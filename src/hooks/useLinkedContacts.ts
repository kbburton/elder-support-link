import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface Contact {
  id: string;
  first_name: string | null;
  last_name: string | null;
  organization_name: string | null;
}

export function useLinkedContacts(entityType: string, entityId: string) {
  return useQuery({
    queryKey: ["linked-contacts-search", entityType, entityId],
    queryFn: async () => {
      let data, error;
      
      if (entityType === "activity") {
        ({ data, error } = await supabase
          .from("contact_activities")
          .select(`contacts!inner(id, first_name, last_name, organization_name)`)
          .eq("activity_log_id", entityId));
      } else if (entityType === "appointment") {
        ({ data, error } = await supabase
          .from("contact_appointments")
          .select(`contacts!inner(id, first_name, last_name, organization_name)`)
          .eq("appointment_id", entityId));
      } else if (entityType === "task") {
        ({ data, error } = await supabase
          .from("contact_tasks")
          .select(`contacts!inner(id, first_name, last_name, organization_name)`)
          .eq("task_id", entityId));
      } else if (entityType === "document") {
        ({ data, error } = await supabase
          .from("contact_documents")
          .select(`contacts!inner(id, first_name, last_name, organization_name)`)
          .eq("document_id", entityId));
      } else {
        // For contact type, return empty array since contacts don't link to themselves
        return [];
      }

      if (error) throw error;
      
      return data?.map((item: any) => item.contacts).filter(Boolean) || [];
    },
    enabled: !!entityId && entityType !== "contact",
  });
}

export function getContactDisplayName(contact: Contact) {
  const fullName = [contact.first_name, contact.last_name].filter(Boolean).join(" ");
  return fullName || contact.organization_name || "Unknown Contact";
}