import { useState, useEffect } from "react";
import { UnifiedTableView, TableColumn } from "@/components/shared/UnifiedTableView";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Trash2, CheckCircle, RefreshCw, Shield, UserPlus } from "lucide-react";
import { format } from "date-fns";

interface AuthUser {
  id: string;
  email?: string;
  created_at: string;
  email_confirmed_at?: string;
  last_sign_in_at?: string;
  profile?: {
    first_name?: string;
    last_name?: string;
    address?: string;
    state?: string;
    zip?: string;
    phone?: string;
    last_active_group_id?: string;
  };
  is_platform_admin?: boolean;
}

export default function SystemUserManagement() {
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [userTypeFilter, setUserTypeFilter] = useState<string>("all");
  const [promoting, setPromoting] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const { data: session } = await supabase.auth.getSession();
      
      if (!session.session) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(`https://yfwgegapmggwywrnzqvg.supabase.co/functions/v1/admin-user-management`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'list' }),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }

      const result = await response.json();
      console.log('Users from edge function with admin status:', result);
      
      // Edge function now returns users with is_platform_admin already set
      const validUsers = (result.users || []).filter(user => user && user.id);
      console.log('Valid users:', validUsers);
      
      setUsers(validUsers);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to fetch users",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const performAdminAction = async (action: string, userId: string, userData?: any) => {
    try {
      setActionLoading(userId);
      const { data: session } = await supabase.auth.getSession();
      
      if (!session.session) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(`https://yfwgegapmggwywrnzqvg.supabase.co/functions/v1/admin-user-management`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action, userId, userData }),
      });

      if (!response.ok) {
        throw new Error(`Failed to ${action} user`);
      }

      const actionMessages = {
        delete: 'User deleted successfully',
        verify: 'User verified successfully',
        reset_password: 'Password reset link generated',
      };

      toast({
        title: "Success",
        description: actionMessages[action as keyof typeof actionMessages] || 'Action completed',
      });

      fetchUsers(); // Refresh the list
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : `Failed to ${action} user`,
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handlePromoteUser = async (user: AuthUser) => {
    const userEmail = user.email;
    if (!userEmail) {
      toast({
        title: "Error",
        description: "User email not found.",
        variant: "destructive",
      });
      return;
    }

    setPromoting(user.id);
    try {
      const { data, error } = await supabase.functions.invoke('send-role-promotion', {
        body: {
          targetEmail: userEmail,
          promotionType: 'system_admin'
        }
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: `System admin promotion confirmation sent to ${userEmail}`,
      });

    } catch (error) {
      toast({
        title: "Error", 
        description: error instanceof Error ? error.message : "Failed to send promotion confirmation",
        variant: "destructive",
      });
    } finally {
      setPromoting(null);
    }
  };

  const handleBulkDelete = async (selectedIds: string[]) => {
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error('Not authenticated');

      await Promise.all(
        selectedIds.map(id => 
          fetch(`https://yfwgegapmggwywrnzqvg.supabase.co/functions/v1/admin-user-management`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${session.session.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ action: 'delete', userId: id }),
          })
        )
      );

      toast({
        title: "Success",
        description: `${selectedIds.length} users deleted successfully`,
      });
      
      fetchUsers();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete selected users",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const filteredUsers = users.filter(user => {
    if (userTypeFilter === "all") return true;
    if (userTypeFilter === "admin") return user.is_platform_admin;
    if (userTypeFilter === "regular") return !user.is_platform_admin;
    if (userTypeFilter === "verified") return user.email_confirmed_at;
    if (userTypeFilter === "unverified") return !user.email_confirmed_at;
    return true;
  });

  const columns: TableColumn[] = [
    {
      key: 'name',
      label: 'Name',
      sortable: true,
       render: (value: any, user: AuthUser) => {
         if (!user) {
           return <div>Invalid user data</div>;
         }
         
         const firstName = user.profile?.first_name || '';
         const lastName = user.profile?.last_name || '';
         const fullName = `${firstName} ${lastName}`.trim();
         
         const displayName = fullName || user.email || 'No Name';
         
         return (
           <div className="font-medium">{displayName}</div>
         );
       }
    },
    {
      key: 'email',
      label: 'Email', 
      sortable: true,
      filterable: true,
      render: (value: any, user: AuthUser) => {
        if (!user) return 'No email';
        return user.email || 'No email';
      }
    },
    {
      key: 'status',
      label: 'Status',
      render: (value: any, user: AuthUser) => {
        if (!user) {
          return <div>Invalid user data</div>;
        }
        return (
          <Badge variant={user.email_confirmed_at ? "default" : "secondary"}>
            {user.email_confirmed_at ? "Verified" : "Unverified"}
          </Badge>
        );
      }
    },
    {
      key: 'role',
      label: 'Role',
      render: (value: any, user: AuthUser) => {
        if (!user) return 'Unknown';
        return user.is_platform_admin ? 'Admin' : 'User';
      }
    },
    {
      key: 'created_at',
      label: 'Created',
      sortable: true,
      render: (value: any, user: AuthUser) => {
        if (!user || !user.created_at) return 'Unknown';
        return format(new Date(user.created_at), 'MMM dd, yyyy');
      }
    },
    {
      key: 'last_sign_in_at',
      label: 'Last Sign In',
      sortable: true,
      render: (value: any, user: AuthUser) => {
        if (!user) return 'Never';
        return user.last_sign_in_at 
          ? format(new Date(user.last_sign_in_at), 'MMM dd, yyyy')
          : 'Never';
      }
    }
  ];

  const customRowActions = (user: AuthUser) => {
    if (!user) {
      return <div>No actions available</div>;
    }
    
    return (
      <div className="flex gap-2 flex-wrap">
        {!user.email_confirmed_at && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => performAdminAction('verify', user.id)}
            disabled={actionLoading === user.id}
          >
            <CheckCircle className="h-4 w-4 mr-1" />
            Verify
          </Button>
        )}
        
        <Button
          variant="outline"
          size="sm"
          onClick={() => performAdminAction('reset_password', user.id)}
          disabled={actionLoading === user.id}
        >
          <RefreshCw className="h-4 w-4 mr-1" />
          Reset Password
        </Button>

        {!user.is_platform_admin && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                disabled={promoting === user.id}
              >
                <UserPlus className="h-4 w-4 mr-1" />
                Promote to Admin
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Promote to System Administrator</AlertDialogTitle>
                <AlertDialogDescription>
                  Send a promotion confirmation email to {user.email}? 
                  They will need to confirm this promotion before gaining admin privileges.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => handlePromoteUser(user)}>
                  Send Confirmation
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
    );
  };

  const headerActions = (
    <div className="flex gap-4 items-center">
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Filter by:</span>
        <Select value={userTypeFilter} onValueChange={setUserTypeFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All users" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Users</SelectItem>
            <SelectItem value="admin">System Admins</SelectItem>
            <SelectItem value="regular">Regular Users</SelectItem>
            <SelectItem value="verified">Verified</SelectItem>
            <SelectItem value="unverified">Unverified</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      <Button onClick={fetchUsers} variant="outline" size="sm">
        <RefreshCw className="h-4 w-4 mr-2" />
        Refresh
      </Button>
    </div>
  );

  return (
    <div className="space-y-6">
      {headerActions}
      <UnifiedTableView
        title="System Users"
        data={filteredUsers}
        columns={columns}
        loading={loading}
        searchable={true}
        searchPlaceholder="Search users by name, email, or ID..."
        onBulkDelete={handleBulkDelete}
        onDelete={(id: string) => performAdminAction('delete', id)}
        customActions={customRowActions}
        entityType="contact"
        defaultSortBy="created_at"
        defaultSortOrder="desc"
      />
    </div>
  );
}