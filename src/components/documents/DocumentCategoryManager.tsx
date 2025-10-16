import { useState } from "react";
import { Plus, Edit, Trash2, ChevronRight, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useDocumentCategories, useCreateCategory, useUpdateCategory, useDeleteCategory } from "@/hooks/useDocumentCategories";
import { useToast } from "@/hooks/use-toast";
import { useDemo } from "@/hooks/useDemo";

interface DocumentCategoryManagerProps {
  groupId: string;
}

export function DocumentCategoryManager({ groupId }: DocumentCategoryManagerProps) {
  const [showDialog, setShowDialog] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    parent_id: "",
  });

  const { toast } = useToast();
  const demo = useDemo();
  const { data: categories = [], isLoading } = useDocumentCategories(groupId);
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const deleteCategory = useDeleteCategory();

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

  const parentCategories = categories.filter(c => !c.parent_id && !c.is_default);
  const defaultCategories = categories.filter(c => c.is_default);
  const getSubgroups = (parentId: string) => categories.filter(c => c.parent_id === parentId);

  // Count custom categories (excluding default)
  const customCategoryCount = parentCategories.length;
  const canAddCategory = customCategoryCount < 10;

  const handleOpenDialog = (category?: any) => {
    if (blockOperation()) return;

    if (category) {
      setEditingCategory(category);
      setFormData({
        name: category.name,
        description: category.description || "",
        parent_id: category.parent_id || "",
      });
    } else {
      setEditingCategory(null);
      setFormData({
        name: "",
        description: "",
        parent_id: "",
      });
    }
    setShowDialog(true);
  };

  const handleCloseDialog = () => {
    setShowDialog(false);
    setEditingCategory(null);
    setFormData({ name: "", description: "", parent_id: "" });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast({
        title: "Validation Error",
        description: "Category name is required.",
        variant: "destructive",
      });
      return;
    }

    // Validate limits
    if (!editingCategory && !formData.parent_id && customCategoryCount >= 10) {
      toast({
        title: "Limit Reached",
        description: "Maximum of 10 custom categories allowed per care group.",
        variant: "destructive",
      });
      return;
    }

    if (formData.parent_id) {
      const siblingCount = getSubgroups(formData.parent_id).length;
      if (siblingCount >= 20 && !editingCategory) {
        toast({
          title: "Limit Reached",
          description: "Maximum of 20 subgroups allowed per category.",
          variant: "destructive",
        });
        return;
      }
    }

    try {
      if (editingCategory) {
        await updateCategory.mutateAsync({
          id: editingCategory.id,
          updates: formData,
        });
      } else {
        await createCategory.mutateAsync({
          ...formData,
          care_group_id: groupId,
        });
      }
      handleCloseDialog();
    } catch (error) {
      // Error handled by mutation
    }
  };

  const handleDelete = async (categoryId: string) => {
    if (blockOperation()) return;

    if (confirm("Are you sure you want to delete this category? Documents using this category will need to be re-categorized.")) {
      try {
        await deleteCategory.mutateAsync(categoryId);
      } catch (error) {
        // Error handled by mutation
      }
    }
  };

  if (isLoading) {
    return <div>Loading categories...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Document Categories</h2>
          <p className="text-sm text-muted-foreground">
            Organize documents with custom categories and subgroups
          </p>
        </div>
        <Button onClick={() => handleOpenDialog()} disabled={!canAddCategory || demo.isDemo}>
          <Plus className="mr-2 h-4 w-4" />
          Add Category ({customCategoryCount}/10)
        </Button>
      </div>

      {/* Default Categories */}
      {defaultCategories.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Default Categories</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {defaultCategories.map((category) => (
                <Badge key={category.id} variant="secondary">
                  {category.name}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Custom Categories */}
      <div className="space-y-4">
        {parentCategories.map((parent) => {
          const subgroups = getSubgroups(parent.id);
          return (
            <Card key={parent.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FolderOpen className="h-5 w-5 text-primary" />
                    <div>
                      <CardTitle className="text-lg">{parent.name}</CardTitle>
                      {parent.description && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {parent.description}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleOpenDialog({
                        parent_id: parent.id,
                        name: "",
                        description: "",
                      })}
                      disabled={subgroups.length >= 20 || demo.isDemo}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Subgroup ({subgroups.length}/20)
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleOpenDialog(parent)}
                      disabled={demo.isDemo}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(parent.id)}
                      disabled={demo.isDemo}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              {subgroups.length > 0 && (
                <CardContent>
                  <div className="space-y-2">
                    {subgroups.map((sub) => (
                      <div
                        key={sub.id}
                        className="flex items-center justify-between p-2 rounded-md bg-muted"
                      >
                        <div className="flex items-center gap-2">
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{sub.name}</span>
                          {sub.description && (
                            <span className="text-sm text-muted-foreground">
                              - {sub.description}
                            </span>
                          )}
                        </div>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenDialog(sub)}
                            disabled={demo.isDemo}
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(sub.id)}
                            disabled={demo.isDemo}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>

      {parentCategories.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FolderOpen className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium">No custom categories yet</p>
            <p className="text-sm text-muted-foreground mb-4">
              Create custom categories to better organize your documents
            </p>
            <Button onClick={() => handleOpenDialog()} disabled={demo.isDemo}>
              <Plus className="mr-2 h-4 w-4" />
              Create First Category
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Category Dialog */}
      <Dialog open={showDialog} onOpenChange={handleCloseDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingCategory ? "Edit Category" : "Create Category"}
            </DialogTitle>
            <DialogDescription>
              {editingCategory
                ? "Update the category details below."
                : formData.parent_id
                ? "Create a new subgroup under the selected category."
                : "Create a new top-level category (maximum 10 per care group)."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {!editingCategory && !formData.parent_id && (
              <div>
                <Label htmlFor="parent">Parent Category (Optional)</Label>
                <Select
                  value={formData.parent_id || "none"}
                  onValueChange={(value) => setFormData({ ...formData, parent_id: value === "none" ? "" : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="None (top-level category)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None (top-level category)</SelectItem>
                    {parentCategories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Medical Records, Insurance"
                required
              />
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Optional description for this category"
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={handleCloseDialog}>
                Cancel
              </Button>
              <Button type="submit" disabled={createCategory.isPending || updateCategory.isPending}>
                {createCategory.isPending || updateCategory.isPending
                  ? "Saving..."
                  : editingCategory
                  ? "Update"
                  : "Create"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
