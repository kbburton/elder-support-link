# Documents V2 - Implementation Notes

**Last Updated:** 2025-01-16  
**Status:** Phase 1 Core Features Complete

---

## ✅ Implemented Features

### 1. Database Schema
- ✅ `documents_v2` table with core fields
- ✅ `document_categories` with parent_id for hierarchy
- ✅ `document_tags` table
- ✅ `document_v2_tags` junction table
- ✅ Separate junction tables for associations:
  - `task_documents_v2`
  - `appointment_documents_v2`
  - `contact_documents_v2`
  - `activity_documents_v2`
- ✅ RLS policies for group member access
- ✅ Validation triggers for category/subgroup limits
- ✅ Same-group validation for associations

### 2. File Upload & Storage
- ✅ Drag-and-drop upload interface
- ✅ File type validation (PDF, DOCX, XLSX, TXT, JPG, PNG, MP3, WAV)
- ✅ File size limit validation (25MB)
- ✅ Duplicate filename detection
- ✅ Progress indicator
- ✅ Supabase storage bucket `documents-v2`
- ✅ Signed URL generation for downloads

### 3. AI Processing
- ✅ Edge function: `process-document-v2`
- ✅ Text extraction via Gemini AI
- ✅ Summary generation with category-specific prompts
- ✅ Processing status tracking (pending/processing/completed/failed)
- ✅ Error handling with retry capability
- ✅ `ai_prompts` table for customizable prompts

### 4. Organization System
- ✅ Category Manager UI
  - Create/edit/delete parent categories (max 10 custom)
  - Create/edit/delete subgroups (max 20 per parent)
  - Database triggers enforce limits
- ✅ Tag Manager UI
  - Create/edit/delete tags
  - Color picker for tag customization
  - Unlimited tags per document
- ✅ Document metadata editing (title, category, notes)

### 5. Association System (Updated 2025-01-16)
- ✅ `entity_associations` unified table
- ✅ UnifiedAssociationManagerV2 component
- ✅ Link documents to tasks, appointments, contacts, activities
- ✅ Group-scoped associations (all must belong to same group)
- ✅ Prevents self-associations and cross-group links
- ✅ Normalized storage (entity_1_id < entity_2_id)
- ✅ Automatic cleanup on document unshare
- ✅ Bidirectional relationships (view from either side)
- ✅ Same-group validation triggers
- ✅ Create/delete associations

### 6. Document Modal
- ✅ View document details
- ✅ Edit metadata (title, category, notes)
- ✅ Tag management
- ✅ Association management
- ✅ Download document
- ✅ Delete document (soft delete)
- ✅ Regenerate summary
- ✅ Processing status indicator
- ✅ Error state handling

### 7. Key Implementation Decisions

#### Unified Associations Table (Evolved Design - 2025-01-16)
- **Phase 1:** Separate junction tables (`task_documents_v2`, `appointment_documents_v2`, etc.)
- **Phase 2 (Current):** Single `entity_associations` table with normalized entity pairs
- **Final Implementation:** 
  - Unified `entity_associations` table with `entity_1_type/id` and `entity_2_type/id`
  - Entity pairs normalized (entity_1_id always < entity_2_id) via trigger
  - Group-scoped with validation trigger
  - Automatic cleanup when document unshared from group
- **Rationale:** 
  - More flexible for future entity types
  - Simpler queries for bidirectional relationships
  - Reduced table proliferation
  - Better support for multi-way associations (future)

#### Category Hierarchy (Simplified)
- **Original Plan:** 3 levels (Categories → Subgroups → Tags)
- **Implemented:** 2 levels (Parent Categories → Subgroups) + unlimited tags
- **Rationale:**
  - Simpler UI/UX
  - Uses `parent_id` self-reference instead of separate subgroups table
  - Tags remain unlimited and flexible

#### Select Component Fix
- **Issue:** Radix SelectItem cannot have empty string value
- **Solution:** Use "none" as value for "no parent" option, convert to empty string in handler
- **Location:** `DocumentCategoryManager.tsx` line 329

#### RLS Infinite Recursion Fix (2025-01-16)
- **Issue:** `document_v2_group_shares` RLS policies caused infinite recursion loop
- **Root Cause:** SELECT policy on `document_v2_group_shares` queried `documents_v2`, which queried `document_v2_group_shares`
- **Solution:** Created SECURITY DEFINER functions to break recursion:
  - `is_document_owner(_document_id, _user_id)`: Direct query without RLS
  - `is_group_member(_group_id, _user_id)`: Direct query without RLS
- **Location:** Migration `20251016201202_b93fdd9a-38fa-424c-aa63-4c4b362aca18.sql`
- **Status:** Resolved

---

## ❌ Not Yet Implemented (Deferred to Phase 2)

### 1. Version Control
- ❌ `document_v2_versions` table
- ❌ Version history UI
- ❌ Restore previous version
- ❌ Version comparison
- ❌ "Version" vs "Replace" options

### 2. Full-Text Search
- ❌ Search within document contents
- ❌ `search_vector` tsvector column
- ❌ GIN index for search
- ❌ Search results with snippets
- ❌ Real-time indexing

### 3. Two-Tab UI
- ❌ "Care Group Documents" tab
- ❌ "My Documents" tab
- ❌ Sharing indicator on personal documents

### 4. Feature Flag System
- ❌ `app_settings` table for feature toggle
- ❌ Admin-only access initially
- ❌ UI check before rendering section

### 5. Soft Delete Model (Simplified)
- ❌ Group member removes from group only
- ❌ Document persists in uploader's view
- ❌ Only uploader can hard delete
- ❌ 30-day trash with auto-purge
- **Current:** Standard soft delete with `is_deleted` flag

### 6. Bulk Operations
- ❌ Multi-select UI
- ❌ Bulk download as ZIP
- ❌ Bulk tag/category assignment
- ❌ Bulk delete

### 7. Audit Logging
- ❌ `document_v2_audit_logs` table
- ❌ Track views, edits, permission changes
- ❌ Admin audit trail

### 8. Comments
- ❌ `document_v2_comments` table
- ❌ Comment threads
- ❌ @mentions
- ❌ Email notifications

### 9. AI Extractions (Interactive)
- ❌ Extract appointments from document
- ❌ Extract contacts from document
- ❌ Extract tasks from document
- ❌ Chat-style approval interface

---

## 🐛 Known Issues & Technical Debt

### 1. Association Column Mapping
- **Issue:** Task-document associations had reversed column mapping
- **Fixed:** Explicit column mapping in `useUnifiedAssociations.ts` lines 380-384
- **Status:** Resolved

### 2. TypeScript Type Inference
- **Issue:** Supabase query results losing type info with `as any`
- **Fixed:** Explicit type assertion for query results
- **Location:** `useUnifiedAssociations.ts` line 272
- **Status:** Resolved

### 3. Select Component Empty Value
- **Issue:** Radix SelectItem rejects empty string values
- **Fixed:** Use "none" value and convert in handler
- **Location:** `DocumentCategoryManager.tsx` line 336
- **Status:** Resolved

### 4. Mobile/Tablet Responsiveness
- **Status:** Desktop works well, mobile/tablet needs testing
- **Action:** Defer to Phase 2

### 5. Storage Usage Display
- **Status:** Not implemented
- **Action:** Defer to Phase 2

---

## 📊 Test Coverage Priorities

### High Priority (Must Test Before Release)
1. ✅ File upload with validation
2. ✅ Category/subgroup limit enforcement
3. ✅ Tag management
4. ✅ Association creation/deletion
5. ✅ RLS policies (group member access)
6. ✅ AI processing pipeline
7. ✅ Document CRUD operations

### Medium Priority
8. Admin-only document access (RLS)
9. Duplicate filename detection
10. Error handling in AI processing
11. Soft delete/restore

### Lower Priority (Can defer)
12. Storage bucket operations
13. Signed URL generation
14. Performance testing
15. Cross-browser compatibility

---

## 🚀 Next Steps for Phase 2

1. **Document Notes Enhancement** 🎯 NEXT (Week 2, Days 1-2)
   - Add rich text editor (markdown support)
   - Implement auto-save functionality
   - Make notes searchable
   - Add formatting toolbar
   - Test notes persistence and display

2. **Version Control** (Week 3, Days 1-3)
   - Implement version history UI
   - Add "Version" vs "Replace" options
   - Test version restore functionality

3. **Full-Text Search** (Week 3, Days 4-7)
   - Add search_vector column with GIN index
   - Implement search UI with filters
   - Test search accuracy and performance

3. **Two-Tab UI** (Week 3-4)
   - Separate care group vs personal views
   - Add sharing indicators
   - Test tab state persistence

4. **Feature Flag** (Week 4)
   - Add app_settings table entry
   - Implement admin toggle UI
   - Test rollout to non-admins

5. **Bulk Operations** (Week 4)
   - Multi-select UI
   - ZIP download functionality
   - Bulk edit operations

---

## 📝 Migration Notes

### Database Changes
- All new tables created with proper RLS policies
- Existing association tables (task_documents, etc.) remain for documents v1
- New junction tables use `_v2` suffix
- Default categories seeded automatically

### Code Changes
- New constants in `src/constants/entities.ts`
- New hooks in `src/hooks/` for documents v2
- New components in `src/components/documents/`
- Updated UnifiedAssociationManager to support v2 documents

### Environment Variables
- No new environment variables required
- Uses existing Supabase configuration
- AI processing uses existing Gemini API key

---

## 🎯 Success Metrics

### Completed
- ✅ Core document upload/storage working
- ✅ AI processing generating summaries
- ✅ Category hierarchy functional
- ✅ Associations linking correctly
- ✅ RLS policies enforcing access control

### Pending
- ❌ Version control operational
- ❌ Search finding documents accurately
- ❌ Feature flag controlling access
- ❌ Bulk operations working
- ❌ Mobile experience optimized
