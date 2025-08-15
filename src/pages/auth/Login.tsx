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
      console.debug('INVITE >>> Saving token from URL (Login page):', token);
      savePendingInvite(token);
    }
  }, [searchParams]);


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

      // Handle pending invitations
      const pending = loadPendingInvite();
      if (pending?.token) {
        console.debug("LOGIN >>> found pending invitation, starting processing");
        try {
          console.debug("LOGIN >>> calling get_invitation_by_token RPC");

          // 1) Resolve token -> invitation row (ARRAY result)
          const { data: rows, error: rErr } = await supabase.rpc('get_invitation_by_token', {
            invitation_token: pending.token
          });
          if (rErr) {
            console.debug("LOGIN >>> get_invitation_by_token RPC failed:", rErr.message);
            throw rErr;
          }

          const resolved = Array.isArray(rows) ? rows[0] : rows;
          console.debug("LOGIN >>> invitation resolved, id:", resolved?.id || "null");

          // 2) Basic validity checks - simple null check
          if (!resolved) {
            console.debug("LOGIN >>> invitation not found or invalid, clearing");
            clearPendingInvite();
            toast({
              title: "Invitation no longer valid",
              description: "Ask the group admin to send a new invite.",
            });
          } else {
            // 3) Accept invitation with correct param name and id
            console.debug("LOGIN >>> calling accept_invitation RPC for id:", resolved.id);
            const { data: groupId, error: aErr } = await supabase.rpc('accept_invitation', {
              invitation_id: resolved.id
            });
            if (aErr) {
              console.debug("LOGIN >>> accept_invitation RPC failed:", aErr.message);
              throw aErr;
            }

            console.debug("LOGIN >>> invitation accepted successfully, group:", groupId);
            clearPendingInvite();

            if (groupId) {
              console.debug("LOGIN >>> navigating to group dashboard");
              toast({ title: "Joined care group", description: "Welcome!" });
              navigate(`/app/${groupId}`, { replace: true });
              return; // stop normal flow; we're in!
            } else {
              console.debug("LOGIN >>> no group ID returned from accept_invitation");
            }
          }
        } catch (e: any) {
          console.debug("LOGIN >>> invitation processing failed:", e?.message || "unknown error");
          toast({
            title: "Invitation issue",
            description: e?.message ?? "Could not accept invitation.",
            variant: "destructive"
          });
          // Clear to avoid loops
          clearPendingInvite();
        }
      } else {
        console.debug("LOGIN >>> no pending invitation found");
      }

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
