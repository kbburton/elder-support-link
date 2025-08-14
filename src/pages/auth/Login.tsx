import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import SEO from "@/components/layout/SEO";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";

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
    if (!email || !password) {
      toast({ title: "Missing credentials", description: "Enter email and password." });
      return;
    }
    try {
      setLoading(true);
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      
      // Check for pending invitation first
      const pendingInvitation = localStorage.getItem("pendingInvitation");
      
      // Get current user info first
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      
      if (pendingInvitation && currentUser) {
        // Try to auto-accept the invitation directly instead of redirecting
        try {
          // Get invitation details
          const { data: invitation } = await supabase.rpc('get_invitation_by_token', {
            invitation_token: pendingInvitation
          });
          
          if (invitation && invitation.length > 0) {
            const invitationData = invitation[0];
            
            // Check if user's email matches invitation email
            const { data: userProfile } = await supabase
              .from('profiles')
              .select('email')
              .eq('user_id', currentUser.id)
              .single();
            
            if (userProfile?.email === invitationData.invited_email) {
              // Check if user is already a member
              const { data: existingMember } = await supabase
                .from('care_group_members')
                .select('id')
                .eq('user_id', currentUser.id)
                .eq('group_id', invitationData.group_id)
                .single();
              
              if (!existingMember) {
                // Add user to group
                const { error: memberError } = await supabase
                  .from('care_group_members')
                  .insert({
                    user_id: currentUser.id,
                    group_id: invitationData.group_id,
                    relationship_to_recipient: 'family' // default value
                  });
                
                if (memberError) throw memberError;
                
                // Accept the invitation
                await supabase.rpc('accept_invitation', {
                  invitation_id: invitationData.id,
                  user_id: currentUser.id
                });
                
                // Update last active group
                await supabase
                  .from('profiles')
                  .update({ last_active_group_id: invitationData.group_id })
                  .eq('user_id', currentUser.id);
                
                // Clear pending invitation
                localStorage.removeItem("pendingInvitation");
                
                toast({ title: "Welcome!", description: "Successfully joined the care group." });
                navigate(`/app/${invitationData.group_id}`, { replace: true });
                return;
              } else {
                // User is already a member, just clear token and go to group
                localStorage.removeItem("pendingInvitation");
                toast({ title: "Welcome back", description: "You're already a member of this group." });
                navigate(`/app/${invitationData.group_id}`, { replace: true });
                return;
              }
            }
          }
        } catch (inviteError) {
          console.error('Error processing invitation:', inviteError);
          // Clear invalid token
          localStorage.removeItem("pendingInvitation");
        }
      }
      
      // Check if user has existing care groups (normal login flow)
      const { data: userGroups, error: groupsError } = await supabase
        .from('care_group_members')
        .select('group_id, care_groups(id, name)')
        .eq('user_id', currentUser?.id);
      
      if (groupsError) throw groupsError;
      
      // Get user profile to check last active group
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('last_active_group_id')
        .eq('user_id', currentUser?.id)
        .single();
      
      if (userGroups && userGroups.length > 0) {
        // User has care groups
        if (userGroups.length === 1) {
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
            // Go to last active group
            toast({ title: "Welcome back", description: "Signed in successfully." });
            navigate(`/app/${targetGroupId}`, { replace: true });
          } else {
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
          <Button variant="outline" className="w-full" onClick={() => navigate("/register")}>Create account</Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;

