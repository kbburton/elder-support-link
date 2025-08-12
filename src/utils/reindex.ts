import { supabase } from "@/integrations/supabase/client";

export async function triggerReindex(entityType: "tasks" | "appointments" | "activity_logs" | "documents", entityId: string) {
  try {
    const entityTypeMap = {
      tasks: "task",
      appointments: "appointment", 
      activity_logs: "activity",
      documents: "document",
    };
    
    const mappedType = entityTypeMap[entityType];
    
    await supabase.rpc("reindex_row", {
      p_entity_type: mappedType,
      p_entity_id: entityId,
    });
  } catch (error) {
    // Fire and forget - log error but don't throw
    console.error("Failed to trigger reindex:", error);
  }
}