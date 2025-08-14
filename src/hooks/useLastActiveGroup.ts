import { useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

export const useLastActiveGroup = () => {
  const { groupId } = useParams();

  useEffect(() => {
    const updateLastActiveGroup = async () => {
      if (!groupId) return;

      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) return;

        // Only update when explicitly navigating between groups
        // This hook should be used in components that represent explicit navigation
        await supabase
          .from('profiles')
          .update({ last_active_group_id: groupId })
          .eq('user_id', session.user.id);
      } catch (error) {
        console.error('Error updating last active group:', error);
      }
    };

    updateLastActiveGroup();
  }, [groupId]);
};