import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useGroupMembers(groupId: string) {
  return useQuery({
    queryKey: ['group-members', groupId],
    queryFn: async () => {
      if (!groupId) {
        return [];
      }
      
      // Use direct SQL query instead of PostgREST relationship since the FK constraint isn't being recognized
      const { data: members, error } = await supabase
        .rpc('get_group_members', { p_group_id: groupId });

      if (error) {
        console.error('Error fetching group members:', error);
        // Fallback: try without the RPC function
        const { data: fallbackMembers, error: fallbackError } = await supabase
          .from('care_group_members')
          .select(`
            user_id,
            profiles(email, first_name, last_name)
          `)
          .eq('group_id', groupId);
          
        if (fallbackError) {
          throw fallbackError;
        }
        
        return fallbackMembers?.map((member: any) => {
          const profile = member.profiles;
          const firstName = profile?.first_name || '';
          const lastName = profile?.last_name || '';
          const fullName = `${firstName} ${lastName}`.trim();
          
          return {
            id: member.user_id,
            email: profile?.email || '',
            name: fullName || profile?.email || 'Unknown User'
          };
        }) || [];
      }

      return members?.map((member: any) => ({
        id: member.user_id,
        email: member.email || '',
        name: member.display_name || member.email || 'Unknown User'
      })) || [];
    },
    enabled: !!groupId
  });
}