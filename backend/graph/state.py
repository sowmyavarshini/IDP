from typing import Any, TypedDict, Annotated
import operator


class PipelineStep(TypedDict):
    name: str
    status: str  # "pending" | "running" | "completed" | "failed"
    output: Any
    error: str | None


def merge_steps(existing: list, new: list) -> list:
    """Merge pipeline step updates by name."""
    merged = {s["name"]: s for s in existing}
    for step in new:
        merged[step["name"]] = step
    return list(merged.values())


class DocumentState(TypedDict):
    document_id: str
    file_name: str
    file_bytes: bytes
    file_type: str

    # Preprocessing
    raw_text: str
    cleaned_text: str

    # Classification
    document_type: str
    classification_confidence: float
    classification_reasoning: str

    # Memory
    memories: dict[str, Any]

    # RAG
    rag_context: list[dict]

    # Extraction
    extracted_fields: dict[str, Any]

    # Validation & confidence components
    validation_results: dict[str, Any]
    confidence_score: float
    ocr_score: float
    retrieval_score: float
    grounding_score: float
    validation_score: float

    # Output
    final_output: dict[str, Any]

    # Tracking
    pipeline_steps: Annotated[list[PipelineStep], merge_steps]
    errors: list[str]
