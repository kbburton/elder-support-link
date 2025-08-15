export type PendingInvite = { invitationId: string; groupId?: string; groupName?: string };

const NEW_KEY = "pendingInvitation";
const LEGACY = ["postLoginInvitation"];

export function getPendingInvite(): PendingInvite | null {
  try {
    const raw = localStorage.getItem(NEW_KEY) ?? localStorage.getItem(LEGACY[0]);
    if (!raw) return null;
    try {
      const obj = JSON.parse(raw);
      return obj?.invitationId ? obj : null;
    } catch { return { invitationId: raw } as PendingInvite; }
  } catch { return null; }
}

export function setPendingInvite(i: PendingInvite) { 
  localStorage.setItem(NEW_KEY, JSON.stringify(i)); 
}

export function clearPendingInvite() { 
  localStorage.removeItem(NEW_KEY); 
  LEGACY.forEach(k=>localStorage.removeItem(k)); 
}