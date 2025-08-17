// src/lib/deleteEntity.ts
import { createClient } from "@/integrations/supabase/client";

export type Entity = "contact" | "task" | "appointment" | "activity" | "document";

type DeleteArgs = {
  entity: Entity;
  id: string;          // the record id to delete
  userId: string;      // auth.uid()
  userEmail: string;   // profiles.email or user.email
};

export async function softDelete({ entity, id, userId, userEmail }: DeleteArgs) {
  const supabase = createClient();

  // map entity -> Postgres function + arg names (we created these earlier)
  const fnMap: Record<Entity, { name: string; args: Record<string, any> }> = {
    contact: {
      name: "soft_delete_contact",
      args: { p_contact_id: id, p_actor_user_id: userId, p_actor_email: userEmail },
    },
    task: {
      name: "soft_delete_task",
      args: { p_task_id: id, p_actor_user_id: userId, p_actor_email: userEmail },
    },
    appointment: {
      name: "soft_delete_appointment",
      args: { p_appointment_id: id, p_actor_user_id: userId, p_actor_email: userEmail },
    },
    activity: {
      name: "soft_delete_activity",
      args: { p_activity_id: id, p_actor_user_id: userId, p_actor_email: userEmail },
    },
    document: {
      name: "soft_delete_document",
      args: { p_document_id: id, p_actor_user_id: userId, p_actor_email: userEmail },
    },
  };

  const { name, args } = fnMap[entity];
  // Prefer RPC (Postgres function). If your functions are “SECURITY DEFINER” and granted to authenticated, this works.
  const { error } = await supabase.rpc(name, args);
  if (error) throw error;
}
