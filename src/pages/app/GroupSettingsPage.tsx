import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { LogOut, Users, Mail, Calendar, Trash2, RotateCcw, AlertTriangle, UserPlus } from "lucide-react";
import SEO from "@/components/layout/SEO";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { RecentlyDeletedTable } from "@/components/delete/RecentlyDeletedTable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

export default function GroupSettingsPage() {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // Invitation management state
  const [email, setEmail] = useState("");
  const [isLoadingInvite, setIsLoadingInvite] = useState(false);
  const [invitations, setInvitations] = useState<any[]>([]);
  const [groupMembers, setGroupMembers] = useState<any[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);

  // Check if user is admin and load invitation data
  useEffect(() => {
    if (groupId) {
      checkAdminStatus();
      fetchInvitations();
      fetchGroupMembers();
    }
  }, [groupId]);

  const checkAdminStatus = async () => {
    try {
      const { data: members, error } = await supabase
        .from('care_group_members')
        .select('is_admin')
        .eq('group_id', groupId)
        .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
        .single();
      
      if (error) throw error;
      setIsAdmin(members?.is_admin || false);
    } catch (error) {
      console.error('Error checking admin status:', error);
    }
  };

  const fetchInvitations = async () => {
    try {
      const { data, error } = await supabase
        .from('care_group_invitations')
        .select('*')
        .eq('group_id', groupId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setInvitations(data || []);
    } catch (error) {
      console.error('Error fetching invitations:', error);
    }
  };

  const fetchGroupMembers = async () => {
    try {
      // Use the RPC function to get group members with proper joins
      const { data: memberData, error } = await supabase
        .rpc('get_group_members', { p_group_id: groupId });
      
      if (error) throw error;
      
      if (!memberData || memberData.length === 0) {
        setGroupMembers([]);
        return;
      }

      const formattedData = memberData.map((member: any) => ({
        user_id: member.user_id,
        is_admin: member.is_admin,
        first_name: member.first_name || 'Unknown',
        last_name: member.last_name || 'User', 
        email: member.email || 'No email'
      }));
      
      setGroupMembers(formattedData);
    } catch (error) {
      console.error('Error fetching group members:', error);
      setGroupMembers([]);
    }
  };

// Notification preferences state
const [userId, setUserId] = useState<string | null>(null);
const [prefsId, setPrefsId] = useState<string | null>(null);
const [prefs, setPrefs] = useState({
  notify_on_new_task: false,
  notify_on_new_appointment: false,
  notify_on_new_document: false,
  notify_on_new_activity_log: false,
});

useEffect(() => {
  const load = async () => {
    const { data: authData } = await supabase.auth.getUser();
    const uid = authData.user?.id ?? null;
    setUserId(uid);
    if (!uid || !groupId) return;
    const { data: np } = await supabase
      .from("notification_preferences")
      .select("id, notify_on_new_task, notify_on_new_appointment, notify_on_new_document, notify_on_new_activity_log")
      .eq("user_id", uid)
      .eq("group_id", groupId)
      .maybeSingle();
    if (np) {
      setPrefsId(np.id as string);
      setPrefs({
        notify_on_new_task: !!(np as any).notify_on_new_task,
        notify_on_new_appointment: !!(np as any).notify_on_new_appointment,
        notify_on_new_document: !!(np as any).notify_on_new_document,
        notify_on_new_activity_log: !!(np as any).notify_on_new_activity_log,
      });
    } else {
      setPrefsId(null);
    }
  };
  load();
}, [groupId]);

const savePrefs = async () => {
  if (!groupId || !userId) return;
  if (prefsId) {
    const { error } = await supabase
      .from("notification_preferences")
      .update(prefs)
      .eq("id", prefsId);
    if (error) return toast({ title: "Save failed", description: error.message });
  } else {
    const { error, data } = await supabase
      .from("notification_preferences")
      .insert({ ...prefs, group_id: groupId, user_id: userId })
      .select()
      .maybeSingle();
    if (!error && data) setPrefsId((data as any).id);
    if (error) return toast({ title: "Save failed", description: error.message });
  }
  toast({ title: "Preferences saved", description: "Notification preferences updated." });
};

const sendInvitation = async () => {
  if (!email.trim()) {
    toast({
      title: "Email required",
      description: "Please enter an email address",
      variant: "destructive"
    });
    return;
  }

  const existingMember = groupMembers.find(member => 
    member.email?.toLowerCase() === email.toLowerCase()
  );
  
  if (existingMember) {
    toast({
      title: "User already has access",
      description: `The user (${email}) already has access to this care group.`,
      variant: "destructive"
    });
    return;
  }

  setIsLoadingInvite(true);
  try {
    const { error } = await supabase.functions.invoke('send-invitation', {
      body: { email, groupId }
    });

    if (error) throw error;

    toast({
      title: "Invitation sent!",
      description: `An invitation has been sent to ${email}`,
    });

    setEmail("");
    fetchInvitations();
  } catch (error: any) {
    console.error('Error sending invitation:', error);
    toast({
      title: "Error sending invitation",
      description: error.message || "Something went wrong",
      variant: "destructive"
    });
  } finally {
    setIsLoadingInvite(false);
  }
};

const resendInvitation = async (invitationId: string) => {
  try {
    const { error } = await supabase.functions.invoke('send-invitation', {
      body: { resendId: invitationId }
    });

    if (error) throw error;

    toast({
      title: "Invitation resent!",
      description: "The invitation has been resent successfully",
    });

    fetchInvitations();
  } catch (error: any) {
    console.error('Error resending invitation:', error);
    toast({
      title: "Error resending invitation",
      description: error.message || "Something went wrong",
      variant: "destructive"
    });
  }
};

const cancelInvitation = async (invitationId: string) => {
  try {
    const { error } = await supabase
      .from('care_group_invitations')
      .delete()
      .eq('id', invitationId);

    if (error) throw error;

    toast({
      title: "Invitation cancelled",
      description: "The invitation has been cancelled successfully",
    });

    fetchInvitations();
  } catch (error: any) {
    console.error('Error cancelling invitation:', error);
    toast({
      title: "Error cancelling invitation",
      description: error.message || "Something went wrong",
      variant: "destructive"
    });
  }
};

const toggleAdminStatus = async (userId: string, currentAdmin: boolean) => {
  try {
    const { error } = await supabase
      .from('care_group_members')
      .update({ is_admin: !currentAdmin })
      .eq('group_id', groupId)
      .eq('user_id', userId);

    if (error) throw error;

    toast({
      title: currentAdmin ? "Admin privileges removed" : "Admin privileges granted",
      description: `User is now ${!currentAdmin ? 'an admin' : 'a regular member'}`,
    });

    fetchGroupMembers();
  } catch (error: any) {
    console.error('Error updating admin status:', error);
    toast({
      title: "Error updating admin status",
      description: error.message || "Something went wrong",
      variant: "destructive"
    });
  }
};

const handleSignOut = async () => {
  try {
    await supabase.auth.signOut();
    
    // Clear any localStorage auth tokens
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('sb-') && key.includes('-auth-token')) {
        localStorage.removeItem(key);
      }
    });
    
    toast({ title: "Signed out", description: "You have been signed out successfully." });
    navigate("/login");
  } catch (error) {
    console.error("Sign out error:", error);
    toast({ 
      title: "Sign out failed", 
      description: "Please try again.",
      variant: "destructive" 
    });
  }
};

  return (
    <main>
      <SEO
        title="Group Settings - Edit care group"
        description="Update care group information like name, address, phone, description, and other important info."
        canonicalPath={typeof window !== "undefined" ? window.location.pathname : "/app/settings"}
      />

      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Group Settings</h1>
        <p className="text-muted-foreground">Edit details for this care group.</p>
      </header>

      <Tabs defaultValue="notifications" className="space-y-6">
        <TabsList className="grid grid-cols-3 lg:w-[400px]">
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          {isAdmin && <TabsTrigger value="invite">Invite Others</TabsTrigger>}
          <TabsTrigger value="deleted">Recently Deleted</TabsTrigger>
        </TabsList>

        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Notification preferences</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="flex items-center justify-between gap-4">
                  <span className="text-sm">Email me when a new task is added</span>
                  <Switch checked={prefs.notify_on_new_task} onCheckedChange={(v) => setPrefs((s) => ({ ...s, notify_on_new_task: !!v }))} />
                </label>
                <label className="flex items-center justify-between gap-4">
                  <span className="text-sm">Email me when a new appointment is added</span>
                  <Switch checked={prefs.notify_on_new_appointment} onCheckedChange={(v) => setPrefs((s) => ({ ...s, notify_on_new_appointment: !!v }))} />
                </label>
                <label className="flex items-center justify-between gap-4">
                  <span className="text-sm">Email me when a new document is added</span>
                  <Switch checked={prefs.notify_on_new_document} onCheckedChange={(v) => setPrefs((s) => ({ ...s, notify_on_new_document: !!v }))} />
                </label>
                <label className="flex items-center justify-between gap-4">
                  <span className="text-sm">Email me when a new activity log is added</span>
                  <Switch checked={prefs.notify_on_new_activity_log} onCheckedChange={(v) => setPrefs((s) => ({ ...s, notify_on_new_activity_log: !!v }))} />
                </label>
              </div>
              <div className="pt-2">
                <Button onClick={savePrefs}>Save preferences</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {isAdmin && (
          <TabsContent value="invite" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5" />
                  Invite Others and Manage Care Group Members
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium mb-4">Send New Invitation</h3>
                  <div className="flex gap-4">
                    <Input
                      type="email"
                      placeholder="Enter email address"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && sendInvitation()}
                      className="flex-1"
                    />
                    <Button 
                      onClick={sendInvitation} 
                      disabled={isLoadingInvite}
                      className="min-w-[120px]"
                    >
                      {isLoadingInvite ? "Sending..." : "Send Invite"}
                    </Button>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-medium mb-4">Current Members</h3>
                  <div className="space-y-4">
                    {groupMembers.map((member) => (
                      <div key={member.user_id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div>
                          <div className="font-medium">
                            {member.first_name} {member.last_name}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {member.email}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {member.is_admin && (
                            <Badge variant="secondary">Admin</Badge>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => toggleAdminStatus(member.user_id, member.is_admin)}
                          >
                            {member.is_admin ? "Remove Admin" : "Make Admin"}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-medium mb-4">Pending Invitations</h3>
                  {invitations.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">
                      No invitations have been sent yet.
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {invitations.map((invitation) => (
                        <div key={invitation.id} className="flex items-center justify-between p-4 border rounded-lg">
                          <div>
                            <div className="font-medium">{invitation.invited_email}</div>
                            <div className="text-sm text-muted-foreground">
                              Invited on {new Date(invitation.created_at).toLocaleDateString()}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              Expires on {new Date(invitation.expires_at).toLocaleDateString()}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge 
                              variant={
                                invitation.status === 'accepted' ? 'default' :
                                invitation.status === 'expired' ? 'destructive' : 'secondary'
                              }
                            >
                              {invitation.status}
                            </Badge>
                            {invitation.status === 'pending' && (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => resendInvitation(invitation.id)}
                                >
                                  <RotateCcw className="h-4 w-4 mr-1" />
                                  Resend
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => cancelInvitation(invitation.id)}
                                >
                                  <Trash2 className="h-4 w-4 mr-1" />
                                  Cancel
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        <TabsContent value="deleted" className="space-y-6">
          <RecentlyDeletedTable groupId={groupId || ""} />
        </TabsContent>
      </Tabs>

      <section className="mt-8">
        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">
              Sign out of your account
            </p>
            <Button 
              variant="outline" 
              onClick={handleSignOut}
              className="gap-2"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </Button>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}