# AccuParse Architecture PlantUML Diagrams

## 1. Complete System Architecture

```plantuml
@startuml System_Architecture
!theme plain
skinparam backgroundColor #ffffff
skinparam classBackgroundColor #f0f0f0

package "Frontend - React/TypeScript" {
    component "App.tsx" as App
    component "UploadPage" as Upload
    component "ProcessingPage" as Processing
    component "ResultsPage" as Results
    component "HistoryPage" as History
    component "MemoryPage" as Memory
    component "API Client" as APIClient
    
    App --> Upload
    App --> Processing
    App --> Results
    App --> History
    App --> Memory
    Upload --> APIClient
    Processing --> APIClient
    Results --> APIClient
    History --> APIClient
    Memory --> APIClient
}

package "Backend - FastAPI + LangGraph" {
    component "FastAPI Server" as FastAPI
    component "Upload Route" as UploadRoute
    component "Status Route" as StatusRoute
    component "Document Route" as DocRoute
    component "Feedback Route" as FeedbackRoute
    component "Memory Route" as MemoryRoute
    component "Background Processor" as BackgroundProc
    
    APIClient --> FastAPI
    FastAPI --> UploadRoute
    FastAPI --> StatusRoute
    FastAPI --> DocRoute
    FastAPI --> FeedbackRoute
    FastAPI --> MemoryRoute
    UploadRoute --> BackgroundProc
}

package "LangGraph Pipeline" {
    component "Preprocessing" as Preprocess
    component "Classification" as Classify
    component "Memory Retrieval" as MemRetrieval
    component "RAG/KB Retrieval" as RAG
    component "Extraction" as Extract
    component "Validation" as Validate
    component "Output" as Output
    
    BackgroundProc --> Preprocess
    Preprocess --> Classify
    Classify --> MemRetrieval
    MemRetrieval --> RAG
    RAG --> Extract
    Extract --> Validate
    Validate --> Output
}

package "External Services" {
    component "Azure OpenAI" as OpenAI
    component "Text Extraction\n(pytesseract, pypdf)" as TextExtraction
}

package "Database - Supabase PostgreSQL" {
    database "documents" as docs
    database "memory_corrections" as memcorr
    database "memory_templates" as memtpl
    database "memory_patterns" as mempat
    database "memory_confidence_history" as memconf
    database "knowledge_base" as kb
}

BackgroundProc --> TextExtraction
Classify --> OpenAI
Extract --> OpenAI
Output --> docs
MemRetrieval --> memcorr
MemRetrieval --> memtpl
MemRetrieval --> mempat
Extract --> kb
FeedbackRoute --> memcorr
FeedbackRoute --> mempat
MemoryRoute --> memcorr
MemoryRoute --> memtpl
MemoryRoute --> mempat
MemoryRoute --> memconf

@enduml
```

---

## 2. Upload & Processing Flow

```plantuml
@startuml Upload_Flow
!theme plain
participant User as user
participant Frontend as fe
participant FastAPI as api
participant BackgroundTask as bg
participant LangGraph as lg
participant Supabase as db
participant OpenAI as llm

user -> fe: Click Upload File
fe -> fe: Select file
user -> fe: Click Upload
fe -> api: POST /api/upload (multipart/form-data)
api -> db: INSERT documents (status='pending')
db -> api: Return document_id
api -> user: Return document_id + "processing started"
api -> bg: Schedule background task

note over bg, lg: Async Processing
bg -> db: SELECT document
bg -> lg: Invoke LangGraph pipeline
lg -> lg: Run 7-node workflow

note over lg, db: Results Persistence
lg -> db: UPDATE documents (status='completed', results)
bg -> db: UPDATE confidence history

user -> fe: Poll /api/documents/{id}/status
fe -> api: GET /api/documents/{id}/status
api -> db: SELECT document status
db -> api: Return DocumentStatus
api -> fe: Return status
fe -> user: Display processing progress

note over user, fe: Processing Complete
user -> fe: View Results
fe -> api: GET /api/documents/{id}
api -> db: SELECT document + results
db -> api: Return full DocumentResult
api -> fe: Return document + extracted fields
fe -> user: Display classification, fields, confidence

user -> fe: Provide Feedback
fe -> api: POST /api/documents/{id}/feedback
api -> db: UPDATE user_feedback, corrections
db -> api: Success
api -> bg: Update memory tables
user -> fe: Confirm feedback received

@enduml
```

---

## 3. Pipeline Data Flow

```plantuml
@startuml Pipeline_Flow
!theme plain

participant Input as "Input File"
participant Preprocess as "1. Preprocess"
participant Classify as "2. Classify"
participant MemRetr as "3. Memory Retrieval"
participant RAG as "4. RAG/KB Retrieval"
participant Extract as "5. Extraction"
participant Validate as "6. Validation"
participant Output as "7. Output"
participant DB as "Supabase DB"

Input -> Preprocess: file_bytes
Preprocess -> Preprocess: Extract text (PDF/DOCX/OCR)\nClean text\nCompute OCR score
Preprocess -> Classify: raw_text, cleaned_text, ocr_score

Classify -> Classify: LLM: Classify document type\nCompute grounding_score
Classify -> MemRetr: document_type, grounding_score

MemRetr -> DB: Query memory_corrections,\nmemory_templates,\nmemory_patterns
DB -> MemRetr: Memory records
MemRetr -> RAG: memories, document_type

RAG -> DB: Query knowledge_base\n(doc type specific fields)
DB -> RAG: KB entries
RAG -> RAG: Compute retrieval_score
RAG -> Extract: rag_context, retrieval_score

Extract -> Extract: LLM: Extract fields\nUsing KB + Memory context
Extract -> Validate: extracted_fields

Validate -> Validate: Check required fields\nCompute validation_score\nFinal confidence = weighted average\n(0.25×OCR + 0.25×Retrieval +\n 0.30×Grounding + 0.20×Validation)
Validate -> Output: validation_results, confidence_score

Output -> Output: Format final_output\nPrepare pipeline_steps log
Output -> DB: INSERT/UPDATE results

@enduml
```

---

## 4. LangGraph Pipeline States

```plantuml
@startuml LangGraph_Workflow
!theme plain
skinparam nodeBackgroundColor #e1f5ff
skinparam nodeBorderColor #01579b
skinparam noteBackgroundColor #fff9c4
skinparam noteBorderColor #f57f17

state "1. Preprocessing" as s1 {
    note right of s1
        Input: file_bytes, filename
        Process:
        • Extract text (pytesseract/pypdf/docx)
        • Clean/normalize text
        • Compute OCR quality score
        Output: raw_text, cleaned_text, 
                file_type, ocr_score
    end note
}

state "2. Classification" as s2 {
    note right of s2
        Input: cleaned_text
        Process:
        • LLM classifies document type
        • Supports 10 document types
        • Compute grounding score
        Output: document_type,
                classification_confidence,
                grounding_score
    end note
}

state "3. Memory Retrieval" as s3 {
    note right of s3
        Input: document_type
        Process:
        • Query user corrections
        • Retrieve templates
        • Load patterns
        • Fetch confidence history
        Output: memories (dict)
    end note
}

state "4. RAG/KB Retrieval" as s4 {
    note right of s4
        Input: document_type, memories
        Process:
        • Query knowledge_base
        • Compute retrieval_score
        • Prepare extraction hints
        Output: rag_context,
                retrieval_score
    end note
}

state "5. Field Extraction" as s5 {
    note right of s5
        Input: cleaned_text, rag_context, memories
        Process:
        • LLM extracts ALL fields
        • Prioritize required fields
        • Use KB & memory as context
        Output: extracted_fields (dict)
    end note
}

state "6. Validation & Scoring" as s6 {
    note right of s6
        Input: extracted_fields, rag_context,
               ocr_score, retrieval_score,
               grounding_score
        Process:
        • Validate field presence
        • Check required fields
        • Compute validation_score
        • Calculate final confidence:
          0.25×OCR + 0.25×Retrieval +
          0.30×Grounding + 0.20×Validation
        Output: validation_results,
                confidence_score
    end note
}

state "7. Output Formatting" as s7 {
    note right of s7
        Input: All pipeline data
        Process:
        • Format final output
        • Prepare pipeline_steps log
        • Persist to database
        Output: final_output,
                pipeline_steps
    end note
}

[*] --> s1
s1 --> s2 : DocumentState flows through
s2 --> s3 : Merged with classification result
s3 --> s4 : Memory added to state
s4 --> s5 : RAG context provided
s5 --> s6 : Extracted fields validated
s6 --> s7 : Confidence scores computed
s7 --> [*] : Results persisted to DB

@enduml
```

---

## 5. Database Schema ERD

```plantuml
@startuml Database_Schema
!theme plain
skinparam backgroundColor #ffffff
skinparam classBackgroundColor #f0f0f0

entity "documents" as doc {
    *id : UUID <<PK>>
    --
    file_name : TEXT
    file_size : INTEGER
    file_type : TEXT
    status : ENUM (pending|processing|completed|failed)
    raw_text : TEXT
    document_type : TEXT
    classification_confidence : FLOAT
    extracted_fields : JSONB
    validation_results : JSONB
    confidence_score : FLOAT
    final_output : JSONB
    pipeline_steps : JSONB
    error_message : TEXT
    user_feedback : ENUM (approved|edited|rejected|NULL)
    feedback_corrections : JSONB
    created_at : TIMESTAMPTZ
    updated_at : TIMESTAMPTZ
}

entity "memory_corrections" as corr {
    *id : UUID <<PK>>
    --
    document_id : UUID <<FK>>
    document_type : TEXT
    field_name : TEXT
    original_value : TEXT
    corrected_value : TEXT
    created_at : TIMESTAMPTZ
}

entity "memory_templates" as tpl {
    *id : UUID <<PK>>
    --
    document_type : TEXT
    template_fields : JSONB
    usage_count : INTEGER
    created_at : TIMESTAMPTZ
    updated_at : TIMESTAMPTZ
}

entity "memory_patterns" as pat {
    *id : UUID <<PK>>
    --
    document_type : TEXT
    pattern_name : TEXT
    pattern_value : TEXT
    confidence : FLOAT
    occurrence_count : INTEGER
    created_at : TIMESTAMPTZ
    updated_at : TIMESTAMPTZ
}

entity "memory_confidence_history" as conf {
    *id : UUID <<PK>>
    --
    document_id : UUID <<FK>>
    document_type : TEXT
    confidence_score : FLOAT
    was_approved : BOOLEAN
    created_at : TIMESTAMPTZ
}

entity "knowledge_base" as kb {
    *id : UUID <<PK>>
    --
    document_type : TEXT
    field_name : TEXT
    description : TEXT
    examples : JSONB
    extraction_hints : JSONB
    is_required : BOOLEAN
    created_at : TIMESTAMPTZ
}

doc ||--o{ corr : references
doc ||--o{ conf : references
doc ||--o{ kb : references

@enduml
```

---

## 6. Continuous Learning Loop

```plantuml
@startuml Learning_Loop
!theme plain

participant User as user
participant Pipeline as pipe
participant DB as "Memory DB"

== Initial Processing ==
user -> pipe: Upload document
pipe -> pipe: Process & extract
pipe -> DB: Store results
pipe -> user: Return confidence=0.75

== User Feedback ==
user -> user: Review extracted fields
user -> user: Notice vendor_name is wrong
user -> DB: Submit correction\nvender_name: "Corrected Name"

note over DB
  Stores in memory_corrections:
  - document_type: "invoice"
  - field_name: "vendor_name"
  - original_value: "Wrong Name"
  - corrected_value: "Corrected Name"
end note

== Future Processing ==
user -> pipe: Upload similar invoice
pipe -> DB: Retrieve memory for doc_type="invoice"
DB -> pipe: Returns past corrections
pipe -> pipe: Uses corrections as extraction context

note over pipe
  Extraction node now knows:
  - Look for patterns similar to
    "Corrected Name"
  - Has historical patterns to match
  - Uses memory to improve accuracy
end note

@enduml
```

---

## 7. Confidence Scoring Components

```plantuml
@startuml Confidence_Scoring
!theme plain
skinparam backgroundColor #ffffff
skinparam classBackgroundColor #fff3e0

component "OCR Score\n(0.25 weight)" as ocr {
    note
        Text Extraction Quality
        • Text length heuristic
        • Character quality ratio
        • File type factor
    end note
}

component "Retrieval Score\n(0.25 weight)" as retrieval {
    note
        Knowledge Base + Memory Coverage
        • KB entries found
        • Memory records count
        • Context richness
    end note
}

component "Grounding Score\n(0.30 weight)" as grounding {
    note
        Model Understanding
        • LLM classification confidence
        • Document type certainty
        • Direct from LLM output
    end note
}

component "Validation Score\n(0.20 weight)" as validation {
    note
        Field Extraction Quality
        • Required fields present
        • Optional fields extracted
        • Data completeness
    end note
}

frame "Final Confidence Formula" {
    [Score Aggregator]
    note right of [Score Aggregator]
        FinalConfidence = 
        0.25×OCR + 0.25×Retrieval +
        0.30×Grounding + 0.20×Validation
    end note
}

ocr --> [Score Aggregator]
retrieval --> [Score Aggregator]
grounding --> [Score Aggregator]
validation --> [Score Aggregator]

[Score Aggregator] --> [Confidence Output (0.0-1.0)]

@enduml
```

---

## 8. Component Interaction Matrix

```plantuml
@startuml Component_Matrix
!theme plain
skinparam backgroundColor #ffffff

rectangle "Frontend Layer" {
    component "App" as app
    component "Pages" as pages
    component "UI Components" as ui
    component "API Client" as apiclient
}

rectangle "API Layer" {
    component "FastAPI" as fastapi
    component "Routes" as routes
    component "Background Tasks" as bgtasks
}

rectangle "Processing Layer" {
    component "LangGraph" as langgraph
    component "7 Pipeline Nodes" as nodes
    component "LLM Integration" as llm
}

rectangle "Data Layer" {
    component "Supabase DB" as db
    component "ORM/Client" as ormclient
}

rectangle "External" {
    component "Azure OpenAI" as openai
    component "Text Extractors" as extractors
}

app --> pages
pages --> ui
pages --> apiclient
apiclient --> fastapi
fastapi --> routes
routes --> bgtasks
bgtasks --> langgraph
langgraph --> nodes
nodes --> llm
nodes --> ormclient
llm --> openai
nodes --> extractors
ormclient --> db

@enduml
```

---

## 9. Frontend Navigation & State Flow

```plantuml
@startuml Frontend_State_Flow
!theme plain
skinparam backgroundColor #ffffff

state App {
    state Upload {
        state [*] --> UploadForm
        state UploadForm: File Selection & Upload
        UploadForm --> [*]: Submit
    }
    
    state Processing {
        state [*] --> StatusPolling
        state StatusPolling: Poll /api/documents/{id}/status
        StatusPolling --> StatusPolling: Every 1-2s
        StatusPolling --> [*]: Processing Complete
    }
    
    state Results {
        state [*] --> LoadResults
        state LoadResults: GET /api/documents/{id}
        LoadResults --> DisplayFields: Parse Response
        state DisplayFields: Show extracted_fields\n+ confidence_score
        DisplayFields --> FeedbackForm: User Reviews
        state FeedbackForm: Approve/Edit/Reject
        FeedbackForm --> [*]: Submit Feedback
    }
    
    state History {
        state [*] --> ListDocs
        state ListDocs: GET /api/documents?limit=50
        ListDocs --> SelectDoc: Click Document
        SelectDoc --> Results: Navigate to Results
    }
    
    state Memory {
        state [*] --> LoadMemory
        state LoadMemory: GET /api/memory
        LoadMemory --> ViewMemory: Display corrections,\npatterns, templates
        ViewMemory --> [*]
    }
    
    [*] --> Upload
    Upload --> Processing: handleDocumentUploaded()
    Processing --> Results: handleProcessingComplete()
    Results --> History: User navigates
    Processing --> History: User navigates
    Results --> Upload: User navigates
    History --> Results: viewDocument(id)
    History --> Upload: User navigates
    Upload --> Memory: User navigates
    Memory --> Upload: User navigates
}

@enduml
```

---

## 10. Error Handling & Fallback Paths

```plantuml
@startuml Error_Handling
!theme plain
skinparam backgroundColor #ffffff

start

:User uploads document;

if (File type valid?) then (no)
    :Return 400 error\nUnsupported file type;
    end
else (yes)
    :INSERT into DB\nstatus = 'pending';
    :Start background process;
    
    if (Text extraction succeeds?) then (no)
        :ocr_score = 0.0\nraw_text = '';
    else (yes)
        :raw_text extracted\nocr_score computed;
    endif
    
    if (Classification succeeds?) then (no)
        :document_type = 'other'\ngrounding_score = 0.3;
    else (yes)
        :document_type assigned\ngrounding_score = confidence;
    endif
    
    if (KB entries found?) then (no)
        :retrieval_score = 0.2\nrag_context = [];
    else (yes)
        :retrieval_score computed\nrag_context populated;
    endif
    
    if (Extraction succeeds?) then (no)
        :extracted_fields = {}\nvalidation_score = 0.0;
    else (yes)
        :extracted_fields populated\nvalidation_score computed;
    endif
    
    :Final confidence calculated\n(weighted average);
    
    if (Confidence > 0.5?) then (high confidence)
        :status = 'completed'\nMark ready for user review;
    else (low confidence)
        :status = 'completed'\nMark needs manual review;
    endif
    
    :Persist to DB\nUPDATE documents;
    
    :User polls status\nReceives results;
    
endif

end

@enduml
```

---

## 11. API Request/Response Examples

```plantuml
@startuml API_Examples
!theme plain

rectangle "Upload Endpoint" {
    note right
        POST /api/upload
        
        Request:
        - file: <binary>
        
        Response (202):
        {
          "document_id": "uuid",
          "message": "processing started"
        }
    end note
}

rectangle "Status Endpoint" {
    note right
        GET /api/documents/{id}/status
        
        Response:
        {
          "id": "uuid",
          "status": "processing",
          "pipeline_steps": [
            {
              "name": "Preprocessing",
              "status": "completed",
              "output": "..."
            },
            ...
          ]
        }
    end note
}

rectangle "Results Endpoint" {
    note right
        GET /api/documents/{id}
        
        Response:
        {
          "extracted_fields": {
            "field1": "value1",
            "field2": "value2"
          },
          "confidence_score": 0.87,
          "document_type": "invoice",
          "validation_results": {...}
        }
    end note
}

rectangle "Feedback Endpoint" {
    note right
        POST /api/documents/{id}/feedback
        
        Request:
        {
          "feedback": "edited",
          "corrections": {
            "field1": "corrected_value"
          }
        }
        
        Response:
        {
          "message": "Feedback recorded",
          "document_id": "uuid"
        }
    end note
}

@enduml
```

