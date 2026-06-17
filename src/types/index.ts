export type DocumentStatus = 'pending' | 'processing' | 'completed' | 'failed';
export type FeedbackType = 'approved' | 'edited' | 'rejected';
export type FieldStatus = 'required_extracted' | 'required_missing' | 'optional_extracted' | 'optional_missing';

export interface PipelineStep {
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  output: string | null;
  error: string | null;
}

export interface ValidationResult {
  field_scores: Record<string, number>;
  field_status: Record<string, FieldStatus>;
  missing_required: string[];
  warnings: string[];
}

export interface DocumentResult {
  id: string;
  file_name: string;
  file_type?: string;
  status: DocumentStatus;
  raw_text?: string;
  document_type?: string;
  classification_confidence?: number;
  extracted_fields: Record<string, unknown>;
  validation_results: ValidationResult;
  confidence_score?: number;
  final_output: Record<string, unknown>;
  pipeline_steps: PipelineStep[];
  error_message?: string;
  user_feedback?: FeedbackType;
  feedback_corrections: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}

export interface MemoryStore {
  corrections: MemoryCorrection[];
  templates: MemoryTemplate[];
  patterns: MemoryPattern[];
  confidence_history: ConfidenceEntry[];
  knowledge_base: KnowledgeEntry[];
}

export interface MemoryCorrection {
  id: string;
  document_id: string;
  document_type: string;
  field_name: string;
  original_value?: string;
  corrected_value?: string;
  created_at: string;
}

export interface MemoryTemplate {
  id: string;
  document_type: string;
  template_fields: Record<string, string>;
  usage_count: number;
  created_at: string;
  updated_at: string;
}

export interface MemoryPattern {
  id: string;
  document_type: string;
  pattern_name: string;
  pattern_value: string;
  confidence: number;
  occurrence_count: number;
  created_at: string;
}

export interface ConfidenceEntry {
  id: string;
  document_id: string;
  document_type: string;
  confidence_score: number;
  was_approved?: boolean;
  created_at: string;
}

export interface KnowledgeEntry {
  id: string;
  document_type: string;
  field_name: string;
  description: string;
  examples: string[];
  extraction_hints: string[];
  is_required: boolean;
}
