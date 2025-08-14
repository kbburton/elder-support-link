export type PendingInvite = { invitationId: string; groupId?: string; groupName?: string };

const NEW_KEY = "pendingInvitation";
const LEGACY_KEYS = ["postLoginInvitation"]; // add others if you find them

export function setPendingInvite(inv: PendingInvite) {
  localStorage.setItem(NEW_KEY, JSON.stringify(inv));
}

export function getPendingInvite(): PendingInvite | null {
  try {
    // 1) preferred
    const raw = localStorage.getItem(NEW_KEY);
    if (raw) {
      const obj = JSON.parse(raw);
      return obj?.invitationId ? obj : null;
    }
  } catch {}

  // 2) legacy keys (migrate to NEW_KEY)
  for (const k of LEGACY_KEYS) {
    const raw = localStorage.getItem(k);
    if (!raw) continue;
    try {
      const obj = JSON.parse(raw);
      if (obj?.invitationId) {
        localStorage.setItem(NEW_KEY, JSON.stringify(obj));
        localStorage.removeItem(k);
        return obj;
      }
    } catch {
      // raw string token
      const inv = { invitationId: raw } as PendingInvite;
      localStorage.setItem(NEW_KEY, JSON.stringify(inv));
      localStorage.removeItem(k);
      return inv;
    }
  }
  return null;
}

export function clearPendingInvite() {
  localStorage.removeItem(NEW_KEY);
  for (const k of LEGACY_KEYS) localStorage.removeItem(k);
}