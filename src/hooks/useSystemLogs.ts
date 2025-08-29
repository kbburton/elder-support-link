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
      const { data, error } = await supabase
        .from("system_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      return data as SystemLog[];
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });
};