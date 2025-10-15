import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePlatformAdmin } from "@/hooks/usePlatformAdmin";

/**
 * Hook to check if the current user has access to Documents V2 features
 * Access is determined by:
 * 1. If user is a platform admin (always has access)
 * 2. If user is a care group admin AND feature is enabled for all users
 */
export function useDocumentsV2Access() {
  const isPlatformAdmin = usePlatformAdmin();

  return useQuery({
    queryKey: ["documents-v2-access"],
    queryFn: async () => {
      // Platform admins always have access
      if (isPlatformAdmin) {
        return { hasAccess: true, reason: "platform_admin" };
      }

      // Check app settings for feature flag
      const { data: settingData, error } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "documents_v2_enabled_for_all")
        .single();

      if (error) {
        console.error("Error checking documents v2 access:", error);
        return { hasAccess: false, reason: "error" };
      }

      const isEnabledForAll = settingData?.value === "true";

      if (!isEnabledForAll) {
        return { hasAccess: false, reason: "feature_disabled" };
      }

      // If enabled for all, check if user is at least a care group admin
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        return { hasAccess: false, reason: "not_authenticated" };
      }

      const { data: memberData } = await supabase
        .from("care_group_members")
        .select("is_admin")
        .eq("user_id", userData.user.id)
        .eq("is_admin", true)
        .maybeSingle();

      if (memberData) {
        return { hasAccess: true, reason: "care_group_admin" };
      }

      return { hasAccess: false, reason: "not_admin" };
    },
  });
}
