"""
Memory service: reads from and writes to the long-term memory store in Supabase.
"""
from db.client import get_supabase


def retrieve_memory(document_type: str | None = None) -> dict:
    """Fetch relevant memories for a given document type."""
    sb = get_supabase()
    result = {"corrections": [], "templates": [], "patterns": [], "confidence_history": []}

    try:
        corrections_q = sb.table("memory_corrections").select("*").order("created_at", desc=True).limit(50)
        if document_type:
            corrections_q = corrections_q.eq("document_type", document_type)
        result["corrections"] = corrections_q.execute().data or []
    except Exception:
        pass

    try:
        templates_q = sb.table("memory_templates").select("*").order("usage_count", desc=True).limit(20)
        if document_type:
            templates_q = templates_q.eq("document_type", document_type)
        result["templates"] = templates_q.execute().data or []
    except Exception:
        pass

    try:
        patterns_q = sb.table("memory_patterns").select("*").order("occurrence_count", desc=True).limit(50)
        if document_type:
            patterns_q = patterns_q.eq("document_type", document_type)
        result["patterns"] = patterns_q.execute().data or []
    except Exception:
        pass

    try:
        conf_q = sb.table("memory_confidence_history").select("*").order("created_at", desc=True).limit(100)
        if document_type:
            conf_q = conf_q.eq("document_type", document_type)
        result["confidence_history"] = conf_q.execute().data or []
    except Exception:
        pass

    return result


def get_knowledge_base(document_type: str | None = None) -> list[dict]:
    """Retrieve domain knowledge base entries."""
    sb = get_supabase()
    try:
        q = sb.table("knowledge_base").select("*")
        if document_type:
            q = q.eq("document_type", document_type)
        return q.execute().data or []
    except Exception:
        return []


def store_correction(document_id: str, document_type: str, corrections: dict) -> None:
    """Persist user corrections to memory."""
    sb = get_supabase()
    rows = []
    for field_name, corrected_value in corrections.items():
        rows.append({
            "document_id": document_id,
            "document_type": document_type,
            "field_name": field_name,
            "corrected_value": str(corrected_value),
        })
    if rows:
        try:
            sb.table("memory_corrections").insert(rows).execute()
        except Exception:
            pass


def upsert_template(document_type: str, fields: dict) -> None:
    """Update or create a document template."""
    sb = get_supabase()
    try:
        existing = sb.table("memory_templates").select("id, usage_count").eq("document_type", document_type).execute().data
        if existing:
            sb.table("memory_templates").update({
                "template_fields": fields,
                "usage_count": existing[0]["usage_count"] + 1,
            }).eq("id", existing[0]["id"]).execute()
        else:
            sb.table("memory_templates").insert({
                "document_type": document_type,
                "template_fields": fields,
                "usage_count": 1,
            }).execute()
    except Exception:
        pass


def record_confidence(document_id: str, document_type: str, confidence: float, was_approved: bool | None = None) -> None:
    """Record confidence score history."""
    sb = get_supabase()
    try:
        sb.table("memory_confidence_history").insert({
            "document_id": document_id,
            "document_type": document_type,
            "confidence_score": confidence,
            "was_approved": was_approved,
        }).execute()
    except Exception:
        pass


def upsert_pattern(document_type: str, pattern_name: str, pattern_value: str, confidence: float = 1.0) -> None:
    """Upsert an extraction pattern."""
    sb = get_supabase()
    try:
        existing = sb.table("memory_patterns").select("id, occurrence_count").eq("document_type", document_type).eq("pattern_name", pattern_name).execute().data
        if existing:
            sb.table("memory_patterns").update({
                "pattern_value": pattern_value,
                "confidence": confidence,
                "occurrence_count": existing[0]["occurrence_count"] + 1,
            }).eq("id", existing[0]["id"]).execute()
        else:
            sb.table("memory_patterns").insert({
                "document_type": document_type,
                "pattern_name": pattern_name,
                "pattern_value": pattern_value,
                "confidence": confidence,
                "occurrence_count": 1,
            }).execute()
    except Exception:
        pass


def get_all_memory() -> dict:
    """Fetch all memory data for the memory store view."""
    sb = get_supabase()
    result = {
        "corrections": [],
        "templates": [],
        "patterns": [],
        "confidence_history": [],
        "knowledge_base": [],
    }
    for table_key in ["corrections", "templates", "patterns", "knowledge_base"]:
        try:
            tbl = f"memory_{table_key}" if table_key != "knowledge_base" else "knowledge_base"
            result[table_key] = sb.table(tbl).select("*").order("created_at", desc=True).limit(200).execute().data or []
        except Exception:
            pass
    try:
        result["confidence_history"] = sb.table("memory_confidence_history").select("*").order("created_at", desc=True).limit(200).execute().data or []
    except Exception:
        pass
    return result
