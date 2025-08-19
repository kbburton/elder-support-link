import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useGroupMembers(groupId: string) {
  return useQuery({
    queryKey: ['group-members', groupId],
    queryFn: async () => {
      console.log('useGroupMembers: Fetching members for groupId:', groupId);
      if (!groupId) {
        console.log('useGroupMembers: No groupId provided');
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
        console.error('useGroupMembers: Error fetching members:', error);
        throw error;
      }

      console.log('useGroupMembers: Raw members data:', members);

      const processedMembers = members?.map((member: any) => ({
        id: member.user_id,
        email: member.profiles?.email || '',
        name: `${member.profiles?.first_name || ''} ${member.profiles?.last_name || ''}`.trim() || member.profiles?.email || 'Unknown'
      })) || [];
      
      console.log('useGroupMembers: Processed members:', processedMembers);
      return processedMembers;
    },
    enabled: !!groupId
  });
}