// src/lib/getUserIdentity.ts
import { createClient } from "@/integrations/supabase/client";

export async function getUserIdentity() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return {
    userId: user?.id ?? "",
    userEmail: user?.email ?? "unknown@unknown",
  };
}
