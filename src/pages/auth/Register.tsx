import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import SEO from "@/components/layout/SEO";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { savePendingInvite, resolveInvite } from "@/lib/invitations";
import { Info } from "lucide-react";

const Register = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [address1, setAddress1] = useState("");
  const [address2, setAddress2] = useState("");
  const [city, setCity] = useState("");
  const [stateProv, setStateProv] = useState("");
  const [zip, setZip] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [invitationData, setInvitationData] = useState<any>(null);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Check for prefilled email from URL params and invitation data on load
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const token =
      sp.get("token") ||
      sp.get("invitationId") ||
      sp.get("invitation_token");

    if (token) {
      console.debug("REGISTER >>> found invite token in URL, storing raw token:", token);
      localStorage.setItem('invitationToken', token);
      
      // Still fetch invitation data for display purposes
      (async () => {
        console.debug('REGISTER >>> resolving invite token for display purposes');
        const { data, error } = await supabase.rpc('get_invitation_by_token', {
          invitation_token: token
        });
        if (error || !data || data.length === 0) {
          console.debug("REGISTER >>> invalid invitation token for display");
          return;
        }
        
        console.debug("REGISTER >>> invitation resolved successfully for display");
        // Load invitation data for display
        setInvitationData(data[0]);
        setEmail(data[0].invited_email || "");
      })();
    } else {
      console.debug("REGISTER >>> no invite token found in URL");
    }
    
    const emailParam = sp.get("email");
    if (emailParam) setEmail(decodeURIComponent(emailParam));
    // IMPORTANT: do not clear the invite here
  }, []);

  const loadInvitationData = async (token: string) => {
    console.log("🔍 Loading invitation data for token:", token);
    try {
      const { data: invitation, error } = await supabase.rpc('get_invitation_by_token', {
        invitation_token: token
      });

      if (error || !invitation || invitation.length === 0) {
        console.error("❌ Failed to load invitation data:", error);
        return;
      }

      console.log("✅ Invitation data loaded:", invitation[0]);
      setInvitationData(invitation[0]);
    } catch (error) {
      console.error("❌ Error loading invitation data:", error);
    }
  };

  const handleSignUp = async () => {
    console.log("🔄 Registration started for:", email);
    
    if (!email || !password || !confirmPassword || !address1 || !city || !stateProv || !zip || !phone) {
      toast({ title: "Missing info", description: "Please complete all required fields." });
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
      console.log("📝 Creating user account...");
      
      // Always redirect to login after registration for invitation flow
      const redirectUrl = `${window.location.origin}/login`;
        
      const { data: authData, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            address1,
            address2,
            city,
            state: stateProv,
            zip,
            phone,
          },
        },
      });
      
      if (error) {
        console.error("❌ Auth signup error:", error);
        throw error;
      }
      
      console.log("✅ User created successfully:", authData.user?.id);
      console.log("📋 Invitation data:", invitationData);

      // If user was created and there's an invitation, process it after login
      if (authData.user && invitationData) {
        console.log("🎯 User created with invitation data:", {
          userId: authData.user.id,
          userEmail: authData.user.email,
          invitationId: invitationData.id,
          groupId: invitationData.group_id,
          groupName: invitationData.group_name,
          invitedEmail: invitationData.invited_email
        });
        
        console.log("💾 Invitation data preserved for post-login processing");
      } else {
        console.log("ℹ️  No invitation data found, skipping group assignment");
        console.log("Debug info:", {
          hasUser: !!authData.user,
          hasInvitationData: !!invitationData,
          userData: authData.user,
          invitationData: invitationData
        });
      }
      
      toast({ 
        title: "Registration successful", 
        description: invitationData 
          ? `You've been successfully added to the ${invitationData.group_name} care group. Please log in to continue.`
          : "Please log in to continue." 
      });
      console.log("🔄 Redirecting to login...");
      navigate("/login", { replace: true });
    } catch (err: any) {
      console.error('❌ Registration error:', err);
      setErrorMessage(`Registration failed: ${err?.message || 'Please try again.'}`);
      setShowErrorModal(true);
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
            {invitationData && (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  You're being invited to join <strong>{invitationData.group_name}</strong>
                </AlertDescription>
              </Alert>
            )}
            <div className="space-y-4">
              <div>
                <Label htmlFor="email">Email *</Label>
                <Input id="email" placeholder="Email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <PasswordInput
                id="password"
                label="Password"
                value={password}
                onChange={setPassword}
                confirmValue={confirmPassword}
                onConfirmChange={setConfirmPassword}
                showConfirm={true}
                required
              />
              <div>
                <Label htmlFor="address1">Street address *</Label>
                <Input id="address1" placeholder="Street address" autoComplete="address-line1" required value={address1} onChange={(e) => setAddress1(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="address2">Street address 2</Label>
                <Input id="address2" placeholder="Apartment, suite, etc. (optional)" value={address2} onChange={(e) => setAddress2(e.target.value)} />
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <Label htmlFor="city">City *</Label>
                  <Input id="city" placeholder="City" autoComplete="address-level2" required value={city} onChange={(e) => setCity(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="state">State *</Label>
                  <Input id="state" placeholder="State" autoComplete="address-level1" required value={stateProv} onChange={(e) => setStateProv(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="zip">ZIP code *</Label>
                  <Input id="zip" placeholder="ZIP code" autoComplete="postal-code" required value={zip} onChange={(e) => setZip(e.target.value)} />
                </div>
              </div>
              <div>
                <Label htmlFor="phone">Phone number *</Label>
                <Input id="phone" placeholder="Phone number" type="tel" autoComplete="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
              <Button className="w-full" onClick={handleSignUp} disabled={loading}>
                {loading ? "Creating account..." : "Sign up"}
              </Button>
              <Button variant="outline" className="w-full" onClick={() => navigate("/login")}>
                Back to Login
              </Button>
            </div>
          </CardContent>
      </Card>

      <AlertDialog open={showErrorModal} onOpenChange={setShowErrorModal}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Registration Error</AlertDialogTitle>
            <AlertDialogDescription>
              {errorMessage}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setShowErrorModal(false)}>
              OK
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Register;

