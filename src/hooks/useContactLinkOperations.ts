import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { triggerReindex } from "@/utils/reindex";

export interface ContactLinkOperations {
  persistContactLinks: (
    entityType: "appointments" | "tasks" | "activity_logs" | "documents",
    entityId: string,
    newContactIds: string[],
    existingContactIds: string[]
  ) => Promise<void>;
}

export function useContactLinkOperations(): ContactLinkOperations {
  const { toast } = useToast();

  const persistContactLinks = async (
    entityType: "appointments" | "tasks" | "activity_logs" | "documents",
    entityId: string,
    newContactIds: string[],
    existingContactIds: string[]
  ) => {
    try {
      // Calculate differences
      const toAdd = newContactIds.filter(id => !existingContactIds.includes(id));
      const toRemove = existingContactIds.filter(id => !newContactIds.includes(id));

      const linkTableMap = {
        appointments: "contact_appointments",
        tasks: "contact_tasks",
        activity_logs: "contact_activities",
        documents: "contact_documents",
      };

      const entityColumnMap = {
        appointments: "appointment_id",
        tasks: "task_id", 
        activity_logs: "activity_log_id",
        documents: "document_id",
      };

      const linkTable = linkTableMap[entityType];
      const entityColumn = entityColumnMap[entityType];

      // Remove unlinked contacts
      if (toRemove.length > 0) {
        for (const contactId of toRemove) {
          const { error } = await supabase
            .from(linkTable as any)
            .delete()
            .eq("contact_id", contactId)
            .eq(entityColumn, entityId);

          if (error) {
            console.error(`Error removing contact link:`, error);
            // Continue with other operations even if one fails
          }
        }
      }

      // Add new contact links
      if (toAdd.length > 0) {
        const insertData = toAdd.map(contactId => ({
          contact_id: contactId,
          [entityColumn]: entityId,
        }));

        for (const data of insertData) {
          const { error } = await supabase
            .from(linkTable as any)
            .insert(data);

          if (error) {
            // If it's a duplicate constraint error, ignore it silently
            if (!error.message?.includes("duplicate") && !error.message?.includes("unique")) {
              console.error(`Error adding contact link:`, error);
              throw error;
            }
          }
        }
      }

      // Trigger reindex for the entity (fire and forget)
      triggerReindex(entityType, entityId);

      if (toAdd.length > 0 || toRemove.length > 0) {
        toast({
          title: "Success",
          description: `Contact links updated successfully`,
        });
      }
    } catch (error: any) {
      console.error("Error persisting contact links:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to update contact links",
        variant: "destructive",
      });
      throw error;
    }
  };

  return { persistContactLinks };
}