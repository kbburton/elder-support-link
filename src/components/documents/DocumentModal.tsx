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
import { Separator } from "@/components/ui/separator";
import { Trash2, RefreshCw, Download } from "lucide-react";
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
import { useDemo } from "@/hooks/useDemo";
import { softDeleteEntity } from "@/lib/delete/rpc";
import { AssociationManager } from "@/components/shared/AssociationManager";
import { format } from "date-fns";
import { formatDistanceToNow } from "date-fns";
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
    if (!document?.summary && !document?.id) return;
    
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

  const getUploaderDisplay = () => {
    if (uploaderProfile) {
      const name = [uploaderProfile.first_name, uploaderProfile.last_name]
        .filter(Boolean)
        .join(' ') || uploaderProfile.email;
      const timeAgo = formatDistanceToNow(new Date(document!.upload_date), { addSuffix: true });
      return `${name} uploaded ${timeAgo}`;
    }
    if (document?.upload_date) {
      const timeAgo = formatDistanceToNow(new Date(document.upload_date), { addSuffix: true });
      return `Uploaded ${timeAgo}`;
    }
    return 'Unknown uploader';
  };

  const categories = ["Medical", "Legal", "Financial", "Insurance", "Personal", "Other"];

  if (!document) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Document Details</DialogTitle>
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
                  <p className="font-mono text-xs bg-muted p-2 rounded">
                    {document.original_filename || 'Unknown'}
                  </p>
                </div>
                
                <div>
                  <Label className="text-muted-foreground">File Type</Label>
                  <p className="font-mono text-xs bg-muted p-2 rounded">
                    {document.file_type || 'Unknown'}
                  </p>
                </div>
                
                <div>
                  <Label className="text-muted-foreground">File Size</Label>
                  <p className="font-mono text-xs bg-muted p-2 rounded">
                    {formatFileSize(document.file_size)}
                  </p>
                </div>
                
                <div>
                  <Label className="text-muted-foreground">Status</Label>
                  <p className="font-mono text-xs bg-muted p-2 rounded">
                    {document.processing_status || 'Unknown'}
                  </p>
                </div>
              </div>

              <div>
                <Label className="text-muted-foreground">Uploader</Label>
                <p className="text-sm">{getUploaderDisplay()}</p>
              </div>

              <div>
                <Label className="text-muted-foreground">Upload Date</Label>
                <p className="text-sm">{format(new Date(document.upload_date), 'PPP p')}</p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex space-x-2 pt-4">
              <Button type="submit" disabled={updateDocument.isPending} className="flex-1">
                {updateDocument.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
              {document.file_url && (
                <Button type="button" variant="outline" onClick={handleDownload}>
                  <Download className="h-4 w-4 mr-1" />
                  Download
                </Button>
              )}
              <Button type="button" variant="outline" onClick={handleDelete}>
                <Trash2 className="h-4 w-4 mr-1" />
                Delete
              </Button>
            </div>
          </form>

          {/* Associations Panel */}
          <div>
            <h3 className="text-sm font-medium mb-4">Document Associations</h3>
            <AssociationManager
              entityId={document.id}
              entityType="document"
              groupId={groupId}
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