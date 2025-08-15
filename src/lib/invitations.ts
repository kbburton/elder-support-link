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

const STORAGE_KEY = "pendingInvitation";

export function savePendingInvite(token: string): void {
  const invite: PendingInvite = { token };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(invite));
}

export function loadPendingInvite(): PendingInvite | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearPendingInvite(): void {
  localStorage.removeItem(STORAGE_KEY);
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