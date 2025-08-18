import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import SEO from "@/components/layout/SEO";
import { DocumentUpload } from "@/components/documents/DocumentUpload";
import { UnifiedTableView } from "@/components/shared/UnifiedTableView";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useDemoOperations } from "@/hooks/useDemoOperations";
import { softDeleteEntity } from "@/lib/delete/rpc";

export default function DocumentsListPage() {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showUpload, setShowUpload] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<any>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const { blockOperation } = useDemoOperations();

  const { data: documents = [], isLoading, refetch } = useQuery({
    queryKey: ["documents", groupId],
    queryFn: async () => {
      if (!groupId || groupId === ':groupId' || groupId === 'undefined' || groupId.startsWith(':')) {
        return [];
      }
      
      const { data, error } = await supabase
        .from("documents")
        .select("*")
        .eq("group_id", groupId)
        .eq("is_deleted", false)
        .order("upload_date", { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!groupId && groupId !== ':groupId' && groupId !== 'undefined' && !groupId.startsWith(':'),
  });

  // Get current user for permissions
  const { data: currentUser } = useQuery({
    queryKey: ["currentUser"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    },
  });

  // Check if user is group admin
  const { data: isGroupAdmin = false } = useQuery({
    queryKey: ["isGroupAdmin", groupId, currentUser?.id],
    queryFn: async () => {
      if (!currentUser?.id || !groupId) return false;
      
      const { data } = await supabase
        .from("care_group_members")
        .select("is_admin")
        .eq("group_id", groupId)
        .eq("user_id", currentUser.id)
        .single();
      
      return data?.is_admin || false;
    },
    enabled: !!currentUser?.id && !!groupId,
  });

  const deleteDocumentMutation = useMutation({
    mutationFn: async (documentId: string) => {
      if (blockOperation()) return { success: false, error: "Operation blocked in demo mode" };
      
      if (!currentUser) throw new Error('User not authenticated');
      
      const result = await softDeleteEntity('document', documentId, currentUser.id, currentUser.email!);
      if (!result.success) {
        throw new Error(result.error || 'Delete failed');
      }
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      toast({ title: "Success", description: "Document moved to trash successfully." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (documentIds: string[]) => {
      if (blockOperation()) return { success: false, error: "Operation blocked in demo mode" };
      
      if (!currentUser) throw new Error('User not authenticated');
      
      const results = [];
      for (const id of documentIds) {
        try {
          const result = await softDeleteEntity('document', id, currentUser.id, currentUser.email!);
          results.push(result);
        } catch (error) {
          results.push({ success: false, error: error.message });
        }
      }
      
      const failures = results.filter(r => !r.success);
      if (failures.length > 0) {
        throw new Error(`${failures.length} documents could not be deleted`);
      }
      
      return results;
    },
    onSuccess: (_, documentIds) => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      toast({ 
        title: "Success", 
        description: `${documentIds.length} document(s) moved to trash. Items can be restored in group settings for 30 days.`
      });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  // Process document text automatically
  const processDocumentMutation = useMutation({
    mutationFn: async (documentId: string) => {
      const { error } = await supabase.functions.invoke('process-document-text', {
        body: { documentId }
      });
      if (error) throw error;
    },
    onSuccess: () => {
      refetch();
    }
  });

  const handleEdit = (document: any) => {
    setSelectedDocument(document);
    setShowEditModal(true);
  };

  const handleDelete = async (documentId: string) => {
    await deleteDocumentMutation.mutateAsync(documentId);
  };

  const handleBulkDelete = async (documentIds: string[]) => {
    await bulkDeleteMutation.mutateAsync(documentIds);
  };

  const canDeleteDocument = (document: any) => {
    if (!currentUser) return false;
    return isGroupAdmin || document.uploaded_by_user_id === currentUser.id;
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'completed': return 'default';
      case 'processing': return 'secondary';
      case 'pending': return 'outline';
      case 'failed': return 'destructive';
      default: return 'outline';
    }
  };

  const getCategoryBadgeVariant = (category: string) => {
    return 'secondary';
  };

  const columns = [
    { 
      key: 'title', 
      label: 'Document Title', 
      sortable: true,
      width: '48',
      render: (value: any, row: any) => value || row.original_filename || 'Untitled Document'
    },
    { 
      key: 'original_filename', 
      label: 'File Name', 
      sortable: true,
      width: '32'
    },
    { 
      key: 'file_type', 
      label: 'Type', 
      sortable: true,
      type: 'badge' as const,
      getBadgeVariant: () => 'outline',
      width: '24'
    },
    { 
      key: 'upload_date', 
      label: 'Upload Date', 
      sortable: true,
      type: 'date' as const,
      width: '28'
    },
    { 
      key: 'processing_status', 
      label: 'Status', 
      sortable: true,
      type: 'badge' as const,
      getBadgeVariant: getStatusBadgeVariant,
      width: '24'
    },
    { 
      key: 'summary', 
      label: 'AI Summary', 
      sortable: false,
      width: '64',
      render: (value: string) => {
        if (!value) return '-';
        return (
          <div className="max-w-md">
            <div className="line-clamp-2 text-sm text-muted-foreground">
              {value}
            </div>
          </div>
        );
      }
    },
    { 
      key: 'associations', 
      label: 'Related Items', 
      type: 'associations' as const,
      width: '48',
      getAssociations: (row: any) => {
        // This would be populated with actual association data
        return [];
      }
    }
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
      <div className="container mx-auto p-6 space-y-6">
        <UnifiedTableView
          title="Documents"
          data={documents}
          columns={columns}
          loading={isLoading}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onBulkDelete={handleBulkDelete}
          entityType="document"
          canDelete={canDeleteDocument}
          searchPlaceholder="Search documents..."
          defaultSortBy="upload_date"
          emptyMessage="No documents found"
          emptyDescription="Start by uploading your first document."
          onCreateNew={() => setShowUpload(true)}
          createButtonLabel="Upload Document"
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

        {showEditModal && selectedDocument && (
          <DocumentEditModal
            document={selectedDocument}
            isOpen={showEditModal}
            onClose={() => {
              setShowEditModal(false);
              setSelectedDocument(null);
            }}
            onSave={() => {
              refetch();
              setShowEditModal(false);
              setSelectedDocument(null);
            }}
          />
        )}
      </div>
    </>
  );
}

// Simple Document Edit Modal
function DocumentEditModal({ document, isOpen, onClose, onSave }: {
  document: any;
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
}) {
  const { toast } = useToast();
  const [title, setTitle] = useState(document.title || '');
  const [category, setCategory] = useState(document.category || '');

  const updateMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('documents')
        .update({ title, category })
        .eq('id', document.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Document updated successfully." });
      onSave();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-background border rounded-xl shadow-xl p-6 w-[500px] max-w-[90vw]">
        <h3 className="text-lg font-semibold mb-4">Edit Document</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full p-2 border rounded-md"
              placeholder="Document title"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full p-2 border rounded-md"
            >
              <option value="">Select category</option>
              <option value="Medical">Medical</option>
              <option value="Legal">Legal</option>
              <option value="Financial">Financial</option>
              <option value="Insurance">Insurance</option>
              <option value="Other">Other</option>
            </select>
          </div>
        </div>
        
        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            onClick={() => updateMutation.mutate()}
            disabled={updateMutation.isPending}
          >
            Save Changes
          </Button>
        </div>
      </div>
    </div>
  );
}