
-- Documents table: stores uploaded documents and their processing results
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name TEXT NOT NULL,
  file_size INTEGER,
  file_type TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  raw_text TEXT,
  document_type TEXT,
  classification_confidence FLOAT,
  extracted_fields JSONB DEFAULT '{}',
  validation_results JSONB DEFAULT '{}',
  confidence_score FLOAT,
  final_output JSONB DEFAULT '{}',
  pipeline_steps JSONB DEFAULT '[]',
  error_message TEXT,
  user_feedback TEXT CHECK (user_feedback IN ('approved', 'edited', 'rejected', NULL)),
  feedback_corrections JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Memory corrections: user-provided corrections for future learning
CREATE TABLE memory_corrections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL,
  field_name TEXT NOT NULL,
  original_value TEXT,
  corrected_value TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Memory templates: learned document templates per type
CREATE TABLE memory_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_type TEXT NOT NULL,
  template_fields JSONB NOT NULL DEFAULT '{}',
  usage_count INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Memory patterns: extracted field patterns per document type
CREATE TABLE memory_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_type TEXT NOT NULL,
  pattern_name TEXT NOT NULL,
  pattern_value TEXT NOT NULL,
  confidence FLOAT DEFAULT 1.0,
  occurrence_count INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Confidence history: historical confidence tracking
CREATE TABLE memory_confidence_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL,
  confidence_score FLOAT NOT NULL,
  was_approved BOOLEAN,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Domain knowledge base for RAG
CREATE TABLE knowledge_base (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_type TEXT NOT NULL,
  field_name TEXT NOT NULL,
  description TEXT NOT NULL,
  examples JSONB DEFAULT '[]',
  extraction_hints JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE memory_corrections ENABLE ROW LEVEL SECURITY;
ALTER TABLE memory_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE memory_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE memory_confidence_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_base ENABLE ROW LEVEL SECURITY;

-- Public access policies (no auth required for this app)
CREATE POLICY "public_select_documents" ON documents FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "public_insert_documents" ON documents FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "public_update_documents" ON documents FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "public_delete_documents" ON documents FOR DELETE TO anon, authenticated USING (true);

CREATE POLICY "public_select_corrections" ON memory_corrections FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "public_insert_corrections" ON memory_corrections FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "public_update_corrections" ON memory_corrections FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "public_delete_corrections" ON memory_corrections FOR DELETE TO anon, authenticated USING (true);

CREATE POLICY "public_select_templates" ON memory_templates FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "public_insert_templates" ON memory_templates FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "public_update_templates" ON memory_templates FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "public_delete_templates" ON memory_templates FOR DELETE TO anon, authenticated USING (true);

CREATE POLICY "public_select_patterns" ON memory_patterns FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "public_insert_patterns" ON memory_patterns FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "public_update_patterns" ON memory_patterns FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "public_delete_patterns" ON memory_patterns FOR DELETE TO anon, authenticated USING (true);

CREATE POLICY "public_select_confidence" ON memory_confidence_history FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "public_insert_confidence" ON memory_confidence_history FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "public_update_confidence" ON memory_confidence_history FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "public_delete_confidence" ON memory_confidence_history FOR DELETE TO anon, authenticated USING (true);

CREATE POLICY "public_select_knowledge" ON knowledge_base FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "public_insert_knowledge" ON knowledge_base FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "public_update_knowledge" ON knowledge_base FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "public_delete_knowledge" ON knowledge_base FOR DELETE TO anon, authenticated USING (true);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER documents_updated_at BEFORE UPDATE ON documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER templates_updated_at BEFORE UPDATE ON memory_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Seed knowledge base with domain knowledge
INSERT INTO knowledge_base (document_type, field_name, description, examples, extraction_hints) VALUES
('invoice', 'invoice_number', 'Unique identifier for the invoice', '["INV-001", "2024-0123", "IV-98765"]', '["Look for patterns like INV-, Invoice No., #", "Usually near the top of document"]'),
('invoice', 'vendor_name', 'Name of the company issuing the invoice', '["Acme Corp", "TechSupplies Ltd"]', '["Look for company name in header or From: field", "May appear above address block"]'),
('invoice', 'total_amount', 'Total amount due', '["$1,250.00", "USD 500", "1000.00"]', '["Look for Total, Amount Due, Grand Total", "Usually near bottom of document"]'),
('invoice', 'due_date', 'Payment due date', '["2024-03-15", "March 15 2024", "Net 30"]', '["Look for Due Date, Payment Due, Terms"]'),
('invoice', 'line_items', 'Individual items billed', '["[{\"description\": \"Widget A\", \"qty\": 2, \"price\": 100}]"]', '["Table structure with qty, description, unit price"]'),
('contract', 'parties', 'Parties involved in the contract', '["Party A: John Doe, Party B: Jane Smith"]', '["Look for between, hereinafter referred to as"]'),
('contract', 'effective_date', 'Date contract takes effect', '["January 1, 2024", "2024-01-01"]', '["Effective Date, Commencement Date, Start Date"]'),
('contract', 'termination_date', 'Contract end date', '["December 31, 2024"]', '["Termination, Expiry, End Date, Valid Until"]'),
('contract', 'governing_law', 'Legal jurisdiction', '["State of California", "New York law"]', '["Governing Law, Jurisdiction, Applicable Law"]'),
('resume', 'name', 'Full name of candidate', '["John Smith", "Jane Doe"]', '["Usually first line or header of document"]'),
('resume', 'email', 'Contact email address', '["john@example.com"]', '["Look for @ symbol, Email:"]'),
('resume', 'skills', 'Technical and soft skills', '["Python, JavaScript, React"]', '["Skills section, Technical Proficiencies"]'),
('resume', 'experience', 'Work experience', '["Software Engineer at Google 2020-2024"]', '["Experience, Work History, Employment"]'),
('report', 'title', 'Report title', '["Q4 2024 Financial Report"]', '["Title page, header, first heading"]'),
('report', 'summary', 'Executive summary', '["This report covers..."]', '["Executive Summary, Abstract, Overview"]'),
('report', 'date', 'Report date', '["December 2024", "2024-12"]', '["Date, Published, Report Date"]');
