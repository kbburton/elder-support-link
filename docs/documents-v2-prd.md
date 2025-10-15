# Documents V2 - Product Requirements Document

**Version:** 1.0  
**Created:** 2025-01-15  
**Status:** Approved  
**Target Launch:** MVP in 2 weeks

---

## 🎯 Executive Summary

Documents V2 is a complete reimagining of the Elder Care platform's document management system, designed to provide intelligent organization, AI-powered insights, and seamless collaboration for care teams. This system will replace the current document functionality with a more robust, scalable solution that better serves the needs of care groups managing complex medical, legal, and financial documentation.

### Core Value Proposition
- **Intelligent Organization:** Hierarchical subgroups (Categories → Subgroups → Tags) with unlimited customization
- **AI-Powered Processing:** Automatic summaries, appointment extraction, contact extraction, and task creation
- **Secure Collaboration:** Granular permissions, version control, and audit trails
- **Admin-First Rollout:** Initially available only to admins via configurable feature flag

---

## 👥 User Personas

### Primary Persona: Care Group Admin (Sarah, 52)
- **Role:** Daughter caring for aging parent with multiple medical conditions
- **Tech Comfort:** Moderate (uses smartphone daily, occasional laptop use)
- **Pain Points:** 
  - Medical records scattered across multiple providers
  - Difficulty finding specific documents when needed
  - Wants to share selective information with siblings without overwhelming them
  - Needs to extract appointments from medical visit summaries

### Secondary Persona: Care Group Member (Tom, 48)
- **Role:** Son, less involved in day-to-day care but wants to stay informed
- **Tech Comfort:** High (software engineer)
- **Needs:** 
  - Quick access to important documents
  - Ability to comment and contribute
  - View-only on mobile when traveling

### Tertiary Persona: Care Recipient (Frank, 78)
- **Role:** The person receiving care
- **Tech Comfort:** Low (uses flip phone, prefers paper)
- **Needs:** 
  - Simple interface if they choose to engage
  - Confidence their information is secure
  - Not overwhelmed by technology

---

## 🏗️ System Architecture

### Document Ownership Model
1. **Initial Ownership:** Document is owned by the user who uploaded it (uploader_user_id)
2. **Care Group Assignment:** Documents can be assigned to a care group
3. **Editing Rights:** Any care group member can edit documents assigned to the group
4. **Deletion Model:**
   - **Soft Delete by Group Member:** Removes document from care group but remains in uploader's personal documents
   - **Hard Delete:** Only the original uploader can permanently delete
5. **Audit Trail:** All actions logged (view, edit, delete, restore)

### Hierarchical Organization Structure

```
Level 1: Categories (Max 15 total: 5 defaults + 10 custom)
├── Medical (default)
├── Legal (default)
├── Financial (default)
├── Personal (default)
├── Other (default)
├── Custom Category 1
└── Custom Category 2...

Level 2: Subgroups (Max 20 per category)
├── Medical
│   ├── Lab Results
│   ├── Prescriptions
│   ├── Visit Summaries
│   └── Insurance
│       └── (up to 20 subgroups per category)

Level 3: Tags/Metadata (Unlimited)
├── Lab Results
│   ├── #blood-work
│   ├── #radiology
│   ├── #pathology
│   └── #cardiology (unlimited tags per document)
```

### Access Control Model

#### Feature Access (Admin-Only Initially)
- **Configuration:** `app_settings` table
  - `key: 'documents_v2_enabled_for_all'`
  - `value: 'false'` (admin-only) / `'true'` (all users)
- **Check:** UI components check this setting before rendering Documents V2 section

#### Document-Level Permissions
1. **Personal Only:** Visible only to uploader
2. **Care Group Shared:** All care group members can view/edit
3. **Admin Only:** Only care group admins can access

### UI Layout - Two Tab System

**Tab 1: Care Group Documents**
- Shows all documents assigned to the care group
- Includes user's own documents that are shared with the group
- Filtered view: only documents where `group_id = current_group_id`

**Tab 2: My Documents**
- Shows ALL documents owned by the current user
- Includes documents shared with care group (with visual indicator)
- Includes documents not shared (personal only)
- Filtered view: `uploader_user_id = current_user_id`

---

## 📋 Feature Requirements - MVP (Phase 1)

**Timeline:** Weeks 1-2  
**Status:** Planning

### Core Features

- [ ] **1.1 Hierarchical Subgroups** (Target: Week 1)
  - Create 5 default categories: Medical, Legal, Financial, Personal, Other
  - Support up to 10 custom Level 1 categories (15 total max)
  - Support up to 20 Level 2 subgroups per category
  - Support unlimited Level 3 tags per document
  - Drag-and-drop organization
  - **Status:** Not Started

- [ ] **1.2 AI Document Processing** (Target: Week 1-2)
  - Smart summaries (category-specific prompts)
  - Extract appointments (interactive chat-style approval - Option B)
  - Extract contacts (interactive chat-style approval)
  - Extract tasks (interactive chat-style approval)
  - Auto-categorization suggestions (AI suggests Level 1 category)
  - Duplicate detection (file name matching)
  - **Status:** Not Started

- [ ] **1.3 Document Upload & Storage** (Target: Week 1)
  - Support formats: PDF, DOCX, Excel, TXT, Images (JPG/PNG), Audio (MP3, WAV)
  - File size limit: 25MB
  - Supabase Storage bucket with RLS policies
  - OCR for images and scanned PDFs
  - Audio transcription with AI summary
  - **Status:** Not Started

- [ ] **1.4 Version Control** (Target: Week 2)
  - Manual versioning (user chooses "Version" or "Replace")
  - Default: Replace (overwrite)
  - Keep maximum 5 versions per document
  - Version history with restore capability
  - Version comparison (list view with restore button)
  - **Status:** Not Started

- [ ] **1.5 Full-Text Search** (Target: Week 2)
  - Search within document contents (extracted via OCR/AI)
  - Semantic search ("find documents about heart condition")
  - Filter by date range, subgroup, uploader
  - Context snippets in search results
  - Real-time indexing on upload
  - **Status:** Not Started

- [ ] **1.6 Bulk Operations** (Target: Week 2)
  - Select multiple documents
  - Bulk download as ZIP
  - Bulk tag assignment
  - Bulk category/subgroup reassignment
  - Maximum 5 documents for email operations
  - **Status:** Not Started

- [ ] **1.7 Admin-Only Permissions** (Target: Week 1)
  - Per-document "Admin Only" checkbox
  - Visual indicator for admin-only documents
  - Audit log for permission changes
  - **Status:** Not Started

- [ ] **1.8 Document Metadata** (Target: Week 1)
  - Title (editable)
  - Category (Level 1)
  - Subgroup (Level 2)
  - Tags (Level 3, unlimited)
  - Notes (rich text)
  - Upload date
  - Uploader
  - Last modified date
  - Version number
  - **Status:** Not Started

- [ ] **1.9 Associations** (Target: Week 2)
  - Link documents to tasks
  - Link documents to appointments
  - Link documents to contacts
  - Link documents to activities
  - Bidirectional relationship display
  - **Status:** Not Started

- [ ] **1.10 Audit Logging** (Target: Week 2)
  - Track who viewed each document (timestamp)
  - Track who edited each field
  - Track document version history
  - Viewable by document owner and care group admin
  - **Status:** Not Started

- [ ] **1.11 Responsive Design** (Target: Week 1-2)
  - Mobile: View-only, camera upload
  - Desktop: Full edit capabilities
  - Tablet: Full features with responsive layout
  - **Status:** Not Started

- [ ] **1.12 Storage Usage Display** (Target: Week 2)
  - Show storage usage by subgroup
  - Total storage for care group
  - Progress bars and limits
  - **Status:** Not Started

- [ ] **1.13 Two-Tab UI** (Target: Week 1)
  - Tab 1: Care Group Documents (group docs + user's shared docs)
  - Tab 2: My Documents (all user docs with sharing indicator)
  - Tab state persistence
  - **Status:** Not Started

- [ ] **1.14 Feature Flag System** (Target: Week 1)
  - Database setting: `documents_v2_enabled_for_all`
  - Default: `false` (admin-only access)
  - UI check before rendering section
  - **Status:** Not Started

- [ ] **1.15 Soft Delete Model** (Target: Week 1)
  - Group member soft delete: removes from care group only
  - Document remains in uploader's personal documents
  - Only uploader can hard delete
  - 30-day trash retention
  - **Status:** Not Started

---

## 📋 Feature Requirements - Phase 2

**Timeline:** Weeks 3-4 (Post-MVP)  
**Status:** Not Started

- [ ] **2.1 Document Comments** (Target: Week 3)
  - Comment threads on documents
  - @mentions for care group members
  - Email notifications for new comments
  - Resolve/unresolve comments
  - **Status:** Not Started

- [ ] **2.2 Email Documents** (Target: Week 3)
  - Send as secure link (not attachment)
  - Link expiration (7 days default)
  - Access code protection
  - Track who opened links
  - Maximum 5 documents per email
  - **Status:** Not Started

- [ ] **2.3 Advanced Search** (Target: Week 4)
  - Search history
  - Saved searches
  - Search within specific care group
  - Boolean operators (AND, OR, NOT)
  - **Status:** Not Started

- [ ] **2.4 Document Q&A** (Target: Week 4)
  - Natural language queries across all documents
  - "What medications is Dad taking?"
  - "When is the next appointment?"
  - AI-powered answers with source citations
  - **Status:** Not Started

- [ ] **2.5 Expiration Alerts** (Target: Week 4)
  - Set expiration dates on documents
  - Email/push notifications 30 days before expiration
  - Dashboard widget for expiring documents
  - Common presets (insurance annual, passport 10 years)
  - **Status:** Not Started

---

## 📋 Future Enhancements (Post-Phase 2)

- [ ] **3.1 Real-Time Collaboration**
  - Google Docs integration (hybrid approach)
  - Simultaneous editing with cursor tracking
  - "Open in Google Docs" button for active editing

- [ ] **3.2 External Sharing**
  - Share with external parties (doctors, lawyers)
  - Time-limited access tokens
  - View-only external access
  - External comment capability

- [ ] **3.3 Advanced AI Features**
  - Related documents suggestions
  - Document comparison (side-by-side diff)
  - AI-generated version change summaries
  - Medication extraction → dedicated Medication section

- [ ] **3.4 Mobile App**
  - Native iOS/Android apps
  - Offline document access
  - Push notifications for document updates

- [ ] **3.5 Compliance & Security**
  - HIPAA compliance certification
  - Encryption at rest for sensitive documents
  - Two-factor authentication for document access
  - Legal e-signature integration (DocuSign)

---

## 🗄️ Database Schema

### New Tables

#### `documents_v2`
```sql
CREATE TABLE documents_v2 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  
  -- Ownership
  uploader_user_id UUID REFERENCES auth.users(id) NOT NULL,
  group_id UUID REFERENCES care_groups(id),
  
  -- Organization
  category_id UUID REFERENCES document_categories(id) NOT NULL,
  subgroup_id UUID REFERENCES document_subgroups(id),
  
  -- Content
  summary TEXT,
  full_text TEXT, -- OCR/transcription
  notes TEXT,
  file_metadata JSONB,
  
  -- Processing
  processing_status TEXT DEFAULT 'pending',
  
  -- Permissions
  is_admin_only BOOLEAN DEFAULT false,
  
  -- Versioning
  version_number INTEGER DEFAULT 1,
  parent_version_id UUID REFERENCES documents_v2(id),
  
  -- Soft delete
  is_deleted BOOLEAN DEFAULT false,
  deleted_at TIMESTAMPTZ,
  deleted_by_user_id UUID REFERENCES auth.users(id),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Search
  search_vector TSVECTOR
);

CREATE INDEX idx_documents_v2_uploader ON documents_v2(uploader_user_id);
CREATE INDEX idx_documents_v2_group ON documents_v2(group_id);
CREATE INDEX idx_documents_v2_category ON documents_v2(category_id);
CREATE INDEX idx_documents_v2_search ON documents_v2 USING GIN(search_vector);
```

#### `document_categories`
```sql
CREATE TABLE document_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  color TEXT,
  is_default BOOLEAN DEFAULT false,
  group_id UUID REFERENCES care_groups(id), -- NULL = system default
  created_by_user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  display_order INTEGER,
  
  UNIQUE(name, group_id)
);

-- Seed defaults
INSERT INTO document_categories (name, is_default, display_order) VALUES
  ('Medical', true, 1),
  ('Legal', true, 2),
  ('Financial', true, 3),
  ('Personal', true, 4),
  ('Other', true, 5);
```

#### `document_subgroups`
```sql
CREATE TABLE document_subgroups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  category_id UUID REFERENCES document_categories(id) NOT NULL,
  created_by_user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  display_order INTEGER,
  
  UNIQUE(name, category_id)
);
```

#### `document_tags`
```sql
CREATE TABLE document_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  color TEXT,
  group_id UUID REFERENCES care_groups(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(name, group_id)
);
```

#### `document_v2_tags` (Junction Table)
```sql
CREATE TABLE document_v2_tags (
  document_id UUID REFERENCES documents_v2(id) ON DELETE CASCADE,
  tag_id UUID REFERENCES document_tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  
  PRIMARY KEY (document_id, tag_id)
);
```

#### `document_v2_associations`
```sql
CREATE TABLE document_v2_associations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES documents_v2(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL, -- 'task', 'appointment', 'contact', 'activity'
  entity_id UUID NOT NULL,
  created_by_user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(document_id, entity_type, entity_id)
);
```

#### `document_v2_versions`
```sql
CREATE TABLE document_v2_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES documents_v2(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  file_url TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  notes TEXT, -- User's version notes
  created_by_user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(document_id, version_number)
);
```

#### `document_v2_comments`
```sql
CREATE TABLE document_v2_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES documents_v2(id) ON DELETE CASCADE,
  comment_text TEXT NOT NULL,
  created_by_user_id UUID REFERENCES auth.users(id),
  created_by_email TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

#### `document_v2_audit_logs`
```sql
CREATE TABLE document_v2_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES documents_v2(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  user_email TEXT,
  action TEXT NOT NULL, -- 'view', 'edit', 'delete', 'restore', 'version', 'download'
  details JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_audit_document ON document_v2_audit_logs(document_id);
CREATE INDEX idx_audit_user ON document_v2_audit_logs(user_id);
```

---

## 🔒 Security & Row-Level Security Policies

### documents_v2 Table RLS

```sql
-- Enable RLS
ALTER TABLE documents_v2 ENABLE ROW LEVEL SECURITY;

-- View: Uploader can always see their documents
CREATE POLICY "Users can view their own documents"
ON documents_v2 FOR SELECT
USING (uploader_user_id = auth.uid());

-- View: Care group members can see group documents (not deleted, not admin-only unless they're admin)
CREATE POLICY "Care group members can view shared documents"
ON documents_v2 FOR SELECT
USING (
  group_id IS NOT NULL 
  AND is_deleted = false
  AND (
    (is_admin_only = false AND is_user_member_of_group(group_id))
    OR (is_admin_only = true AND is_user_admin_of_group(group_id))
  )
);

-- Insert: User can upload documents
CREATE POLICY "Users can upload documents"
ON documents_v2 FOR INSERT
WITH CHECK (uploader_user_id = auth.uid());

-- Update: Uploader can update, OR care group members if document is shared
CREATE POLICY "Users can update documents"
ON documents_v2 FOR UPDATE
USING (
  uploader_user_id = auth.uid()
  OR (group_id IS NOT NULL AND is_user_member_of_group(group_id))
);

-- Delete: Only uploader can hard delete (is_deleted = true permanently removes)
CREATE POLICY "Only uploader can delete documents"
ON documents_v2 FOR DELETE
USING (uploader_user_id = auth.uid());

-- Trash view: Admins can see deleted documents in their care group
CREATE POLICY "Admins can view deleted documents"
ON documents_v2 FOR SELECT
USING (
  is_deleted = true
  AND group_id IS NOT NULL
  AND is_user_admin_of_group(group_id)
);
```

---

## 🤖 AI Processing Workflows

### 1. Document Upload Flow

```
User uploads document → 
  Supabase Storage (bucket: documents-v2) → 
  Edge Function: process-document-v2 → 
    Extract text (OCR if image/PDF, transcribe if audio) → 
    Generate category-specific summary (ai_prompts table) → 
    Extract structured data (appointments, contacts, tasks) → 
    Interactive chat approval (Option B) ↓
    
Chat Approval Flow:
  AI: "I found an appointment on May 15th at 2pm with Dr. Smith. Would you like me to create this appointment?"
  User: "Yes, but it's at 3pm not 2pm"
  AI: "Got it. Creating appointment for May 15th at 3pm with Dr. Smith. Confirmed?"
  User: "Yes"
  → Appointment created
  → Association created (document ↔ appointment)
```

### 2. AI Extraction - Chat Interface (Option B)

**Example: Appointment Extraction**

```typescript
// AI finds potential appointment in document
const extraction = {
  type: 'appointment',
  confidence: 0.85,
  data: {
    date: '2025-05-15',
    time: '14:00',
    provider: 'Dr. Smith',
    location: '123 Main St'
  }
};

// Interactive chat flow
AI: "I found an appointment in this document:
     📅 May 15, 2025 at 2:00 PM
     👨‍⚕️ Dr. Smith
     📍 123 Main St
     
     Would you like me to create this appointment?"

User: "Yes, but the time is 3pm"

AI: "Thanks for the correction. I'll update the time to 3:00 PM. 
     Should I create the appointment now?"

User: "Yes"

AI: "✓ Appointment created! I've also linked this document to the appointment."
```

### 3. AI Prompts by Category

```sql
-- Stored in ai_prompts table
Medical Category Prompt:
"Analyze this medical document and provide:
1. A concise 2-3 sentence summary
2. Key findings or diagnoses
3. Medications mentioned
4. Any follow-up actions needed
5. Upcoming appointments or tests"

Legal Category Prompt:
"Analyze this legal document and provide:
1. Document type (will, POA, trust, etc.)
2. Key parties involved
3. Important dates or deadlines
4. Action items required
5. Relevant contacts (attorneys, notaries)"

Financial Category Prompt:
"Analyze this financial document and provide:
1. Document type (tax form, statement, bill, etc.)
2. Account or policy numbers (last 4 digits only)
3. Important dates (due dates, expiration)
4. Amount summaries
5. Action items (payments due, renewals)"
```

---

## 📊 Success Metrics

### Primary KPIs (Track Post-Launch)

1. **Adoption Rate**
   - Target: 80% of care group admins use Documents V2 within 30 days
   - Measurement: Unique users accessing Documents V2 / Total active admins

2. **AI Extraction Accuracy**
   - Target: 75% of AI-extracted items accepted without edits
   - Measurement: Approved extractions / Total extraction suggestions

3. **User Satisfaction**
   - Target: 4.5+ star rating
   - Measurement: In-app rating prompt after 10 document uploads

4. **Time to Find Documents**
   - Target: 50% reduction in time to locate documents
   - Measurement: Time from search initiation to document open (compare to baseline)

5. **Document Organization Improvement**
   - Target: 70% of documents tagged within Level 3 hierarchy
   - Measurement: Documents with tags / Total documents

### Secondary KPIs

- Average documents per care group
- Storage usage trends
- Version control usage rate
- Comment engagement rate
- Search query success rate (result clicked within top 3)

---

## 🚀 Implementation Plan

### Week 1: Foundation

**Day 1-2: Database & Backend**
- [x] Create all database tables (schema above) (✓ Completed: 2025-10-15)
- [x] Implement RLS policies (✓ Completed: 2025-10-15)
- [x] Create database functions (has_role, is_user_admin_of_group) (✓ Completed: 2025-10-15)
- [x] Set up feature flag in app_settings table (✓ Completed: 2025-10-15)
- [ ] Create Supabase Storage bucket: documents-v2 (In Progress)

**Day 3-4: Core UI Components**
- [ ] Create `/app/${groupId}/documents-v2` page structure
- [ ] Implement two-tab layout (Care Group / My Documents)
- [ ] Build hierarchical category/subgroup selector
- [ ] Create document upload component
- [ ] Build document card/list view components

**Day 5-7: Upload & Processing**
- [ ] Implement file upload with size validation
- [ ] Create Edge Function: process-document-v2
- [ ] Integrate OCR for images/PDFs
- [ ] Integrate audio transcription
- [ ] Generate AI summaries (category-specific)

### Week 2: Intelligence & Features

**Day 8-9: AI Extraction**
- [ ] Implement chat-style extraction approval UI
- [ ] Build appointment extraction flow
- [ ] Build contact extraction flow
- [ ] Build task extraction flow
- [ ] Create association linking logic

**Day 10-11: Search & Organization**
- [ ] Implement full-text search with semantic understanding
- [ ] Build tag management UI
- [ ] Create bulk operations (select, download, tag)
- [ ] Implement drag-and-drop organization

**Day 12-13: Versioning & Permissions**
- [ ] Build version control UI (version vs replace prompt)
- [ ] Implement version history view
- [ ] Create admin-only permission toggle
- [ ] Build audit log viewer

**Day 14: Polish & Testing**
- [ ] Responsive design testing (mobile, tablet, desktop)
- [ ] Error handling and loading states
- [ ] Performance optimization
- [ ] Admin feature flag testing
- [ ] UAT with test care groups

---

## 🎨 UI/UX Design Principles

### Visual Design
- Use semantic tokens from `index.css` and `tailwind.config.ts`
- All colors must be HSL format
- Consistent with existing Elder Care design system
- Accessibility: WCAG 2.1 AA compliant

### Mobile-First Considerations
- Mobile: View-only, camera upload, swipe gestures
- Tablet: Full features with responsive layout
- Desktop: Full power-user features

### Loading States
- Skeleton loaders for document lists
- Progress indicators for uploads
- Optimistic UI updates where possible

### Error Handling
- Graceful degradation if AI processing fails
- Clear error messages for file size limits
- Retry mechanisms for failed uploads

---

## 📝 Technical Decisions

### Why Not Google Docs Integration for MVP?
- **Pro:** Real-time collaboration out of the box
- **Con:** Requires Google account, loss of control, complex permissions sync
- **Decision:** Native storage for MVP, hybrid approach in Phase 2

### Why Manual Versioning vs Auto-Save?
- **Pro:** User control, less storage cost, clearer version history
- **Con:** Users might forget to version
- **Decision:** Manual with smart prompts ("This document was last edited 3 days ago. Version or replace?")

### Why Chat-Style Approval vs Modal Checkboxes?
- **Pro:** More engaging, handles corrections naturally, conversational
- **Con:** More complex to build, longer interaction time
- **Decision:** Chat-style for MVP, aligns with AI-first product vision

### Why Two Tabs vs Single View with Filters?
- **Pro:** Clear mental model, faster navigation
- **Con:** Duplicate listings in some cases
- **Decision:** Two tabs, with visual indicators to reduce confusion

---

## 🔧 Migration Plan (Future)

When ready to switch from old documents to Documents V2:

1. **Data Migration Script**
   - Map old documents to new schema
   - Assign default categories based on existing metadata
   - Preserve all associations (tasks, appointments, contacts)

2. **Dual-Mode Period**
   - Both systems run in parallel for 2 weeks
   - Old documents read-only, redirect to "Migrate to V2" button
   - Progressive migration with user consent

3. **Deprecation**
   - Archive old documents table
   - Maintain read-only access for 90 days
   - Full sunset after 6 months

---

## 📚 Appendix

### Glossary
- **Care Group:** A collection of users caring for a single care recipient
- **Subgroup:** Organizational hierarchy (Category → Subgroup → Tag)
- **Soft Delete:** Document removed from care group but retained in uploader's personal documents
- **Hard Delete:** Permanent deletion, only by original uploader
- **Admin-Only:** Document visible only to care group administrators

### References
- [Supabase Storage Documentation](https://supabase.com/docs/guides/storage)
- [Lovable AI Documentation](https://docs.lovable.dev/features/ai)
- [OpenAI Vision API](https://platform.openai.com/docs/guides/vision)

### Open Questions
- [ ] Should we support DICOM medical imaging formats in Phase 2?
- [ ] What's the desired behavior for expired documents (auto-archive)?
- [ ] Should document comments support rich text or plain text only?

---

## ✅ Feature Completion Tracker

This section is updated as features are completed. Format: `[x] Feature Name (✓ Completed: YYYY-MM-DD)`

### Phase 1 (MVP)
- [ ] 1.1 Hierarchical Subgroups (In Progress: TypeScript hooks created)
- [ ] 1.2 AI Document Processing
- [ ] 1.3 Document Upload & Storage
- [ ] 1.4 Version Control (In Progress: Database tables and hooks created)
- [ ] 1.5 Full-Text Search
- [ ] 1.6 Bulk Operations
- [ ] 1.7 Admin-Only Permissions
- [ ] 1.8 Document Metadata
- [ ] 1.9 Associations
- [ ] 1.10 Audit Logging
- [ ] 1.11 Responsive Design
- [ ] 1.12 Storage Usage Display
- [ ] 1.13 Two-Tab UI
- [x] 1.14 Feature Flag System (✓ Completed: 2025-10-15)
- [ ] 1.15 Soft Delete Model

### Phase 2
- [ ] 2.1 Document Comments
- [ ] 2.2 Email Documents
- [ ] 2.3 Advanced Search
- [ ] 2.4 Document Q&A
- [ ] 2.5 Expiration Alerts

---

**Document Control:**
- Last Updated: 2025-01-15
- Next Review: 2025-01-22
- Owner: Elder Care Product Team
