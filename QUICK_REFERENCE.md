# AccuParse - Quick Reference Guide

## 🎯 Project Overview

**AccuParse** is an intelligent document classifier that:
1. Takes uploaded documents (PDF, DOCX, images, etc.)
2. Classifies them into 11 document types
3. Extracts structured fields using AI
4. Scores extraction confidence
5. Learns from user feedback

---

## 🏗️ High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     User (Frontend)                              │
│                    React/TypeScript UI                           │
└────────────┬──────────────────────────────────────────────┬──────┘
             │ HTTP REST API                               │
             ↓                                             ↓
        ┌─────────────────────────────────────────────────────┐
        │        FastAPI Backend (Python)                      │
        │    • Upload handling                                 │
        │    • Status polling                                  │
        │    • Result retrieval                                │
        │    • Feedback collection                             │
        └────────────────┬─────────────────────────────────────┘
                         │ Background Processing
                         ↓
        ┌─────────────────────────────────────────────────────┐
        │      LangGraph Pipeline (7 Stages)                  │
        │  1. Preprocess   → 2. Classify    → 3. Memory       │
        │  4. RAG/KB       → 5. Extract     → 6. Validate     │
        │  7. Output                                           │
        └──┬──────────────────────┬──────────────────────┬─────┘
           │                      │                      │
           ↓                      ↓                      ↓
    ┌──────────────┐      ┌───────────────┐    ┌────────────────┐
    │   Supabase   │      │  Azure OpenAI │    │  Text Extract  │
    │   PostgreSQL │      │     (LLM)     │    │  (pytesseract) │
    └──────────────┘      └───────────────┘    └────────────────┘
```

---

## 📊 7-Stage Pipeline

| Stage | Input | Process | Output | Confidence Component |
|-------|-------|---------|--------|----------------------|
| **1. Preprocess** | file_bytes | Extract text, clean, score quality | raw_text, cleaned_text | OCR Score (25%) |
| **2. Classify** | cleaned_text | LLM: identify document type | document_type, confidence | Grounding Score (30%) |
| **3. Memory** | document_type | Query user corrections + patterns | memories dict | - |
| **4. RAG/KB** | document_type | Fetch domain knowledge base | rag_context, retrieval_score | Retrieval Score (25%) |
| **5. Extract** | cleaned_text + KB | LLM: extract all fields | extracted_fields | - |
| **6. Validate** | extracted_fields | Check presence, compute scores | validation_results | Validation Score (20%) |
| **7. Output** | all state | Format results, persist to DB | final_output | **Final Score** |

---

## 🧠 Confidence Scoring

**Final Confidence = 0.25×OCR + 0.25×Retrieval + 0.30×Grounding + 0.20×Validation**

### Score Components:
- **OCR (25%)**: Text extraction quality → better text = higher score
- **Retrieval (25%)**: Knowledge base coverage → more context = higher score
- **Grounding (30%)**: Model understanding → LLM confidence in classification
- **Validation (20%)**: Field completeness → required fields present = higher score

### Score Interpretation:
| Score | Status | Action |
|-------|--------|--------|
| 0.85-1.00 | 🟢 High | Auto-approve |
| 0.70-0.84 | 🟡 Good | Review recommended |
| 0.50-0.69 | 🔵 Moderate | Manual review needed |
| 0.30-0.49 | 🟠 Low | Requires corrections |
| <0.30 | 🔴 Very Low | Reject & retry |

---

## 💾 Database Tables

| Table | Purpose | Key Columns |
|-------|---------|------------|
| **documents** | All uploaded docs + results | id, status, document_type, extracted_fields, confidence_score, user_feedback |
| **memory_corrections** | User corrections for learning | document_type, field_name, original_value, corrected_value |
| **memory_templates** | Learned doc templates | document_type, template_fields, usage_count |
| **memory_patterns** | Field patterns | document_type, pattern_name, pattern_value, occurrence_count |
| **memory_confidence_history** | Confidence trends | document_id, confidence_score, was_approved |
| **knowledge_base** | Domain knowledge | document_type, field_name, description, examples, is_required |

---

## 🌊 Data Flow (User Perspective)

```
User Action              API Call                Database          Response
───────────────────────────────────────────────────────────────────────────
1. Upload file    →  POST /api/upload      →  INSERT documents   →  document_id
                     (background starts)       (status='pending')

2. Wait/Poll      →  GET /api/documents/{id}/status  →  SELECT   →  pipeline_steps
                     (every 2 seconds)                           (shows progress)

3. Processing      [Background LangGraph pipeline runs...]
   completes        [7 stages execute sequentially]
                    [Results saved to DB]

4. View results   →  GET /api/documents/{id}    →  SELECT         →  full document
                                                  documents
                                                  + extracted_fields

5. Provide        →  POST /api/documents/{id}/  →  UPDATE          →  confirmation
   feedback          feedback                      documents +
                                                    memory tables
                     (corrections stored)
                     (patterns learned)
```

---

## 🧠 Memory & Learning System

### How It Works:
1. **User provides feedback**: "This field was wrong"
2. **System stores correction**: → `memory_corrections` table
3. **Future processing**: Uses corrections as context hints
4. **Extraction improves**: LLM now knows the pattern

### Memory Types:
- **Corrections**: "This vendor name should be 'Acme Corp'"
- **Templates**: "Invoice has fields: invoice_number, total_amount, ..."
- **Patterns**: "Invoice numbers always start with INV-"
- **Confidence History**: Track if confidence correlates with approval

---

## 📡 API Endpoints Summary

### Upload Document
```
POST /api/upload
Content-Type: multipart/form-data
```
Returns: `{ document_id, message }`

### Check Processing Status
```
GET /api/documents/{document_id}/status
```
Returns: Status + pipeline_steps progress

### Get Full Results
```
GET /api/documents/{document_id}
```
Returns: Complete extraction + confidence score

### List All Documents
```
GET /api/documents?limit=50&offset=0
```
Returns: Array of documents

### Submit Feedback
```
POST /api/documents/{document_id}/feedback
Body: { feedback: "approved"|"edited"|"rejected", corrections: {...} }
```

### Get Memory Store
```
GET /api/memory
```
Returns: All corrections, templates, patterns, confidence history

---

## 🎨 Frontend Structure

```
App.tsx (Main Router)
├── Pages (State-based views)
│   ├── UploadPage      → POST /api/upload
│   ├── ProcessingPage  → GET /api/documents/{id}/status (polling)
│   ├── ResultsPage     → GET /api/documents/{id} → display results
│   ├── HistoryPage     → GET /api/documents?limit=50
│   └── MemoryPage      → GET /api/memory
│
└── UI Components (Reusable)
    ├── Badge           (status indicator)
    ├── ConfidenceBar   (visual score 0-100%)
    ├── JsonViewer      (expandable extracted fields)
    ├── PipelineStatus  (step progress indicator)
    └── Spinner         (loading animation)
```

---

## 📚 Document Types Supported

| Type | Examples | Key Fields |
|------|----------|-----------|
| **invoice** | Bills, purchase orders | invoice_number, vendor, total, due_date, line_items |
| **contract** | Agreements, NDAs | parties, effective_date, termination_date, governing_law |
| **resume** | CVs, job applications | name, email, skills, experience, education |
| **report** | Business/financial reports | title, summary, date, sections |
| **letter** | Correspondence | sender, recipient, date, content |
| **form** | Applications | form_name, fields, submission_date |
| **receipt** | Transactions | transaction_id, date, items, total |
| **claims_document** | Insurance claims | claim_number, date, amount, type |
| **medical_bill** | Hospital bills | patient_name, services, costs |
| **medical_report** | Clinical notes | diagnosis, treatments, medications |
| **other** | Unrecognized | variable |

---

## 🔧 Technology Stack

### Frontend
- React 18 + TypeScript
- Vite (build)
- Tailwind CSS (styling)
- Lucide React (icons)
- Supabase JS Client

### Backend
- FastAPI (REST API)
- Python 3.11+
- LangGraph (pipeline orchestration)
- LangChain (LLM abstractions)
- Azure OpenAI API (GPT model)
- pypdf, python-docx, pytesseract (text extraction)

### Database
- PostgreSQL (Supabase)
- Row-Level Security (RLS)
- JSONB for flexible storage

---

## 🚀 Processing Flow (Detailed)

### Input → File Upload
```
┌─────────────┐
│  File (PDF/ │
│  DOCX/IMG)  │
└──────┬──────┘
       │ 1. POST /api/upload
       ↓
   ┌────────────────┐
   │ FastAPI Server │
   └────────┬───────┘
            │ 2. Save to DB (pending)
            │ 3. Queue background task
            ↓
        ┌──────────┐
        │ Response │──→ Return document_id
        └──────────┘
```

### Background Processing
```
┌─────────────────────┐
│ Background Task     │
│ (process_document)  │
└──────────┬──────────┘
           │ 4. Load file bytes
           ↓
      ┌──────────────────┐
      │  Stage 1: Extract│
      │  text from file  │
      │  (pytesseract)   │
      └────────┬─────────┘
               │ raw_text, ocr_score
               ↓
         ┌─────────────────┐
         │ Stage 2: Classify│
         │ with LLM         │
         │ (Azure OpenAI)   │
         └────────┬────────┘
                  │ document_type, grounding_score
                  ↓
            ┌──────────────────┐
            │ Stage 3-7:       │
            │ Memory → RAG →   │
            │ Extract → Validate│
            │ → Output         │
            └────────┬─────────┘
                     │ final_output, confidence_score
                     ↓
              ┌──────────────────┐
              │ Save to Database │
              │ UPDATE documents │
              │ (status=completed)
              └──────────────────┘
```

### Frontend → Poll Status
```
┌──────────────┐
│ User Views   │──→ ┌────────────────────────┐
│ Processing   │    │ GET /api/documents/id  │
└──────────────┘    │ /status (every 2s)     │
                    └───────────┬────────────┘
                                │
                          ┌─────────────┐
                          │ Check DB    │
                          │ status field│
                          └─────┬───────┘
                                │
                    ┌───────────┴───────────┐
                    │                       │
              pending/processing       completed/failed
                    │                       │
           (show loading)            (show results)
                    │                       │
                Poll again    ┌─────────────────────────┐
                    │         │ Display extracted_fields│
                    └────────→│ + confidence_score      │
                              │ + validation_results    │
                              └─────────────────────────┘
```

---

## ⚙️ Configuration

### Environment Variables (`.env`)
```
AZURE_OPENAI_API_KEY=<your-key>
AZURE_OPENAI_ENDPOINT=<your-endpoint>
AZURE_OPENAI_DEPLOYMENT_ID=<deployment-name>
AZURE_OPENAI_API_VERSION=2024-02-15-preview

SUPABASE_URL=<your-project-url>
SUPABASE_KEY=<your-anon-key>
```

### API Base URL (Frontend)
```
VITE_API_URL=http://localhost:8000
```

---

## 🐛 Common Issues & Solutions

### Issue: "Document stuck in processing"
- **Cause**: Backend error in pipeline
- **Fix**: Check `/api/documents/{id}` for error_message; restart server

### Issue: "Low confidence score"
- **Cause**: Poor document quality or missing KB entries
- **Fix**: Provide corrections → system learns; verify knowledge_base has your doc type

### Issue: "Wrong document classification"
- **Cause**: Insufficient context for LLM
- **Fix**: Provide feedback → system stores as memory; improves next time

### Issue: "Database connection error"
- **Cause**: Supabase credentials or migration issues
- **Fix**: Verify .env; re-run migrations: `supabase db push`

---

## 📈 Performance Notes

| Operation | Typical Time |
|-----------|-------------|
| File upload | <1s |
| Text extraction (small PDF) | 1-2s |
| LLM classification call | 2-4s |
| LLM extraction call | 3-8s |
| Full pipeline (small doc) | 10-20s |
| Full pipeline (large doc/OCR) | 30-60s |

---

## 🎓 Learning From Usage

The system improves through:
1. **User Corrections** → Stored as patterns
2. **Template Usage** → Track which templates are used most
3. **Confidence Tracking** → Learn which confidence scores correlate with approval
4. **Pattern Extraction** → Remember field value patterns

Example: After 10 invoices with "Acme Corp" corrections, future invoices will have hints to find "Acme Corp" patterns automatically.

---

## 📋 Checklist for Understanding

- [ ] Read the **7-stage pipeline** section
- [ ] Understand **confidence scoring formula**
- [ ] Review **database schema** and relationships
- [ ] Study **API endpoints** (upload, status, results, feedback)
- [ ] Trace **user flow** from upload to results
- [ ] Learn **memory system** (how corrections improve extraction)
- [ ] Check **document types** support for your use case
- [ ] Review **technology stack** (tools & libraries used)

---

## 🔗 Key Files to Review

### Backend Core
- `backend/main.py` - FastAPI app, routes, background processing
- `backend/graph/workflow.py` - LangGraph pipeline builder
- `backend/graph/nodes.py` - 7-stage pipeline implementation
- `backend/models/schemas.py` - Data models

### Frontend
- `src/App.tsx` - Main app router & navigation
- `src/components/pages/*.tsx` - Page components
- `src/api/client.ts` - API communication

### Database
- `supabase/migrations/` - Schema and knowledge base seeding

---

## 💡 Key Insights

1. **Async Processing**: Files don't block the API → scale better
2. **Confidence is Transparent**: Users see what score came from where
3. **Memory Enables Learning**: No model retraining needed, just store patterns
4. **Modular Pipeline**: Easy to swap stages or add new ones
5. **Flexible Schema**: JSONB allows different doc types to have different fields
6. **Weighted Confidence**: Grounding (30%) most important → model understanding matters most

---

## 🎯 Next Steps

1. **Deploy**: Push to production (Vercel for frontend, cloud for backend)
2. **Collect Data**: Process documents, gather user feedback
3. **Improve**: Analyze confidence trends, add more document types
4. **Scale**: Optimize pipeline, add batch processing, consider fine-tuning
5. **Monitor**: Track confidence vs approval rate, error patterns

