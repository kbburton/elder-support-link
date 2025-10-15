import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Plus, FileText, FolderOpen, Tag, Settings } from "lucide-react";
import SEO from "@/components/layout/SEO";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DocumentV2Modal } from "@/components/documents/DocumentV2Modal";
import { DocumentCategoryManager } from "@/components/documents/DocumentCategoryManager";
import { DocumentUpload } from "@/components/documents/DocumentUpload";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { UnifiedTableView, TableColumn } from "@/components/shared/UnifiedTableView";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useDemo } from "@/hooks/useDemo";
import { useDocumentsV2Access } from "@/hooks/useDocumentsV2Access";
import { softDeleteEntity, bulkSoftDelete } from "@/lib/delete/rpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";

const formatFileSize = (bytes?: number) => {
  if (!bytes) return 'Unknown';
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
};

export default function DocumentsV2Page() {
  const { groupId } = useParams();
  const [activeTab, setActiveTab] = useState("care-group");
  const [showUpload, setShowUpload] = useState(false);
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<any>(null);
  const [showDocumentModal, setShowDocumentModal] = useState(false);

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isDemo } = useDemo();
  const { data: accessData, isLoading: accessLoading } = useDocumentsV2Access();
  const hasAccess = accessData?.hasAccess || false;

  // Get current user
  const { data: currentUser } = useQuery({
    queryKey: ["current-user"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    },
  });

  // Fetch care group documents (shared with group)
  const { data: careGroupDocuments = [], isLoading: careGroupLoading, refetch: refetchCareGroup } = useQuery({
    queryKey: ["documents-v2-care-group", groupId],
    queryFn: async () => {
      if (!groupId) return [];
      
      const { data, error } = await supabase
        .from("documents")
        .select("*, document_categories(name)")
        .eq("group_id", groupId)
        .eq("is_deleted", false)
        .eq("is_shared_with_group", true)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!groupId && hasAccess && !isDemo,
  });

  // Fetch personal documents (not shared)
  const { data: personalDocuments = [], isLoading: personalLoading, refetch: refetchPersonal } = useQuery({
    queryKey: ["documents-v2-personal", groupId, currentUser?.id],
    queryFn: async () => {
      if (!groupId || !currentUser) return [];
      
      const { data, error } = await supabase
        .from("documents")
        .select("*, document_categories(name)")
        .eq("group_id", groupId)
        .eq("is_deleted", false)
        .eq("uploaded_by_user_id", currentUser.id)
        .eq("is_shared_with_group", false)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!groupId && !!currentUser && hasAccess && !isDemo,
  });

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

  // Delete mutations
  const deleteDocumentMutation = useMutation({
    mutationFn: async (documentId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      
      await softDeleteEntity("document", documentId, user.id, user.email || "");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents-v2-care-group"] });
      queryClient.invalidateQueries({ queryKey: ["documents-v2-personal"] });
      toast({
        title: "Document deleted",
        description: "Document has been moved to trash.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to delete document.",
        variant: "destructive",
      });
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (documentIds: string[]) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      
      await bulkSoftDelete("document", documentIds, user.id, user.email || "");
    },
    onSuccess: (_, documentIds) => {
      queryClient.invalidateQueries({ queryKey: ["documents-v2-care-group"] });
      queryClient.invalidateQueries({ queryKey: ["documents-v2-personal"] });
      toast({
        title: "Documents deleted",
        description: `${documentIds.length} document(s) moved to trash.`,
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to delete documents.",
        variant: "destructive",
      });
    },
  });

  const handleEditDocument = (document: any) => {
    if (blockOperation()) return;
    setSelectedDocument(document);
    setShowDocumentModal(true);
  };

  const handleDeleteDocument = (documentId: string) => {
    if (blockOperation()) return;
    if (confirm("Delete this document?")) {
      deleteDocumentMutation.mutate(documentId);
    }
  };

  const handleBulkDelete = (documentIds: string[]) => {
    if (blockOperation()) return;
    bulkDeleteMutation.mutate(documentIds);
  };

  // Define table columns
  const columns: TableColumn[] = [
    {
      key: "title",
      label: "Title",
      sortable: true,
      render: (value, row) => (
        <div className="font-medium">
          {value || row.original_filename || "Untitled Document"}
        </div>
      ),
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
      key: "current_version",
      label: "Version",
      sortable: true,
      render: (value) => value ? (
        <Badge variant="outline">v{value}</Badge>
      ) : (
        <Badge variant="outline">v1</Badge>
      ),
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
            <Button onClick={() => setShowUpload(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Upload Document
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
            <Card>
              <CardHeader>
                <CardTitle>Care Group Documents</CardTitle>
                <CardDescription>
                  Documents shared with all members of this care group
                </CardDescription>
              </CardHeader>
              <CardContent>
                <UnifiedTableView
                  title=""
                  data={careGroupDocuments}
                  columns={columns}
                  loading={careGroupLoading}
                  onEdit={handleEditDocument}
                  onDelete={handleDeleteDocument}
                  onBulkDelete={handleBulkDelete}
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
            <Card>
              <CardHeader>
                <CardTitle>My Personal Documents</CardTitle>
                <CardDescription>
                  Private documents visible only to you
                </CardDescription>
              </CardHeader>
              <CardContent>
                <UnifiedTableView
                  title=""
                  data={personalDocuments}
                  columns={columns}
                  loading={personalLoading}
                  onEdit={handleEditDocument}
                  onDelete={handleDeleteDocument}
                  onBulkDelete={handleBulkDelete}
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

        {/* Upload Dialog */}
        <Dialog open={showUpload} onOpenChange={setShowUpload}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Upload Documents</DialogTitle>
            </DialogHeader>
            <DocumentUpload
              onUploadComplete={() => {
                refetchCareGroup();
                refetchPersonal();
                toast({
                  title: "Upload Complete",
                  description: "Document uploaded successfully.",
                });
              }}
              onClose={() => setShowUpload(false)}
            />
          </DialogContent>
        </Dialog>

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
