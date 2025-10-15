import { useState } from "react";
import { X, Plus, Tag as TagIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useDocumentTags, useDocumentTagAssignments, useAssignTag, useUnassignTag } from "@/hooks/useDocumentTags";
import { useToast } from "@/hooks/use-toast";
import { useDemo } from "@/hooks/useDemo";

interface DocumentTagManagerProps {
  documentId: string;
  groupId: string;
}

const TAG_COLORS = [
  "bg-blue-500",
  "bg-green-500",
  "bg-yellow-500",
  "bg-red-500",
  "bg-purple-500",
  "bg-pink-500",
  "bg-indigo-500",
  "bg-orange-500",
];

export function DocumentTagManager({ documentId, groupId }: DocumentTagManagerProps) {
  const [showAddTag, setShowAddTag] = useState(false);
  const [newTagName, setNewTagName] = useState("");

  const { toast } = useToast();
  const demo = useDemo();

  const { data: allTags = [] } = useDocumentTags(groupId);
  const { data: assignedTags = [] } = useDocumentTagAssignments(documentId);
  const assignTag = useAssignTag();
  const unassignTag = useUnassignTag();

  const assignedTagIds = new Set(assignedTags.map((a: any) => a.tag_id));
  const availableTags = allTags.filter((tag: any) => !assignedTagIds.has(tag.id));

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

  const handleAssignTag = async (tagId: string) => {
    if (blockOperation()) return;

    try {
      await assignTag.mutateAsync({ documentId, tagId });
      setShowAddTag(false);
    } catch (error) {
      // Error handled by mutation
    }
  };

  const handleUnassignTag = async (tagId: string) => {
    if (blockOperation()) return;

    try {
      await unassignTag.mutateAsync({ documentId, tagId });
    } catch (error) {
      // Error handled by mutation
    }
  };

  const handleCreateAndAssignTag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (blockOperation()) return;

    if (!newTagName.trim()) {
      toast({
        title: "Validation Error",
        description: "Tag name is required.",
        variant: "destructive",
      });
      return;
    }

    // Create tag is handled in useCreateTag hook
    // For now, show message that tag creation needs to be implemented
    toast({
      title: "Coming Soon",
      description: "Tag creation will be available in the next update.",
    });
    
    setNewTagName("");
    setShowAddTag(false);
  };

  const getTagColor = (index: number) => {
    return TAG_COLORS[index % TAG_COLORS.length];
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold flex items-center gap-2">
          <TagIcon className="h-4 w-4" />
          Tags
        </h3>
        <Popover open={showAddTag} onOpenChange={setShowAddTag}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" disabled={demo.isDemo}>
              <Plus className="h-4 w-4 mr-1" />
              Add Tag
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80">
            <div className="space-y-4">
              <div>
                <h4 className="font-medium mb-2">Available Tags</h4>
                <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
                  {availableTags.length > 0 ? (
                    availableTags.map((tag: any, index: number) => (
                      <Badge
                        key={tag.id}
                        variant="outline"
                        className="cursor-pointer hover:bg-muted"
                        onClick={() => handleAssignTag(tag.id)}
                      >
                        <span
                          className={`w-2 h-2 rounded-full ${getTagColor(index)} mr-2`}
                        />
                        {tag.name}
                      </Badge>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      All available tags are already assigned
                    </p>
                  )}
                </div>
              </div>

              <div>
                <h4 className="font-medium mb-2">Create New Tag</h4>
                <form onSubmit={handleCreateAndAssignTag} className="space-y-2">
                  <Input
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    placeholder="Tag name"
                  />
                  <Button type="submit" size="sm" className="w-full">
                    Create & Assign
                  </Button>
                </form>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <div className="flex flex-wrap gap-2 min-h-[40px] p-3 border rounded-md">
        {assignedTags.length > 0 ? (
          assignedTags.map((assignment: any, index: number) => {
            const tag = allTags.find((t: any) => t.id === assignment.tag_id);
            if (!tag) return null;

            return (
              <Badge key={assignment.id} variant="secondary" className="gap-1">
                <span
                  className={`w-2 h-2 rounded-full ${getTagColor(index)}`}
                />
                {tag.name}
                <button
                  onClick={() => handleUnassignTag(assignment.tag_id)}
                  className="ml-1 hover:bg-muted rounded-full p-0.5"
                  disabled={demo.isDemo}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            );
          })
        ) : (
          <p className="text-sm text-muted-foreground">
            No tags assigned. Click "Add Tag" to get started.
          </p>
        )}
      </div>
    </div>
  );
}
