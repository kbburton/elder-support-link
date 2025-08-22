import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { LogOut, Users, Mail, Calendar, Trash2, RotateCcw, AlertTriangle, UserPlus } from "lucide-react";
import SEO from "@/components/layout/SEO";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { RecentlyDeletedTable } from "@/components/delete/RecentlyDeletedTable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

const GroupSchema = z.object({
  name: z.string().min(1, "Name is required"),
  recipient_address: z.string().optional(),
  recipient_city: z.string().optional(),
  recipient_state: z.string().optional(),
  recipient_zip: z.string().optional(),
  recipient_phone: z.string().optional(),
  recipient_email: z.string().email("Invalid email address").optional().or(z.literal("")),
  date_of_birth: z.string().optional(),
  profile_description: z.string().optional(),
  other_important_information: z.string().optional(),
});

type GroupFormValues = z.infer<typeof GroupSchema>;

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

  const form = useForm<GroupFormValues>({
    resolver: zodResolver(GroupSchema),
    defaultValues: {
      name: "",
      recipient_address: "",
      recipient_city: "",
      recipient_state: "",
      recipient_zip: "",
      recipient_phone: "",
      recipient_email: "",
      date_of_birth: "",
      profile_description: "",
      other_important_information: "",
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ["care_group", groupId],
    enabled: !!groupId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("care_groups")
        .select(
          "name, recipient_address, recipient_city, recipient_state, recipient_zip, recipient_phone, recipient_email, date_of_birth, profile_description, other_important_information"
        )
        .eq("id", groupId)
        .single();
      if (error) throw error;
      return data as GroupFormValues;
    },
  });

  useEffect(() => {
    if (data) {
      form.reset({
        name: data.name ?? "",
        recipient_address: data.recipient_address ?? "",
        recipient_city: data.recipient_city ?? "",
        recipient_state: data.recipient_state ?? "",
        recipient_zip: data.recipient_zip ?? "",
        recipient_phone: data.recipient_phone ?? "",
        recipient_email: (data as any).recipient_email ?? "",
        date_of_birth: data.date_of_birth ?? "",
        profile_description: data.profile_description ?? "",
        other_important_information: (data as any).other_important_information ?? "",
      });
    }
  }, [data, form]);

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
      const { data: members, error: membersError } = await supabase
        .from('care_group_members')
        .select('user_id, is_admin')
        .eq('group_id', groupId);

      if (membersError) throw membersError;

      if (!members || members.length === 0) {
        setGroupMembers([]);
        return;
      }

      const userIds = members.map(m => m.user_id);
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name')
        .in('user_id', userIds);

      if (profilesError) throw profilesError;

      const memberData = members.map(member => {
        const profile = profiles?.find(p => p.user_id === member.user_id);
        return {
          user_id: member.user_id,
          is_admin: member.is_admin,
          profiles: profile
        };
      });

      setGroupMembers(memberData || []);
    } catch (error) {
      console.error('Error fetching group members:', error);
    }
  };

  const saveMutation = useMutation({
    mutationFn: async (values: GroupFormValues) => {
      if (!groupId) throw new Error("Missing group id");
      const { error } = await supabase
        .from("care_groups")
        .update(values)
        .eq("id", groupId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Saved", description: "Care group updated successfully." });
    },
    onError: (err: any) => {
      toast({ title: "Update failed", description: err.message ?? "Please try again.", variant: "destructive" });
    },
  });

const deleteMutation = useMutation({
  mutationFn: async () => {
    if (!groupId || groupId === "demo") throw new Error("Cannot delete this group.");
    const { error } = await supabase.from("care_groups").delete().eq("id", groupId);
    if (error) throw error;
  },
  onSuccess: () => {
    toast({ title: "Group deleted", description: "This care group has been removed." });
    navigate("/app/demo/calendar");
  },
  onError: (err: any) => {
    toast({ title: "Delete failed", description: err.message ?? "Please try again.", variant: "destructive" });
  },
});

const onSubmit = (values: GroupFormValues) => saveMutation.mutate(values);

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
    member.profiles?.email?.toLowerCase() === email.toLowerCase()
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

      <Tabs defaultValue="details" className="space-y-6">
        <TabsList className="grid grid-cols-4 lg:w-[400px]">
          <TabsTrigger value="details">Group Details</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          {isAdmin && <TabsTrigger value="invite">Invite Others</TabsTrigger>}
          <TabsTrigger value="deleted">Recently Deleted</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Care group details</CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Care recipient name</FormLabel>
                        <FormControl>
                          <Input placeholder="Name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="recipient_phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone</FormLabel>
                          <FormControl>
                            <Input placeholder="(555) 555-5555" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="recipient_email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input type="email" placeholder="example@email.com" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="date_of_birth"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Date of birth</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="profile_description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Profile description</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Brief description" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="other_important_information"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Other important information</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Anything else we should know" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="recipient_address"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Address</FormLabel>
                          <FormControl>
                            <Input placeholder="Street address" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="recipient_city"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>City</FormLabel>
                          <FormControl>
                            <Input placeholder="City" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="recipient_state"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>State</FormLabel>
                          <FormControl>
                            <Input placeholder="State" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="recipient_zip"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>ZIP</FormLabel>
                          <FormControl>
                            <Input placeholder="ZIP code" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <CardFooter className="px-0">
                    <Button type="submit" disabled={isLoading || saveMutation.isPending}>
                      {saveMutation.isPending ? "Saving..." : "Save changes"}
                    </Button>
                  </CardFooter>
                </form>
              </Form>
            </CardContent>
          </Card>

          {isAdmin && (
            <Card className="border-destructive/30">
              <CardHeader>
                <CardTitle>Danger zone</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">
                  Deleting a care group is permanent and cannot be undone.
                </p>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" disabled={groupId === "demo" || deleteMutation.isPending}>
                      {deleteMutation.isPending ? "Deleting..." : "Delete this group"}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete this care group?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete the group. Appointments, tasks, and documents that reference this group will no longer be accessible from this group.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => deleteMutation.mutate()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                        Confirm delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </CardContent>
            </Card>
          )}
        </TabsContent>

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
                            {member.profiles?.first_name} {member.profiles?.last_name}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {member.profiles?.email}
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