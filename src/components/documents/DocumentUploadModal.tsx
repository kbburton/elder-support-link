import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Upload, X } from "lucide-react";
import { useDocumentCategories } from "@/hooks/useDocumentCategories";

interface DocumentUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpload: (file: File, metadata: {
    title?: string;
    categoryId?: string;
    notes?: string;
  }) => void;
  groupId: string;
  isUploading: boolean;
}

export function DocumentUploadModal({
  isOpen,
  onClose,
  onUpload,
  groupId,
  isUploading,
}: DocumentUploadModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [notes, setNotes] = useState("");

  const { data: categories = [] } = useDocumentCategories(groupId);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      // Auto-populate title with filename if empty
      if (!title) {
        setTitle(selectedFile.name.replace(/\.[^/.]+$/, ""));
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    onUpload(file, {
      title: title || file.name,
      categoryId: categoryId || undefined,
      notes: notes || undefined,
    });

    // Reset form
    setFile(null);
    setTitle("");
    setCategoryId("");
    setNotes("");
  };

  const handleCancel = () => {
    setFile(null);
    setTitle("");
    setCategoryId("");
    setNotes("");
    onClose();
  };

  // Organize categories into parent/child structure
  const parentCategories = categories.filter(c => !c.parent_id);
  const getSubgroups = (parentId: string) => categories.filter(c => c.parent_id === parentId);

  const getCategoryDisplay = () => {
    if (!categoryId) return "Select category (optional)";
    const category = categories.find(c => c.id === categoryId);
    if (!category) return "Select category (optional)";
    
    if (category.parent_id) {
      const parent = categories.find(c => c.id === category.parent_id);
      return parent ? `${parent.name} > ${category.name}` : category.name;
    }
    return category.name;
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleCancel}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Upload Document</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* File Selection */}
          <div>
            <Label htmlFor="file-upload">Select File *</Label>
            {!file ? (
              <div className="mt-2">
                <Button type="button" variant="outline" asChild className="w-full">
                  <label className="cursor-pointer">
                    <Upload className="mr-2 h-4 w-4" />
                    Choose File
                    <input
                      id="file-upload"
                      type="file"
                      className="hidden"
                      onChange={handleFileSelect}
                    />
                  </label>
                </Button>
              </div>
            ) : (
              <div className="mt-2 flex items-center justify-between p-3 border rounded-md bg-muted">
                <span className="text-sm truncate flex-1">{file.name}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setFile(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          {/* Title */}
          <div>
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={file?.name || "Document title"}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Leave blank to use filename
            </p>
          </div>

          {/* Category */}
          <div>
            <Label htmlFor="category">Category</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger>
                <SelectValue>
                  {getCategoryDisplay()}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">No category</SelectItem>
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
            <p className="text-xs text-muted-foreground mt-1">
              Category helps AI generate better summaries
            </p>
          </div>

          {/* Notes */}
          <div>
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Add any notes about this document..."
            />
          </div>

          {/* Info Box */}
          <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-md p-3">
            <p className="text-sm text-blue-900 dark:text-blue-100">
              <strong>AI Processing:</strong> After upload, Lovable AI will automatically extract text and generate a summary. 
              {categoryId && " The selected category will help create a more accurate summary."}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={isUploading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!file || isUploading}>
              {isUploading ? "Uploading..." : "Upload & Process"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
