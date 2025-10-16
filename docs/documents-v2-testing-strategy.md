# Documents V2 - Testing Strategy

**Version:** 1.1  
**Created:** 2025-01-15  
**Updated:** 2025-01-16 (Implementation Phase)  
**Status:** Active  
**Owner:** Elder Care Development Team

---

## 🎯 Testing Objectives

1. **Ensure functional correctness** across all Documents V2 features
2. **Validate security** through RLS policies and permission checks
3. **Verify AI processing** accuracy and error handling
4. **Confirm UI/UX consistency** with existing platform patterns
5. **Achieve 80% minimum code coverage** for core functionality
6. **Prevent regressions** through automated test suites

## ✅ Implementation Status

### Completed Features (Requiring Tests)
- ✅ Document upload with file validation
- ✅ Category/subgroup hierarchy with limit enforcement
- ✅ Tag management system
- ✅ AI document processing (summary generation)
- ✅ Association system via `entity_associations` table (2025-01-16)
- ✅ UnifiedAssociationManagerV2 component
- ✅ Multi-group sharing via `document_v2_group_shares`
- ✅ Document modal UI with edit/delete capabilities
- ✅ RLS policies for group member access (fixed infinite recursion 2025-01-16)

### Not Yet Implemented (Tests Deferred)
- 🎯 **Document Notes Enhancement** (Next Priority - Week 2)
- ❌ Version control
- ❌ Full-text search
- ❌ Bulk operations
- ❌ Audit logging
- ❌ Two-tab UI (care group vs personal documents)
- ❌ Feature flag system
- ❌ Soft delete with group removal vs hard delete

---

## 🏗️ Testing Structure

### Test Types

#### 1. **Unit Tests** (Vitest + React Testing Library)
- Component rendering and behavior
- Form validation logic
- Data transformation utilities
- Permission checks
- Category/subgroup limit validation
- Utility functions (formatFileSize, getFileType, etc.)

#### 2. **Integration Tests**
- Complete user flows (upload → process → organize)
- AI processing pipeline
- Association creation/deletion
- Version control operations
- Soft delete and restore workflows
- Search functionality (full-text + semantic)

#### 3. **API Tests**
- Edge function execution
- RLS policy enforcement
- Storage bucket operations
- Database triggers and functions
- Supabase client operations

#### 4. **E2E Tests** (Playwright - Future Phase)
- Complete user journeys across multiple pages
- Multi-user collaboration scenarios
- Mobile/tablet responsive behavior
- Cross-browser compatibility

---

## 📁 Test File Organization

```
tests/
├── documents-v2/
│   ├── unit/
│   │   ├── components/
│   │   │   ├── DocumentV2Modal.test.tsx
│   │   │   ├── DocumentCategoryManager.test.tsx
│   │   │   ├── DocumentTagManager.test.tsx
│   │   │   ├── DocumentVersionHistory.test.tsx
│   │   │   ├── DocumentAIProcessing.test.tsx
│   │   │   └── DocumentSearchBar.test.tsx
│   │   ├── hooks/
│   │   │   ├── useDocumentCategories.test.ts
│   │   │   ├── useDocumentTags.test.ts
│   │   │   ├── useDocumentVersions.test.ts
│   │   │   └── useDocumentsV2Access.test.ts
│   │   ├── utils/
│   │   │   ├── file-utils.test.ts
│   │   │   ├── validation.test.ts
│   │   │   └── category-limits.test.ts
│   │   └── permissions/
│   │       ├── admin-only.test.ts
│   │       ├── group-member.test.ts
│   │       └── personal-docs.test.ts
│   ├── integration/
│   │   ├── document-upload-flow.test.ts
│   │   ├── ai-processing-pipeline.test.ts
│   │   ├── associations-linking.test.ts
│   │   ├── version-control.test.ts
│   │   ├── search-functionality.test.ts
│   │   ├── soft-delete-restore.test.ts
│   │   └── bulk-operations.test.ts
│   ├── api/
│   │   ├── edge-functions/
│   │   │   ├── process-document-v2.test.ts
│   │   │   ├── ai-extraction.test.ts
│   │   │   └── search-reindex.test.ts
│   │   ├── rls-policies/
│   │   │   ├── documents-v2-rls.test.ts
│   │   │   ├── categories-rls.test.ts
│   │   │   └── tags-rls.test.ts
│   │   └── storage/
│   │       ├── bucket-operations.test.ts
│   │       └── signed-urls.test.ts
│   ├── e2e/ (Future Phase)
│   │   ├── complete-upload-journey.spec.ts
│   │   ├── multi-user-collaboration.spec.ts
│   │   └── mobile-responsive.spec.ts
│   └── fixtures/
│       ├── sample-documents/
│       │   ├── medical-report.pdf
│       │   ├── legal-document.docx
│       │   ├── financial-statement.xlsx
│       │   ├── scanned-receipt.jpg
│       │   └── voice-note.mp3
│       ├── mock-ai-responses.json
│       ├── test-users.json
│       └── test-care-groups.json
```

---

## 🧪 Test Scenarios & Coverage

### Priority 1: Core Functionality (MVP)

#### 1. **Document Upload**

**Unit Tests:**
```typescript
describe("DocumentUpload Component", () => {
  test("accepts valid file types (PDF, DOCX, Excel, Images, Audio)", async () => {
    // Test each supported file type
  });

  test("rejects files exceeding 25MB limit", async () => {
    const largeFile = createMockFile(26 * 1024 * 1024); // 26MB
    // Expect validation error
  });

  test("shows upload progress indicator", async () => {
    // Mock upload, verify progress bar updates
  });

  test("handles duplicate file names with confirmation", async () => {
    // Upload file.pdf, then upload file.pdf again
    // Expect duplicate detection modal
  });
});
```

**Integration Tests:**
```typescript
describe("Document Upload Flow", () => {
  test("uploads document → creates database record → stores in bucket", async () => {
    const file = createMockFile("test.pdf");
    await uploadDocument(file, groupId);
    
    // Verify database record exists
    const doc = await supabase.from("documents_v2").select().eq("title", "test.pdf").single();
    expect(doc).toBeDefined();
    
    // Verify file in storage
    const { data } = await supabase.storage.from("documents-v2").list();
    expect(data.some(f => f.name.includes("test.pdf"))).toBe(true);
  });

  test("triggers AI processing after successful upload", async () => {
    const file = createMockFile("medical-report.pdf");
    const doc = await uploadDocument(file, groupId);
    
    // Wait for processing to complete
    await waitFor(() => {
      expect(doc.processing_status).toBe("completed");
      expect(doc.summary).toBeDefined();
    });
  });
});
```

---

#### 2. **Category & Subgroup Management**

**Unit Tests:**
```typescript
describe("Category Validation", () => {
  test("allows up to 10 custom categories per care group", async () => {
    // Create 10 custom categories (success)
    // Attempt 11th category (expect error)
  });

  test("allows up to 20 subgroups per category", async () => {
    const category = await createCategory({ name: "Medical", groupId });
    
    // Create 20 subgroups (success)
    for (let i = 1; i <= 20; i++) {
      await createSubgroup({ name: `Subgroup ${i}`, categoryId: category.id });
    }
    
    // Attempt 21st subgroup (expect error)
    await expect(
      createSubgroup({ name: "Subgroup 21", categoryId: category.id })
    ).rejects.toThrow("Maximum 20 subgroups per category");
  });

  test("does not count default categories toward 10 custom limit", async () => {
    const categories = await fetchCategories(groupId);
    const customCount = categories.filter(c => !c.is_default).length;
    expect(customCount).toBeLessThanOrEqual(10);
  });
});
```

---

#### 3. **Permission Checks**

**Unit Tests:**
```typescript
describe("Document Permissions", () => {
  test("uploader can always view their own documents", async () => {
    const doc = await createDocument({ uploaderId: user1.id });
    const canView = await checkPermission(user1.id, doc.id, "view");
    expect(canView).toBe(true);
  });

  test("care group members can view shared documents", async () => {
    const doc = await createDocument({ 
      uploaderId: user1.id, 
      groupId, 
      isSharedWithGroup: true 
    });
    
    const canView = await checkPermission(user2.id, doc.id, "view");
    expect(canView).toBe(true);
  });

  test("admin-only documents hidden from non-admin members", async () => {
    const doc = await createDocument({ 
      uploaderId: admin.id, 
      groupId, 
      isAdminOnly: true 
    });
    
    const canViewNonAdmin = await checkPermission(memberUser.id, doc.id, "view");
    const canViewAdmin = await checkPermission(admin.id, doc.id, "view");
    
    expect(canViewNonAdmin).toBe(false);
    expect(canViewAdmin).toBe(true);
  });

  test("only uploader can hard delete documents", async () => {
    const doc = await createDocument({ uploaderId: user1.id, groupId });
    
    const canDeleteMember = await checkPermission(user2.id, doc.id, "delete");
    const canDeleteUploader = await checkPermission(user1.id, doc.id, "delete");
    
    expect(canDeleteMember).toBe(false);
    expect(canDeleteUploader).toBe(true);
  });
});
```

**API Tests:**
```typescript
describe("RLS Policy Enforcement", () => {
  test("SELECT: users can only see their own + shared group documents", async () => {
    // User 1 uploads personal doc (not shared)
    const personalDoc = await supabase.from("documents_v2").insert({
      uploader_user_id: user1.id,
      title: "Personal Doc",
      group_id: null
    });
    
    // User 2 should NOT see it
    const { data } = await supabase
      .from("documents_v2")
      .select()
      .eq("id", personalDoc.id)
      .as(user2);
    
    expect(data).toHaveLength(0);
  });

  test("UPDATE: non-uploader group members can edit shared documents", async () => {
    const doc = await createDocument({ 
      uploaderId: user1.id, 
      groupId, 
      isSharedWithGroup: true 
    });
    
    // User 2 (group member) updates document
    const { error } = await supabase
      .from("documents_v2")
      .update({ notes: "Updated by user2" })
      .eq("id", doc.id)
      .as(user2);
    
    expect(error).toBeNull();
  });

  test("DELETE: only uploader can permanently delete", async () => {
    const doc = await createDocument({ uploaderId: user1.id, groupId });
    
    // User 2 attempts delete (should fail)
    const { error: deleteError } = await supabase
      .from("documents_v2")
      .delete()
      .eq("id", doc.id)
      .as(user2);
    
    expect(deleteError).toBeDefined();
    
    // User 1 deletes (should succeed)
    const { error } = await supabase
      .from("documents_v2")
      .delete()
      .eq("id", doc.id)
      .as(user1);
    
    expect(error).toBeNull();
  });
});
```

---

#### 4. **AI Processing Pipeline**

**Integration Tests:**
```typescript
describe("AI Document Processing", () => {
  test("extracts text from PDF via OCR", async () => {
    const pdfFile = loadTestFile("fixtures/medical-report.pdf");
    const doc = await uploadAndProcess(pdfFile, groupId);
    
    expect(doc.full_text).toBeDefined();
    expect(doc.full_text.length).toBeGreaterThan(100);
  });

  test("generates category-specific summary for medical documents", async () => {
    const medicalDoc = await uploadAndProcess(
      loadTestFile("fixtures/medical-report.pdf"),
      groupId,
      { categoryId: medicalCategoryId }
    );
    
    expect(medicalDoc.summary).toContain("diagnosis");
    // Should use medical-specific AI prompt
  });

  test("extracts appointments from document text", async () => {
    const doc = await uploadAndProcess(
      loadTestFile("fixtures/appointment-letter.pdf"),
      groupId
    );
    
    // Wait for AI extraction
    const extractions = await fetchExtractions(doc.id);
    const appointmentExtraction = extractions.find(e => e.type === "appointment");
    
    expect(appointmentExtraction).toBeDefined();
    expect(appointmentExtraction.data).toMatchObject({
      date: expect.any(String),
      time: expect.any(String),
      provider: expect.any(String)
    });
  });

  test("handles AI processing failures gracefully", async () => {
    // Mock AI API failure
    mockAIApiError();
    
    const doc = await uploadAndProcess(loadTestFile("fixtures/test.pdf"), groupId);
    
    expect(doc.processing_status).toBe("failed");
    expect(doc.summary).toBeNull();
    // Document should still be accessible
  });
});
```

---

#### 5. **Version Control**

**Integration Tests:**
```typescript
describe("Document Versioning", () => {
  test("creates new version when user chooses 'Version'", async () => {
    const originalDoc = await createDocument({ title: "Report v1" });
    
    // Upload new file with "Version" option
    const newVersion = await uploadNewVersion(originalDoc.id, newFile, { 
      action: "version" 
    });
    
    expect(newVersion.version_number).toBe(2);
    expect(newVersion.parent_version_id).toBe(originalDoc.id);
    
    // Verify version record in document_versions table
    const versions = await fetchVersions(originalDoc.id);
    expect(versions).toHaveLength(2);
  });

  test("replaces existing document when user chooses 'Replace'", async () => {
    const originalDoc = await createDocument({ title: "Report v1", fileUrl: "old.pdf" });
    
    // Upload new file with "Replace" option
    await uploadNewVersion(originalDoc.id, newFile, { action: "replace" });
    
    // Original document updated, no new version created
    const updatedDoc = await fetchDocument(originalDoc.id);
    expect(updatedDoc.file_url).not.toBe("old.pdf");
    expect(updatedDoc.version_number).toBe(1); // Still version 1
  });

  test("allows restoring previous version", async () => {
    const doc = await createDocument({ title: "Report" });
    
    // Create version 2
    await uploadNewVersion(doc.id, newFile, { action: "version" });
    
    // Restore version 1
    await restoreVersion(doc.id, 1);
    
    // Verify current version is now restored content
    const restoredDoc = await fetchDocument(doc.id);
    expect(restoredDoc.file_url).toBe(doc.file_url); // Original file
  });

  test("enforces maximum 5 versions per document", async () => {
    const doc = await createDocument({ title: "Report" });
    
    // Create 5 versions
    for (let i = 2; i <= 6; i++) {
      await uploadNewVersion(doc.id, newFile, { action: "version" });
    }
    
    const versions = await fetchVersions(doc.id);
    expect(versions).toHaveLength(5); // Oldest version pruned
  });
});
```

---

#### 6. **Soft Delete & Restore**

**Integration Tests:**
```typescript
describe("Soft Delete Model", () => {
  test("group member soft delete removes from care group only", async () => {
    const doc = await createDocument({ 
      uploaderId: user1.id, 
      groupId, 
      isSharedWithGroup: true 
    });
    
    // User 2 (group member) soft deletes
    await softDeleteDocument(doc.id, groupId, user2.id);
    
    // Document no longer in care group view
    const groupDocs = await fetchGroupDocuments(groupId);
    expect(groupDocs.find(d => d.id === doc.id)).toBeUndefined();
    
    // Document still in uploader's personal documents
    const personalDocs = await fetchPersonalDocuments(user1.id);
    expect(personalDocs.find(d => d.id === doc.id)).toBeDefined();
  });

  test("uploader can hard delete (permanent)", async () => {
    const doc = await createDocument({ uploaderId: user1.id, groupId });
    
    // User 1 (uploader) hard deletes
    await hardDeleteDocument(doc.id, user1.id);
    
    // Document completely removed from database
    const deletedDoc = await fetchDocument(doc.id);
    expect(deletedDoc).toBeNull();
  });

  test("admins can view deleted documents in trash", async () => {
    const doc = await createDocument({ uploaderId: user1.id, groupId });
    await softDeleteDocument(doc.id, groupId, user2.id);
    
    // Admin can see in trash
    const trashedDocs = await fetchTrashedDocuments(groupId, adminUser.id);
    expect(trashedDocs.find(d => d.id === doc.id)).toBeDefined();
  });

  test("deleted documents auto-purge after 30 days", async () => {
    const doc = await createDocument({ uploaderId: user1.id, groupId });
    
    // Soft delete and set deleted_at to 31 days ago
    await supabase
      .from("documents_v2")
      .update({ 
        is_deleted: true, 
        deleted_at: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000) 
      })
      .eq("id", doc.id);
    
    // Run cleanup job
    await runScheduledCleanup();
    
    // Document should be hard deleted
    const deletedDoc = await fetchDocument(doc.id);
    expect(deletedDoc).toBeNull();
  });
});
```

---

#### 7. **Search Functionality**

**Integration Tests:**
```typescript
describe("Document Search", () => {
  test("full-text search returns relevant documents", async () => {
    await createDocument({ 
      title: "Cardiology Report", 
      fullText: "Patient shows signs of atrial fibrillation" 
    });
    
    const results = await searchDocuments("atrial fibrillation", groupId);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].title).toBe("Cardiology Report");
  });

  test("semantic search understands natural language queries", async () => {
    await createDocument({ 
      title: "Heart Health Report", 
      fullText: "Irregular heartbeat detected" 
    });
    
    // User searches in natural language
    const results = await searchDocuments("heart problems", groupId);
    expect(results.length).toBeGreaterThan(0);
    // Should match "Heart Health Report" semantically
  });

  test("filters search results by category", async () => {
    await createDocument({ title: "Medical Report", categoryId: medicalCategoryId });
    await createDocument({ title: "Legal Document", categoryId: legalCategoryId });
    
    const results = await searchDocuments("report document", groupId, { 
      categoryId: medicalCategoryId 
    });
    
    expect(results.every(d => d.category_id === medicalCategoryId)).toBe(true);
  });

  test("returns search context snippets", async () => {
    await createDocument({ 
      title: "Lab Results", 
      fullText: "Cholesterol levels are elevated at 240 mg/dL. Patient advised to reduce dietary intake." 
    });
    
    const results = await searchDocuments("cholesterol elevated", groupId);
    expect(results[0].snippet).toContain("elevated at 240 mg/dL");
  });
});
```

---

#### 8. **Associations**

**Integration Tests:**
```typescript
describe("Document Associations", () => {
  test("links document to appointment", async () => {
    const doc = await createDocument({ title: "Appointment Letter" });
    const appointment = await createAppointment({ date: "2025-05-15" });
    
    await linkDocumentToEntity(doc.id, "appointments", appointment.id);
    
    // Verify bidirectional relationship
    const docAssociations = await fetchAssociations("documents_v2", doc.id);
    expect(docAssociations.appointments).toContainEqual({ id: appointment.id });
    
    const apptDocs = await fetchLinkedDocuments("appointments", appointment.id);
    expect(apptDocs).toContainEqual({ id: doc.id });
  });

  test("removes association when document is soft deleted", async () => {
    const doc = await createDocument({ title: "Task Document", groupId });
    const task = await createTask({ title: "Complete form" });
    
    await linkDocumentToEntity(doc.id, "tasks", task.id);
    await softDeleteDocument(doc.id, groupId, userId);
    
    // Association should be removed
    const taskDocs = await fetchLinkedDocuments("tasks", task.id);
    expect(taskDocs.find(d => d.id === doc.id)).toBeUndefined();
  });

  test("unlinking document creates audit log entry", async () => {
    const doc = await createDocument({ title: "Contact Document" });
    const contact = await createContact({ name: "Dr. Smith" });
    
    await linkDocumentToEntity(doc.id, "contacts", contact.id);
    await unlinkDocumentFromEntity(doc.id, "contacts", contact.id);
    
    // Verify audit log
    const auditLogs = await fetchAuditLogs(doc.id);
    expect(auditLogs.some(log => 
      log.action === "unlink" && log.details.entity_type === "contacts"
    )).toBe(true);
  });
});
```

---

#### 9. **Bulk Operations**

**Integration Tests:**
```typescript
describe("Bulk Document Operations", () => {
  test("downloads multiple documents as ZIP", async () => {
    const doc1 = await createDocument({ title: "Report 1" });
    const doc2 = await createDocument({ title: "Report 2" });
    
    const zipBlob = await bulkDownload([doc1.id, doc2.id]);
    
    expect(zipBlob.type).toBe("application/zip");
    expect(zipBlob.size).toBeGreaterThan(0);
  });

  test("applies tags to multiple documents", async () => {
    const docs = await Promise.all([
      createDocument({ title: "Doc 1" }),
      createDocument({ title: "Doc 2" }),
      createDocument({ title: "Doc 3" })
    ]);
    
    const tag = await createTag({ name: "urgent", groupId });
    await bulkAddTag(docs.map(d => d.id), tag.id);
    
    // Verify all documents have tag
    for (const doc of docs) {
      const docTags = await fetchDocumentTags(doc.id);
      expect(docTags.some(t => t.id === tag.id)).toBe(true);
    }
  });

  test("bulk reassigns category/subgroup", async () => {
    const docs = await Promise.all([
      createDocument({ title: "Doc 1", categoryId: medicalCategoryId }),
      createDocument({ title: "Doc 2", categoryId: medicalCategoryId })
    ]);
    
    await bulkReassignCategory(docs.map(d => d.id), legalCategoryId);
    
    // Verify category updated
    const updatedDocs = await fetchDocuments(docs.map(d => d.id));
    expect(updatedDocs.every(d => d.category_id === legalCategoryId)).toBe(true);
  });
});
```

---

#### 10. **Feature Flag System**

**Unit Tests:**
```typescript
describe("Documents V2 Access Control", () => {
  test("admins can access when feature flag is false", async () => {
    await setFeatureFlag("documents_v2_enabled_for_all", false);
    
    const canAccess = await checkDocumentsV2Access(adminUser.id, groupId);
    expect(canAccess).toBe(true);
  });

  test("non-admins cannot access when feature flag is false", async () => {
    await setFeatureFlag("documents_v2_enabled_for_all", false);
    
    const canAccess = await checkDocumentsV2Access(memberUser.id, groupId);
    expect(canAccess).toBe(false);
  });

  test("all users can access when feature flag is true", async () => {
    await setFeatureFlag("documents_v2_enabled_for_all", true);
    
    const canAccessMember = await checkDocumentsV2Access(memberUser.id, groupId);
    const canAccessAdmin = await checkDocumentsV2Access(adminUser.id, groupId);
    
    expect(canAccessMember).toBe(true);
    expect(canAccessAdmin).toBe(true);
  });
});
```

---

### Priority 2: UI/UX Consistency

#### 11. **Component Rendering**

**Unit Tests:**
```typescript
describe("DocumentV2Modal Component", () => {
  test("renders two-column layout on desktop", () => {
    const { container } = render(<DocumentV2Modal document={mockDoc} />);
    const grid = container.querySelector(".lg\\:grid-cols-2");
    expect(grid).toBeInTheDocument();
  });

  test("renders single column on mobile", () => {
    mockViewport("mobile");
    const { container } = render(<DocumentV2Modal document={mockDoc} />);
    const grid = container.querySelector(".grid-cols-1");
    expect(grid).toBeInTheDocument();
  });

  test("displays UnifiedAssociationManager in right column", () => {
    render(<DocumentV2Modal document={mockDoc} />);
    expect(screen.getByText("Related Items")).toBeInTheDocument();
  });

  test("uses semantic color tokens (not direct colors)", () => {
    const { container } = render(<DocumentV2Modal document={mockDoc} />);
    
    // Should NOT find direct color classes
    expect(container.innerHTML).not.toMatch(/bg-blue-\d+/);
    expect(container.innerHTML).not.toMatch(/text-white/);
    
    // Should find semantic tokens
    expect(container.innerHTML).toMatch(/bg-primary/);
    expect(container.innerHTML).toMatch(/text-muted-foreground/);
  });
});
```

---

### Priority 3: Performance & Edge Cases

#### 12. **Performance Tests**

```typescript
describe("Performance", () => {
  test("handles large document lists (1000+ items) efficiently", async () => {
    // Create 1000 documents
    await bulkCreateDocuments(1000, groupId);
    
    const startTime = performance.now();
    const docs = await fetchGroupDocuments(groupId);
    const endTime = performance.now();
    
    expect(docs.length).toBe(1000);
    expect(endTime - startTime).toBeLessThan(2000); // < 2 seconds
  });

  test("debounces search input to prevent excessive API calls", async () => {
    const searchSpy = vi.fn();
    render(<DocumentSearchBar onSearch={searchSpy} />);
    
    const searchInput = screen.getByPlaceholderText("Search documents...");
    
    // Type quickly
    fireEvent.change(searchInput, { target: { value: "test" } });
    fireEvent.change(searchInput, { target: { value: "test query" } });
    
    // Should only call search once after debounce delay
    await waitFor(() => {
      expect(searchSpy).toHaveBeenCalledTimes(1);
    }, { timeout: 1000 });
  });

  test("implements pagination for large result sets", async () => {
    await bulkCreateDocuments(100, groupId);
    
    const page1 = await fetchGroupDocuments(groupId, { page: 1, limit: 25 });
    const page2 = await fetchGroupDocuments(groupId, { page: 2, limit: 25 });
    
    expect(page1.length).toBe(25);
    expect(page2.length).toBe(25);
    expect(page1[0].id).not.toBe(page2[0].id); // Different documents
  });
});
```

---

## 🚀 CI/CD Integration

### GitHub Actions Workflow

```yaml
name: Documents V2 Tests

on:
  pull_request:
    paths:
      - "src/components/documents/**"
      - "src/hooks/useDocument*.ts"
      - "tests/documents-v2/**"
      - "supabase/functions/**"

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: "20"
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run unit tests
        run: npm run test:unit -- tests/documents-v2/unit
      
      - name: Run integration tests
        run: npm run test:integration -- tests/documents-v2/integration
      
      - name: Check code coverage
        run: npm run test:coverage
        env:
          COVERAGE_THRESHOLD: 80
      
      - name: Upload coverage report
        uses: codecov/codecov-action@v3
```

### Pre-Commit Hooks

```json
{
  "husky": {
    "hooks": {
      "pre-commit": "npm run test:unit -- --changed",
      "pre-push": "npm run test:integration"
    }
  }
}
```

---

## 📊 Code Coverage Requirements

### Minimum Coverage Targets

- **Overall:** 80% minimum
- **Core Logic:** 90% minimum
  - Permission checks
  - Validation functions
  - Data transformations
- **UI Components:** 70% minimum
- **Integration Flows:** 85% minimum

### Coverage Exclusions

- Generated types (`supabase/types.ts`)
- Mock data fixtures
- Storybook stories
- Configuration files

---

## 🧰 Testing Tools & Setup

### Dependencies

```json
{
  "devDependencies": {
    "@testing-library/react": "^14.0.0",
    "@testing-library/jest-dom": "^6.1.0",
    "@testing-library/user-event": "^14.5.0",
    "vitest": "^1.0.0",
    "happy-dom": "^12.10.0",
    "msw": "^2.0.0",
    "@vitest/coverage-v8": "^1.0.0"
  }
}
```

### Vitest Configuration

```typescript
// vitest.config.ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "happy-dom",
    setupFiles: ["./tests/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        "node_modules/",
        "tests/fixtures/",
        "**/*.d.ts",
        "**/*.config.*",
        "**/mockData/**"
      ],
      thresholds: {
        global: {
          statements: 80,
          branches: 80,
          functions: 80,
          lines: 80
        }
      }
    }
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src")
    }
  }
});
```

### Test Setup File

```typescript
// tests/setup.ts
import "@testing-library/jest-dom";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";
import { server } from "./mocks/server";

// Mock Supabase client
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(),
    storage: {
      from: vi.fn()
    },
    auth: {
      getUser: vi.fn()
    }
  }
}));

// Start MSW server
beforeAll(() => server.listen());
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => server.close());
```

---

## 📦 Test Data Fixtures

### Sample Document Fixtures

```typescript
// tests/fixtures/mock-documents.ts
export const mockMedicalDocument = {
  id: "doc-1",
  title: "Cardiology Consultation Report",
  original_filename: "cardiology-2025-01-15.pdf",
  file_url: "https://storage.example.com/documents/doc-1.pdf",
  file_type: "application/pdf",
  file_size: 1024000,
  uploader_user_id: "user-1",
  group_id: "group-1",
  category_id: "medical-category-id",
  summary: "Patient consultation for irregular heartbeat. Recommended EKG.",
  full_text: "Patient presented with symptoms of irregular heartbeat...",
  processing_status: "completed",
  is_admin_only: false,
  version_number: 1,
  created_at: "2025-01-15T10:00:00Z"
};

export const mockLegalDocument = {
  id: "doc-2",
  title: "Power of Attorney",
  original_filename: "poa-signed.pdf",
  file_url: "https://storage.example.com/documents/doc-2.pdf",
  file_type: "application/pdf",
  file_size: 512000,
  uploader_user_id: "user-1",
  group_id: "group-1",
  category_id: "legal-category-id",
  summary: "Durable power of attorney granting healthcare decision-making authority.",
  processing_status: "completed",
  is_admin_only: true, // Admin-only document
  created_at: "2025-01-10T14:30:00Z"
};
```

### Mock AI Responses

```typescript
// tests/fixtures/mock-ai-responses.json
{
  "appointment_extraction": {
    "type": "appointment",
    "confidence": 0.92,
    "data": {
      "date": "2025-05-15",
      "time": "14:00",
      "provider": "Dr. Sarah Johnson",
      "location": "Main Street Cardiology Center",
      "address": "123 Main St, Suite 200",
      "category": "Medical",
      "notes": "Follow-up consultation for EKG results"
    }
  },
  "contact_extraction": {
    "type": "contact",
    "confidence": 0.88,
    "data": {
      "first_name": "Sarah",
      "last_name": "Johnson",
      "title": "Dr.",
      "contact_type": "Healthcare Provider",
      "phone_primary": "(555) 123-4567",
      "email_work": "sjohnson@mainstcardio.com"
    }
  },
  "task_extraction": {
    "type": "task",
    "confidence": 0.85,
    "data": {
      "title": "Schedule follow-up EKG",
      "description": "Contact cardiology office to schedule EKG within 2 weeks",
      "due_date": "2025-05-01",
      "priority": "high"
    }
  }
}
```

---

## 🎯 Test Execution Commands

```bash
# Run all tests
npm run test

# Run unit tests only
npm run test:unit

# Run integration tests only
npm run test:integration

# Run specific test file
npm run test tests/documents-v2/unit/DocumentV2Modal.test.tsx

# Run tests in watch mode
npm run test:watch

# Run tests with coverage report
npm run test:coverage

# Run tests for changed files only (pre-commit)
npm run test -- --changed

# Run E2E tests (future)
npm run test:e2e
```

---

## 📈 Success Criteria

### Phase 1 (MVP) Testing Goals

- ✅ 80%+ code coverage across all Documents V2 code
- ✅ 100% of critical paths tested (upload, process, permissions)
- ✅ All RLS policies validated with automated tests
- ✅ Zero high-severity security vulnerabilities
- ✅ All integration tests passing before deployment

### Phase 2 Testing Goals

- ✅ E2E test suite covering complete user journeys
- ✅ Performance benchmarks established and monitored
- ✅ Cross-browser compatibility tests (Chrome, Firefox, Safari, Edge)
- ✅ Mobile responsive tests (iOS Safari, Android Chrome)
- ✅ Accessibility audit (WCAG 2.1 AA compliance)

---

## 📝 Test Maintenance Guidelines

1. **Update tests when features change** - Keep tests in sync with implementation
2. **Write tests first for bug fixes** - Add regression test before fixing bug
3. **Remove obsolete tests** - Delete tests for removed features
4. **Keep fixtures realistic** - Use production-like test data
5. **Mock external dependencies** - Don't rely on external APIs in tests
6. **Run full suite before merging** - Ensure all tests pass on PR

---

**Document Control:**
- Last Updated: 2025-01-15
- Next Review: 2025-01-22
- Owner: Elder Care Development Team
