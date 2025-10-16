import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Plus, FileText, FolderOpen, Settings, Upload, Loader2, CheckCircle, XCircle, Clock } from "lucide-react";
import SEO from "@/components/layout/SEO";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DocumentV2Modal } from "@/components/documents/DocumentV2Modal";
import { DocumentUploadModal } from "@/components/documents/DocumentUploadModal";
import { DocumentCategoryManager } from "@/components/documents/DocumentCategoryManager";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { UnifiedTableView, TableColumn } from "@/components/shared/UnifiedTableView";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useDemo } from "@/hooks/useDemo";
import { useDocumentsV2Access } from "@/hooks/useDocumentsV2Access";
import { useDocumentsV2 } from "@/hooks/useDocumentsV2";
import { useQueryClient } from "@tanstack/react-query";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const formatFileSize = (bytes?: number) => {
  if (!bytes) return 'Unknown';
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
};

export default function DocumentsV2Page() {
  const { groupId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState("care-group");
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<any>(null);
  const [showDocumentModal, setShowDocumentModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadIsPersonal, setUploadIsPersonal] = useState(false);

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isDemo } = useDemo();
  const { data: accessData, isLoading: accessLoading } = useDocumentsV2Access();
  const hasAccess = accessData?.hasAccess || false;

  // Use the new hook for care group documents
  const { 
    documents: careGroupDocuments, 
    isLoading: careGroupLoading, 
    uploadDocument: uploadToGroup,
    deleteDocument: deleteGroupDoc,
    isUploading: isUploadingToGroup
  } = useDocumentsV2(groupId, false);

  // Use the new hook for personal documents
  const { 
    documents: personalDocuments, 
    isLoading: personalLoading,
    uploadDocument: uploadToPersonal,
    deleteDocument: deletePersonalDoc,
    isUploading: isUploadingToPersonal
  } = useDocumentsV2(groupId, true);

  // Handle opening document from URL parameter
  useEffect(() => {
    const documentId = searchParams.get('openDocument');
    if (documentId && !showDocumentModal) {
      // Search in both care group and personal documents
      const doc = [...careGroupDocuments, ...personalDocuments].find(d => d.id === documentId);
      if (doc) {
        setSelectedDocument(doc);
        setShowDocumentModal(true);
        // Remove the query parameter
        searchParams.delete('openDocument');
        setSearchParams(searchParams);
      }
    }
  }, [searchParams, careGroupDocuments, personalDocuments, showDocumentModal, setSearchParams]);

  const blockOperation = () => {
    if (isDemo) {
      toast({
        title: "Demo Mode",
        description: "This action is not available in demo mode.",
        variant: "destructive",
      });
      return true;
    }
    return false;
  };

  const handleUploadClick = (isPersonal: boolean) => {
    if (blockOperation()) return;
    setUploadIsPersonal(isPersonal);
    setShowUploadModal(true);
  };

  const handleUploadSubmit = (file: File, metadata: {
    title?: string;
    categoryId?: string;
    notes?: string;
  }) => {
    if (uploadIsPersonal) {
      uploadToPersonal({
        file,
        groupId: null,
        title: metadata.title,
        categoryId: metadata.categoryId,
        notes: metadata.notes,
        isShared: false
      });
    } else {
      uploadToGroup({
        file,
        groupId: groupId!,
        title: metadata.title,
        categoryId: metadata.categoryId,
        notes: metadata.notes,
        isShared: true
      });
    }
    setShowUploadModal(false);
  };

  const handleEditDocument = (document: any) => {
    if (blockOperation()) return;
    setSelectedDocument(document);
    setShowDocumentModal(true);
  };

  const handleDeleteDocument = (documentId: string, isPersonal: boolean) => {
    if (blockOperation()) return;
    if (confirm("Delete this document?")) {
      if (isPersonal) {
        deletePersonalDoc(documentId);
      } else {
        deleteGroupDoc(documentId);
      }
    }
  };

  const handleBulkDelete = (documentIds: string[], isPersonal: boolean) => {
    if (blockOperation()) return;
    documentIds.forEach(id => {
      if (isPersonal) {
        deletePersonalDoc(id);
      } else {
        deleteGroupDoc(id);
      }
    });
  };

  // Define table columns
  const columns: TableColumn[] = [
    {
      key: "title",
      label: "Title",
      sortable: true,
      render: (value, row) => (
        <div>
          <div className="font-medium">
            {value || row.original_filename || "Untitled Document"}
          </div>
          {row.summary && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <p className="text-xs text-muted-foreground truncate max-w-[300px] cursor-help">
                    {row.summary}
                  </p>
                </TooltipTrigger>
                <TooltipContent className="max-w-md">
                  <p className="text-sm">{row.summary}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      ),
    },
    {
      key: "processing_status",
      label: "Status",
      sortable: true,
      render: (value) => {
        if (value === 'completed') {
          return (
            <Badge variant="default" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
              <CheckCircle className="h-3 w-3 mr-1" />
              Processed
            </Badge>
          );
        }
        if (value === 'processing') {
          return (
            <Badge variant="default" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100">
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              Processing
            </Badge>
          );
        }
        if (value === 'failed') {
          return (
            <Badge variant="destructive">
              <XCircle className="h-3 w-3 mr-1" />
              Failed
            </Badge>
          );
        }
        return (
          <Badge variant="secondary">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
      },
    },
    {
      key: "category_id",
      label: "Category",
      sortable: true,
      render: (value, row) => {
        const categoryName = row.document_categories?.name;
        return categoryName ? (
          <Badge variant="secondary">{categoryName}</Badge>
        ) : (
          <span className="text-muted-foreground">-</span>
        );
      },
    },
    {
      key: "file_type",
      label: "Type",
      sortable: true,
      render: (value, row) => (
        <Badge variant="outline" className="text-xs">
          {row.original_filename?.split('.').pop()?.toUpperCase() || 'Unknown'}
        </Badge>
      ),
    },
    {
      key: "file_size",
      label: "Size",
      sortable: true,
      render: (value) => <span className="text-sm">{formatFileSize(value)}</span>,
    },
    {
      key: "created_at",
      label: "Upload Date",
      sortable: true,
      render: (value) => (
        <div className="text-sm">{format(new Date(value), 'MM/dd/yy')}</div>
      ),
    },
  ];

  // Access control check
  if (accessLoading) {
    return (
      <div className="container mx-auto p-4">
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <p>Checking access...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="container mx-auto p-4">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium">Documents V2 Not Available</p>
            <p className="text-sm text-muted-foreground text-center max-w-md">
              The new document management system is currently in beta and only available to administrators.
              Please contact your care group administrator for access.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!groupId) {
    return (
      <div className="container mx-auto p-4">
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <p>Invalid group</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <>
      <SEO
        title="Documents V2 - Care Coordination"
        description="Manage and organize documents with advanced features including categories, tags, and version control."
      />
      <div className="container mx-auto p-4 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileText className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold">Documents (New)</h1>
              <p className="text-muted-foreground">
                Advanced document management with categories, tags, and version control
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowCategoryManager(true)}>
              <Settings className="mr-2 h-4 w-4" />
              Manage Categories
            </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="care-group">
              <FolderOpen className="mr-2 h-4 w-4" />
              Care Group ({careGroupDocuments.length})
            </TabsTrigger>
            <TabsTrigger value="personal">
              <FileText className="mr-2 h-4 w-4" />
              My Documents ({personalDocuments.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="care-group" className="space-y-4">
            <div className="flex justify-end mb-4">
              <Button 
                onClick={() => handleUploadClick(false)} 
                disabled={isUploadingToGroup}
              >
                {isUploadingToGroup ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                {isUploadingToGroup ? 'Uploading & Processing...' : 'Upload Document'}
              </Button>
            </div>
            <Card>
              <CardHeader>
                <CardTitle>Care Group Documents</CardTitle>
                <CardDescription>
                  Documents shared with all members - AI processing with Lovable Cloud
                </CardDescription>
              </CardHeader>
              <CardContent>
                <UnifiedTableView
                  title=""
                  data={careGroupDocuments}
                  columns={columns}
                  loading={careGroupLoading}
                  onEdit={handleEditDocument}
                  onDelete={(id) => handleDeleteDocument(id, false)}
                  onBulkDelete={(ids) => handleBulkDelete(ids, false)}
                  searchable={true}
                  searchPlaceholder="Search documents..."
                  defaultSortBy="created_at"
                  defaultSortOrder="desc"
                  entityType="document"
                  getItemTitle={(item) => item.title || item.original_filename || "Untitled"}
                  emptyMessage="No shared documents"
                  emptyDescription="Upload documents to share with your care group."
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="personal" className="space-y-4">
            <div className="flex justify-end mb-4">
              <Button 
                onClick={() => handleUploadClick(true)} 
                disabled={isUploadingToPersonal}
              >
                {isUploadingToPersonal ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                {isUploadingToPersonal ? 'Uploading & Processing...' : 'Upload Document'}
              </Button>
            </div>
            <Card>
              <CardHeader>
                <CardTitle>My Personal Documents</CardTitle>
                <CardDescription>
                  Private documents visible only to you - AI processing with Lovable Cloud
                </CardDescription>
              </CardHeader>
              <CardContent>
                <UnifiedTableView
                  title=""
                  data={personalDocuments}
                  columns={columns}
                  loading={personalLoading}
                  onEdit={handleEditDocument}
                  onDelete={(id) => handleDeleteDocument(id, true)}
                  onBulkDelete={(ids) => handleBulkDelete(ids, true)}
                  searchable={true}
                  searchPlaceholder="Search documents..."
                  defaultSortBy="created_at"
                  defaultSortOrder="desc"
                  entityType="document"
                  getItemTitle={(item) => item.title || item.original_filename || "Untitled"}
                  emptyMessage="No personal documents"
                  emptyDescription="Upload documents for your personal use."
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Upload Modal */}
        <DocumentUploadModal
          isOpen={showUploadModal}
          onClose={() => setShowUploadModal(false)}
          onUpload={handleUploadSubmit}
          groupId={groupId}
          isUploading={uploadIsPersonal ? isUploadingToPersonal : isUploadingToGroup}
        />

        {/* Category Manager Dialog */}
        <Dialog open={showCategoryManager} onOpenChange={setShowCategoryManager}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Manage Document Categories</DialogTitle>
            </DialogHeader>
            <DocumentCategoryManager groupId={groupId} />
          </DialogContent>
        </Dialog>

        {/* Document Modal */}
        <DocumentV2Modal
          document={selectedDocument}
          isOpen={showDocumentModal}
          onClose={() => {
            setShowDocumentModal(false);
            setSelectedDocument(null);
          }}
          groupId={groupId}
        />
      </div>
    </>
  );
}
