import { useState, useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ExternalLink, Plus, Unlink as UnlinkIcon } from "lucide-react";

interface ReverseLinkedItemsProps {
  contactId: string;
  itemType: "activity_logs" | "appointments" | "tasks" | "documents";
}

export default function ReverseLinkedItems({ contactId, itemType }: ReverseLinkedItemsProps) {
  const { groupId } = useParams();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string>("");
  const [isLinking, setIsLinking] = useState(false);

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

  // Fetch available items to link
  const { data: availableItems = [] } = useQuery({
    queryKey: ["available-items", groupId, itemType],
    queryFn: async () => {
      let data, error;
      
      if (itemType === "activity_logs") {
        ({ data, error } = await supabase
          .from("activity_logs")
          .select("id, title, date_time, type")
          .eq("group_id", groupId!)
          .order("date_time", { ascending: false }));
      } else if (itemType === "appointments") {
        ({ data, error } = await supabase
          .from("appointments")
          .select("id, description, date_time, category")
          .eq("group_id", groupId!)
          .order("date_time", { ascending: false }));
      } else if (itemType === "tasks") {
        ({ data, error } = await supabase
          .from("tasks")
          .select("id, title, status, due_date")
          .eq("group_id", groupId!)
          .order("created_at", { ascending: false }));
      } else if (itemType === "documents") {
        ({ data, error } = await supabase
          .from("documents")
          .select("id, title, category, upload_date")
          .eq("group_id", groupId!)
          .order("upload_date", { ascending: false }));
      }

      if (error) throw error;
      return data || [];
    },
    enabled: !!groupId && isDialogOpen,
  });

  const handleLink = async () => {
    if (!selectedItemId) return;
    
    setIsLinking(true);
    try {
      let error;
      
      if (itemType === "activity_logs") {
        ({ error } = await supabase
          .from("contact_activities")
          .insert({
            contact_id: contactId,
            activity_log_id: selectedItemId,
          }));
      } else if (itemType === "appointments") {
        ({ error } = await supabase
          .from("contact_appointments")
          .insert({
            contact_id: contactId,
            appointment_id: selectedItemId,
          }));
      } else if (itemType === "tasks") {
        ({ error } = await supabase
          .from("contact_tasks")
          .insert({
            contact_id: contactId,
            task_id: selectedItemId,
          }));
      } else if (itemType === "documents") {
        ({ error } = await supabase
          .from("contact_documents")
          .insert({
            contact_id: contactId,
            document_id: selectedItemId,
          }));
      }

      if (error) throw error;

      toast({
        title: "Success",
        description: `${itemType.replace("_", " ")} linked successfully`,
      });

      setSelectedItemId("");
      setIsDialogOpen(false);
      refetchLinkedItems();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || `Failed to link ${itemType.replace("_", " ")}`,
        variant: "destructive",
      });
    } finally {
      setIsLinking(false);
    }
  };

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

      toast({
        title: "Success",
        description: `${itemType.replace("_", " ")} unlinked successfully`,
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

  // Filter out already linked items
  const unlinkedItems = availableItems.filter(
    item => !items.some(linkedItem => linkedItem.id === item.id)
  );

  const getItemDisplayName = (item: any) => {
    return item.title || item.description || item.category || "Untitled";
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Related {itemType.replace("_", " ").replace("s", "s")}</CardTitle>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Link
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Link {itemType.replace("_", " ").slice(0, -1)} to Contact</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <Select value={selectedItemId} onValueChange={setSelectedItemId}>
                  <SelectTrigger>
                    <SelectValue placeholder={`Select a ${itemType.replace("_", " ").slice(0, -1)} to link`} />
                  </SelectTrigger>
                  <SelectContent>
                    {unlinkedItems.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {getItemDisplayName(item)}
                        {item.date_time && (
                          <span className="text-sm text-muted-foreground ml-2">
                            - {format(new Date(item.date_time), "MMM d, yyyy")}
                          </span>
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex justify-end space-x-2">
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleLink}
                    disabled={!selectedItemId || isLinking}
                  >
                    {isLinking ? "Linking..." : "Link"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
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
  );
}