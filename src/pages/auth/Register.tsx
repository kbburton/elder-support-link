import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import SEO from "@/components/layout/SEO";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";

const Register = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSignUp = async () => {
    if (!email || !password) {
      toast({ title: "Missing info", description: "Email and password are required." });
      return;
    }
    try {
      setLoading(true);
      const redirectUrl = `${window.location.origin}/onboarding`;
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: redirectUrl }
      });
      if (error) throw error;
      toast({ title: "Check your email", description: "Confirm your email to finish sign up." });
      navigate("/login", { replace: true });
    } catch (err: any) {
      toast({ title: "Registration failed", description: err?.message || "Please try again." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center">
      <SEO title="Register — DaveAssist" description="Create your DaveAssist account." />
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Create account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Input placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <Button className="w-full" onClick={handleSignUp} disabled={loading}>
            {loading ? "Creating account..." : "Sign up"}
          </Button>
          <Button variant="outline" className="w-full" onClick={() => navigate("/login")}>Back to Login</Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default Register;

