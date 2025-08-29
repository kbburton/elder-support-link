import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SystemLog {
  id: string;
  level: string;
  message: string;
  component: string;
  operation: string;
  metadata: Record<string, any>;
  created_at: string;
}

export const useSystemLogs = () => {
  return useQuery({
    queryKey: ["system_logs"],
    queryFn: async () => {
      try {
        // Use RPC function to get system logs
        const { data, error } = await supabase.rpc('get_system_logs') as any;
        if (error) throw error;
        return (data || []) as SystemLog[];
      } catch (error) {
        console.error('Error fetching system logs:', error);
        return [] as SystemLog[];
      }
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });
};