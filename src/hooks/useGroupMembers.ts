import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useGroupMembers(groupId: string) {
  return useQuery({
    queryKey: ['group-members', groupId],
    queryFn: async () => {
      if (!groupId) {
        return [];
      }
      
      // Use the new RPC function to get group members with proper joins
      const { data: members, error } = await supabase
        .rpc('get_group_members', { p_group_id: groupId }) as { 
          data: Array<{
            user_id: string;
            email: string;
            first_name: string | null;
            last_name: string | null;
            display_name: string;
            role: string;
            is_admin: boolean;
          }> | null;
          error: any;
        };

      if (error) {
        console.error('Error fetching group members:', error);
        throw error;
      }

      return (members || []).map(member => ({
        id: member.user_id,
        email: member.email || '',
        name: member.display_name || 'Unknown User'
      }));
    },
    enabled: !!groupId
  });
}