import { supabase } from "@/integrations/supabase/client";
import type { EntityType, DeleteResult, BulkDeleteResult } from "./types";

const RPC_MAPPING = {
  contact: { 
    softDelete: 'soft_delete_contact', 
    restore: 'restore_contact' 
  },
  appointment: { 
    softDelete: 'soft_delete_appointment', 
    restore: 'restore_appointment' 
  },
  task: { 
    softDelete: 'soft_delete_task', 
    restore: 'restore_task' 
  },
  activity: { 
    softDelete: 'soft_delete_activity', 
    restore: 'restore_activity' 
  },
  document: { 
    softDelete: 'soft_delete_document', 
    restore: 'restore_document' 
  }
} as const;

export async function softDeleteEntity(
  entityType: EntityType,
  entityId: string,
  actorUserId: string,
  actorEmail: string
): Promise<DeleteResult> {
  try {
    const rpcName = RPC_MAPPING[entityType].softDelete;
    const paramName = `p_${entityType}_id`;
    
    const { error } = await supabase.rpc(rpcName as any, {
      [paramName]: entityId,
      p_actor_user_id: actorUserId,
      p_actor_email: actorEmail
    });

    if (error) {
      console.error(`Soft delete ${entityType} error:`, error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error(`Soft delete ${entityType} error:`, error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

export async function restoreEntity(
  entityType: EntityType,
  entityId: string,
  actorUserId: string,
  actorEmail: string
): Promise<DeleteResult> {
  try {
    const rpcName = RPC_MAPPING[entityType].restore;
    const paramName = `p_${entityType}_id`;
    
    const { error } = await supabase.rpc(rpcName as any, {
      [paramName]: entityId,
      p_actor_user_id: actorUserId,
      p_actor_email: actorEmail
    });

    if (error) {
      console.error(`Restore ${entityType} error:`, error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error(`Restore ${entityType} error:`, error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

export async function bulkSoftDelete(
  entityType: EntityType,
  entityIds: string[],
  actorUserId: string,
  actorEmail: string
): Promise<BulkDeleteResult> {
  const results: BulkDeleteResult = {
    successful: [],
    failed: []
  };

  for (const id of entityIds) {
    const result = await softDeleteEntity(entityType, id, actorUserId, actorEmail);
    if (result.success) {
      results.successful.push(id);
    } else {
      results.failed.push({ id, error: result.error || 'Unknown error' });
    }
  }

  return results;
}

export async function bulkRestore(
  entityType: EntityType,
  entityIds: string[],
  actorUserId: string,
  actorEmail: string
): Promise<BulkDeleteResult> {
  const results: BulkDeleteResult = {
    successful: [],
    failed: []
  };

  for (const id of entityIds) {
    const result = await restoreEntity(entityType, id, actorUserId, actorEmail);
    if (result.success) {
      results.successful.push(id);
    } else {
      results.failed.push({ id, error: result.error || 'Unknown error' });
    }
  }

  return results;
}