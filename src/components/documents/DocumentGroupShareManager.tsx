import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Users, Plus, X } from "lucide-react";
import { 
  useDocumentGroupShares, 
  useUserCareGroups, 
  useShareDocument, 
  useUnshareDocument 
} from "@/hooks/useDocumentGroupShares";
import { useDemo } from "@/hooks/useDemo";
import { useToast } from "@/hooks/use-toast";

interface DocumentGroupShareManagerProps {
  documentId: string;
  currentGroupId?: string;
}

export function DocumentGroupShareManager({ 
  documentId, 
  currentGroupId 
}: DocumentGroupShareManagerProps) {
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  
  const { toast } = useToast();
  const { isDemo } = useDemo();
  
  const { data: shares = [], isLoading: sharesLoading } = useDocumentGroupShares(documentId);
  const { data: userGroups = [], isLoading: groupsLoading } = useUserCareGroups();
  const shareDocument = useShareDocument();
  const unshareDocument = useUnshareDocument();

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

  const handleShare = () => {
    if (blockOperation()) return;
    if (!selectedGroupId) return;

    shareDocument.mutate(
      { documentId, groupId: selectedGroupId },
      {
        onSuccess: () => {
          setSelectedGroupId("");
        }
      }
    );
  };

  const handleUnshare = (shareId: string) => {
    if (blockOperation()) return;
    if (confirm("Remove this document from the care group?")) {
      unshareDocument.mutate(shareId);
    }
  };

  // Filter out groups that already have this document shared
  const sharedGroupIds = shares.map(s => s.group_id);
  const availableGroups = userGroups.filter(g => !sharedGroupIds.includes(g.id));

  if (sharesLoading || groupsLoading) {
    return <div className="text-sm text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
          <Users className="h-4 w-4" />
          Shared with Care Groups
        </h4>
        <p className="text-xs text-muted-foreground mb-3">
          Manage which care groups can access this document
        </p>
      </div>

      {/* Currently shared groups */}
      {shares.length > 0 ? (
        <div className="space-y-2">
          {shares.map((share) => (
            <div 
              key={share.id} 
              className="flex items-center justify-between p-2 border rounded-md bg-muted/50"
            >
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">
                  {share.care_groups?.name || 'Unknown Group'}
                </span>
                {share.group_id === currentGroupId && (
                  <Badge variant="secondary" className="text-xs">Current</Badge>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleUnshare(share.id)}
                disabled={shareDocument.isPending || unshareDocument.isPending}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-sm text-muted-foreground p-3 bg-muted/30 rounded-md text-center">
          Not shared with any care groups
        </div>
      )}

      {/* Add new share */}
      {availableGroups.length > 0 && (
        <>
          <Separator />
          <div className="space-y-3">
            <Label htmlFor="share-group">Share with another group</Label>
            <div className="flex gap-2">
              <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
                <SelectTrigger id="share-group" className="flex-1">
                  <SelectValue placeholder="Select a care group" />
                </SelectTrigger>
                <SelectContent>
                  {availableGroups.map((group) => (
                    <SelectItem key={group.id} value={group.id}>
                      {group.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                onClick={handleShare}
                disabled={!selectedGroupId || shareDocument.isPending}
                size="default"
              >
                <Plus className="h-4 w-4 mr-1" />
                Share
              </Button>
            </div>
          </div>
        </>
      )}

      {availableGroups.length === 0 && shares.length > 0 && (
        <div className="text-xs text-muted-foreground text-center p-2 bg-muted/20 rounded">
          Shared with all your care groups
        </div>
      )}
    </div>
  );
}
