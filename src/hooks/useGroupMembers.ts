import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useGroupMembers(groupId: string) {
  return useQuery({
    queryKey: ['group-members', groupId],
    queryFn: async () => {
      if (!groupId) {
        return [];
      }
      
      const { data: members, error } = await supabase
        .from('care_group_members')
        .select(`
          user_id,
          profiles!care_group_members_user_id_fkey(email, first_name, last_name)
        `)
        .eq('group_id', groupId);

      if (error) {
        throw error;
      }

      const processedMembers = members?.map((member: any) => {
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
      
      return processedMembers;
    },
    enabled: !!groupId
  });
}