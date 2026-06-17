-- Add is_required column to knowledge_base
ALTER TABLE knowledge_base ADD COLUMN IF NOT EXISTS is_required BOOLEAN DEFAULT false;

-- Update existing invoice entries
UPDATE knowledge_base SET is_required = true  WHERE document_type = 'invoice' AND field_name IN ('invoice_number', 'vendor_name', 'total_amount');
UPDATE knowledge_base SET is_required = false WHERE document_type = 'invoice' AND field_name IN ('due_date', 'line_items');

-- Update existing contract entries
UPDATE knowledge_base SET is_required = true  WHERE document_type = 'contract' AND field_name IN ('parties', 'effective_date');
UPDATE knowledge_base SET is_required = false WHERE document_type = 'contract' AND field_name IN ('termination_date', 'governing_law');

-- Update existing resume entries
UPDATE knowledge_base SET is_required = true  WHERE document_type = 'resume'   AND field_name IN ('name', 'email');
UPDATE knowledge_base SET is_required = false WHERE document_type = 'resume'   AND field_name IN ('skills', 'experience');

-- Update existing report entries
UPDATE knowledge_base SET is_required = true  WHERE document_type = 'report'   AND field_name = 'title';
UPDATE knowledge_base SET is_required = false WHERE document_type = 'report'   AND field_name IN ('summary', 'date');

-- ── Enrich invoice ────────────────────────────────────────────────────────────
INSERT INTO knowledge_base (document_type, field_name, description, examples, extraction_hints, is_required) VALUES
('invoice','invoice_date',   'Date the invoice was issued',              '["2024-03-15","Mar 05, 2026"]',        '["Invoice Date","Date of Issue","Bill Date","INVOICE DATE"]',         true),
('invoice','customer_name',  'Name of the customer / buyer',             '["John Doe","Suchitra N M"]',          '["Customer","Bill To","Client","CUSTOMER DETAILS"]',                  false),
('invoice','customer_address','Billing address of the customer',         '["123 Main St, City, State"]',         '["Customer address block","Bill To address"]',                        false),
('invoice','subtotal',       'Amount before discounts/taxes',            '["₹2374","$1200.00"]',                 '["Subtotal","Total Package Amount","Before Tax"]',                    false),
('invoice','tax_amount',     'Tax charged on the invoice',               '["₹120","GST 18%"]',                   '["Tax","GST","VAT","CGST","SGST"]',                                   false),
('invoice','discount',       'Discount applied',                         '["₹232","10%"]',                       '["Discount","VIP Discount","Promo"]',                                 false),
('invoice','payment_mode',   'Method of payment',                        '["online","cash","credit card"]',      '["Payment Mode","Payment Method","Pay Mode"]',                        false),
('invoice','booking_id',     'Booking or order reference',               '["15736491","ORD-001"]',               '["Booking ID","Order ID","Reference"]',                               false),
('invoice','currency',       'Currency of the invoice',                  '["USD","INR","EUR"]',                  '["Currency symbol or code","₹","$"]',                                 false),
('invoice','pan_number',     'PAN number of the vendor',                 '["AAKCR7631M"]',                       '["PAN","Company PAN No."]',                                           false),
('invoice','gstin',          'GST identification number',                '["33AAGCA9491C1ZQ"]',                  '["GSTIN","GST No."]',                                                 false),
('invoice','sac_code',       'Service Accounting Code',                  '["999316"]',                           '["SAC CODE","SAC"]',                                                  false);

-- ── New type: claims_document ─────────────────────────────────────────────────
INSERT INTO knowledge_base (document_type, field_name, description, examples, extraction_hints, is_required) VALUES
-- Required
('claims_document','claim_number',              'Unique claim identifier (must contain CL-)',                '["CL-70178883/2"]',                                            '["Claim Number","CL- prefix"]',                                         true),
('claims_document','policy_number',             'Insurance policy number',                                  '["001000005665122"]',                                          '["Policy Number","Policy No."]',                                        true),
('claims_document','insured_name',              'Name of the insured entity',                               '["Forestry Mutual Insurance Company"]',                        '["Insured","Insured Name"]',                                            true),
('claims_document','primary_carrier',           'Primary underwriting carrier',                             '["Waypoint Underwriting Management LLC"]',                     '["Primary Carrier","Underwriter","Carrier"]',                           true),
('claims_document','currency',                  'Currency of claim amounts',                                '["USD","GBP"]',                                                '["Currency","financial section header"]',                               true),
('claims_document','has_multiple_injured_parties','Whether more than one claimant exists',                  '["True","False"]',                                             '["multiple injured parties","claimant count"]',                         true),
('claims_document','loss_date',                 'Date the loss/incident occurred',                          '["2023-10-17"]',                                               '["Loss Date","Date of Loss","Incident Date"]',                          true),
('claims_document','peril',                     'Type of peril/risk',                                       '["Work Comp","Property Damage"]',                              '["Peril","Type of Loss"]',                                              true),
('claims_document','claim_status',              'Current status of the claim',                              '["closed","open","pending"]',                                  '["Status","Claim Status","CLOSED","OPEN"]',                             true),
('claims_document','claim_type',                'Category of the claim',                                    '["Work Comp","Liability"]',                                    '["Claim Type","Type"]',                                                 true),
('claims_document','document_category',         'Document category identifier',                             '["primary_claims_documents"]',                                 '["Document Category"]',                                                 true),
('claims_document','report_date',               'Date this report was generated',                           '["2024-11-05"]',                                               '["Report Date","Date"]',                                                true),
-- Optional
('claims_document','risk_reference',            'Risk reference number',                                    '["UERX00012301"]',                                             '["Risk Reference","Risk Ref"]',                                         false),
('claims_document','transaction_ref',           'Transaction reference number',                             '["39451367"]',                                                 '["Transaction Ref.","Transaction Reference"]',                          false),
('claims_document','account_number',            'Account number',                                           '["136656/UW-US"]',                                             '["Account Number","Account No."]',                                      false),
('claims_document','adjuster_name',             'Name of the claims adjuster',                              '["Milagros Rivera"]',                                          '["Adjuster","Claims Adjuster"]',                                        false),
('claims_document','contact_info',              'Contact details of adjuster',                              '["email | phone"]',                                            '["Contact","Email","Phone"]',                                           false),
('claims_document','capacity_partner',          'Capacity partner name',                                    '["N/A"]',                                                      '["Capacity Partner"]',                                                  false),
('claims_document','broker',                    'Broker name',                                              '["Guy Carpenter & Company, LLC"]',                             '["Broker","Reinsurance Broker"]',                                       false),
('claims_document','broker_address',            'Broker address',                                           '["1166 Avenue of the Americas..."]',                           '["Broker Address"]',                                                    false),
('claims_document','country_code',              'Country code',                                             '["US","GB"]',                                                  '["Country Code","Country"]',                                            false),
('claims_document','jurisdiction',              'Legal jurisdiction / state',                               '["North Carolina"]',                                           '["Jurisdiction","State"]',                                              false),
('claims_document','claimant_name',             'Name of the injured party',                                '["Joe Thompson"]',                                             '["Name (in Injured Parties section)","Claimant"]',                      false),
('claims_document','injury_description',        'Description of the injury or incident',                   '["64 y/o truck driver who had a heart attack"]',               '["Injury Description","Incident Description"]',                         false),
('claims_document','date_of_injury',            'Date of the injury/incident',                             '["2023-10-17"]',                                               '["Date of Injury","Injury Date"]',                                      false),
('claims_document','body_part',                 'Body part affected',                                      '["Cardiovascular / Multiple"]',                                '["Body Part","Part Affected"]',                                         false),
('claims_document','severity',                  'Severity of the injury',                                  '["Severe","Minor","Moderate"]',                                '["Severity","Injury Severity"]',                                        false),
('claims_document','medical_incurred',          'Total medical costs incurred',                            '["USD 5,500.00"]',                                             '["Medical Incurred","Medical Costs"]',                                  false),
('claims_document','medical_paid',              'Medical costs paid out',                                  '["USD 5,500.00"]',                                             '["Medical Paid"]',                                                      false),
('claims_document','indemnity_incurred',        'Indemnity costs incurred',                                '["USD 0.00"]',                                                 '["Indemnity Incurred"]',                                                false),
('claims_document','indemnity_paid',            'Indemnity paid',                                          '["USD 0.00"]',                                                 '["Indemnity Paid"]',                                                    false),
('claims_document','expense_incurred',          'Expense costs incurred',                                  '["USD 0.00"]',                                                 '["Expense Incurred"]',                                                  false),
('claims_document','total_incurred',            'Total amount incurred',                                   '["USD 5,500.00"]',                                             '["Total Incurred","Incurred Loss"]',                                    false),
('claims_document','total_paid',                'Total amount paid',                                       '["USD 5,500.00"]',                                             '["Total Paid","Paid Loss"]',                                            false),
('claims_document','total_balance',             'Outstanding balance',                                     '["USD 0.00"]',                                                 '["Total Balance","Outstanding"]',                                       false),
('claims_document','loss_description',          'Description of the loss event',                           '["Barrett Logging, Inc. truck driver..."]',                   '["Loss Description","Incident Description"]',                           false),
('claims_document','subperil',                  'Sub-category of peril',                                   '["Occupational Disease / Heart Attack"]',                      '["Sub-Peril","Subperil"]',                                              false),
('claims_document','loss_name',                 'Employer / loss location name',                           '["Barrett Logging, Inc."]',                                   '["Loss Name","Employer","Loss Location Name"]',                         false),
('claims_document','line_of_business',          'Line of insurance business',                              '["Worker''s Compensation / Employers'' Liability"]',           '["Line of Business","LOB"]',                                            false),
('claims_document','treaty_type',               'Type of reinsurance treaty',                              '["Excess of Loss"]',                                           '["Treaty Type","Reinsurance Type"]',                                    false),
('claims_document','attachment_point',          'Attachment / excess point',                               '["USD 500,000"]',                                              '["Attachment Point","Excess","SIR"]',                                   false),
('claims_document','deductible_amount',         'Deductible or SIR amount',                               '["USD 500,000"]',                                              '["Deductible","SIR","Self-Insured Retention"]',                         false),
('claims_document','per_occurrence_limit',      'Per occurrence policy limit',                             '["USD 500,000"]',                                              '["Per Occurrence Limit","Limit"]',                                      false),
('claims_document','claim_standing',            'Disposition / standing of the claim',                     '["accepted","denied","pending"]',                              '["Claim Standing","Standing"]',                                         false),
('claims_document','document_subtype',          'Specific subtype of this document',                       '["claims_closing_advice"]',                                    '["Document Subtype","Subtype"]',                                        false),
('claims_document','waypoint_share',            'Share percentage for the carrier',                        '["100% (1.0)"]',                                               '["Waypoint Share","Share %"]',                                          false);

-- ── New type: medical_bill ─────────────────────────────────────────────────────
INSERT INTO knowledge_base (document_type, field_name, description, examples, extraction_hints, is_required) VALUES
('medical_bill','bill_number',         'Unique bill/invoice number',                          '["LTTN032600000153","007215"]',             '["Invoice No.","Bill No.","SID No.","Bill Number"]',            true),
('medical_bill','patient_name',        'Full name of the patient',                            '["Suchitra N M","MRS. SUCHITRA N M"]',     '["Patient Name","Name","Customer"]',                           true),
('medical_bill','bill_date',           'Date of the bill',                                    '["Mar 05, 2026","07/03/2026"]',            '["Invoice Date","Bill Date","Date","INVOICE DATE"]',           true),
('medical_bill','total_amount',        'Total amount charged',                                '["₹1909","1,300.00"]',                     '["Grand Total","Total Amount","Amount Chargeable"]',           true),
('medical_bill','vendor_name',         'Name of the medical facility / lab',                  '["Redcliffe Lifetech","AARTHI SCANS"]',   '["Bill From","Company Name","Header name"]',                   true),
('medical_bill','service_descriptions','List of services / tests performed',                  '["PCOS Panel","CBC Test","USG PELVIS"]',  '["Test Description","Service","Description column"]',         false),
('medical_bill','amount_received',     'Amount actually paid',                                '["₹1909","1,300.00"]',                    '["Paid Amount","Amount Received"]',                            false),
('medical_bill','payment_mode',        'Payment method',                                      '["online","cash"]',                        '["Payment Mode","Pay Mode"]',                                  false),
('medical_bill','payment_date',        'Date payment was made',                               '["Mar 05, 2026"]',                         '["Payment Date"]',                                             false),
('medical_bill','gstin',               'GST identification number',                           '["33AAGCA9491C1ZQ"]',                      '["GSTIN"]',                                                    false),
('medical_bill','sac_code',            'Service Accounting Code',                             '["999316"]',                               '["SAC CODE"]',                                                 false),
('medical_bill','referring_doctor',    'Referring / prescribing doctor',                      '["Dr. Esther Rani Stella"]',              '["Ref. By","Referring Doctor"]',                               false),
('medical_bill','patient_age',         'Age of the patient',                                  '["27Y 9M","51"]',                          '["Age","Patient Age","y/o"]',                                  false),
('medical_bill','patient_id',          'Patient identifier (PID / SID)',                      '["0800476290","08008255"]',               '["PID","Patient ID","SID No."]',                               false),
('medical_bill','discount',            'Discount applied',                                    '["₹232"]',                                 '["Discount","VIP Discount"]',                                  false),
('medical_bill','cin',                 'Company Identification Number',                       '["U85100UP2021PTC140992"]',               '["CIN"]',                                                      false);

-- ── New type: medical_report ───────────────────────────────────────────────────
INSERT INTO knowledge_base (document_type, field_name, description, examples, extraction_hints, is_required) VALUES
('medical_report','patient_name',      'Full name of the patient',                            '["Rodney James Foster"]',                  '["Patient name","header name","Name field"]',                  true),
('medical_report','encounter_date',    'Date of the clinical encounter',                      '["9/25/2024"]',                            '["Encounter Date","Visit Date","Date"]',                       true),
('medical_report','provider_name',     'Name of the treating physician',                      '["Norman Hugh Scott McCulloch Jr., MD"]', '["Provider","Physician","Doctor"]',                            true),
('medical_report','primary_diagnosis', 'Primary clinical diagnosis with ICD code',            '["Diabetic ulcer E11.621, L97.522"]',     '["Primary Diagnosis","Primary? = Yes","Visit Diagnoses"]',    true),
('medical_report','mrn',               'Medical Record Number',                               '["000899552"]',                            '["MRN","Medical Record Number","MRN:"]',                       false),
('medical_report','patient_age',       'Age of the patient',                                  '["51"]',                                   '["Age","y/o","year old","Description line"]',                  false),
('medical_report','patient_gender',    'Gender of the patient',                               '["male","female"]',                        '["Gender","M/F","Description line"]',                          false),
('medical_report','specialty',         'Medical specialty of the provider',                   '["Undersea and Hyperbaric Medicine"]',     '["Specialty","Department"]',                                   false),
('medical_report','diagnoses',         'All diagnoses with ICD / CMS/HCC codes',              '["E11.621 - Diabetic ulcer..."]',          '["Diagnoses","ICD codes","Encounter Diagnoses"]',              false),
('medical_report','medications',       'Current medication list',                             '["cephalexin 500mg capsule"]',             '["Medication List","Medications","Rx","Drug"]',                false),
('medical_report','assessment',        'Clinical assessment / plan',                          '["Type 2 diabetes mellitus with..."]',    '["Assessment","Plan","Clinical Assessment"]',                  false),
('medical_report','facility_name',     'Healthcare facility / department name',               '["GSV WOUND CARE OP"]',                   '["Department","Facility","Hospital"]',                         false),
('medical_report','visit_type',        'Type of clinical encounter',                          '["Office Visit","Follow-up"]',            '["Visit Type","Encounter Type","Office Visit"]',               false);
