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
  console.log('🗑️ SOFT DELETE DEBUG START:', {
    entityType,
    entityId,
    actorUserId,
    actorEmail,
    timestamp: new Date().toISOString()
  });
  
  try {
    const rpcName = RPC_MAPPING[entityType].softDelete;
    console.log('🗑️ Using RPC function:', rpcName);
    
    // Use correct parameter names for each entity type based on actual DB function signatures
    let params: Record<string, any>;
    if (entityType === 'task') {
      // soft_delete_task(p_task_id uuid, p_actor_user_id uuid, p_actor_email text)
      params = {
        p_task_id: entityId,
        p_actor_user_id: actorUserId,
        p_actor_email: actorEmail
      };
    } else if (entityType === 'appointment') {
      // soft_delete_appointment(p_by_email text, p_by_user_id uuid, p_appointment_id uuid)
      params = {
        p_appointment_id: entityId,
        p_by_user_id: actorUserId,
        p_by_email: actorEmail
      };
    } else if (entityType === 'contact') {
      // soft_delete_contact(p_by_email text, p_by_user_id uuid, p_contact_id uuid)
      params = {
        p_contact_id: entityId,
        p_by_user_id: actorUserId,
        p_by_email: actorEmail
      };
    } else if (entityType === 'activity') {
      // soft_delete_activity(p_activity_id uuid, p_actor_user_id uuid, p_actor_email text)
      params = {
        p_activity_id: entityId,
        p_actor_user_id: actorUserId,
        p_actor_email: actorEmail
      };
    } else if (entityType === 'document') {
      // soft_delete_document(p_document_id uuid, p_actor_user_id uuid, p_actor_email text)
      params = {
        p_document_id: entityId,
        p_actor_user_id: actorUserId,
        p_actor_email: actorEmail
      };
    } else {
      throw new Error(`Unknown entity type: ${entityType}`);
    }
    
    console.log('🗑️ Prepared parameters:', params);
    console.log('🗑️ Calling supabase.rpc with:', { rpcName, params });
    
    const { error } = await supabase.rpc(rpcName as any, params);
    
    console.log('🗑️ RPC Response:', { error: error ? {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code
    } : null });

    if (error) {
      console.error(`🗑️ Soft delete ${entityType} error:`, error);
      return { success: false, error: error.message };
    }

    console.log('🗑️ SOFT DELETE SUCCESS for', entityType, entityId);
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
    
    // Use correct parameter names for each entity type based on actual DB function signatures
    let params: Record<string, any>;
    if (entityType === 'task') {
      // restore_task(p_task_id uuid, p_actor_user_id uuid, p_actor_email text)
      params = {
        p_task_id: entityId,
        p_actor_user_id: actorUserId,
        p_actor_email: actorEmail
      };
    } else if (entityType === 'appointment') {
      // restore_appointment(p_appointment_id uuid, p_actor_user_id uuid, p_actor_email text)
      params = {
        p_appointment_id: entityId,
        p_actor_user_id: actorUserId,
        p_actor_email: actorEmail
      };
    } else if (entityType === 'contact') {
      // restore_contact(p_contact_id uuid, p_actor_user_id uuid, p_actor_email text)
      params = {
        p_contact_id: entityId,
        p_actor_user_id: actorUserId,
        p_actor_email: actorEmail
      };
    } else if (entityType === 'activity') {
      // restore_activity(p_activity_id uuid, p_actor_user_id uuid, p_actor_email text)
      params = {
        p_activity_id: entityId,
        p_actor_user_id: actorUserId,
        p_actor_email: actorEmail
      };
    } else if (entityType === 'document') {
      // restore_document(p_document_id uuid, p_actor_user_id uuid, p_actor_email text)
      params = {
        p_document_id: entityId,
        p_actor_user_id: actorUserId,
        p_actor_email: actorEmail
      };
    } else {
      throw new Error(`Unknown entity type: ${entityType}`);
    }
    
    const { error } = await supabase.rpc(rpcName as any, params);

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