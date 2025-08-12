import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { useToast } from "@/hooks/use-toast";
import { X, Users } from "lucide-react";

interface Contact {
  id: string;
  first_name: string | null;
  last_name: string | null;
  organization_name: string | null;
  contact_type: string;
}

interface RelatedContactsSectionProps {
  entityType: "appointments" | "tasks" | "activity_logs" | "documents";
  entityId: string;
  title?: string;
}

export default function RelatedContactsSection({
  entityType,
  entityId,
  title = "Related Contacts",
}: RelatedContactsSectionProps) {
  const { groupId } = useParams();
  const { toast } = useToast();
  const [unlinkContactId, setUnlinkContactId] = useState<string | null>(null);

  // Fetch linked contacts
  const { data: linkedContacts = [], refetch } = useQuery({
    queryKey: ["linked-contacts", entityType, entityId],
    queryFn: async () => {
      let data, error;
      
      if (entityType === "activity_logs") {
        ({ data, error } = await supabase
          .from("contact_activities")
          .select(`contacts!inner(id, first_name, last_name, organization_name, contact_type)`)
          .eq("activity_log_id", entityId));
      } else if (entityType === "appointments") {
        ({ data, error } = await supabase
          .from("contact_appointments")
          .select(`contacts!inner(id, first_name, last_name, organization_name, contact_type)`)
          .eq("appointment_id", entityId));
      } else if (entityType === "tasks") {
        ({ data, error } = await supabase
          .from("contact_tasks")
          .select(`contacts!inner(id, first_name, last_name, organization_name, contact_type)`)
          .eq("task_id", entityId));
      } else if (entityType === "documents") {
        ({ data, error } = await supabase
          .from("contact_documents")
          .select(`contacts!inner(id, first_name, last_name, organization_name, contact_type)`)
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

  const getContactTypeColor = (type: string) => {
    const colors = {
      medical: "bg-red-50 text-red-700 border-red-200",
      legal: "bg-blue-50 text-blue-700 border-blue-200", 
      family: "bg-green-50 text-green-700 border-green-200",
      friend: "bg-yellow-50 text-yellow-700 border-yellow-200",
      other: "bg-gray-50 text-gray-700 border-gray-200",
    };
    return colors[type as keyof typeof colors] || colors.other;
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

      refetch();
      setUnlinkContactId(null);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to unlink contact",
        variant: "destructive",
      });
    }
  };

  if (linkedContacts.length === 0) {
    return null;
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {linkedContacts.map((contact) => (
              <div key={contact.id} className="flex items-center gap-1">
                <Badge 
                  variant="secondary" 
                  className={`${getContactTypeColor(contact.contact_type)} pr-1`}
                >
                  {getContactName(contact)}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-4 w-4 p-0 ml-1 hover:bg-destructive hover:text-destructive-foreground"
                    onClick={() => setUnlinkContactId(contact.id)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Unlink confirmation dialog */}
      <AlertDialog open={!!unlinkContactId} onOpenChange={() => setUnlinkContactId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unlink Contact</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to unlink this contact? This will remove the association 
              but won't delete the contact itself.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => unlinkContactId && handleUnlink(unlinkContactId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Unlink
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}