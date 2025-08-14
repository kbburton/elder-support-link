import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import SEO from "@/components/layout/SEO";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const Login = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // Check for invitation token and prefilled email in URL params on load
  useEffect(() => {
    const token = searchParams.get("token");
    const emailParam = searchParams.get("email");
    
    if (token) {
      localStorage.setItem("pendingInvitation", token);
    }
    
    if (emailParam) {
      setEmail(decodeURIComponent(emailParam));
    }
  }, [searchParams]);

  const handleSignIn = async () => {
    console.log("🔄 Login started for:", email);
    
    if (!email || !password) {
      toast({ title: "Missing credentials", description: "Enter email and password." });
      return;
    }
    try {
      setLoading(true);
      console.log("🔐 Authenticating user...");
      
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        console.error("❌ Authentication error:", error);
        throw error;
      }
      console.log("✅ Authentication successful");
      
      // Check for welcome message first (from registration)
      const welcomeMessage = localStorage.getItem("welcomeMessage");
      if (welcomeMessage) {
        console.log("💬 Found welcome message:", welcomeMessage);
        localStorage.removeItem("welcomeMessage");
        toast({ title: "Welcome!", description: welcomeMessage });
      }
      
      // Check for pending invitation first
      const pendingInvitation = localStorage.getItem("pendingInvitation");
      console.log("🎫 Pending invitation token:", pendingInvitation || "none");
      
      // Get current user info first
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      console.log("👤 Current user ID:", currentUser?.id);
      
      if (pendingInvitation && currentUser) {
        // Try to auto-accept the invitation directly
        console.log("🔄 Processing pending invitation...");
        try {
          // Get invitation details
          const { data: invitation, error: inviteError } = await supabase.rpc('get_invitation_by_token', {
            invitation_token: pendingInvitation
          });
          
          if (inviteError) {
            console.error("❌ Error getting invitation:", inviteError);
            throw inviteError;
          }
          
          console.log("✅ Invitation details:", invitation);
          
          if (invitation && invitation.length > 0) {
            const invitationData = invitation[0];
            console.log("📋 Processing invitation for group:", invitationData.group_id);
            
            // Check if user's email matches invitation email
            const { data: userProfile } = await supabase
              .from('profiles')
              .select('email')
              .eq('user_id', currentUser.id)
              .maybeSingle();
            
            console.log("👤 User profile email:", userProfile?.email);
            console.log("📧 Invitation email:", invitationData.invited_email);
            
            if (userProfile?.email === invitationData.invited_email) {
              // Check if user is already a member
              const { data: existingMember } = await supabase
                .from('care_group_members')
                .select('id')
                .eq('user_id', currentUser.id)
                .eq('group_id', invitationData.group_id)
                .maybeSingle();
              
              console.log("👥 Existing membership:", existingMember?.id || "none");
              
              if (!existingMember) {
                console.log("➕ Adding user to care group...");
                // Add user to group
                const { error: memberError } = await supabase
                  .from('care_group_members')
                  .insert({
                    user_id: currentUser.id,
                    group_id: invitationData.group_id,
                    relationship_to_recipient: 'family'
                  });
                
                if (memberError) {
                  console.error("❌ Error adding to group:", memberError);
                  // Check if it's a duplicate key error
                  if (memberError.code === '23505') {
                    console.log("ℹ️  User already member (duplicate key)");
                    toast({ title: "Welcome back", description: "You already have access to this care group." });
                  } else {
                    throw memberError;
                  }
                } else {
                  console.log("✅ User added to group successfully");
                  toast({ title: "Welcome!", description: "Successfully joined the care group." });
                }
                
                // Accept the invitation
                console.log("📝 Accepting invitation...");
                const { error: acceptError } = await supabase.rpc('accept_invitation', {
                  invitation_id: invitationData.id,
                  user_id: currentUser.id
                });
                
                if (acceptError) {
                  console.error("❌ Error accepting invitation:", acceptError);
                } else {
                  console.log("✅ Invitation accepted");
                }
              } else {
                console.log("ℹ️  User already member of group");
                toast({ title: "Welcome back", description: "You already have access to this care group." });
              }
              
              // Update last active group
              console.log("📌 Updating last active group...");
              const { error: profileError } = await supabase
                .from('profiles')
                .update({ last_active_group_id: invitationData.group_id })
                .eq('user_id', currentUser.id);
              
              if (profileError) {
                console.error("❌ Error updating profile:", profileError);
              } else {
                console.log("✅ Last active group updated");
              }
              
              // Clear pending invitation
              localStorage.removeItem("pendingInvitation");
              console.log("🧹 Cleared pending invitation");
              
              // Navigate to monthly calendar view with welcome message
              console.log("🗓️  Redirecting to calendar for group:", invitationData.group_id);
              toast({ title: "Welcome!", description: `Welcome to ${invitationData.group_name}!` });
              navigate(`/app/${invitationData.group_id}/calendar`, { replace: true });
              return;
            } else {
              console.log("❌ Email mismatch - invitation not for this user");
            }
          } else {
            console.log("❌ No invitation data found");
          }
        } catch (inviteError) {
          console.error('❌ Error processing invitation:', inviteError);
          localStorage.removeItem("pendingInvitation");
          toast({ 
            title: "Error", 
            description: "Failed to process invitation. Please try again.",
            variant: "destructive"
          });
        }
      }
      
      console.log("🔄 Processing normal login flow...");
      // Check if user has existing care groups (normal login flow)
      const { data: userGroups, error: groupsError } = await supabase
        .from('care_group_members')
        .select('group_id, care_groups(id, name)')
        .eq('user_id', currentUser?.id);
      
      if (groupsError) {
        console.error("❌ Error getting user groups:", groupsError);
        throw groupsError;
      }
      
      console.log("👥 User groups:", userGroups?.length || 0, "groups found");
      
      // Get user profile to check last active group
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('last_active_group_id')
        .eq('user_id', currentUser?.id)
        .single();
      
      if (userGroups && userGroups.length > 0) {
        console.log("✅ User has existing groups, processing redirect...");
        // User has care groups
        if (userGroups.length === 1) {
          console.log("📍 Single group - redirecting directly");
          // Single group - redirect directly
          const groupId = userGroups[0].group_id;
          
          // Update last active group
          await supabase
            .from('profiles')
            .update({ last_active_group_id: groupId })
            .eq('user_id', currentUser?.id);
            
          toast({ title: "Welcome back", description: "Signed in successfully." });
          navigate(`/app/${groupId}`, { replace: true });
        } else {
          console.log("📍 Multiple groups - checking last active");
          // Multiple groups - check for last active group
          let targetGroupId = userProfile?.last_active_group_id;
          
          // Verify the last active group is still accessible
          if (targetGroupId) {
            const isGroupAccessible = userGroups.some(group => group.group_id === targetGroupId);
            if (!isGroupAccessible) {
              targetGroupId = null;
            }
          }
          
          if (targetGroupId) {
            console.log("📍 Going to last active group:", targetGroupId);
            // Go to last active group
            toast({ title: "Welcome back", description: "Signed in successfully." });
            navigate(`/app/${targetGroupId}`, { replace: true });
          } else {
            console.log("📍 No valid last active group - using first group");
            // Multiple groups but no valid last active - use first group
            const firstGroupId = userGroups[0].group_id;
            
            // Update last active group to first group
            await supabase
              .from('profiles')
              .update({ last_active_group_id: firstGroupId })
              .eq('user_id', currentUser?.id);
              
            toast({ title: "Welcome back", description: "Signed in successfully." });
            navigate(`/app/${firstGroupId}`, { replace: true });
          }
        }
      } else {
        console.log("❌ No groups found - redirecting to onboarding");
        // No groups - go to onboarding to create one
        toast({ title: "Welcome back", description: "Create or join a care group to get started." });
        navigate("/onboarding", { replace: true });
      }
    } catch (err: any) {
      const msg = err?.message?.toLowerCase?.() || "";
      if (msg.includes("confirm")) {
        toast({ title: "Email not confirmed", description: "Check your inbox for the confirmation email, then try again." });
      } else {
        toast({ title: "Sign in failed", description: err?.message || "Please try again." });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendConfirmation = async () => {
    if (!email) {
      toast({ title: "Email required", description: "Enter your email to resend confirmation." });
      return;
    }
    try {
      setLoading(true);
      const redirectUrl = `${window.location.origin}/onboarding`;
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
        options: { emailRedirectTo: redirectUrl }
      });
      if (error) throw error;
      toast({ title: "Email sent", description: "Confirmation email resent. Please check your inbox." });
    } catch (err: any) {
      toast({ title: "Could not resend", description: err?.message || "Please try again." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center">
      <SEO title="Login — DaveAssist" description="Access your DaveAssist account." />
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Login</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Input placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <Button className="w-full" onClick={handleSignIn} disabled={loading}>
            {loading ? "Signing in..." : "Sign in"}
          </Button>
          <Button variant="outline" className="w-full" onClick={handleResendConfirmation} disabled={!email || loading}>
            Resend confirmation email
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => navigate("/password-reset")}>
              Forgot Password?
            </Button>
            <Button variant="outline" className="flex-1" onClick={() => navigate("/register")}>
              Create account
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;

