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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Loader2, UserPlus, Shield, Trash2, Users, History, BarChart3, UserCheck, Search, Database } from "lucide-react";
import { format } from "date-fns";
import { usePlatformAdmin } from "@/hooks/usePlatformAdmin";
import SystemUserManagement from "@/components/admin/SystemUserManagement";

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

interface User {
  user_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  last_sign_in_at: string | null;
  created_at: string;
  is_system_admin: boolean;
}

interface RoleHistory {
  id: string;
  user_id: string;
  role_type: string;
  granted_at: string | null;
  revoked_at: string | null;
  granted_by_user_id: string | null;
  revoked_by_user_id: string | null;
  user_email: string;
  user_name: string;
  granted_by_name: string | null;
  revoked_by_name: string | null;
}

interface AnalyticsData {
  id: string;
  page_path: string;
  session_id: string;
  login_time: string | null;
  time_spent_seconds: number | null;
  referrer_page: string | null;
  bounce: boolean;
  created_at: string;
  user_email: string | null;
}

interface DemoSession {
  id: string;
  email: string;
  session_count: number;
  created_at: string;
  last_accessed: string;
}

interface DemoAnalytics {
  id: string;
  session_id: string;
  page_path: string;
  entered_at: string;
  left_at?: string;  
  time_spent_seconds?: number;
}

const SystemAdminPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { canAccessAdmin, isLoading: adminLoading } = usePlatformAdmin();
  
  const [loading, setLoading] = useState(true);
  const [promoting, setPromoting] = useState(false);
  const [systemAdmins, setSystemAdmins] = useState<SystemAdmin[]>([]);
  const [pendingPromotions, setPendingPromotions] = useState<PendingPromotion[]>([]);
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [roleHistory, setRoleHistory] = useState<RoleHistory[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsData[]>([]);
  const [demoSessions, setDemoSessions] = useState<DemoSession[]>([]);
  const [demoAnalytics, setDemoAnalytics] = useState<DemoAnalytics[]>([]);
  const [showSystemAdminsOnly, setShowSystemAdminsOnly] = useState(false);
  const [rebuildingIndex, setRebuildingIndex] = useState(false);

  useEffect(() => {
    if (!adminLoading) {
      if (!canAccessAdmin) {
        toast({
          title: "Access Denied",
          description: "You must be a verified system administrator to access this page.",
          variant: "destructive",
        });
        navigate("/app");
        return;
      }
      loadData();
    }
  }, [adminLoading, canAccessAdmin]);

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
          .select('user_id, first_name, last_name')
          .in('user_id', userIds);

        if (profilesError) throw profilesError;

        const formattedAdmins = profiles.map(profile => ({
          user_id: profile.user_id,
          email: 'Unknown', // Email should come from auth.users, not profiles
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

      // Load all users with their roles
      await loadUsers();
      
      // Load role history
      await loadRoleHistory();
      
      // Load analytics data
      await loadAnalytics();
      
      // Load demo analytics data
      await loadDemoAnalytics();

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

  const loadUsers = async () => {
    try {
      // Get all profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name, created_at');

      if (profilesError) throw profilesError;

      // Get system admins
      const { data: platformAdmins, error: adminError } = await supabase
        .from('platform_admins')
        .select('user_id');

      if (adminError) throw adminError;

      const adminUserIds = new Set(platformAdmins?.map(a => a.user_id) || []);

      const formattedUsers: User[] = (profiles || []).map(profile => ({
        user_id: profile.user_id,
        email: 'Unknown', // Email should come from auth.users, not profiles
        first_name: profile.first_name,
        last_name: profile.last_name,
        last_sign_in_at: null, // We'll need to get this from auth if needed
        created_at: profile.created_at,
        is_system_admin: adminUserIds.has(profile.user_id)
      }));

      setUsers(formattedUsers);
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  const loadRoleHistory = async () => {
    try {
      // First get the role history records
      const { data: history, error } = await supabase
        .from('role_history')
        .select('id, user_id, role_type, granted_at, revoked_at, granted_by_user_id, revoked_by_user_id')
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (!history || history.length === 0) {
        setRoleHistory([]);
        return;
      }

      // Get all unique user IDs we need to look up
      const userIds = new Set<string>();
      history.forEach(h => {
        userIds.add(h.user_id);
        if (h.granted_by_user_id) userIds.add(h.granted_by_user_id);
        if (h.revoked_by_user_id) userIds.add(h.revoked_by_user_id);
      });

      // Get profiles for all these users
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name')
        .in('user_id', Array.from(userIds));

      if (profilesError) throw profilesError;

      // Create a lookup map for profiles
      const profileMap = new Map();
      (profiles || []).forEach(profile => {
        profileMap.set(profile.user_id, profile);
      });

      // Format the history with profile data
      const formattedHistory: RoleHistory[] = history.map(h => {
        const userProfile = profileMap.get(h.user_id);
        const grantedByProfile = h.granted_by_user_id ? profileMap.get(h.granted_by_user_id) : null;
        const revokedByProfile = h.revoked_by_user_id ? profileMap.get(h.revoked_by_user_id) : null;

        return {
          id: h.id,
          user_id: h.user_id,
          role_type: h.role_type,
          granted_at: h.granted_at,
          revoked_at: h.revoked_at,
          granted_by_user_id: h.granted_by_user_id,
          revoked_by_user_id: h.revoked_by_user_id,
          user_email: userProfile ? (userProfile.first_name || userProfile.last_name ? `${userProfile.first_name || ''} ${userProfile.last_name || ''}`.trim() : 'Unknown') : 'Unknown',
          user_name: userProfile ? `${userProfile.first_name || ''} ${userProfile.last_name || ''}`.trim() || 'N/A' : 'N/A',
          granted_by_name: grantedByProfile ? `${grantedByProfile.first_name || ''} ${grantedByProfile.last_name || ''}`.trim() || 'N/A' : null,
          revoked_by_name: revokedByProfile ? `${revokedByProfile.first_name || ''} ${revokedByProfile.last_name || ''}`.trim() || 'N/A' : null
        };
      });

      setRoleHistory(formattedHistory);
    } catch (error) {
      console.error('Error loading role history:', error);
    }
  };

  const loadAnalytics = async () => {
    try {
      const { data: analyticsData, error } = await supabase
        .from('analytics_data')
        .select('id, page_path, session_id, login_time, time_spent_seconds, referrer_page, bounce, created_at, user_id')
        .in('page_path', ['/', '/auth/login'])
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      if (!analyticsData || analyticsData.length === 0) {
        setAnalytics([]);
        return;
      }

      // Get unique user IDs
      const userIds = [...new Set(analyticsData.map(a => a.user_id).filter(Boolean))];
      
      let profileMap = new Map();
      if (userIds.length > 0) {
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('user_id, first_name, last_name')
          .in('user_id', userIds);

        if (profilesError) throw profilesError;

        (profiles || []).forEach(profile => {
          profileMap.set(profile.user_id, profile);
        });
      }

      const formattedAnalytics: AnalyticsData[] = analyticsData.map(a => ({
        id: a.id,
        page_path: a.page_path,
        session_id: a.session_id,
        login_time: a.login_time,
        time_spent_seconds: a.time_spent_seconds,
        referrer_page: a.referrer_page,
        bounce: a.bounce,
        created_at: a.created_at,
        user_email: a.user_id ? (profileMap.get(a.user_id)?.first_name || profileMap.get(a.user_id)?.last_name ? `${profileMap.get(a.user_id)?.first_name || ''} ${profileMap.get(a.user_id)?.last_name || ''}`.trim() : 'Unknown') : null
      }));

      setAnalytics(formattedAnalytics);
    } catch (error) {
      console.error('Error loading analytics:', error);
    }
  };

  const loadDemoAnalytics = async () => {
    try {
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
        throw new Error('Failed to fetch demo analytics');
      }

      const result = await response.json();
      setDemoSessions(result.demoSessions || []);
      setDemoAnalytics(result.demoAnalytics || []);
    } catch (error) {
      console.error('Error loading demo analytics:', error);
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

  const handleRebuildSearchIndex = async () => {
    setRebuildingIndex(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-rebuild-search');
      
      if (error) {
        throw new Error(error.message);
      }

      toast({
        title: "Search Index Rebuilt",
        description: `Successfully rebuilt search index with ${data.total_entries} entries`,
      });
    } catch (error) {
      console.error('Error rebuilding search index:', error);
      toast({
        title: "Error",
        description: "Failed to rebuild search index. Please try again.",
        variant: "destructive"
      });
    } finally {
      setRebuildingIndex(false);
    }
  };

  if (adminLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const filteredUsers = showSystemAdminsOnly 
    ? users.filter(user => user.is_system_admin)
    : users;

  return (
    <div className="container mx-auto py-8">
      <div className="flex items-center gap-2 mb-8">
        <Shield className="h-6 w-6" />
        <h1 className="text-3xl font-bold">System Administration</h1>
      </div>

      <Tabs defaultValue="admin-management" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="admin-management" className="flex items-center gap-2">
            <UserPlus className="h-4 w-4" />
            Admin Management
          </TabsTrigger>
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Users
          </TabsTrigger>
          <TabsTrigger value="role-history" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            Role History
          </TabsTrigger>
          <TabsTrigger value="search-management" className="flex items-center gap-2">
            <Search className="h-4 w-4" />
            Search
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Analytics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="admin-management" className="space-y-6">
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
        </TabsContent>

        <TabsContent value="users" className="space-y-6">
          <SystemUserManagement />
        </TabsContent>

        <TabsContent value="role-history" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Role History
              </CardTitle>
              <CardDescription>
                Track changes to system administrator roles.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>By</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {roleHistory.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell>{entry.user_name}</TableCell>
                      <TableCell>{entry.user_email}</TableCell>
                      <TableCell>
                        <Badge variant={entry.revoked_at ? 'destructive' : 'default'}>
                          {entry.revoked_at ? 'Role Revoked' : 'Role Granted'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {new Date(entry.revoked_at || entry.granted_at || '').toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        {entry.revoked_at ? entry.revoked_by_name : entry.granted_by_name}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="search-management" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Search Index Management
              </CardTitle>
              <CardDescription>
                Rebuild the full-text search index for all entities across all groups to ensure the most recent content is searchable.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 border rounded-lg bg-muted/50">
                <h4 className="font-medium mb-2">What does this do?</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Rebuilds the search index for all tasks, appointments, contacts, and documents</li>
                  <li>• Ensures newly added or modified content appears in search results</li>
                  <li>• May take several minutes for large datasets</li>
                  <li>• Safe to run during normal operation</li>
                </ul>
              </div>
              <Button 
                onClick={handleRebuildSearchIndex}
                disabled={rebuildingIndex}
                className="w-full"
                size="lg"
              >
                <Database className="mr-2 h-4 w-4" />
                {rebuildingIndex ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Rebuilding Search Index...
                  </>
                ) : (
                  "Rebuild Search Index"
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <Tabs defaultValue="site-analytics" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="site-analytics">Site Analytics</TabsTrigger>
              <TabsTrigger value="demo-analytics">Demo Analytics</TabsTrigger>
            </TabsList>
            
            <TabsContent value="site-analytics" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Site Analytics Dashboard
                  </CardTitle>
                  <CardDescription>
                    View page usage analytics for the landing and login pages.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Page</TableHead>
                        <TableHead>User</TableHead>
                        <TableHead>Session ID</TableHead>
                        <TableHead>Time Spent</TableHead>
                        <TableHead>Referrer</TableHead>
                        <TableHead>Bounce</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {analytics.map((entry) => (
                        <TableRow key={entry.id}>
                          <TableCell>
                            <Badge variant={entry.page_path === '/' ? 'default' : 'secondary'}>
                              {entry.page_path === '/' ? 'Landing' : 'Login'}
                            </Badge>
                          </TableCell>
                          <TableCell>{entry.user_email || 'Anonymous'}</TableCell>
                          <TableCell className="font-mono text-sm">
                            {entry.session_id.slice(0, 8)}...
                          </TableCell>
                          <TableCell>
                            {entry.time_spent_seconds ? `${entry.time_spent_seconds}s` : 'N/A'}
                          </TableCell>
                          <TableCell>{entry.referrer_page || 'Direct'}</TableCell>
                          <TableCell>
                            <Badge variant={entry.bounce ? 'destructive' : 'secondary'}>
                              {entry.bounce ? 'Yes' : 'No'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {new Date(entry.created_at).toLocaleDateString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="demo-analytics" className="space-y-6">
              <div className="grid gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Demo Sessions</CardTitle>
                    <CardDescription>Track demo usage by email addresses.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Email</TableHead>
                          <TableHead>Sessions</TableHead>
                          <TableHead>First Visit</TableHead>
                          <TableHead>Last Access</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {demoSessions.map((session) => (
                          <TableRow key={session.id}>
                            <TableCell>{session.email}</TableCell>
                            <TableCell>{session.session_count}</TableCell>
                            <TableCell>{format(new Date(session.created_at), 'MMM dd, yyyy HH:mm')}</TableCell>
                            <TableCell>{format(new Date(session.last_accessed), 'MMM dd, yyyy HH:mm')}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader>
                    <CardTitle>Demo Page Analytics</CardTitle>
                    <CardDescription>Detailed page view analytics for demo sessions.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Session ID</TableHead>
                          <TableHead>Page Path</TableHead>
                          <TableHead>Entered At</TableHead>
                          <TableHead>Left At</TableHead>
                          <TableHead>Time Spent</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {demoAnalytics.map((analytics) => (
                          <TableRow key={analytics.id}>
                            <TableCell className="font-mono text-sm">
                              {analytics.session_id.slice(0, 8)}...
                            </TableCell>
                            <TableCell>{analytics.page_path}</TableCell>
                            <TableCell>{format(new Date(analytics.entered_at), 'MMM dd, yyyy HH:mm:ss')}</TableCell>
                            <TableCell>
                              {analytics.left_at ? format(new Date(analytics.left_at), 'MMM dd, yyyy HH:mm:ss') : 'Still active'}
                            </TableCell>
                            <TableCell>
                              {analytics.time_spent_seconds ? (
                                `${Math.floor(analytics.time_spent_seconds / 60)}m ${analytics.time_spent_seconds % 60}s`
                              ) : 'N/A'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SystemAdminPage;