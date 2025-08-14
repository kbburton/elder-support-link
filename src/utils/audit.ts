import { supabase } from "@/integrations/supabase/client";

/**
 * Audit logging utilities for enhanced security monitoring
 */

export type AuditAction = 
  | 'create' | 'update' | 'delete' | 'view' | 'download' | 'upload' 
  | 'login' | 'logout' | 'password_change' | 'permission_change'
  | 'admin_action' | 'export' | 'import' | 'search';

export type ResourceType = 
  | 'contact' | 'task' | 'appointment' | 'document' | 'activity' 
  | 'user' | 'group' | 'invitation' | 'feedback';

interface AuditLogEntry {
  action: AuditAction;
  resourceType: ResourceType;
  resourceId: string;
  groupId: string;
  details?: Record<string, any>;
}

interface AdminAuditEntry {
  action: string;
  targetType?: string;
  targetId?: string;
  details?: Record<string, any>;
}

/**
 * Logs user actions for audit trail
 */
export async function logAuditEvent({
  action,
  resourceType,
  resourceId,
  groupId,
  details
}: AuditLogEntry): Promise<void> {
  try {
    const { error } = await supabase.rpc('log_audit_event', {
      p_action: action,
      p_resource_type: resourceType,
      p_resource_id: resourceId,
      p_group_id: groupId,
      p_details: details ? JSON.stringify(details) : null
    });

    if (error) {
      console.error('Failed to log audit event:', error);
    }
  } catch (error) {
    console.error('Error logging audit event:', error);
  }
}

/**
 * Logs admin actions for security monitoring
 */
export async function logAdminAction({
  action,
  targetType,
  targetId,
  details
}: AdminAuditEntry): Promise<void> {
  try {
    const { error } = await supabase.rpc('log_admin_action', {
      p_action: action,
      p_target_type: targetType,
      p_target_id: targetId,
      p_details: details ? JSON.stringify(details) : null
    });

    if (error) {
      console.error('Failed to log admin action:', error);
    }
  } catch (error) {
    console.error('Error logging admin action:', error);
  }
}

/**
 * Creates an audit trail for document operations
 */
export async function auditDocumentOperation(
  action: 'view' | 'download' | 'upload' | 'delete',
  documentId: string,
  groupId: string,
  additionalDetails?: Record<string, any>
): Promise<void> {
  await logAuditEvent({
    action,
    resourceType: 'document',
    resourceId: documentId,
    groupId,
    details: {
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      ...additionalDetails
    }
  });
}

/**
 * Creates an audit trail for contact operations
 */
export async function auditContactOperation(
  action: AuditAction,
  contactId: string,
  groupId: string,
  additionalDetails?: Record<string, any>
): Promise<void> {
  await logAuditEvent({
    action,
    resourceType: 'contact',
    resourceId: contactId,
    groupId,
    details: {
      timestamp: new Date().toISOString(),
      ...additionalDetails
    }
  });
}

/**
 * Creates an audit trail for task operations
 */
export async function auditTaskOperation(
  action: AuditAction,
  taskId: string,
  groupId: string,
  additionalDetails?: Record<string, any>
): Promise<void> {
  await logAuditEvent({
    action,
    resourceType: 'task',
    resourceId: taskId,
    groupId,
    details: {
      timestamp: new Date().toISOString(),
      ...additionalDetails
    }
  });
}

/**
 * Creates an audit trail for appointment operations
 */
export async function auditAppointmentOperation(
  action: AuditAction,
  appointmentId: string,
  groupId: string,
  additionalDetails?: Record<string, any>
): Promise<void> {
  await logAuditEvent({
    action,
    resourceType: 'appointment',
    resourceId: appointmentId,
    groupId,
    details: {
      timestamp: new Date().toISOString(),
      ...additionalDetails
    }
  });
}

/**
 * Creates an audit trail for admin operations
 */
export async function auditAdminOperation(
  action: string,
  targetType?: string,
  targetId?: string,
  additionalDetails?: Record<string, any>
): Promise<void> {
  await logAdminAction({
    action,
    targetType,
    targetId,
    details: {
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      ...additionalDetails
    }
  });
}

/**
 * Gets audit logs for a specific group (for group admins)
 */
export async function getGroupAuditLogs(groupId: string, limit: number = 50) {
  const { data, error } = await supabase
    .from('enhanced_audit_logs')
    .select('*')
    .eq('group_id', groupId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Failed to fetch audit logs:', error);
    return [];
  }

  return data || [];
}

/**
 * Gets admin audit logs (for platform admins only)
 */
export async function getAdminAuditLogs(limit: number = 50) {
  const { data, error } = await supabase
    .from('admin_audit_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Failed to fetch admin audit logs:', error);
    return [];
  }

  return data || [];
}