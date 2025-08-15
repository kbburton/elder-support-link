import { supabase } from "@/integrations/supabase/client";

export interface PendingInvite {
  token: string;
}

export interface ResolvedInvite {
  id: string;
  group_id: string;
  expires_at?: string;
  used_at?: string;
}

export function savePendingInvite(token: string): void {
  localStorage.setItem('invitationToken', token);
}

export function loadPendingInvite(): PendingInvite | null {
  const token = localStorage.getItem('invitationToken');
  return token ? { token } : null;
}

export function clearPendingInvite(): void {
  localStorage.removeItem('invitationToken');
}

export async function resolveInvite(token: string): Promise<ResolvedInvite | null> {
  const { data, error } = await supabase.rpc('get_invitation_by_token', {
    invitation_token: token
  });
  
  if (error || !data || data.length === 0) {
    return null;
  }
  
  return {
    id: data[0].id,
    group_id: data[0].group_id,
    expires_at: undefined, // This field is not returned by the RPC
    used_at: undefined     // This field is not returned by the RPC
  };
}

export async function acceptInvite(invitationId: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('accept_invitation', {
    invitation_id: invitationId
  });
  
  if (error) {
    throw error;
  }
  
  return data; // group_id as uuid string
}