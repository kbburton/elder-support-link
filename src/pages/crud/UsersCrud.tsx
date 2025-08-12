import SEO from "@/components/layout/SEO";
import UserManagement from "@/components/admin/UserManagement";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Shield } from "lucide-react";

export default function UsersCrud() {
  const [isSystemAdmin, setIsSystemAdmin] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAdminStatus = async () => {
      try {
        const { data, error } = await supabase.rpc('is_system_admin');
        if (error) throw error;
        setIsSystemAdmin(data);
      } catch (error) {
        console.error('Error checking admin status:', error);
        setIsSystemAdmin(false);
      } finally {
        setLoading(false);
      }
    };

    checkAdminStatus();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <SEO title="User Management — DaveAssist" description="Manage registered users" />
        <div className="flex items-center justify-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  if (!isSystemAdmin) {
    return (
      <div className="space-y-6">
        <SEO title="User Management — DaveAssist" description="Manage registered users" />
        <Alert>
          <Shield className="h-4 w-4" />
          <AlertDescription>
            You do not have system administrator privileges. Contact a system administrator to access user management.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SEO title="User Management — DaveAssist" description="Manage registered users" />
      <UserManagement />
    </div>
  );
}
