import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Link, Unlink } from "lucide-react";

interface ContactLinkerProps {
  entityId: string;
  entityType: "activity_logs" | "appointments" | "tasks" | "documents";
  entityTitle?: string;
  onLinksChange?: () => void;
}

interface Contact {
  id: string;
  first_name: string | null;
  last_name: string | null;
  organization_name: string | null;
}

export default function ContactLinker({
  entityId,
  entityType,
  entityTitle,
  onLinksChange,
}: ContactLinkerProps) {
  const { groupId } = useParams();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedContactId, setSelectedContactId] = useState<string>("");
  const [isLinking, setIsLinking] = useState(false);

  // Fetch contacts in the group
  const { data: contacts = [] } = useQuery({
    queryKey: ["contacts", groupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select("id, first_name, last_name, organization_name")
        .eq("care_group_id", groupId!)
        .order("first_name", { ascending: true });
      
      if (error) throw error;
      return data as Contact[];
    },
    enabled: !!groupId,
  });

  // Fetch existing linked contacts
  const { data: linkedContacts = [], refetch: refetchLinks } = useQuery({
    queryKey: ["linked-contacts", entityType, entityId],
    queryFn: async () => {
      let data, error;
      
      if (entityType === "activity_logs") {
        ({ data, error } = await supabase
          .from("contact_activities")
          .select(`contacts!inner(id, first_name, last_name, organization_name)`)
          .eq("activity_log_id", entityId));
      } else if (entityType === "appointments") {
        ({ data, error } = await supabase
          .from("contact_appointments")
          .select(`contacts!inner(id, first_name, last_name, organization_name)`)
          .eq("appointment_id", entityId));
      } else if (entityType === "tasks") {
        ({ data, error } = await supabase
          .from("contact_tasks")
          .select(`contacts!inner(id, first_name, last_name, organization_name)`)
          .eq("task_id", entityId));
      } else if (entityType === "documents") {
        ({ data, error } = await supabase
          .from("contact_documents")
          .select(`contacts!inner(id, first_name, last_name, organization_name)`)
          .eq("document_id", entityId));
      }

      if (error) throw error;
      
      return data?.map((item: any) => item.contacts).filter(Boolean) || [];
    },
    enabled: !!entityId,
  });

  const getContactName = (contact: Contact) => {
    const fullName = [contact.first_name, contact.last_name].filter(Boolean).join(" ");
    return fullName || contact.organization_name || "Unknown Contact";
  };

  const handleLink = async () => {
    if (!selectedContactId) return;
    
    setIsLinking(true);
    try {
      let error;
      
      if (entityType === "activity_logs") {
        ({ error } = await supabase
          .from("contact_activities")
          .insert({
            contact_id: selectedContactId,
            activity_log_id: entityId,
          }));
      } else if (entityType === "appointments") {
        ({ error } = await supabase
          .from("contact_appointments")
          .insert({
            contact_id: selectedContactId,
            appointment_id: entityId,
          }));
      } else if (entityType === "tasks") {
        ({ error } = await supabase
          .from("contact_tasks")
          .insert({
            contact_id: selectedContactId,
            task_id: entityId,
          }));
      } else if (entityType === "documents") {
        ({ error } = await supabase
          .from("contact_documents")
          .insert({
            contact_id: selectedContactId,
            document_id: entityId,
          }));
      }

      if (error) throw error;

      toast({
        title: "Success",
        description: "Contact linked successfully",
      });

      setSelectedContactId("");
      setIsDialogOpen(false);
      refetchLinks();
      onLinksChange?.();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to link contact",
        variant: "destructive",
      });
    } finally {
      setIsLinking(false);
    }
  };

  const handleUnlink = async (contactId: string) => {
    try {
      let error;
      
      if (entityType === "activity_logs") {
        ({ error } = await supabase
          .from("contact_activities")
          .delete()
          .eq("contact_id", contactId)
          .eq("activity_log_id", entityId));
      } else if (entityType === "appointments") {
        ({ error } = await supabase
          .from("contact_appointments")
          .delete()
          .eq("contact_id", contactId)
          .eq("appointment_id", entityId));
      } else if (entityType === "tasks") {
        ({ error } = await supabase
          .from("contact_tasks")
          .delete()
          .eq("contact_id", contactId)
          .eq("task_id", entityId));
      } else if (entityType === "documents") {
        ({ error } = await supabase
          .from("contact_documents")
          .delete()
          .eq("contact_id", contactId)
          .eq("document_id", entityId));
      }

      if (error) throw error;

      toast({
        title: "Success", 
        description: "Contact unlinked successfully",
      });

      refetchLinks();
      onLinksChange?.();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to unlink contact",
        variant: "destructive",
      });
    }
  };

  // Get available contacts (not already linked)
  const availableContacts = contacts.filter(
    contact => !linkedContacts.some(linked => linked.id === contact.id)
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">Linked Contacts</h4>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Link className="h-4 w-4 mr-2" />
              Link Contact
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Link Contact to {entityTitle}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Select value={selectedContactId} onValueChange={setSelectedContactId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a contact to link" />
                </SelectTrigger>
                <SelectContent>
                  {availableContacts.map((contact) => (
                    <SelectItem key={contact.id} value={contact.id}>
                      {getContactName(contact)}
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
                  disabled={!selectedContactId || isLinking}
                >
                  {isLinking ? "Linking..." : "Link Contact"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {linkedContacts.length === 0 ? (
        <p className="text-sm text-muted-foreground">No contacts linked</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {linkedContacts.map((contact) => (
            <Badge key={contact.id} variant="secondary" className="flex items-center gap-2">
              {getContactName(contact)}
              <Button
                variant="ghost"
                size="sm"
                className="h-4 w-4 p-0 hover:bg-destructive hover:text-destructive-foreground"
                onClick={() => handleUnlink(contact.id)}
              >
                <Unlink className="h-3 w-3" />
              </Button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}