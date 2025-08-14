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
      if (pendingInvitation) {
        localStorage.removeItem("pendingInvitation");
        toast({ title: "Welcome!", description: "Successfully signed in. You can now accept the invitation." });
        navigate(`/invite/accept?token=${pendingInvitation}`, { replace: true });
        return;
      }
      
      // Get user profile to check last active group
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('last_active_group_id')
        .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
        .single();

      // Check if user has existing care groups
      const { data: userGroups, error: groupsError } = await supabase
        .from('care_group_members')
        .select('group_id, care_groups(id, name)')
        .eq('user_id', (await supabase.auth.getUser()).data.user?.id);
      
      if (groupsError) throw groupsError;
      
      if (userGroups && userGroups.length > 0) {
        // User has care groups
        if (userGroups.length === 1) {
          // Single group - redirect directly
          const groupId = userGroups[0].group_id;
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
            // Multiple groups but no last active - show selection
            toast({ title: "Welcome back", description: "Choose your care group." });
            navigate("/onboarding", { replace: true });
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

