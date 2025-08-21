import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, UserPlus, Shield, Trash2 } from "lucide-react";
import { usePlatformAdmin } from "@/hooks/usePlatformAdmin";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

interface SystemAdmin {
  user_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  created_at: string;
}

interface PendingPromotion {
  id: string;
  target_email: string;
  promotion_type: string;
  created_at: string;
  expires_at: string;
  status: string;
}

const SystemAdminPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isPlatformAdmin, isLoading: adminLoading } = usePlatformAdmin();
  
  const [loading, setLoading] = useState(true);
  const [promoting, setPromoting] = useState(false);
  const [systemAdmins, setSystemAdmins] = useState<SystemAdmin[]>([]);
  const [pendingPromotions, setPendingPromotions] = useState<PendingPromotion[]>([]);
  const [newAdminEmail, setNewAdminEmail] = useState("");

  useEffect(() => {
    if (!adminLoading) {
      if (!isPlatformAdmin) {
        toast({
          title: "Access Denied",
          description: "You must be a system administrator to access this page.",
          variant: "destructive",
        });
        navigate("/app");
        return;
      }
      loadData();
    }
  }, [adminLoading, isPlatformAdmin]);

  const loadData = async () => {
    try {
      // Load system admins - need to do manual join since relation isn't set up
      const { data: platformAdmins, error: platformError } = await supabase
        .from('platform_admins')
        .select('user_id');

      if (platformError) throw platformError;

      if (platformAdmins?.length > 0) {
        const userIds = platformAdmins.map(admin => admin.user_id);
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('user_id, email, first_name, last_name')
          .in('user_id', userIds);

        if (profilesError) throw profilesError;

        const formattedAdmins = profiles.map(profile => ({
          user_id: profile.user_id,
          email: profile.email,
          first_name: profile.first_name,
          last_name: profile.last_name,
          created_at: new Date().toISOString() // Use current date since we don't track this
        }));
        setSystemAdmins(formattedAdmins);
      } else {
        setSystemAdmins([]);
      }

      // Load pending promotions
      const { data: promotions, error: promotionsError } = await supabase
        .from('role_promotion_confirmations')
        .select('id, target_email, promotion_type, created_at, expires_at, confirmed_at')
        .eq('promotion_type', 'system_admin')
        .is('confirmed_at', null)
        .order('created_at', { ascending: false });

      if (promotionsError) throw promotionsError;
      
      const formattedPromotions = (promotions || []).map(p => ({
        ...p,
        status: new Date(p.expires_at) < new Date() ? 'expired' : 'pending'
      }));
      setPendingPromotions(formattedPromotions);

    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: "Error",
        description: "Failed to load system admin data.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePromoteUser = async () => {
    if (!newAdminEmail.trim()) {
      toast({
        title: "Error",
        description: "Please enter an email address.",
        variant: "destructive",
      });
      return;
    }

    setPromoting(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-role-promotion', {
        body: {
          targetEmail: newAdminEmail.trim(),
          promotionType: 'system_admin'
        }
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: `Role promotion confirmation sent to ${newAdminEmail}`,
      });
      
      setNewAdminEmail("");
      loadData(); // Reload to show pending promotion
    } catch (error) {
      console.error('Error promoting user:', error);
      toast({
        title: "Error",
        description: "Failed to send role promotion confirmation.",
        variant: "destructive",
      });
    } finally {
      setPromoting(false);
    }
  };

  const handleRemoveAdmin = async (adminUserId: string, adminEmail: string) => {
    try {
      const { error } = await supabase
        .from('platform_admins')
        .delete()
        .eq('user_id', adminUserId);

      if (error) throw error;

      // Log admin action
      await supabase.rpc('log_admin_action', {
        p_action: 'system_admin_removed',
        p_target_type: 'user',
        p_target_id: adminUserId,
        p_details: { target_email: adminEmail }
      });

      toast({
        title: "Success",
        description: "System admin removed successfully.",
      });
      
      loadData();
    } catch (error) {
      console.error('Error removing admin:', error);
      toast({
        title: "Error",
        description: "Failed to remove system admin.",
        variant: "destructive",
      });
    }
  };

  if (adminLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div className="flex items-center gap-2">
        <Shield className="h-6 w-6" />
        <h1 className="text-3xl font-bold">System Administration</h1>
      </div>

      {/* Add System Admin */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Promote System Administrator
          </CardTitle>
          <CardDescription>
            Send a role promotion confirmation to a user to make them a system administrator.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1">
              <Label htmlFor="adminEmail">User Email</Label>
              <Input
                id="adminEmail"
                type="email"
                placeholder="user@example.com"
                value={newAdminEmail}
                onChange={(e) => setNewAdminEmail(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <Button onClick={handlePromoteUser} disabled={promoting}>
                {promoting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Send Confirmation
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Current System Admins */}
      <Card>
        <CardHeader>
          <CardTitle>Current System Administrators</CardTitle>
          <CardDescription>
            Users with full system administration privileges.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Added</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {systemAdmins.map((admin) => (
                <TableRow key={admin.user_id}>
                  <TableCell>
                    {admin.first_name || admin.last_name 
                      ? `${admin.first_name || ''} ${admin.last_name || ''}`.trim()
                      : 'N/A'
                    }
                  </TableCell>
                  <TableCell>{admin.email}</TableCell>
                  <TableCell>
                    {new Date(admin.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remove System Admin</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to remove {admin.email} as a system administrator? 
                            This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleRemoveAdmin(admin.user_id, admin.email)}
                          >
                            Remove Admin
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pending Promotions */}
      {pendingPromotions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Pending Promotions</CardTitle>
            <CardDescription>
              Role promotion confirmations awaiting user confirmation.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Sent</TableHead>
                  <TableHead>Expires</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingPromotions.map((promotion) => (
                  <TableRow key={promotion.id}>
                    <TableCell>{promotion.target_email}</TableCell>
                    <TableCell>
                      <Badge variant={promotion.status === 'failed' ? 'destructive' : 'secondary'}>
                        {promotion.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(promotion.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      {new Date(promotion.expires_at).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default SystemAdminPage;