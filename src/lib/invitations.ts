// src/lib/invitations.ts
export type PendingInvite = {
  invitationId: string;   // UUID from the invite link
  groupId: string;        // group UUID
  groupName?: string;
};

const KEY = 'pendingInvitation';

export function savePendingInvite(i: PendingInvite) {
  localStorage.setItem(KEY, JSON.stringify(i));
}

export function getPendingInvite(): PendingInvite | null {
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export function clearPendingInvite() {
  localStorage.removeItem(KEY);
}