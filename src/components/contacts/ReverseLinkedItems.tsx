import { useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ExternalLink, Plus, Unlink as UnlinkIcon, ChevronDown, LinkIcon } from "lucide-react";
import LinkExistingModal from "./LinkExistingModal";
import { triggerReindex } from "@/utils/reindex";

interface ReverseLinkedItemsProps {
  contactId: string;
  itemType: "activity_logs" | "appointments" | "tasks" | "documents";
}

export default function ReverseLinkedItems({ contactId, itemType }: ReverseLinkedItemsProps) {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [linkExistingOpen, setLinkExistingOpen] = useState(false);

  // Fetch linked items
  const { data: items = [], refetch: refetchLinkedItems, isLoading: loading } = useQuery({
    queryKey: ["reverse-linked-items", contactId, itemType],
    queryFn: async () => {
      let data, error;
      
      if (itemType === "activity_logs") {
        ({ data, error } = await supabase
          .from("contact_activities")
          .select(`activity_logs!inner(id, title, date_time, type)`)
          .eq("contact_id", contactId));
      } else if (itemType === "appointments") {
        ({ data, error } = await supabase
          .from("contact_appointments")
          .select(`appointments!inner(id, category, description, date_time)`)
          .eq("contact_id", contactId));
      } else if (itemType === "tasks") {
        ({ data, error } = await supabase
          .from("contact_tasks")
          .select(`tasks!inner(id, title, status, due_date)`)
          .eq("contact_id", contactId));
      } else if (itemType === "documents") {
        ({ data, error } = await supabase
          .from("contact_documents")
          .select(`documents!inner(id, title, category, upload_date)`)
          .eq("contact_id", contactId));
      }

      if (error) throw error;
      
      const linkedItems = data?.map((item: any) => item[itemType.slice(0, -1)] || item[itemType]).filter(Boolean) || [];
      return linkedItems;
    },
    enabled: !!contactId,
  });

  const handleUnlink = async (itemId: string) => {
    try {
      let error;
      
      if (itemType === "activity_logs") {
        ({ error } = await supabase
          .from("contact_activities")
          .delete()
          .eq("contact_id", contactId)
          .eq("activity_log_id", itemId));
      } else if (itemType === "appointments") {
        ({ error } = await supabase
          .from("contact_appointments")
          .delete()
          .eq("contact_id", contactId)
          .eq("appointment_id", itemId));
      } else if (itemType === "tasks") {
        ({ error } = await supabase
          .from("contact_tasks")
          .delete()
          .eq("contact_id", contactId)
          .eq("task_id", itemId));
      } else if (itemType === "documents") {
        ({ error } = await supabase
          .from("contact_documents")
          .delete()
          .eq("contact_id", contactId)
          .eq("document_id", itemId));
      }

      if (error) throw error;

      // Trigger reindex for the unlinked item (fire and forget)
      triggerReindex(itemType, itemId);

      toast({
        title: "Success",
        description: "Unlinked contact",
      });

      refetchLinkedItems();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || `Failed to unlink ${itemType.replace("_", " ")}`,
        variant: "destructive",
      });
    }
  };

  const handleCreateNew = () => {
    // Navigate to create form with contact pre-filled
    const routeMap = {
      activity_logs: "activity",
      appointments: "appointments", 
      tasks: "tasks",
      documents: "documents"
    };
    
    const route = routeMap[itemType];
    navigate(`/app/${groupId}/${route}/create?contactId=${contactId}`);
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Related {itemType.replace("_", " ").replace("s", "s")}</CardTitle>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add
                  <ChevronDown className="h-4 w-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setLinkExistingOpen(true)}>
                  <LinkIcon className="h-4 w-4 mr-2" />
                  Link existing
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleCreateNew}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create new
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="animate-pulse space-y-2">
              <div className="h-4 bg-gray-200 rounded"></div>
            </div>
          ) : items.length === 0 ? (
            <p className="text-muted-foreground">No {itemType.replace("_", " ")} linked to this contact.</p>
          ) : (
            <div className="space-y-2">
              {items.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-2 border rounded">
                  <div>
                    <span className="font-medium">{item.title || item.description || item.category}</span>
                    {item.date_time && (
                      <span className="text-sm text-muted-foreground ml-2">
                        {format(new Date(item.date_time), "MMM d, yyyy")}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleUnlink(item.id)}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <UnlinkIcon className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" asChild>
                      <Link to={`/app/${groupId}/${itemType === "activity_logs" ? "activity" : itemType}/${item.id}`}>
                        <ExternalLink className="h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Link existing modal */}
      <LinkExistingModal
        open={linkExistingOpen}
        onOpenChange={setLinkExistingOpen}
        contactId={contactId}
        entityType={itemType}
        onLinked={refetchLinkedItems}
      />
    </>
  );
}