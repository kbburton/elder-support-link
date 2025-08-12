import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Trash2, CheckCircle, RefreshCw, Shield } from "lucide-react";
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
    email?: string;
  };
}

export default function UserManagement() {
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
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
      setUsers(result.users || []);
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

  useEffect(() => {
    fetchUsers();
  }, []);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>User Management</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center p-8">
            <RefreshCw className="h-8 w-8 animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          User Management
        </CardTitle>
        <Button onClick={fetchUsers} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Last Sign In</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell>
                  <div>
                    <div className="font-medium">
                      {user.profile?.first_name && user.profile?.last_name
                        ? `${user.profile.first_name} ${user.profile.last_name}`
                        : 'No name'}
                    </div>
                    <div className="text-sm text-muted-foreground">ID: {user.id.slice(0, 8)}...</div>
                  </div>
                </TableCell>
                <TableCell>{user.email || user.profile?.email || 'No email'}</TableCell>
                <TableCell>
                  {user.email_confirmed_at ? (
                    <Badge variant="default">Verified</Badge>
                  ) : (
                    <Badge variant="secondary">Unverified</Badge>
                  )}
                </TableCell>
                <TableCell>
                  {format(new Date(user.created_at), 'MMM dd, yyyy')}
                </TableCell>
                <TableCell>
                  {user.last_sign_in_at
                    ? format(new Date(user.last_sign_in_at), 'MMM dd, yyyy')
                    : 'Never'}
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
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

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="destructive"
                          size="sm"
                          disabled={actionLoading === user.id}
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Delete
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete User</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete this user? This action cannot be undone.
                            User: {user.email || 'No email'}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => performAdminAction('delete', user.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete User
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}