"""
FastAPI application: document classification pipeline API.
"""
import uuid
import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, File, UploadFile, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

from db.client import get_supabase
from models.schemas import DocumentResult, DocumentStatus, FeedbackRequest, MemoryStore, UploadResponse
from graph.workflow import get_graph
from services.memory_service import (
    store_correction,
    upsert_template,
    record_confidence,
    upsert_pattern,
    get_all_memory,
)

load_dotenv()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Warm up the LangGraph compilation on startup
    get_graph()
    yield


app = FastAPI(
    title="Intelligent Document Classifier",
    description="LangGraph-powered document classification and field extraction API",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Background processing task
# ---------------------------------------------------------------------------
async def process_document(document_id: str, file_bytes: bytes, filename: str):
    sb = get_supabase()
    graph = get_graph()

    try:
        # Mark as processing
        sb.table("documents").update({"status": "processing"}).eq("id", document_id).execute()

        # Build initial state
        initial_state = {
            "document_id": document_id,
            "file_name": filename,
            "file_bytes": file_bytes,
            "file_type": "",
            "raw_text": "",
            "cleaned_text": "",
            "document_type": "",
            "classification_confidence": 0.0,
            "classification_reasoning": "",
            "memories": {},
            "rag_context": [],
            "extracted_fields": {},
            "validation_results": {},
            "confidence_score": 0.0,
            "ocr_score": 0.0,
            "retrieval_score": 0.0,
            "grounding_score": 0.0,
            "validation_score": 0.0,
            "final_output": {},
            "pipeline_steps": [],
            "errors": [],
        }

        # Run pipeline (LangGraph is synchronous; run in thread pool)
        logger.info("Running pipeline for document %s (%s)", document_id, filename)
        loop = asyncio.get_running_loop()
        final_state = await loop.run_in_executor(None, lambda: graph.invoke(initial_state))
        logger.info("Pipeline complete for %s, type=%s, confidence=%.2f",
                    document_id, final_state.get("document_type"), final_state.get("confidence_score", 0))

        # Persist results
        sb.table("documents").update({
            "status": "completed",
            "raw_text": final_state.get("raw_text", "")[:50000],
            "file_type": final_state.get("file_type", ""),
            "document_type": final_state.get("document_type", "other"),
            "classification_confidence": final_state.get("classification_confidence", 0),
            "extracted_fields": final_state.get("extracted_fields", {}),
            "validation_results": final_state.get("validation_results", {}),
            "confidence_score": final_state.get("confidence_score", 0),
            "final_output": final_state.get("final_output", {}),
            "pipeline_steps": final_state.get("pipeline_steps", []),
        }).eq("id", document_id).execute()

        # Update memory
        doc_type = final_state.get("document_type", "other")
        confidence = final_state.get("confidence_score", 0)
        fields = final_state.get("extracted_fields", {})

        record_confidence(document_id, doc_type, confidence)
        if fields:
            upsert_template(doc_type, {k: type(v).__name__ for k, v in fields.items()})

    except Exception as e:
        error_msg = str(e)
        logger.error("Pipeline failed for %s: %s", document_id, error_msg, exc_info=True)
        sb.table("documents").update({
            "status": "failed",
            "error_message": error_msg[:1000],
        }).eq("id", document_id).execute()


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------
@app.get("/api/health")
def health():
    return {"status": "ok", "service": "document-classifier"}


@app.post("/api/upload", response_model=UploadResponse)
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
):
    allowed_types = {
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/msword",
        "text/plain",
        "text/csv",
        "image/png",
        "image/jpeg",
        "image/tiff",
        "image/bmp",
    }
    if file.content_type and file.content_type not in allowed_types:
        if not file.filename.lower().endswith((".pdf", ".docx", ".doc", ".txt", ".csv", ".png", ".jpg", ".jpeg", ".tiff", ".bmp")):
            raise HTTPException(status_code=400, detail=f"Unsupported file type: {file.content_type}")

    file_bytes = await file.read()
    if len(file_bytes) > 20 * 1024 * 1024:  # 20MB limit
        raise HTTPException(status_code=400, detail="File too large (max 20MB)")

    document_id = str(uuid.uuid4())
    sb = get_supabase()

    # Insert pending record
    sb.table("documents").insert({
        "id": document_id,
        "file_name": file.filename,
        "file_size": len(file_bytes),
        "file_type": file.content_type or "",
        "status": "pending",
        "pipeline_steps": [],
    }).execute()

    logger.info("Queued document %s (%s, %d bytes)", document_id, file.filename, len(file_bytes))
    background_tasks.add_task(process_document, document_id, file_bytes, file.filename)

    return UploadResponse(document_id=document_id, message="Document uploaded and processing started")


@app.get("/api/documents/{document_id}/status", response_model=DocumentStatus)
def get_document_status(document_id: str):
    sb = get_supabase()
    result = sb.table("documents").select(
        "id, file_name, status, document_type, classification_confidence, confidence_score, pipeline_steps, created_at"
    ).eq("id", document_id).execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Document not found")

    return DocumentStatus(**result.data[0])


@app.get("/api/documents/{document_id}", response_model=DocumentResult)
def get_document(document_id: str):
    sb = get_supabase()
    result = sb.table("documents").select("*").eq("id", document_id).execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Document not found")

    return DocumentResult(**result.data[0])


@app.get("/api/documents", response_model=list[DocumentResult])
def list_documents(limit: int = 50, offset: int = 0):
    sb = get_supabase()
    result = sb.table("documents").select(
        "id, file_name, file_type, status, document_type, classification_confidence, confidence_score, created_at, user_feedback"
    ).order("created_at", desc=True).range(offset, offset + limit - 1).execute()
    return [DocumentResult(**d) for d in (result.data or [])]


@app.post("/api/documents/{document_id}/feedback")
def submit_feedback(document_id: str, body: FeedbackRequest):
    sb = get_supabase()

    # Fetch document
    doc = sb.table("documents").select("document_type, confidence_score").eq("id", document_id).execute()
    if not doc.data:
        raise HTTPException(status_code=404, detail="Document not found")

    doc_data = doc.data[0]
    doc_type = doc_data.get("document_type", "other")
    confidence = doc_data.get("confidence_score", 0)
    was_approved = body.feedback == "approved"

    # Update document
    sb.table("documents").update({
        "user_feedback": body.feedback,
        "feedback_corrections": body.corrections,
    }).eq("id", document_id).execute()

    # Update memory
    record_confidence(document_id, doc_type, confidence, was_approved)

    if body.corrections:
        store_correction(document_id, doc_type, body.corrections)
        for field, value in body.corrections.items():
            upsert_pattern(doc_type, field, str(value))

    return {"message": "Feedback recorded", "document_id": document_id}


@app.get("/api/memory", response_model=MemoryStore)
def get_memory():
    data = get_all_memory()
    return MemoryStore(**data)


@app.delete("/api/documents/{document_id}")
def delete_document(document_id: str):
    sb = get_supabase()
    sb.table("documents").delete().eq("id", document_id).execute()
    return {"message": "Document deleted"}
