"""
LangGraph nodes for the document classifier pipeline.
Confidence formula:
  FinalConfidence = 0.25×OCR + 0.25×Retrieval + 0.30×Grounding + 0.20×Validation
"""
import json
import os
import re
from typing import Any

from langchain_openai import AzureChatOpenAI, ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage

from graph.state import DocumentState
from services.document_parser import extract_text, clean_text, truncate_for_llm
from services.memory_service import retrieve_memory, get_knowledge_base


def _llm() -> AzureChatOpenAI:
    AZURE_OPENAI_API_KEY = os.getenv(
        "AZURE_OPENAI_API_KEY"
      
    )
    AZURE_OPENAI_ENDPOINT = os.getenv(
        "AZURE_OPENAI_ENDPOINT"
    )
    AZURE_OPENAI_DEPLOYMENT_ID = os.getenv("AZURE_OPENAI_DEPLOYMENT_ID")
    AZURE_OPENAI_API_VERSION = os.getenv("AZURE_OPENAI_API_VERSION")
    return AzureChatOpenAI(
        azure_endpoint=AZURE_OPENAI_ENDPOINT,
        api_key=AZURE_OPENAI_API_KEY,
        model=AZURE_OPENAI_DEPLOYMENT_ID,
        api_version=AZURE_OPENAI_API_VERSION,
        temperature=0.1,
        max_tokens=4000,
    )


def _step(name: str, status: str, output: Any = None, error: str | None = None) -> dict:
    return {"name": name, "status": status, "output": output, "error": error}


def _compute_ocr_score(raw_text: str, file_type: str) -> float:
    """Estimate OCR / text-extraction quality (0–1)."""
    if not raw_text or not raw_text.strip():
        return 0.10

    text_len = len(raw_text.strip())

    # Length heuristic
    if text_len >= 2000:
        length_score = 1.00
    elif text_len >= 1000:
        length_score = 0.90
    elif text_len >= 500:
        length_score = 0.80
    elif text_len >= 200:
        length_score = 0.65
    elif text_len >= 50:
        length_score = 0.45
    else:
        length_score = 0.20

    # Character quality — ratio of printable, meaningful characters
    meaningful = sum(
        1 for c in raw_text
        if c.isalnum() or c.isspace() or c in '.,;:!?-_()[]{}@#$%&*/\\\'"'
    )
    quality_ratio = meaningful / max(len(raw_text), 1)

    # File-type factor (native text > scanned image)
    ft = file_type.lower()
    if any(k in ft for k in ('pdf', 'text', 'plain', 'csv')):
        type_factor = 1.00
    elif any(k in ft for k in ('word', 'docx', 'doc')):
        type_factor = 0.95
    elif any(k in ft for k in ('image', 'png', 'jpg', 'jpeg', 'tiff', 'bmp')):
        type_factor = 0.80  # OCR may introduce errors
    else:
        type_factor = 0.90

    score = length_score * 0.55 + quality_ratio * 0.30 + type_factor * 0.15
    return round(min(1.0, max(0.0, score)), 3)


def _compute_retrieval_score(rag_context: list, memories: dict) -> float:
    """Estimate retrieval quality — how much relevant context was found (0–1)."""
    kb_count = len(rag_context)

    # KB coverage score
    if kb_count >= 30:
        kb_score = 1.00
    elif kb_count >= 20:
        kb_score = 0.90
    elif kb_count >= 10:
        kb_score = 0.80
    elif kb_count >= 5:
        kb_score = 0.65
    elif kb_count >= 1:
        kb_score = 0.45
    else:
        kb_score = 0.20  # doc type has no KB entries

    # Memory bonus — prior corrections and patterns give context
    memory_records = sum(len(v) for v in memories.values() if isinstance(v, list))
    memory_bonus = min(0.15, memory_records * 0.015)

    return round(min(1.0, kb_score + memory_bonus), 3)


# ---------------------------------------------------------------------------
# Node 1: Preprocessing — computes ocr_score
# ---------------------------------------------------------------------------
def preprocess_node(state: DocumentState) -> dict:
    step_name = "Preprocessing"
    try:
        raw_text, file_type = extract_text(state["file_bytes"], state["file_name"])
        cleaned = clean_text(raw_text)
        ocr_score = _compute_ocr_score(raw_text, file_type)
        return {
            "raw_text": raw_text,
            "cleaned_text": cleaned,
            "file_type": file_type,
            "ocr_score": ocr_score,
            "pipeline_steps": [_step(step_name, "completed",
                f"Extracted {len(cleaned)} chars ({file_type}) · OCR score: {ocr_score:.0%}")],
        }
    except Exception as e:
        return {
            "raw_text": "",
            "cleaned_text": "",
            "file_type": "unknown",
            "ocr_score": 0.0,
            "errors": [f"Preprocessing failed: {e}"],
            "pipeline_steps": [_step(step_name, "failed", error=str(e))],
        }


# ---------------------------------------------------------------------------
# Node 2: Classification — classification_confidence serves as grounding_score
# ---------------------------------------------------------------------------
def classify_node(state: DocumentState) -> dict:
    step_name = "Classification"
    text_snippet = state.get("cleaned_text", "")

    system_prompt = """You are an expert document classifier. Analyze the provided text and classify the document.

Return a JSON object with:
{
  "document_type": "<type>",
  "confidence": <0.0-1.0>,
  "reasoning": "<brief explanation>"
}

Supported types:
- invoice: Bills, purchase orders, commercial invoices, lab/medical bills with invoice number
- contract: Agreements, NDAs, terms and conditions, legal documents
- resume: CV, curriculum vitae, job applications
- report: Business reports, financial reports, research papers, analysis documents
- letter: Correspondence, memos, emails, formal letters
- form: Applications, questionnaires, registration forms
- receipt: Transaction receipts, payment confirmations, point-of-sale receipts
- claims_document: Insurance claim documents, claim closing advice, CDR reports, loss notifications, claim review documents
- medical_bill: Medical lab invoices, diagnostic bills, hospital bills of supply, scan bills, healthcare service bills
- medical_report: Clinical visit notes, encounter summaries, physician progress notes, discharge summaries, medical records
- other: Anything that does not fit above categories

Only return valid JSON, nothing else."""

    try:
        llm = _llm()
        response = llm.invoke([
            SystemMessage(content=system_prompt),
            HumanMessage(content=f"Document text:\n\n{text_snippet}"),
        ])
        print(f"Classification node : {system_prompt}")
        content = response.content.strip()
        content = re.sub(r"^```(?:json)?\s*", "", content)
        content = re.sub(r"\s*```$", "", content)
        data = json.loads(content)
        doc_type = data.get("document_type", "other")
        confidence = float(data.get("confidence", 0.5))
        reasoning = data.get("reasoning", "")
        return {
            "document_type": doc_type,
            "classification_confidence": confidence,
            "grounding_score": confidence,  # grounding = how well model understands the doc
            "classification_reasoning": reasoning,
            "pipeline_steps": [_step(step_name, "completed",
                f"Type: {doc_type} ({confidence:.0%} confidence) · Grounding: {confidence:.0%}")],
        }
    except Exception as e:
        return {
            "document_type": "other",
            "classification_confidence": 0.3,
            "grounding_score": 0.3,
            "classification_reasoning": "Classification failed",
            "errors": [f"Classification failed: {e}"],
            "pipeline_steps": [_step(step_name, "failed", error=str(e))],
        }


# ---------------------------------------------------------------------------
# Node 3: Memory Retrieval
# ---------------------------------------------------------------------------
def memory_retrieval_node(state: DocumentState) -> dict:
    step_name = "Memory Retrieval"
    doc_type = state.get("document_type", "other")
    try:
        memories = retrieve_memory(doc_type)
        total = sum(len(v) for v in memories.values() if isinstance(v, list))
        return {
            "memories": memories,
            "pipeline_steps": [_step(step_name, "completed", f"Loaded {total} memory records")],
        }
    except Exception as e:
        return {
            "memories": {},
            "errors": [f"Memory retrieval failed: {e}"],
            "pipeline_steps": [_step(step_name, "failed", error=str(e))],
        }


# ---------------------------------------------------------------------------
# Node 4: RAG / Domain Knowledge Retrieval — computes retrieval_score
# ---------------------------------------------------------------------------
def rag_retrieval_node(state: DocumentState) -> dict:
    step_name = "Domain Knowledge (RAG)"
    doc_type = state.get("document_type", "other")
    memories = state.get("memories", {})
    try:
        kb_entries = get_knowledge_base(doc_type)
        context = []
        for entry in kb_entries:
            context.append({
                "field": entry["field_name"],
                "description": entry["description"],
                "examples": entry.get("examples", []),
                "hints": entry.get("extraction_hints", []),
                "is_required": bool(entry.get("is_required", False)),
            })
        retrieval_score = _compute_retrieval_score(context, memories)
        return {
            "rag_context": context,
            "retrieval_score": retrieval_score,
            "pipeline_steps": [_step(step_name, "completed",
                f"Retrieved {len(context)} KB entries · Retrieval score: {retrieval_score:.0%}")],
        }
    except Exception as e:
        return {
            "rag_context": [],
            "retrieval_score": 0.2,
            "errors": [f"RAG retrieval failed: {e}"],
            "pipeline_steps": [_step(step_name, "failed", error=str(e))],
        }


# ---------------------------------------------------------------------------
# Node 5: Field Extraction — KB fields are reference, extract everything
# ---------------------------------------------------------------------------
def extraction_node(state: DocumentState) -> dict:
    step_name = "Field Extraction"
    doc_type = state.get("document_type", "other")
    text = state.get("cleaned_text", "")
    rag_context = state.get("rag_context", [])
    memories = state.get("memories", {})

    # Build reference field sections (required vs optional) from KB
    required_ref = ""
    optional_ref = ""
    if rag_context:
        req = [f for f in rag_context if f.get("is_required", False)]
        opt = [f for f in rag_context if not f.get("is_required", False)]
        if req:
            required_ref = "\nKnown REQUIRED fields for this document type (prioritize these):\n"
            for f in req:
                hints_str = ""
                if f.get("hints") and isinstance(f["hints"], list):
                    hints_str = f" [hints: {'; '.join(str(h) for h in f['hints'][:2])}]"
                required_ref += f"  • {f['field']}: {f['description']}{hints_str}\n"
        if opt:
            optional_ref = "\nKnown optional fields (extract if present):\n"
            for f in opt[:25]:
                optional_ref += f"  • {f['field']}: {f['description']}\n"

    # User-specified fields and past corrections from memory
    user_required_context = ""
    correction_context = ""
    if memories.get("corrections"):
        req_mem, corr_mem = [], []
        for c in memories["corrections"][:20]:
            fn = c.get("field_name", "")
            cv = (c.get("corrected_value") or "").strip()
            (req_mem if cv.startswith("REQUIRED") else corr_mem).append(
                (fn, cv[len("REQUIRED"):].lstrip(": ").strip() if cv.startswith("REQUIRED") else cv)
            )
        if req_mem:
            user_required_context = "\nUser-specified additional required fields:\n"
            for fn, hint in req_mem:
                user_required_context += f"  • {fn}" + (f": {hint}" if hint else "") + "\n"
        if corr_mem:
            correction_context = "\nPast user corrections:\n"
            for fn, cv in corr_mem[:5]:
                correction_context += f"  • {fn}: was corrected to '{cv}'\n"

    system_prompt = f"""You are an expert document data extractor.

IMPORTANT: Extract ALL meaningful information from the document — do not limit yourself to the reference fields listed below. The known fields are hints to help you, but you must also capture any additional information present in the document.

Document type: {doc_type}
{required_ref}
{optional_ref}
{user_required_context}
{correction_context}

Extraction rules:
- Extract every meaningful field present in the document
- For REQUIRED fields: set to null only if absolutely not present
- For all other fields: include anything that adds value
- Currency amounts: include symbol and format (e.g. "USD 5,500.00")
- Dates: use ISO format (YYYY-MM-DD) where possible
- Lists of items (line items, diagnoses, medications, etc.): use arrays
- Do not fabricate values — only extract what is clearly stated
- Use snake_case for field names you invent

Return a single flat JSON object. Only return valid JSON."""

    try:
        llm = _llm()
        response = llm.invoke([
            SystemMessage(content=system_prompt),
            HumanMessage(content=f"Document text:\n\n{text}"),
        ])
        print(f"Extraction node : {system_prompt}")
        content = response.content.strip()
        content = re.sub(r"^```(?:json)?\s*", "", content)
        content = re.sub(r"\s*```$", "", content)
        fields = json.loads(content)
        return {
            "extracted_fields": fields,
            "pipeline_steps": [_step(step_name, "completed", f"Extracted {len(fields)} fields")],
        }
    except Exception as e:
        return {
            "extracted_fields": {},
            "errors": [f"Extraction failed: {e}"],
            "pipeline_steps": [_step(step_name, "failed", error=str(e))],
        }


# ---------------------------------------------------------------------------
# Node 6: Validation & Confidence Scoring
# Formula: FinalConfidence = 0.25×OCR + 0.25×Retrieval + 0.30×Grounding + 0.20×Validation
# ---------------------------------------------------------------------------
def _field_present(value: Any) -> bool:
    if value is None:
        return False
    if isinstance(value, str) and value.strip() == "":
        return False
    if isinstance(value, list) and len(value) == 0:
        return False
    return True


def validation_node(state: DocumentState) -> dict:
    step_name = "Validation & Confidence Scoring"
    fields = state.get("extracted_fields", {})
    rag_context = state.get("rag_context", [])

    # Pull intermediate scores from state
    ocr_score = float(state.get("ocr_score", 0.5))
    retrieval_score = float(state.get("retrieval_score", 0.5))
    grounding_score = float(state.get("grounding_score", state.get("classification_confidence", 0.5)))

    # Required field names from knowledge base
    required_field_names: set[str] = {f["field"] for f in rag_context if f.get("is_required", False)}

    validation: dict[str, Any] = {
        "field_scores": {},
        "field_status": {},
        "missing_required": [],
        "warnings": [],
    }

    weighted_sum = 0.0
    weighted_total = 0.0

    for field, value in fields.items():
        present = _field_present(value)
        is_required = field in required_field_names
        weight = 2.0 if is_required else 1.0
        conf = 1.0 if present else 0.0

        weighted_sum += conf * weight
        weighted_total += weight
        validation["field_scores"][field] = conf

        if is_required and present:
            validation["field_status"][field] = "required_extracted"
        elif is_required and not present:
            validation["field_status"][field] = "required_missing"
            validation["missing_required"].append(field)
        elif not is_required and present:
            validation["field_status"][field] = "optional_extracted"
        else:
            validation["field_status"][field] = "optional_missing"

    # Account for required KB fields that weren't extracted at all
    for f in rag_context:
        fn = f["field"]
        if f.get("is_required", False) and fn not in fields:
            validation["missing_required"].append(fn)
            validation["field_status"][fn] = "required_missing"
            validation["field_scores"][fn] = 0.0
            weighted_total += 2.0  # weighted_sum += 0

    # Validation score: weighted ratio
    validation_score = round(weighted_sum / weighted_total, 3) if weighted_total > 0 else 0.5

    # ── Final confidence formula ──────────────────────────────────────────────
    final_confidence = round(
        0.25 * ocr_score
        + 0.25 * retrieval_score
        + 0.30 * grounding_score
        + 0.20 * validation_score,
        3,
    )
    final_confidence = max(0.0, min(1.0, final_confidence))

    # Store score breakdown inside validation_results for frontend use
    validation["score_breakdown"] = {
        "ocr":        round(ocr_score, 3),
        "retrieval":  round(retrieval_score, 3),
        "grounding":  round(grounding_score, 3),
        "validation": round(validation_score, 3),
        "weights":    {"ocr": 0.25, "retrieval": 0.25, "grounding": 0.30, "validation": 0.20},
    }

    if validation["missing_required"]:
        preview = ", ".join(validation["missing_required"][:5])
        extra = f" (+{len(validation['missing_required']) - 5} more)" if len(validation["missing_required"]) > 5 else ""
        validation["warnings"].append(f"Missing required fields: {preview}{extra}")

    req_ok  = sum(1 for s in validation["field_status"].values() if s == "required_extracted")
    req_tot = sum(1 for s in validation["field_status"].values() if s.startswith("required"))
    opt_ok  = sum(1 for s in validation["field_status"].values() if s == "optional_extracted")

    return {
        "validation_results": validation,
        "validation_score":   validation_score,
        "confidence_score":   final_confidence,
        "pipeline_steps": [_step(step_name, "completed",
            f"Final: {final_confidence:.0%} "
            f"[OCR {ocr_score:.0%} · Ret {retrieval_score:.0%} · "
            f"Gnd {grounding_score:.0%} · Val {validation_score:.0%}] "
            f"| Req: {req_ok}/{req_tot} · Opt: {opt_ok} extracted")],
    }


# ---------------------------------------------------------------------------
# Node 7: Final Output Assembly
# ---------------------------------------------------------------------------
def output_node(state: DocumentState) -> dict:
    step_name = "Final Output"
    output = {
        "document_id": state["document_id"],
        "file_name": state["file_name"],
        "document_type": state.get("document_type", "other"),
        "classification": {
            "type": state.get("document_type", "other"),
            "confidence": state.get("classification_confidence", 0),
            "reasoning": state.get("classification_reasoning", ""),
        },
        "extracted_fields": state.get("extracted_fields", {}),
        "validation": state.get("validation_results", {}),
        "confidence_breakdown": {
            "ocr_score":        state.get("ocr_score", 0),
            "retrieval_score":  state.get("retrieval_score", 0),
            "grounding_score":  state.get("grounding_score", 0),
            "validation_score": state.get("validation_score", 0),
            "final_score":      state.get("confidence_score", 0),
        },
        "overall_confidence": state.get("confidence_score", 0),
        "memory_context": {
            "corrections_applied": len(state.get("memories", {}).get("corrections", [])),
            "rag_entries_used": len(state.get("rag_context", [])),
        },
    }
    return {
        "final_output": output,
        "pipeline_steps": [_step(step_name, "completed", "Structured JSON output ready")],
    }
