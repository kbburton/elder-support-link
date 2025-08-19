import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Plus, FileText, Link as LinkIcon } from "lucide-react";
import SEO from "@/components/layout/SEO";
import { DocumentUpload } from "@/components/documents/DocumentUpload";
import { DocumentModal } from "@/components/documents/DocumentModal";
import { DocumentAssociationsModal } from "@/components/documents/DocumentAssociationsModal";
import { UnifiedTableView, TableColumn } from "@/components/shared/UnifiedTableView";
import { Badge } from "@/components/ui/badge";
import { format, formatDistanceToNow } from "date-fns";
import { softDeleteEntity, bulkSoftDelete } from "@/lib/delete/rpc";
import { useToast } from "@/hooks/use-toast";
import { useDemo } from "@/hooks/useDemo";

const formatFileSize = (bytes?: number) => {
  if (!bytes) return 'Unknown';
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
};

export default function DocumentsPage() {
  const { groupId } = useParams();
  const [showUpload, setShowUpload] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<any>(null);
  const [showDocumentModal, setShowDocumentModal] = useState(false);
  const [selectedDocumentForAssociations, setSelectedDocumentForAssociations] = useState<any>(null);
  const [isAssociationsModalOpen, setIsAssociationsModalOpen] = useState(false);

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const demo = useDemo();

  // Fetch documents with uploader profile information
  const { data: documents = [], isLoading, refetch, error: queryError } = useQuery({
    queryKey: ["documents", groupId],
    queryFn: async () => {
      console.log("Documents query starting for groupId:", groupId);
      if (!groupId || groupId === ':groupId' || groupId === 'undefined' || groupId.startsWith(':')) {
        console.log("Invalid groupId, returning empty array");
        return [];
      }
      
      // First get documents without the profiles join to make it work
      const { data, error } = await supabase
        .from("documents")
        .select("*")
        .eq("group_id", groupId)
        .eq("is_deleted", false)
        .order("created_at", { ascending: false });
      
      console.log("Documents query result:", { data, error, groupId });
      if (error) {
        console.error("Documents query error:", error);
        throw error;
      }

      // Get uploader info separately if we have documents
      if (data && data.length > 0) {
        const uploaderIds = [...new Set(data.map(doc => doc.uploaded_by_user_id).filter(Boolean))];
        if (uploaderIds.length > 0) {
          const { data: profiles } = await supabase
            .from("profiles")
            .select("user_id, first_name, last_name, email")
            .in("user_id", uploaderIds);
          
          // Attach uploader info to documents
          const documentsWithUploaders = data.map(doc => ({
            ...doc,
            uploader: profiles?.find(p => p.user_id === doc.uploaded_by_user_id) || null
          }));
          
          return documentsWithUploaders;
        }
      }
      
      return data || [];
    },
    enabled: !!groupId && groupId !== ':groupId' && groupId !== 'undefined' && !groupId.startsWith(':'),
  });

  console.log("Documents component state:", { documents, isLoading, queryError, groupId });

  const blockOperation = () => {
    if (demo.isDemo) {
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
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      toast({
        title: "Document deleted",
        description: "Document has been moved to trash and can be restored within 30 days.",
      });
    },
    onError: (error) => {
      console.error("Delete error:", error);
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
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      toast({
        title: "Documents deleted", 
        description: `${documentIds.length} document(s) moved to trash and can be restored within 30 days.`,
      });
    },
    onError: (error) => {
      console.error("Bulk delete error:", error);
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
    if (confirm("Are you sure you want to delete this document? It will be moved to trash and can be restored within 30 days.")) {
      deleteDocumentMutation.mutate(documentId);
    }
  };

  const handleBulkDelete = (documentIds: string[]) => {
    if (blockOperation()) return;
    bulkDeleteMutation.mutate(documentIds);
  };

  const getUploaderEmail = (document: any) => {
    return document.uploader?.email || 'Unknown';
  };

  const getUploadDate = (document: any) => {
    const date = new Date(document.upload_date || document.created_at);
    return format(date, 'MM/dd/yy');
  };

  const getReadableFileType = (filename?: string, fileType?: string) => {
    if (!filename && !fileType) return 'Unknown';
    
    const extension = filename?.split('.').pop()?.toLowerCase() || fileType?.toLowerCase();
    
    switch (extension) {
      case 'pdf': return 'PDF';
      case 'doc': case 'docx': return 'Word';
      case 'xls': case 'xlsx': return 'Excel';
      case 'ppt': case 'pptx': return 'PowerPoint';
      case 'txt': return 'Text';
      case 'jpg': case 'jpeg': return 'JPEG Image';
      case 'png': return 'PNG Image';
      case 'gif': return 'GIF Image';
      case 'zip': return 'ZIP Archive';
      default: return extension?.toUpperCase() || 'Unknown';
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category?.toLowerCase()) {
      case 'medical': return 'destructive';
      case 'legal': return 'secondary';
      case 'financial': return 'default';
      case 'insurance': return 'outline';
      default: return 'secondary';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'default';
      case 'processing': return 'secondary';
      case 'pending': return 'outline';
      case 'failed': return 'destructive';
      default: return 'secondary';
    }
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
      key: "original_filename", 
      label: "Original Filename",
      sortable: true,
      render: (value, row) => (
        <div className="max-w-48">
          <Button
            variant="link"
            className="p-0 h-auto text-left text-sm text-wrap break-all"
            onClick={async () => {
              try {
                const { data } = await supabase.storage
                  .from('documents')
                  .createSignedUrl(row.file_url, 600); // 10 minutes
                
                if (data?.signedUrl) {
                  window.open(data.signedUrl, '_blank');
                } else {
                  toast({
                    title: "Error",
                    description: "Failed to generate file preview link.",
                    variant: "destructive",
                  });
                }
              } catch (error) {
                console.error('File preview error:', error);
                toast({
                  title: "Error",
                  description: "Failed to open file preview.",
                  variant: "destructive",
                });
              }
            }}
            title="Click to view document"
          >
            {value || "Unknown"}
          </Button>
        </div>
      ),
    },
    {
      key: "file_type",
      label: "Type",
      sortable: true,
      render: (value, row) => (
        <Badge variant="outline" className="text-xs">
          {getReadableFileType(row.original_filename, value)}
        </Badge>
      ),
    },
    {
      key: "file_size",
      label: "Size", 
      sortable: true,
      render: (value) => (
        <span className="text-sm">{formatFileSize(value)}</span>
      ),
    },
    {
      key: "notes",
      label: "Notes",
      render: (value) => value ? (
        <div className="max-w-xs">
          <div className="line-clamp-2 text-sm text-muted-foreground">{value}</div>
        </div>
      ) : "-",
    },
    {
      key: "summary",
      label: "Summary",
      sortable: true,
      render: (value) => value ? (
        <div className="max-w-xs">
          <div className="line-clamp-2 text-sm text-muted-foreground">{value}</div>
        </div>
      ) : "-",
    },
    {
      key: "uploader_email",
      label: "Uploader Email",
      sortable: true,
      render: (_, row) => (
        <div className="text-sm">{getUploaderEmail(row)}</div>
      ),
    },
    {
      key: "upload_date",
      label: "Upload Date", 
      sortable: true,
      render: (_, row) => (
        <div className="text-sm">{getUploadDate(row)}</div>
      ),
    },
    {
      key: "category",
      label: "Category",
      sortable: true,
      type: "badge",
      getBadgeVariant: getCategoryColor,
      render: (value) => value ? (
        <Badge variant={getCategoryColor(value)}>{value}</Badge>
      ) : "-",
    },
  ];

  if (!groupId || groupId === ':groupId' || groupId === 'undefined' || groupId.startsWith(':')) {
    return (
      <div className="p-6 text-center">
        <h2 className="text-xl font-semibold mb-2">Invalid Group</h2>
        <p className="text-muted-foreground">Please select a valid care group.</p>
      </div>
    );
  }

  return (
    <>
      <SEO 
        title="Documents - Care Coordination"
        description="Manage and organize important documents for your care group."
      />
      <div className="container mx-auto p-4 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileText className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold">Documents</h1>
              <p className="text-muted-foreground">
                Manage and organize important documents for your care group
              </p>
            </div>
          </div>
          <Button onClick={() => setShowUpload(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Upload Document
          </Button>
        </div>

        <UnifiedTableView
          title=""
          data={documents}
          columns={columns}
          loading={isLoading}
          onEdit={handleEditDocument}
          onDelete={handleDeleteDocument}
          onBulkDelete={handleBulkDelete}
          searchable={true}
          searchPlaceholder="Search documents..."
          defaultSortBy="created_at"
          defaultSortOrder="desc"
          entityType="document"
          getItemTitle={(item) => item.title || item.original_filename || "Untitled Document"}
          emptyMessage="No documents found"
          emptyDescription="Start by uploading your first document."
          customActions={(item) => (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedDocumentForAssociations(item);
                setIsAssociationsModalOpen(true);
              }}
              disabled={demo.isDemo}
              title="Manage associations"
              className="h-8 w-8 p-0"
            >
              <LinkIcon className="h-4 w-4" />
            </Button>
          )}
        />

        {showUpload && (
          <DocumentUpload
            onUploadComplete={() => {
              setShowUpload(false);
              refetch();
            }}
            onClose={() => setShowUpload(false)}
          />
        )}

        <DocumentModal
          document={selectedDocument}
          isOpen={showDocumentModal}
          onClose={() => {
            setShowDocumentModal(false);
            setSelectedDocument(null);
          }}
          groupId={groupId}
        />

        <DocumentAssociationsModal
          document={selectedDocumentForAssociations}
          isOpen={isAssociationsModalOpen}
          onClose={() => {
            setIsAssociationsModalOpen(false);
            setSelectedDocumentForAssociations(null);
          }}
          groupId={groupId}
        />
      </div>
    </>
  );
}