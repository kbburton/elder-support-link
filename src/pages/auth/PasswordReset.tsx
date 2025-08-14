import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import SEO from "@/components/layout/SEO";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const PasswordReset = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  
  const [step, setStep] = useState<"request" | "reset">("request");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Check if we have reset tokens in URL
    const accessToken = searchParams.get("access_token");
    const refreshToken = searchParams.get("refresh_token");
    
    if (accessToken && refreshToken) {
      setStep("reset");
    }
  }, [searchParams]);

  const handleRequestReset = async () => {
    if (!email) {
      toast({ title: "Email required", description: "Please enter your email address." });
      return;
    }

    try {
      setLoading(true);
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/password-reset`,
      });

      if (error) throw error;

      toast({
        title: "Reset email sent",
        description: "Check your email for password reset instructions.",
      });
    } catch (err: any) {
      toast({
        title: "Error",
        description: err?.message || "Failed to send reset email. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!password || !confirmPassword) {
      toast({ title: "Missing information", description: "Please fill in all password fields." });
      return;
    }

    if (password !== confirmPassword) {
      toast({ title: "Password mismatch", description: "Passwords do not match." });
      return;
    }

    // Validate password strength
    const hasMinLength = password.length >= 8;
    const hasLettersAndNumbers = /[a-zA-Z]/.test(password) && /[0-9]/.test(password);
    const hasUppercase = /[A-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);

    if (!hasMinLength || !hasLettersAndNumbers || !hasUppercase || !hasNumber) {
      toast({
        title: "Password requirements not met",
        description: "Please ensure your password meets all the requirements.",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);
      const { error } = await supabase.auth.updateUser({
        password: password,
      });

      if (error) throw error;

      toast({
        title: "Password updated",
        description: "Your password has been successfully updated.",
      });

      navigate("/login", { replace: true });
    } catch (err: any) {
      toast({
        title: "Error",
        description: err?.message || "Failed to update password. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center">
      <SEO 
        title={step === "request" ? "Reset Password — DaveAssist" : "Set New Password — DaveAssist"} 
        description={step === "request" ? "Reset your DaveAssist password." : "Set your new DaveAssist password."} 
      />
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>
            {step === "request" ? "Reset Password" : "Set New Password"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {step === "request" ? (
            <>
              <div>
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                />
              </div>
              <Button
                className="w-full"
                onClick={handleRequestReset}
                disabled={loading}
              >
                {loading ? "Sending..." : "Send Reset Email"}
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => navigate("/login")}
              >
                Back to Login
              </Button>
            </>
          ) : (
            <>
              <PasswordInput
                id="new-password"
                label="New Password"
                value={password}
                onChange={setPassword}
                confirmValue={confirmPassword}
                onConfirmChange={setConfirmPassword}
                showConfirm={true}
                required
              />
              <Button
                className="w-full"
                onClick={handlePasswordReset}
                disabled={loading || password !== confirmPassword || password.length === 0}
              >
                {loading ? "Updating..." : "Update Password"}
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => navigate("/login")}
              >
                Back to Login
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PasswordReset;