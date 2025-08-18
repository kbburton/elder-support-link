import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";

export const useGroupWelcome = (groupId: string, groupName: string) => {
  const [showWelcome, setShowWelcome] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const checkFirstTimeAccess = async () => {
      try {
        // Validate groupId before making requests
        if (!groupId || groupId === ':groupId' || groupId === 'undefined' || groupId.startsWith(':')) {
          console.log('Skipping welcome check for invalid groupId:', groupId);
          return;
        }

        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) return;

        // Check if user has accessed this group before
        const { data: hasAccessed } = await supabase.rpc('has_accessed_group_before', {
          p_user_id: session.user.id,
          p_group_id: groupId
        });

        if (!hasAccessed) {
          setShowWelcome(true);
        }
      } catch (error) {
        console.error('Error checking group access:', error);
      }
    };

    if (groupId && groupName) {
      checkFirstTimeAccess();
    }
  }, [groupId, groupName]);

  const closeWelcome = () => {
    setShowWelcome(false);
  };

  return {
    showWelcome,
    closeWelcome
  };
};