import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Users, Mail, Calendar, Trash2, RotateCcw, AlertTriangle } from "lucide-react";

export default function GroupInvitePage() {
  const { groupId } = useParams();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [invitations, setInvitations] = useState<any[]>([]);
  const [groupMembers, setGroupMembers] = useState<any[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isCheckingMigration, setIsCheckingMigration] = useState(true);
  const [migrationApplied, setMigrationApplied] = useState(false);

  useEffect(() => {
    if (groupId) {
      checkMigrationStatus();
    }
  }, [groupId]);

  const checkMigrationStatus = async () => {
    try {
      // Test if the new tables and functions exist
      const { error: invitationError } = await supabase
        .from('care_group_invitations' as any)
        .select('id')
        .limit(1);

      const { error: adminCheckError } = await supabase.rpc('is_user_admin_of_group' as any, {
        group_uuid: groupId
      });

      if (!invitationError && !adminCheckError) {
        setMigrationApplied(true);
        checkAdminStatus();
        fetchInvitations();
        fetchGroupMembers();
      }
    } catch (error) {
      console.error('Migration check failed:', error);
    } finally {
      setIsCheckingMigration(false);
    }
  };

  const checkAdminStatus = async () => {
    try {
      const { data, error } = await supabase.rpc('is_user_admin_of_group' as any, {
        group_uuid: groupId
      });
      
      if (error) throw error;
      setIsAdmin(data);
    } catch (error) {
      console.error('Error checking admin status:', error);
    }
  };

  const fetchInvitations = async () => {
    try {
      const { data, error } = await supabase
        .from('care_group_invitations' as any)
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
      const { data, error } = await supabase
        .from('care_group_members')
        .select(`
          user_id,
          is_admin,
          profiles (
            email,
            first_name,
            last_name
          )
        `)
        .eq('group_id', groupId);

      if (error) throw error;
      setGroupMembers(data || []);
    } catch (error) {
      console.error('Error fetching group members:', error);
    }
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

    // Check if email is already a member
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

    setIsLoading(true);
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
      setIsLoading(false);
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
        .from('care_group_invitations' as any)
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
        .update({ is_admin: !currentAdmin } as any)
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

  if (isCheckingMigration) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardContent className="p-8 text-center">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-muted-foreground">Checking system status...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!migrationApplied) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Migration Required
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              The invitation system requires database migration to be completed. The required tables and functions are not yet available.
            </p>
            <p className="text-sm text-muted-foreground">
              Please ensure the database migration has been applied, then refresh this page.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardContent className="p-8 text-center">
            <h1 className="text-2xl font-bold mb-4">Access Denied</h1>
            <p className="text-muted-foreground">
              You need admin privileges to manage invitations for this care group.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">Invite Others to Care Group</h1>
        <p className="text-muted-foreground">
          Send invitations to new members and manage existing invitations.
        </p>
      </div>

      {/* Send New Invitation */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Send New Invitation
          </CardTitle>
          <CardDescription>
            Invite someone new to join this care group by email.
          </CardDescription>
        </CardHeader>
        <CardContent>
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
              disabled={isLoading}
              className="min-w-[120px]"
            >
              {isLoading ? "Sending..." : "Send Invite"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Current Group Members */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Current Members
          </CardTitle>
          <CardDescription>
            Manage admin privileges for existing group members.
          </CardDescription>
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>

      {/* Pending Invitations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Pending Invitations
          </CardTitle>
          <CardDescription>
            Manage sent invitations and track their status.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {invitations.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No invitations have been sent yet.
            </p>
          ) : (
            <div className="space-y-4">
              {invitations.map((invitation) => (
                <div key={invitation.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <div className="font-medium">{invitation.email}</div>
                    <div className="text-sm text-muted-foreground">
                      Invited by {invitation.invited_by_email} on {new Date(invitation.created_at).toLocaleDateString()}
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
        </CardContent>
      </Card>
    </div>
  );
}