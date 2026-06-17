from pydantic import BaseModel
from typing import Any, Optional
from datetime import datetime


class DocumentStatus(BaseModel):
    id: str
    file_name: str
    status: str
    document_type: Optional[str] = None
    classification_confidence: Optional[float] = None
    confidence_score: Optional[float] = None
    pipeline_steps: list[dict] = []
    created_at: Optional[str] = None


class DocumentResult(BaseModel):
    id: str
    file_name: str
    file_type: Optional[str] = None
    status: str
    raw_text: Optional[str] = None
    document_type: Optional[str] = None
    classification_confidence: Optional[float] = None
    extracted_fields: dict[str, Any] = {}
    validation_results: dict[str, Any] = {}
    confidence_score: Optional[float] = None
    final_output: dict[str, Any] = {}
    pipeline_steps: list[dict] = []
    error_message: Optional[str] = None
    user_feedback: Optional[str] = None
    feedback_corrections: dict[str, Any] = {}
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class FeedbackRequest(BaseModel):
    feedback: str  # "approved" | "edited" | "rejected"
    corrections: dict[str, Any] = {}


class MemoryStore(BaseModel):
    corrections: list[dict] = []
    templates: list[dict] = []
    patterns: list[dict] = []
    confidence_history: list[dict] = []
    knowledge_base: list[dict] = []


class UploadResponse(BaseModel):
    document_id: str
    message: str
