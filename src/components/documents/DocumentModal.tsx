import { useState, useEffect } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Download, Trash2, RefreshCw } from "lucide-react";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { useDemo } from "@/hooks/useDemo";
import { softDeleteEntity } from "@/lib/delete/rpc";
import { AssociationManager } from "@/components/shared/AssociationManager";
import { useToast } from "@/hooks/use-toast";

interface Document {
  id: string;
  title?: string;
  category?: string;
  notes?: string;
  summary?: string;
  original_filename?: string;
  file_type?: string;
  file_size?: number;
  file_url?: string;
  upload_date: string;
  uploaded_by_user_id?: string;
  processing_status?: string;
}

interface DocumentModalProps {
  document: Document | null;
  isOpen: boolean;
  onClose: () => void;
  groupId: string;
}

const formatFileSize = (bytes?: number) => {
  if (!bytes) return 'Unknown';
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
};

export function DocumentModal({ document, isOpen, onClose, groupId }: DocumentModalProps) {
  const [formData, setFormData] = useState({
    title: document?.title || "",
    category: document?.category || "",
    notes: document?.notes || "",
    summary: document?.summary || "",
  });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const demo = useDemo();

  // Fetch uploader profile info
  const { data: uploaderProfile } = useQuery({
    queryKey: ["profile", document?.uploaded_by_user_id],
    queryFn: async () => {
      if (!document?.uploaded_by_user_id) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("first_name, last_name, email")
        .eq("user_id", document.uploaded_by_user_id)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!document?.uploaded_by_user_id && isOpen,
  });

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

  // Reset form when document changes
  useEffect(() => {
    if (document) {
      setFormData({
        title: document.title || "",
        category: document.category || "",
        notes: document.notes || "",
        summary: document.summary || "",
      });
    } else {
      setFormData({
        title: "",
        category: "",
        notes: "",
        summary: "",
      });
    }
  }, [document]);

  const updateDocument = useMutation({
    mutationFn: async (data: any) => {
      const { error } = await supabase
        .from("documents")
        .update(data)
        .eq("id", document!.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      toast({
        title: "Document updated",
        description: "Document has been updated successfully.",
      });
      onClose();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update document.",
        variant: "destructive",
      });
    },
  });

  const deleteDocument = useMutation({
    mutationFn: async () => {
      if (!document) throw new Error("No document to delete");
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      await softDeleteEntity("document", document.id, user.id, user.email || "");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      toast({
        title: "Document deleted",
        description: "Document has been moved to trash and can be restored within 30 days.",
      });
      onClose();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete document.",
        variant: "destructive",
      });
    },
  });

  const regenerateSummary = async () => {
    if (!document) return;
    
    setIsRegenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('regenerate-summary', {
        body: { documentId: document.id }
      });
      
      if (error) throw error;
      
      // Update the form data with new summary
      setFormData(prev => ({
        ...prev,
        summary: data.summary || prev.summary
      }));
      
      toast({
        title: "Summary regenerated",
        description: "AI summary has been regenerated successfully.",
      });
    } catch (error) {
      console.error('Error regenerating summary:', error);
      toast({
        title: "Error",
        description: "Failed to regenerate summary.",
        variant: "destructive",
      });
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (blockOperation()) return;

    updateDocument.mutate(formData);
  };

  const handleDelete = () => {
    if (blockOperation()) return;
    setShowDeleteConfirm(true);
  };

  const confirmDelete = () => {
    deleteDocument.mutate();
    setShowDeleteConfirm(false);
  };

  const handleDownload = () => {
    if (document?.file_url) {
      window.open(document.file_url, '_blank');
    }
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

  const getUploaderEmail = () => {
    return uploaderProfile?.email || 'Unknown';
  };

  const getUploadDate = () => {
    if (document?.upload_date) {
      return format(new Date(document.upload_date), 'MMM dd, yyyy');
    }
    return 'Unknown';
  };

  const categories = ["Medical", "Legal", "Financial", "Insurance", "Personal", "Other"];

  if (!document) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="space-y-3">
          <DialogTitle className="text-lg font-semibold">Document Details</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Document Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Editable Fields */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium">Document Information</h3>
              
              <div>
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder={document.original_filename || "Document title"}
                />
              </div>

              <div>
                <Label htmlFor="category">Category</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => setFormData({ ...formData, category: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                  placeholder="Add your notes about this document..."
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label htmlFor="summary">AI Summary</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={regenerateSummary}
                    disabled={isRegenerating}
                  >
                    <RefreshCw className={`h-4 w-4 mr-1 ${isRegenerating ? 'animate-spin' : ''}`} />
                    Regenerate
                  </Button>
                </div>
                <Textarea
                  id="summary"
                  value={formData.summary}
                  onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
                  rows={4}
                  placeholder="AI-generated summary will appear here..."
                />
              </div>
            </div>

            <Separator />

            {/* Read-only Information */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-muted-foreground">File Information</h4>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <Label className="text-muted-foreground">Original Filename</Label>
                  <p className="font-mono text-xs bg-muted p-2 rounded break-all">
                    {document.original_filename || 'Unknown'}
                  </p>
                </div>
                
                <div>
                  <Label className="text-muted-foreground">File Type</Label>
                  <p className="text-sm bg-muted p-2 rounded">
                    {getReadableFileType(document.original_filename, document.file_type)}
                  </p>
                </div>
                
                <div>
                  <Label className="text-muted-foreground">File Size</Label>
                  <p className="font-mono text-xs bg-muted p-2 rounded">
                    {formatFileSize(document.file_size)}
                  </p>
                </div>
                
                <div>
                  <Label className="text-muted-foreground">Uploader Email</Label>
                  <p className="font-mono text-xs bg-muted p-2 rounded break-all">
                    {getUploaderEmail()}
                  </p>
                </div>
                
                <div>
                  <Label className="text-muted-foreground">Upload Date</Label>
                  <p className="text-sm bg-muted p-2 rounded">
                    {getUploadDate()}
                  </p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <Separator />
            <div className="flex flex-wrap gap-3">
              <Button type="submit" disabled={updateDocument.isPending}>
                {updateDocument.isPending ? 'Updating...' : 'Update Document'}
              </Button>
              
              <Button
                type="button"
                variant="outline"
                onClick={handleDelete}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
              
              {document.file_url && (
                <Button
                  type="button"
                  variant="outline" 
                  onClick={handleDownload}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download
                </Button>
              )}
              
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
            </div>
          </form>

          {/* Associations Panel */}
          <div className="space-y-4">
            <AssociationManager
              entityId={document.id}
              entityType="document"
              groupId={groupId}
              onNavigate={(type, id) => {
                const baseUrl = `/app/${groupId}`;
                let url = '';
                
                switch (type) {
                  case 'contact':
                    url = `${baseUrl}/contacts`;
                    break;
                  case 'appointment':
                    url = `${baseUrl}/calendar`;
                    break;
                  case 'task':
                    url = `${baseUrl}/tasks`;
                    break;
                  case 'activity':
                    url = `${baseUrl}/activities`;
                    break;
                  default:
                    return;
                }
                
                window.open(url, '_blank');
              }}
            />
          </div>
        </div>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Document</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this document? It will be moved to trash and can be restored within 30 days.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90">
                Delete Document
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}