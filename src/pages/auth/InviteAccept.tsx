import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { Loader2 } from "lucide-react";

const InviteAccept = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [invitation, setInvitation] = useState<any>(null);
  const [accepting, setAccepting] = useState(false);

  const token = searchParams.get("token");

  useEffect(() => {
    if (!token) {
      toast({
        title: "Invalid invitation",
        description: "No invitation token provided.",
        variant: "destructive",
      });
      navigate("/login");
      return;
    }

    fetchInvitation();
  }, [token]);

  // Auto-accept invitation after successful login/registration
  useEffect(() => {
    const autoAcceptInvitation = async () => {
      console.log("🔄 Auto-acceptance check started", { hasInvitation: !!invitation, token });
      
      if (!invitation) {
        console.log("❌ No invitation data yet, waiting...");
        return;
      }
      
      const { data: { session } } = await supabase.auth.getSession();
      console.log("👤 Current session:", session ? { userId: session.user.id, email: session.user.email } : "No session");
      
      if (!session) {
        console.log("❌ No session found, skipping auto-acceptance");
        return;
      }

      // Check if this is a return from login/registration by checking for pending invitation
      const pendingInvitation = localStorage.getItem("pendingInvitation");
      console.log("💾 Pending invitation from localStorage:", pendingInvitation);
      
      if (pendingInvitation === token) {
        console.log("✅ Found matching pending invitation, auto-accepting...");
        localStorage.removeItem("pendingInvitation");
        // Auto-accept the invitation
        acceptInvitation();
      } else {
        console.log("❓ No matching pending invitation found", { pendingInvitation, currentToken: token });
      }
    };

    // Add a small delay to ensure invitation data is loaded
    const timeoutId = setTimeout(autoAcceptInvitation, 500);
    return () => clearTimeout(timeoutId);
  }, [invitation, token]);

  const fetchInvitation = async () => {
    try {
      console.log("🔍 Fetching invitation with token:", token);
      
      // Use RPC function to get invitation by token
      const { data: invitation, error } = await supabase.rpc('get_invitation_by_token', {
        invitation_token: token
      });

      console.log("📧 Invitation RPC result:", { invitation, error });

      if (error) {
        console.error("❌ RPC Error:", error);
        toast({
          title: "Database Error",
          description: `Failed to fetch invitation: ${error.message}`,
          variant: "destructive",
        });
        navigate("/login");
        return;
      }

      if (!invitation || invitation.length === 0) {
        console.log("❌ No invitation found for token:", token);
        toast({
          title: "Invalid invitation",
          description: "This invitation is invalid or has expired.",
          variant: "destructive",
        });
        navigate("/login");
        return;
      }

      console.log("✅ Invitation found:", invitation[0]);
      setInvitation(invitation[0]);
    } catch (error) {
      console.error("❌ Error fetching invitation:", error);
      toast({
        title: "Error",
        description: "Failed to load invitation details.",
        variant: "destructive",
      });
      navigate("/login");
    } finally {
      setLoading(false);
    }
  };

  const acceptInvitation = async () => {
    console.log("🚀 Starting invitation acceptance process");
    console.log("📧 Invitation data:", invitation);
    
    if (!invitation) {
      console.log("❌ No invitation data available");
      return;
    }

    setAccepting(true);
    try {
      console.log("🔐 Checking user authentication...");
      // Check if user is authenticated
      const { data: { session } } = await supabase.auth.getSession();
      console.log("👤 Session data:", session ? { userId: session.user.id, email: session.user.email } : "No session");
      
      if (!session) {
        console.log("❌ User not authenticated, redirecting to login/register");
        // Get the invited email from the invitation data
        const invitedEmail = invitation.invited_email || "";
        
        // Check if user exists in profiles (has account)
        const { data: existingUser } = await supabase
          .from("profiles")
          .select("email")
          .eq("email", invitedEmail)
          .single();

        // Store invitation token for after login/registration
        localStorage.setItem("pendingInvitation", token!);
        
        if (existingUser) {
          // User exists, redirect to login with prefilled email
          toast({
            title: "Please log in",
            description: "You need to log in to accept this invitation.",
          });
          navigate(`/login?token=${token}&email=${encodeURIComponent(invitedEmail)}`, { replace: true });
        } else {
          // New user, redirect to registration with prefilled email
          toast({
            title: "Create your account",
            description: "Please create an account to accept this invitation.",
          });
          navigate(`/register?token=${token}&email=${encodeURIComponent(invitedEmail)}`, { replace: true });
        }
        return;
      }

      console.log("✅ User is authenticated, proceeding with invitation acceptance");
      
      // Check if user is already a member
      console.log("🔍 Checking if user is already a group member...");
      const { data: existingMember, error: memberCheckError } = await supabase
        .from("care_group_members")
        .select("id")
        .eq("user_id", session.user.id)
        .eq("group_id", invitation.group_id)
        .maybeSingle();

      console.log("👥 Existing member check result:", { existingMember, error: memberCheckError });

      if (existingMember) {
        console.log("✅ User is already a member, redirecting to group");
        // Update invitation status to accepted
        await supabase.rpc('accept_invitation', {
          invitation_id: invitation.id,
          user_id: session.user.id
        });
        toast({
          title: "Already a member",
          description: "You are already a member of this group.",
        });
        navigate(`/app/${invitation.group_id}`);
        return;
      }

      // Check if another user with the same email is already a member
      console.log("📧 Checking if email is already associated with a group member...");
      const { data: emailMembers, error: emailCheckError } = await supabase
        .from("care_group_members")
        .select(`
          id,
          user_id,
          profiles!inner(email)
        `)
        .eq("group_id", invitation.group_id)
        .eq("profiles.email", invitation.invited_email);

      console.log("📧 Email check result:", { emailMembers, error: emailCheckError });

      if (emailMembers && emailMembers.length > 0) {
        console.log("⚠️ Email already associated with a group member");
        // Update invitation status to accepted
        await supabase.rpc('accept_invitation', {
          invitation_id: invitation.id,
          user_id: session.user.id
        });
        toast({
          title: "Welcome back!",
          description: "Your email is already associated with this group.",
        });
        navigate(`/app/${invitation.group_id}`);
        return;
      }

      // Ensure user has a profile before adding to group
      console.log("👤 Checking if user profile exists...");
      const { data: existingProfile, error: profileCheckError } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("user_id", session.user.id)
        .maybeSingle();

      console.log("📝 Profile check result:", { existingProfile, error: profileCheckError });

      if (!existingProfile) {
        console.log("➕ Creating user profile...");
        // Create profile if it doesn't exist
        const { error: profileError } = await supabase
          .from("profiles")
          .insert({
            user_id: session.user.id,
            email: session.user.email,
            first_name: session.user.user_metadata?.first_name || "",
            last_name: session.user.user_metadata?.last_name || "",
          });

        console.log("📝 Profile creation result:", { error: profileError });

        if (profileError) {
          console.error("❌ Error creating profile:", profileError);
          toast({
            title: "Error",
            description: "Failed to create user profile. Please try again.",
            variant: "destructive",
          });
          return;
        }
        console.log("✅ Profile created successfully");
      } else {
        console.log("✅ Profile already exists");
      }

      // Add user to group
      console.log("➕ Adding user to group...");
      console.log("📊 Group membership data:", {
        user_id: session.user.id,
        group_id: invitation.group_id,
        is_admin: false
      });

      const { error: memberError } = await supabase
        .from("care_group_members")
        .insert({
          user_id: session.user.id,
          group_id: invitation.group_id,
          is_admin: false,
        });

      console.log("👥 Group membership insertion result:", { error: memberError });

      if (memberError) {
        console.error("❌ Error adding member:", memberError);
        console.error("❌ Full error details:", JSON.stringify(memberError, null, 2));
        console.log("🔍 Current user email:", session.user.email);
        console.log("🔍 Invitation email:", invitation.invited_email);
        console.log("🔍 User ID:", session.user.id);
        console.log("🔍 Group ID:", invitation.group_id);
        
        toast({
          title: "Error",
          description: `Failed to join the group: ${memberError.message}`,
          variant: "destructive",
        });
        return;
      }

      console.log("✅ Successfully added to group");

      // Update invitation status using RPC
      console.log("📝 Updating invitation status...");
      const { error: invitationUpdateError } = await supabase.rpc('accept_invitation', {
        invitation_id: invitation.id,
        user_id: session.user.id
      });

      console.log("📧 Invitation update result:", { error: invitationUpdateError });

      toast({
        title: "Welcome!",
        description: `You have successfully joined ${invitation.group_name}.`,
      });

      // Update user's last active group
      console.log("🔄 Updating user's last active group...");
      const { error: profileUpdateError } = await supabase
        .from('profiles')
        .update({ last_active_group_id: invitation.group_id })
        .eq('user_id', session.user.id);

      console.log("👤 Profile update result:", { error: profileUpdateError });

      console.log("🎉 Invitation acceptance completed successfully!");
      navigate(`/app/${invitation.group_id}`);
    } catch (error) {
      console.error("💥 Unexpected error accepting invitation:", error);
      toast({
        title: "Error",
        description: "Failed to accept invitation. Please try again.",
        variant: "destructive",
      });
    } finally {
      setAccepting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex items-center space-x-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Loading invitation...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>Care Group Invitation</CardTitle>
          <CardDescription>
            You've been invited to join a care group
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {invitation && (
            <>
              <div className="text-center space-y-2">
                <h3 className="font-semibold text-lg">{invitation.group_name}</h3>
                <p className="text-sm text-muted-foreground">
                  Invited by: {invitation.invited_by_email}
                </p>
                {invitation.message && (
                  <div className="bg-muted p-3 rounded-md">
                    <p className="text-sm italic">"{invitation.message}"</p>
                  </div>
                )}
              </div>
              
              <div className="flex flex-col space-y-2">
                <Button 
                  onClick={acceptInvitation} 
                  disabled={accepting}
                  className="w-full"
                >
                  {accepting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Accepting...
                    </>
                  ) : (
                    "Accept Invitation"
                  )}
                </Button>
                
                <Button 
                  variant="outline" 
                  onClick={() => navigate("/login")}
                  className="w-full"
                >
                  Go to Login
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default InviteAccept;