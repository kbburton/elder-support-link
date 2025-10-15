import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
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
import { Download, Trash2, RefreshCw, Share, Check, FileText, Clock } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { useDemo } from "@/hooks/useDemo";
import { softDeleteEntity } from "@/lib/delete/rpc";
import { UnifiedAssociationManager } from "@/components/shared/UnifiedAssociationManager";
import { ENTITY } from "@/constants/entities";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useDocumentCategories } from "@/hooks/useDocumentCategories";
import { useDocumentTags, useAssignTag, useUnassignTag } from "@/hooks/useDocumentTags";
import { useDocumentVersions } from "@/hooks/useDocumentVersions";
import { DocumentVersionHistory } from "./DocumentVersionHistory";
import { DocumentTagManager } from "./DocumentTagManager";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Document {
  id: string;
  title?: string;
  category_id?: string;
  notes?: string;
  summary?: string;
  original_filename?: string;
  file_type?: string;
  file_size?: number;
  file_url?: string;
  created_at?: string;
  uploaded_by_user_id?: string;
  processing_status?: string;
  is_shared_with_group?: boolean;
  current_version?: number;
}

interface DocumentV2ModalProps {
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

export function DocumentV2Modal({ document, isOpen, onClose, groupId }: DocumentV2ModalProps) {
  const [formData, setFormData] = useState({
    title: document?.title || "",
    category_id: document?.category_id || "",
    notes: document?.notes || "",
    summary: document?.summary || "",
    is_shared_with_group: document?.is_shared_with_group ?? true,
  });
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [activeTab, setActiveTab] = useState("details");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewSummary, setPreviewSummary] = useState("");
  const [previewIsError, setPreviewIsError] = useState(false);

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const demo = useDemo();

  // Fetch categories for the group
  const { data: categories = [] } = useDocumentCategories(groupId);
  
  // Fetch tags and assignments
  const { data: tags = [] } = useDocumentTags(groupId);
  const { data: documentTags = [] } = useDocumentTags(document?.id || null);
  
  // Fetch version history
  const { data: versions = [] } = useDocumentVersions(document?.id || null);

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
        category_id: document.category_id || "",
        notes: document.notes || "",
        summary: document.summary || "",
        is_shared_with_group: document.is_shared_with_group ?? true,
      });
    } else {
      setFormData({
        title: "",
        category_id: "",
        notes: "",
        summary: "",
        is_shared_with_group: true,
      });
    }
  }, [document]);

const updateDocument = useMutation({
    mutationFn: async (data: any) => {
      const { error } = await supabase
        .from("documents_v2")
        .update(data)
        .eq("id", document!.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents-v2"] });
      toast({
        title: "Document updated",
        description: "Document has been updated successfully.",
      });
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
      const { data, error } = await supabase.functions.invoke('regenerate-summary-v2', {
        body: { documentId: document.id }
      });
      if (error) {
        const errMsg = (error as any)?.message || 'Unknown error';
        setPreviewIsError(true);
        setPreviewSummary(typeof errMsg === 'string' ? errMsg : JSON.stringify(error, null, 2));
        setPreviewOpen(true);
        return;
      }
      const generated = data?.summary as string | undefined;
      if (!generated || !generated.trim()) {
        setPreviewIsError(true);
        setPreviewSummary('No summary returned by the AI function.');
        setPreviewOpen(true);
        return;
      }
      setPreviewIsError(false);
      setPreviewSummary(generated.trim());
      setPreviewOpen(true);
    } catch (error) {
      console.error('Error regenerating summary:', error);
      setPreviewIsError(true);
      setPreviewSummary(error instanceof Error ? error.message : String(error));
      setPreviewOpen(true);
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
    if (confirm("Are you sure you want to delete this document? It will be moved to trash and can be restored within 30 days.")) {
      deleteDocument.mutate();
    }
  };

const handleDownload = async () => {
    if (!document?.id) return;
    try {
      const { data, error } = await supabase.functions.invoke('sign-document-download', {
        body: { documentId: document.id },
      });
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, '_blank');
      } else {
        toast({ title: 'Error', description: 'Failed to generate download link.', variant: 'destructive' });
      }
    } catch (error) {
      console.error('Download error:', error);
      toast({ title: 'Error', description: 'Failed to download document.', variant: 'destructive' });
    }
  };
  const handleShareLink = async () => {
    if (!document?.id) return;
    
    const shareUrl = `${window.location.origin}/app/${groupId}/documents?openDocument=${document.id}`;
    
    try {
      await navigator.clipboard.writeText(shareUrl);
      setLinkCopied(true);
      toast({
        title: "Link copied",
        description: "Shareable document link copied to clipboard.",
      });
      
      setTimeout(() => setLinkCopied(false), 2000);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy link to clipboard.",
        variant: "destructive",
      });
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

const getUploadDate = () => {
  const dt = (document as any)?.created_at;
  if (dt) {
    return format(new Date(dt), 'MM/dd/yy');
  }
  return 'Unknown';
};

  // Get category hierarchy display
  const getCategoryDisplay = () => {
    if (!formData.category_id) return "Select category";
    const category = categories.find(c => c.id === formData.category_id);
    if (!category) return "Select category";
    
    if (category.parent_id) {
      const parent = categories.find(c => c.id === category.parent_id);
      return parent ? `${parent.name} > ${category.name}` : category.name;
    }
    return category.name;
  };

  // Organize categories into parent/child structure
  const parentCategories = categories.filter(c => !c.parent_id);
  const getSubgroups = (parentId: string) => categories.filter(c => c.parent_id === parentId);

  if (!document) return null;

  return (<>
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="space-y-3">
          <DialogTitle className="text-xl font-semibold flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Document Details
            {document.current_version && (
              <Badge variant="outline" className="ml-2">
                v{document.current_version}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="versions">
              <Clock className="h-4 w-4 mr-2" />
              Versions ({versions.length})
            </TabsTrigger>
            <TabsTrigger value="associations">Related Items</TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Document Form */}
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Editable Fields */}
                <div className="space-y-4">
                  <h3 className="text-base font-semibold">Document Information</h3>
                  
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
                      value={formData.category_id}
                      onValueChange={(value) => setFormData({ ...formData, category_id: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select category">
                          {getCategoryDisplay()}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {parentCategories.map((parent) => (
                          <div key={parent.id}>
                            <SelectItem value={parent.id}>{parent.name}</SelectItem>
                            {getSubgroups(parent.id).map((sub) => (
                              <SelectItem key={sub.id} value={sub.id} className="pl-8">
                                └ {sub.name}
                              </SelectItem>
                            ))}
                          </div>
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
                        disabled={isRegenerating || demo.isDemo}
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

                  <div className="flex items-center justify-between space-x-2">
                    <Label htmlFor="share-toggle" className="text-sm">
                      Share with care group
                    </Label>
                    <Switch
                      id="share-toggle"
                      checked={formData.is_shared_with_group}
                      onCheckedChange={(checked) => setFormData({ ...formData, is_shared_with_group: checked })}
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
                      <p className="text-sm bg-muted p-2 rounded break-all">
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
                      <p className="text-sm bg-muted p-2 rounded">
                        {formatFileSize(document.file_size)}
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
                  
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleShareLink}
                  >
                    {linkCopied ? (
                      <>
                        <Check className="mr-2 h-4 w-4 text-green-600" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Share className="mr-2 h-4 w-4" />
                        Share Link
                      </>
                    )}
                  </Button>
                  
                  <Button type="button" variant="outline" onClick={onClose}>
                    Cancel
                  </Button>
                </div>
              </form>

              {/* Tags Panel */}
              <div className="space-y-4">
                <DocumentTagManager
                  documentId={document.id}
                  groupId={groupId}
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="versions">
            <DocumentVersionHistory
              documentId={document.id}
              currentVersion={document.current_version || 1}
              groupId={groupId}
            />
          </TabsContent>

          <TabsContent value="associations">
            <UnifiedAssociationManager
              entityId={document.id}
              entityType={ENTITY.document}
              groupId={groupId}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>

    <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{previewIsError ? 'AI Summary Debug' : 'AI Summary Preview'}</DialogTitle>
          <DialogDescription>
            {previewIsError
              ? 'The function did not return a summary. Inspect the details below.'
              : 'Review the generated summary. Click Save to update the document.'}
          </DialogDescription>
        </DialogHeader>
        <Textarea value={previewSummary} readOnly rows={8} />
        <DialogFooter>
          <Button variant="outline" onClick={() => setPreviewOpen(false)}>
            {previewIsError ? 'Close' : 'Cancel'}
          </Button>
          {!previewIsError && (
            <Button onClick={() => {
              setFormData(prev => ({ ...prev, summary: previewSummary }));
              updateDocument.mutate({ summary: previewSummary });
              setPreviewOpen(false);
            }}>
              Save Summary
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </>);

}

