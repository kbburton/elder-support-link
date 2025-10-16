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
**Status:** In Progress - Core Infrastructure Complete

### Core Features

- [x] **1.1 Hierarchical Categories & Subgroups** ✅ (Completed)
  - ✅ Created 5 default categories: Medical, Legal, Financial, Personal, Other
  - ✅ Support up to 10 custom Level 1 categories (15 total max)
  - ✅ Support up to 20 Level 2 subgroups per category
  - ✅ Tags system with unlimited tags per document
  - ✅ Database triggers to enforce limits
  - ✅ Category Manager UI with parent/subgroup creation
  - ✅ Tag Manager UI with color selection
  - ⚠️ Changed from "subgroups" terminology to "parent categories" + "subgroups" for clarity
  - **Status:** Complete

- [x] **1.2 Document Upload & Storage** ✅ (Completed)
  - ✅ Support formats: PDF, DOCX, Excel, TXT, Images (JPG/PNG), Audio (MP3, WAV)
  - ✅ File size limit: 25MB with validation
  - ✅ Supabase Storage bucket `documents-v2` with RLS policies
  - ✅ Drag-and-drop upload interface
  - ✅ Progress indicator during upload
  - ✅ Duplicate filename detection with user confirmation
  - ⚠️ OCR for images and scanned PDFs - implemented via edge function
  - ⚠️ Audio transcription - implemented but requires testing
  - **Status:** Complete

- [x] **1.3 AI Document Processing** ✅ (Completed)
  - ✅ Smart summaries via Gemini AI
  - ✅ Category-specific prompts stored in `ai_prompts` table
  - ✅ Processing status tracking (pending/processing/completed/failed)
  - ✅ Error handling and retry capability
  - ✅ Full text extraction stored in database
  - ⚠️ Auto-categorization suggestions - not implemented (user manually selects)
  - ⚠️ Extract appointments/contacts/tasks - deferred to Phase 2
  - **Status:** Core complete, extractions deferred

- [x] **1.4 Document Metadata** ✅ (Completed)
  - ✅ Title (editable)
  - ✅ Category (Level 1) - required field
  - ✅ Subgroup (Level 2) - optional
  - ✅ Tags (Level 3, unlimited) - optional
  - ✅ Notes (plain text)
  - ✅ Upload date (auto)
  - ✅ Uploader (auto)
  - ✅ Last modified date (auto-updated)
  - ✅ File metadata (type, size, original filename)
  - **Status:** Complete

- [x] **1.9 Associations** ✅ (Completed - Updated 2025-01-16)
  - ✅ Unified `entity_associations` table for all entity types
  - ✅ Supports: document ↔ task, appointment, contact, activity_log
  - ✅ Group-scoped associations (all entities must belong to same group)
  - ✅ Prevents self-associations and cross-group links
  - ✅ Normalized association storage (entity_1 always has lower ID)
  - ✅ `UnifiedAssociationManagerV2` component with search and filter
  - ✅ Bidirectional relationship display
  - ✅ Automatic cleanup when document unshared from group
  - ⚠️ Changed from separate junction tables to unified `entity_associations` table
  - **Status:** Complete

- [x] **1.8 Database Schema & RLS** ✅ (Completed - Updated 2025-01-16)
  - ✅ `documents_v2` table (removed `group_id`, using `document_v2_group_shares`)
  - ✅ `document_v2_group_shares` for multi-group sharing
  - ✅ `document_categories` with parent_id for hierarchy
  - ✅ `document_tags` table
  - ✅ `document_v2_tags` junction table
  - ✅ `entity_associations` unified association table
  - ✅ RLS policies fixed for infinite recursion (SECURITY DEFINER functions)
  - ✅ `is_document_owner()` and `is_group_member()` helper functions
  - ✅ RLS policies for admin-only documents
  - ✅ Soft delete support (is_deleted flag)
  - **Status:** Complete

- [x] **1.13 Document Modal UI** ✅ (Completed)
  - ✅ View document details
  - ✅ Edit metadata (title, category, notes)
  - ✅ Manage tags
  - ✅ View/manage associations
  - ✅ Download document
  - ✅ Delete document
  - ✅ Regenerate summary
  - ✅ Processing status indicator
  - ✅ Error state handling
  - **Status:** Complete

- [ ] **1.14 Document Notes Enhancement** 🎯 NEXT PRIORITY (Target: Week 2)
  - Rich text editor for document notes
  - Markdown support for formatting
  - Auto-save notes on blur
  - Notes visible in document modal
  - Notes searchable in future full-text search
  - **Status:** Not Started - Next Feature

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
  - Filter by date range, category, uploader
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

- [ ] **1.7 Admin-Only Permissions** (Partially Complete)
  - ✅ Per-document "Admin Only" checkbox in database
  - ✅ RLS policies to enforce admin-only access
  - ⚠️ Visual indicator for admin-only documents - not implemented in UI
  - ⚠️ Audit log for permission changes - not implemented
  - **Status:** Backend complete, UI pending

- [ ] **1.10 Audit Logging** (Not Started)
  - Track who viewed each document (timestamp)
  - Track who edited each field
  - Track document version history
  - Viewable by document owner and care group admin
  - **Status:** Not Started

- [ ] **1.11 Responsive Design** (Partially Complete)
  - ✅ Desktop: Full edit capabilities
  - ⚠️ Mobile: View-only, camera upload - needs testing
  - ⚠️ Tablet: Full features with responsive layout - needs testing
  - **Status:** Desktop complete, mobile/tablet needs work

- [ ] **1.12 Storage Usage Display** (Not Started)
  - Show storage usage by category
  - Total storage for care group
  - Progress bars and limits
  - **Status:** Not Started

- [ ] **1.13 Two-Tab UI** (Not Started)
  - Tab 1: Care Group Documents (group docs + user's shared docs)
  - Tab 2: My Documents (all user docs with sharing indicator)
  - Tab state persistence
  - **Status:** Not Started - Currently single list view

- [ ] **1.14 Feature Flag System** (Not Started)
  - Database setting: `documents_v2_enabled_for_all`
  - Default: `false` (admin-only access)
  - UI check before rendering section
  - **Status:** Not Started - Currently accessible to all group members

- [ ] **1.15 Soft Delete Model** (Not Started)
  - Group member soft delete: removes from care group only
  - Document remains in uploader's personal documents
  - Only uploader can hard delete
  - 30-day trash retention
  - **Status:** Not Started - Using standard soft delete

---

## 📋 Feature Requirements - Phase 2

**Timeline:** Weeks 3-4 (Post-MVP)  
**Status:** Ready to Begin

### Priority Items for Phase 2

- [ ] **2.1 Version Control** ⭐ HIGH PRIORITY (Target: Week 3, Days 1-3)
  - Implement document versioning UI
  - "Version" vs "Replace" options on upload
  - Version history modal with restore capability
  - Maximum 5 versions per document (auto-prune oldest)
  - Version comparison view
  - Database: `document_v2_versions` table
  - **Rationale:** Core feature mentioned in MVP, deferred for initial release
  - **Status:** Not Started

- [ ] **2.2 Full-Text Search** ⭐ HIGH PRIORITY (Target: Week 3, Days 4-7)
  - Search within document full_text content
  - Filter by category, date range, uploader
  - Search results with context snippets
  - PostgreSQL full-text search with ts_vector
  - Reindex on document update
  - Database: Add search_vector column + GIN index
  - **Rationale:** Critical for finding documents in large libraries
  - **Status:** Not Started

- [ ] **2.3 Two-Tab UI System** (Target: Week 3)
  - Tab 1: "Care Group Documents" (shared documents)
  - Tab 2: "My Documents" (all user's documents with sharing indicator)
  - Tab state persistence
  - Visual indicator for which documents are shared
  - **Rationale:** Improves organization and clarifies ownership
  - **Status:** Not Started

- [ ] **2.4 Feature Flag + Admin-Only Rollout** (Target: Week 3)
  - `app_settings` table entry: `documents_v2_enabled_for_all`
  - Default: `false` (admin-only)
  - UI check before showing Documents V2 section
  - Admin UI to toggle feature flag
  - **Rationale:** Controlled rollout to admins first for testing
  - **Status:** Not Started

- [ ] **2.5 Soft Delete Model Refinement** (Target: Week 4)
  - Group member soft delete → removes from group only
  - Document remains in uploader's "My Documents"
  - Only uploader can permanently delete
  - 30-day trash retention with auto-purge
  - Trash view for admins
  - **Rationale:** Prevents accidental data loss, allows recovery
  - **Status:** Not Started

- [ ] **2.6 Bulk Operations** (Target: Week 4)
  - Select multiple documents (checkbox UI)
  - Bulk download as ZIP
  - Bulk tag assignment
  - Bulk category reassignment
  - Bulk delete (with confirmation)
  - **Rationale:** Efficiency for managing multiple documents
  - **Status:** Not Started

- [ ] **2.7 Document Comments** (Target: Week 4)
  - Comment threads on documents
  - @mentions for care group members
  - Email notifications for new comments
  - Resolve/unresolve comments
  - Database: `document_v2_comments` table
  - **Rationale:** Collaboration feature for care teams
  - **Status:** Not Started

- [ ] **2.8 Audit Logging** (Target: Week 4)
  - Track document views (user, timestamp)
  - Track edits (field changes)
  - Track permission changes
  - Viewable by document owner and group admin
  - Database: `document_v2_audit_logs` table
  - **Rationale:** Security and accountability
  - **Status:** Not Started

### Lower Priority (Can defer to Phase 3)

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

#### `documents_v2` ✅ IMPLEMENTED (Updated 2025-01-16)
```sql
CREATE TABLE documents_v2 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  
  -- Ownership
  uploaded_by_user_id UUID REFERENCES auth.users(id) NOT NULL,
  -- NOTE: group_id REMOVED - use document_v2_group_shares instead
  
  -- Organization
  category_id UUID REFERENCES document_categories(id) NOT NULL,
  
  -- Content
  summary TEXT,
  full_text TEXT, -- OCR/transcription
  notes TEXT,
  
  -- Processing
  processing_status TEXT DEFAULT 'pending',
  processing_error TEXT,
  
  -- Permissions
  is_admin_only BOOLEAN DEFAULT false,
  
  -- Versioning (NOT YET IMPLEMENTED)
  current_version INTEGER DEFAULT 1,
  
  -- Soft delete
  is_deleted BOOLEAN DEFAULT false,
  deleted_at TIMESTAMPTZ,
  deleted_by_user_id UUID,
  deleted_by_email TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_documents_v2_uploader ON documents_v2(uploaded_by_user_id);
CREATE INDEX idx_documents_v2_category ON documents_v2(category_id);
-- Full-text search index NOT YET IMPLEMENTED

-- NEW: Multi-group sharing table
CREATE TABLE document_v2_group_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES documents_v2(id) ON DELETE CASCADE,
  group_id UUID REFERENCES care_groups(id) ON DELETE CASCADE,
  shared_by_user_id UUID REFERENCES auth.users(id),
  shared_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(document_id, group_id)
);

-- NEW: Unified associations table
CREATE TABLE entity_associations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES care_groups(id) NOT NULL,
  entity_1_type TEXT NOT NULL, -- 'document', 'task', 'appointment', 'contact', 'activity_log'
  entity_1_id UUID NOT NULL,
  entity_2_type TEXT NOT NULL,
  entity_2_id UUID NOT NULL,
  created_by_user_id UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(group_id, entity_1_type, entity_1_id, entity_2_type, entity_2_id)
);
```

#### `document_categories` ✅ IMPLEMENTED
```sql
CREATE TABLE document_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT, -- NOT USED in current UI
  color TEXT, -- NOT USED in current UI
  is_default BOOLEAN DEFAULT false,
  parent_id UUID REFERENCES document_categories(id), -- ADDED: For hierarchical structure
  care_group_id UUID REFERENCES care_groups(id), -- NULL = system default
  created_by_user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  display_order INTEGER,
  
  UNIQUE(name, care_group_id, parent_id) -- CHANGED: Added parent_id to unique constraint
);

-- Trigger to enforce category limits (max 10 custom, max 20 subgroups)
-- See: validate_category_limits() function
```

#### `document_tags` ✅ IMPLEMENTED
```sql
CREATE TABLE document_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  color TEXT, -- Hex color code for tag display
  care_group_id UUID REFERENCES care_groups(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(name, care_group_id)
);
```

#### `document_v2_tags` ✅ IMPLEMENTED
```sql
CREATE TABLE document_v2_tags (
  document_id UUID REFERENCES documents_v2(id) ON DELETE CASCADE,
  tag_id UUID REFERENCES document_tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  
  PRIMARY KEY (document_id, tag_id)
);
```

#### Association Junction Tables ✅ IMPLEMENTED
**CHANGE:** Instead of single `document_v2_associations` table, implemented separate junction tables:

```sql
-- Task-Document V2 Junction
CREATE TABLE task_documents_v2 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  document_id UUID REFERENCES documents_v2(id) ON DELETE CASCADE,
  created_by_user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(task_id, document_id)
);

-- Appointment-Document V2 Junction
CREATE TABLE appointment_documents_v2 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID REFERENCES appointments(id) ON DELETE CASCADE,
  document_id UUID REFERENCES documents_v2(id) ON DELETE CASCADE,
  created_by_user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(appointment_id, document_id)
);

-- Contact-Document V2 Junction
CREATE TABLE contact_documents_v2 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  document_id UUID REFERENCES documents_v2(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(contact_id, document_id)
);

-- Activity-Document V2 Junction
CREATE TABLE activity_documents_v2 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_log_id UUID REFERENCES activity_logs(id) ON DELETE CASCADE,
  document_id UUID REFERENCES documents_v2(id) ON DELETE CASCADE,
  created_by_user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(activity_log_id, document_id)
);

-- Validation trigger: validate_same_group_association_v2()
-- Ensures documents and linked entities belong to same care group
```

#### ❌ NOT YET IMPLEMENTED

**Version Control Tables:**
- `document_v2_versions` - deferred to Phase 2
- Version history UI and restore functionality

**Comments:**
- `document_v2_comments` - deferred to Phase 2

**Audit Logging:**
- `document_v2_audit_logs` - deferred to Phase 2

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

## 🎨 UI/UX Design Standards & Component Patterns

**Goal:** Ensure Documents V2 maintains visual and functional consistency with the existing Elder Care platform, particularly matching the patterns used in Appointments and Tasks.

---

### Modal Structure & Layout

**Standard Modal Pattern** (Reference: `EnhancedAppointmentModal.tsx`, `EnhancedTaskModal.tsx`)

```tsx
<Dialog>
  <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
    <DialogHeader>
      <DialogTitle className="flex items-center gap-2">
        <FileIcon className="h-5 w-5" />
        {document.title || "Document Details"}
      </DialogTitle>
    </DialogHeader>

    {/* Two-Column Layout */}
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* LEFT COLUMN: Document Form */}
      <div className="space-y-4">
        {/* Form fields here */}
      </div>

      {/* RIGHT COLUMN: Associations */}
      <div className="space-y-4">
        <UnifiedAssociationManager
          entityType="documents_v2"
          entityId={document.id}
          groupId={groupId}
          onNavigate={handleNavigate}
        />
      </div>
    </div>

    {/* ACTION BUTTONS */}
    <DialogFooter className="flex justify-between">
      <Button variant="destructive" onClick={handleDelete}>
        Delete
      </Button>
      <div className="flex gap-2">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={handleSubmit} disabled={isLoading}>
          {isLoading ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

**Modal Behavior:**
- Maximum width: `max-w-4xl` (consistent with appointments/tasks)
- Maximum height: `max-h-[90vh]` with `overflow-y-auto`
- Two-column layout on desktop (`lg:grid-cols-2`)
- Single column on mobile/tablet
- Left column: Form fields for document metadata
- Right column: `UnifiedAssociationManager` for related entities

---

### Page Layout Pattern

**Standard Page Structure** (Reference: `AppointmentsPage.tsx`, `TasksPage.tsx`)

```tsx
function DocumentsV2Page() {
  return (
    <div className="container mx-auto p-4 space-y-6">
      {/* HEADER SECTION */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileText className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Documents</h1>
            <p className="text-muted-foreground">
              Organize and manage care documents with AI assistance
            </p>
          </div>
        </div>
        <Button onClick={() => setShowUploadModal(true)}>
          <Upload className="mr-2 h-4 w-4" />
          Upload Document
        </Button>
      </div>

      {/* TAB NAVIGATION */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="care-group">Care Group Documents</TabsTrigger>
          <TabsTrigger value="my-documents">My Documents</TabsTrigger>
        </TabsList>

        {/* TAB CONTENT */}
        <TabsContent value="care-group">
          <UnifiedTableView {...tableConfig} />
        </TabsContent>
        <TabsContent value="my-documents">
          <UnifiedTableView {...tableConfig} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

**Page Requirements:**
- Container: `container mx-auto p-4`
- Icon + title + description header
- Action button in top-right (Upload Document)
- Two-tab interface using shadcn `Tabs` component
- `UnifiedTableView` for document listing in each tab
- Consistent spacing with `space-y-6`

---

### Form Components & Inputs

**Consistent Input Patterns:**

```tsx
{/* TEXT INPUT */}
<div className="space-y-2">
  <Label htmlFor="title">Document Title</Label>
  <Input
    id="title"
    value={formData.title}
    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
    placeholder="Enter document title"
  />
</div>

{/* SELECT DROPDOWN */}
<div className="space-y-2">
  <Label htmlFor="category">Category</Label>
  <Select value={formData.categoryId} onValueChange={(value) => setFormData({ ...formData, categoryId: value })}>
    <SelectTrigger>
      <SelectValue placeholder="Select category" />
    </SelectTrigger>
    <SelectContent>
      {categories.map((cat) => (
        <SelectItem key={cat.id} value={cat.id}>
          {cat.name}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
</div>

{/* TEXTAREA */}
<div className="space-y-2">
  <Label htmlFor="notes">Notes</Label>
  <Textarea
    id="notes"
    value={formData.notes}
    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
    placeholder="Add notes about this document"
    rows={3}
  />
</div>

{/* DATE PICKER */}
<div className="space-y-2">
  <Label>Upload Date</Label>
  <Popover>
    <PopoverTrigger asChild>
      <Button variant="outline" className="w-full justify-start">
        <CalendarIcon className="mr-2 h-4 w-4" />
        {formData.date ? format(formData.date, "PPP") : "Pick a date"}
      </Button>
    </PopoverTrigger>
    <PopoverContent className="w-auto p-0">
      <Calendar mode="single" selected={formData.date} onSelect={(date) => setFormData({ ...formData, date })} />
    </PopoverContent>
  </Popover>
</div>

{/* TAGS (Multi-Select Badges) */}
<div className="space-y-2">
  <Label>Tags</Label>
  <div className="flex flex-wrap gap-2">
    {selectedTags.map((tag) => (
      <Badge key={tag.id} variant="secondary" className="gap-1">
        {tag.name}
        <X className="h-3 w-3 cursor-pointer" onClick={() => removeTag(tag.id)} />
      </Badge>
    ))}
    <Button variant="outline" size="sm" onClick={() => setShowTagModal(true)}>
      <Plus className="h-3 w-3 mr-1" /> Add Tag
    </Button>
  </div>
</div>

{/* FILE UPLOAD (Drag & Drop) */}
<div className="space-y-2">
  <Label>Upload File</Label>
  <div className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary transition-colors cursor-pointer">
    <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
    <p className="text-sm text-muted-foreground">
      Drag and drop files here, or click to browse
    </p>
    <p className="text-xs text-muted-foreground mt-2">
      Supported formats: PDF, DOCX, Excel, Images, Audio (Max 25MB)
    </p>
  </div>
</div>
```

**Form Validation:**
- Use `zod` schema validation
- Display errors inline with red text below inputs
- Disable submit button while validating
- Show loading spinner on submit button during mutation

---

### UnifiedTableView Configuration

**Document Table Setup:**

```tsx
const tableConfig: UnifiedTableViewProps = {
  entityType: "documents_v2",
  title: "Documents",
  columns: [
    {
      key: "title",
      label: "Title",
      sortable: true,
      render: (doc) => (
        <div>
          <p className="font-medium">{doc.title}</p>
          <p className="text-xs text-muted-foreground">{doc.original_filename}</p>
        </div>
      )
    },
    {
      key: "category",
      label: "Category",
      sortable: true,
      render: (doc) => (
        <Badge variant="outline">{doc.category?.name}</Badge>
      )
    },
    {
      key: "file_size",
      label: "Size",
      render: (doc) => formatFileSize(doc.file_size)
    },
    {
      key: "created_at",
      label: "Uploaded",
      sortable: true,
      render: (doc) => format(new Date(doc.created_at), "MMM d, yyyy")
    },
    {
      key: "actions",
      label: "Actions",
      render: (doc) => (
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => handleDownload(doc)}>
            <Download className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => openAssociationsModal(doc)}>
            <Link className="h-4 w-4" />
          </Button>
        </div>
      )
    }
  ],
  searchPlaceholder: "Search documents...",
  bulkActions: [
    { label: "Download Selected", onClick: handleBulkDownload },
    { label: "Add Tags", onClick: handleBulkTag },
    { label: "Delete", onClick: handleBulkDelete, variant: "destructive" }
  ],
  onRowClick: (doc) => setSelectedDocument(doc),
  filterOptions: [
    {
      key: "category_id",
      label: "Category",
      options: categories.map(cat => ({ value: cat.id, label: cat.name }))
    }
  ]
};
```

**Table Features:**
- Search bar with debounced input
- Sortable columns (title, date, size)
- Badge components for categories and status
- Custom actions column (download, associations)
- Bulk selection with checkbox column
- Pagination at bottom
- Loading skeleton states

---

### Consistent Patterns & Best Practices

#### 1. **Data Mutations** (TanStack Query)

```tsx
const updateDocumentMutation = useMutation({
  mutationFn: async (data: DocumentUpdate) => {
    const { error } = await supabase
      .from("documents_v2")
      .update(data)
      .eq("id", documentId);
    
    if (error) throw error;
  },
  onSuccess: () => {
    toast({
      title: "Document updated",
      description: "Your changes have been saved successfully."
    });
    queryClient.invalidateQueries({ queryKey: ["documents_v2"] });
    onClose();
  },
  onError: (error) => {
    toast({
      title: "Error updating document",
      description: error.message,
      variant: "destructive"
    });
  }
});
```

**Mutation Requirements:**
- Always use `useMutation` from TanStack Query
- Show success toast on completion
- Show error toast on failure
- Invalidate relevant queries after success
- Close modal/dialog after success
- Check for demo mode with `blockOperation()` before executing

#### 2. **Toast Notifications** (Sonner)

```tsx
import { toast } from "sonner";

// Success
toast.success("Document uploaded successfully");

// Error
toast.error("Failed to upload document", {
  description: "File size exceeds 25MB limit"
});

// Loading (with promise)
toast.promise(uploadPromise, {
  loading: "Uploading document...",
  success: "Document uploaded successfully",
  error: "Failed to upload document"
});
```

#### 3. **Soft Delete Pattern**

```tsx
const handleSoftDelete = async () => {
  if (blockOperation()) return; // Demo mode check

  const { error } = await softDeleteEntity({
    entityType: "documents_v2",
    entityId: document.id,
    groupId: currentGroupId
  });

  if (!error) {
    toast.success("Document removed from care group");
    queryClient.invalidateQueries({ queryKey: ["documents_v2"] });
  }
};
```

#### 4. **Demo Mode Detection**

```tsx
import { useDemo } from "@/hooks/useDemo";

function DocumentModal() {
  const { isDemo, blockOperation } = useDemo();

  const handleDelete = () => {
    if (blockOperation()) return; // Shows demo mode toast
    // Proceed with deletion
  };

  return (
    <Dialog>
      {isDemo && (
        <Alert variant="warning">
          <Info className="h-4 w-4" />
          <AlertDescription>
            This is demo mode. Changes will not be saved.
          </AlertDescription>
        </Alert>
      )}
    </Dialog>
  );
}
```

#### 5. **Query Invalidation After Mutations**

```tsx
// After creating/updating/deleting documents
queryClient.invalidateQueries({ queryKey: ["documents_v2"] });
queryClient.invalidateQueries({ queryKey: ["documents_v2", groupId] });
queryClient.invalidateQueries({ queryKey: ["document_categories", groupId] });

// After creating associations
queryClient.invalidateQueries({ queryKey: ["associations", "documents_v2", documentId] });
queryClient.invalidateQueries({ queryKey: ["associations", entityType, entityId] });
```

#### 6. **URL Parameter Support (Deep Linking)**

```tsx
import { useSearchParams } from "react-router-dom";

function DocumentsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const openDocumentId = searchParams.get("openDocument");

  useEffect(() => {
    if (openDocumentId) {
      setSelectedDocument(openDocumentId);
      setSearchParams({}); // Clear param after opening
    }
  }, [openDocumentId]);
}

// Navigate to document from another page:
// /app/${groupId}/documents?openDocument=${documentId}
```

#### 7. **Audit Logging**

```tsx
// Log document access
await supabase.from("document_v2_audit_logs").insert({
  document_id: documentId,
  user_id: currentUserId,
  user_email: currentUserEmail,
  action: "view", // or 'edit', 'delete', 'download', 'version'
  details: { source: "web_app" },
  ip_address: clientIp, // From request headers
  user_agent: navigator.userAgent
});
```

---

### Responsive Behavior

**Breakpoints:**
- Mobile: `< 768px` (sm)
- Tablet: `768px - 1024px` (md, lg)
- Desktop: `> 1024px` (xl)

**Mobile Adaptations:**
```tsx
{/* Desktop: Two-column layout */}
<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
  <div>{/* Form */}</div>
  <div className="hidden lg:block">{/* Associations - Hidden on mobile */}</div>
</div>

{/* Mobile: Show associations via button */}
<Button variant="outline" className="lg:hidden w-full" onClick={() => setShowAssociations(true)}>
  <Link className="mr-2 h-4 w-4" />
  View Related Items ({associationCount})
</Button>

{/* Mobile: Stack table cells vertically */}
<div className="block md:hidden">
  {/* Card-style layout for mobile */}
</div>
<div className="hidden md:block">
  {/* Table layout for tablet/desktop */}
</div>
```

**Touch Interactions:**
- Increase button touch targets to minimum 44x44px on mobile
- Support swipe gestures for deleting items
- Pull-to-refresh for document lists
- Long-press for context menu

---

### Visual Design Standards

**Color System:**
- **Primary Actions:** `bg-primary text-primary-foreground` (Upload, Save)
- **Secondary Actions:** `bg-secondary text-secondary-foreground` (Cancel)
- **Destructive Actions:** `bg-destructive text-destructive-foreground` (Delete)
- **Muted Text:** `text-muted-foreground`
- **Card Backgrounds:** `bg-card`
- **Borders:** `border border-border`

**CRITICAL:** Never use direct color values like `text-white`, `bg-blue-500`, etc. Always use semantic tokens from `index.css`:
```css
/* ✅ CORRECT */
<Button className="bg-primary text-primary-foreground">Upload</Button>
<p className="text-muted-foreground">Last updated 2 days ago</p>

/* ❌ WRONG */
<Button className="bg-blue-600 text-white">Upload</Button>
<p className="text-gray-500">Last updated 2 days ago</p>
```

**Typography:**
- Page Titles: `text-3xl font-bold`
- Section Titles: `text-xl font-semibold`
- Card Titles: `text-lg font-medium`
- Body Text: `text-base`
- Caption Text: `text-sm text-muted-foreground`
- Tiny Text: `text-xs text-muted-foreground`

**Spacing:**
- Page sections: `space-y-6`
- Form fields: `space-y-4`
- Inline elements: `gap-2` or `gap-3`
- Card padding: `p-4` or `p-6`

**Icons:**
- Use `lucide-react` icons exclusively
- Icon sizes: `h-4 w-4` (small), `h-5 w-5` (medium), `h-8 w-8` (large)
- Always pair icons with text labels for accessibility

**Badges:**
```tsx
{/* Category badges */}
<Badge variant="outline">Medical</Badge>

{/* Status badges */}
<Badge variant="default">Processing</Badge>
<Badge variant="secondary">Completed</Badge>
<Badge variant="destructive">Failed</Badge>

{/* Removable tags */}
<Badge variant="secondary" className="gap-1">
  {tagName}
  <X className="h-3 w-3 cursor-pointer" onClick={onRemove} />
</Badge>
```

---

### Loading States & Skeletons

```tsx
{/* Document List Loading */}
{isLoading && (
  <div className="space-y-4">
    {[1, 2, 3, 4, 5].map((i) => (
      <div key={i} className="flex items-center space-x-4">
        <Skeleton className="h-12 w-12 rounded" />
        <div className="space-y-2 flex-1">
          <Skeleton className="h-4 w-[250px]" />
          <Skeleton className="h-4 w-[200px]" />
        </div>
      </div>
    ))}
  </div>
)}

{/* Upload Progress */}
<div className="space-y-2">
  <div className="flex justify-between text-sm">
    <span>Uploading {fileName}...</span>
    <span>{uploadProgress}%</span>
  </div>
  <Progress value={uploadProgress} />
</div>

{/* AI Processing */}
<div className="flex items-center gap-2 text-muted-foreground">
  <Loader2 className="h-4 w-4 animate-spin" />
  <span>AI is analyzing your document...</span>
</div>
```

---

### Error Handling

**Error Messages:**
```tsx
{/* Form Validation Error */}
{errors.title && (
  <p className="text-sm text-destructive">{errors.title.message}</p>
)}

{/* API Error Alert */}
{error && (
  <Alert variant="destructive">
    <AlertCircle className="h-4 w-4" />
    <AlertTitle>Error</AlertTitle>
    <AlertDescription>{error.message}</AlertDescription>
  </Alert>
)}

{/* Graceful Degradation for AI Failure */}
{aiProcessingFailed && (
  <Alert>
    <Info className="h-4 w-4" />
    <AlertDescription>
      AI processing is temporarily unavailable. Your document has been uploaded successfully, 
      but you'll need to add the summary and category manually.
    </AlertDescription>
  </Alert>
)}
```

**Retry Mechanisms:**
```tsx
const uploadMutation = useMutation({
  mutationFn: uploadDocument,
  retry: 3, // Retry failed uploads 3 times
  retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000)
});
```

---

### Accessibility (WCAG 2.1 AA)

- All form inputs have associated `<Label>` elements
- All buttons have descriptive text or `aria-label`
- Modal dialogs trap focus and can be closed with ESC key
- Color contrast ratio minimum 4.5:1 for text
- Keyboard navigation support for all interactive elements
- Screen reader announcements for async actions (toasts)

---

### Component Reusability Checklist

**Reuse These Existing Components:**
- ✅ `UnifiedTableView` - For all document listings
- ✅ `UnifiedAssociationManager` - For linking to tasks/appointments/contacts/activities
- ✅ `EnhancedDeleteConfirm` - For delete confirmations
- ✅ `BulkDeleteBar` - For bulk operations
- ✅ `DocumentUpload` - Modify to support V2 schema
- ✅ All shadcn UI components (Button, Dialog, Input, Select, Badge, etc.)

**Create These New Components:**
- 📝 `DocumentV2Modal` - Main document edit/view modal (two-column layout)
- 📝 `DocumentCategoryManager` - Manage categories and subgroups hierarchy
- 📝 `DocumentTagManager` - Create and assign tags to documents
- 📝 `DocumentVersionHistory` - List versions with restore capability
- 📝 `DocumentAIProcessing` - AI extraction interface with chat-style approval
- 📝 `DocumentSearchBar` - Enhanced search with semantic understanding
- 📝 `DocumentTabs` - Two-tab interface (Care Group / My Documents)

---

### Mobile-First Considerations
- Mobile: View-only mode, camera upload, swipe gestures for actions
- Tablet: Full features with responsive two-column → single-column layout
- Desktop: Full power-user features, keyboard shortcuts, bulk operations

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
