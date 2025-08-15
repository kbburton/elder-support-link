import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import SEO from "@/components/layout/SEO";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { loadPendingInvite, clearPendingInvite, savePendingInvite } from "@/lib/invitations";

const Login = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const emailParam = searchParams.get("email");
    const token = searchParams.get("token");
    if (emailParam) setEmail(decodeURIComponent(emailParam));
    if (token) {
      console.debug('LOGIN >>> Saving raw token to localStorage:', token);
      localStorage.setItem('invitationToken', token);
    }
  }, [searchParams]);


  async function processInvitationAfterLogin(userId: string, navigate: Function, toast: Function) {
    const token = localStorage.getItem('invitationToken');
    if (!token) return false;

    // 1) Lookup invitation (uuid)
    const { data: invRows, error: lookupErr } = await supabase.rpc('get_invitation_by_token', {
      invitation_token: token
    });

    if (lookupErr) {
      toast({ title: 'Invitation issue', description: lookupErr.message, variant: 'destructive' });
      return false;
    }
    
    const inv = Array.isArray(invRows) ? invRows[0] : invRows;
    if (!inv || (inv as any).status !== 'pending' || (inv as any).used_at || ((inv as any).expires_at && new Date((inv as any).expires_at) <= new Date())) {
      toast({ title: 'Invitation issue', description: 'This invitation is invalid or expired.', variant: 'destructive' });
      return false;
    }

    // 2) Accept invitation
    const { data: groupId, error: acceptErr } = await supabase.rpc('accept_invitation', {
      invitation_id: inv.id
    });
    if (acceptErr) {
      toast({ title: 'Could not join group', description: acceptErr.message, variant: 'destructive' });
      return false;
    }

    // 3) Clear token; set last active group; navigate to the group
    localStorage.removeItem('invitationToken');
    await supabase.from('profiles')
      .update({ last_active_group_id: groupId })
      .eq('user_id', userId);

    toast({ title: 'Welcome!', description: 'You\'ve joined the care group.' });
    navigate(`/app/${groupId}`, { replace: true });
    return true;
  }

  const handleSignIn = async () => {
    console.log("🔄 Login started for:", email);
    console.log("🔘 Button clicked, loading state:", loading);

    if (!email || !password) {
      toast({
        title: "Missing credentials",
        description: "Enter email and password.",
      });
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

      // Get current user info first
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();
      console.log("👤 Current user ID:", currentUser?.id);
      console.debug("LOGIN >>> Starting invitation check...");

      // Process invitation if present
      const processed = await processInvitationAfterLogin(currentUser!.id, navigate, toast);
      if (processed) return; // you were redirected to the group

      // Check for welcome message first (from registration)
      const welcomeMessage = localStorage.getItem("welcomeMessage");
      if (welcomeMessage) {
        console.log("💬 Found welcome message:", welcomeMessage);
        localStorage.removeItem("welcomeMessage");
        toast({ title: "Welcome!", description: welcomeMessage });
      }

      console.log("🔄 Processing normal login flow...");
      // Check if user has existing care groups (normal login flow)
      const { data: userGroups, error: groupsError } = await supabase
        .from("care_group_members")
        .select("group_id, care_groups(id, name)")
        .eq("user_id", currentUser?.id);

      if (groupsError) {
        console.error("❌ Error getting user groups:", groupsError);
        throw groupsError;
      }

      console.log("👥 User groups:", userGroups?.length || 0, "groups found");

      // Get user profile to check last active group
      const { data: userProfile } = await supabase
        .from("profiles")
        .select("last_active_group_id")
        .eq("user_id", currentUser?.id)
        .single();

      if (userGroups && userGroups.length > 0) {
        console.log("✅ User has existing groups, processing redirect...");
        // User has care groups
        if (userGroups.length === 1) {
          console.log("📍 Single group - redirecting directly");
          // Single group - redirect directly
          const groupId = userGroups[0].group_id;

          // Update last active group
          await supabase.from("profiles").update({ last_active_group_id: groupId }).eq("user_id", currentUser?.id);

          toast({ title: "Welcome back", description: "Signed in successfully." });
          navigate(`/app/${groupId}`, { replace: true });
        } else {
          console.log("📍 Multiple groups - checking last active");
          // Multiple groups - check for last active group
          let targetGroupId = userProfile?.last_active_group_id;

          // Verify the last active group is still accessible
          if (targetGroupId) {
            const isGroupAccessible = userGroups.some((group) => group.group_id === targetGroupId);
            if (!isGroupAccessible) {
              targetGroupId = null as unknown as string | null;
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
              .from("profiles")
              .update({ last_active_group_id: firstGroupId })
              .eq("user_id", currentUser?.id);

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
        toast({
          title: "Email not confirmed",
          description: "Check your inbox for the confirmation email, then try again.",
        });
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
        type: "signup",
        email,
        options: { emailRedirectTo: redirectUrl },
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
