// src/lib/restoreEntity.ts
import { createClient } from "@/integrations/supabase/client";
import type { Entity } from "./deleteEntity";

type RestoreArgs = {
  entity: Entity;
  id: string;
  userId: string;
  userEmail: string;
};

export async function restoreEntity({ entity, id, userId, userEmail }: RestoreArgs) {
  const supabase = createClient();

  const fnMap: Record<Entity, { name: string; args: Record<string, any> }> = {
    contact: {
      name: "restore_contact",
      args: { p_contact_id: id, p_actor_user_id: userId, p_actor_email: userEmail },
    },
    task: {
      name: "restore_task",
      args: { p_task_id: id, p_actor_user_id: userId, p_actor_email: userEmail },
    },
    appointment: {
      name: "restore_appointment",
      args: { p_appointment_id: id, p_actor_user_id: userId, p_actor_email: userEmail },
    },
    activity: {
      name: "restore_activity",
      args: { p_activity_id: id, p_actor_user_id: userId, p_actor_email: userEmail },
    },
    document: {
      name: "restore_document", // if you haven't created this RPC yet, skip documents in Trash for now
      args: { p_document_id: id, p_actor_user_id: userId, p_actor_email: userEmail },
    },
  };

  const { name, args } = fnMap[entity];
  const { error } = await supabase.rpc(name, args);
  if (error) throw error;
}
