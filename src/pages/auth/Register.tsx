import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import SEO from "@/components/layout/SEO";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";

const Register = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [address1, setAddress1] = useState("");
  const [address2, setAddress2] = useState("");
  const [city, setCity] = useState("");
  const [stateProv, setStateProv] = useState("");
  const [zip, setZip] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSignUp = async () => {
    if (!email || !password || !address1 || !city || !stateProv || !zip || !phone) {
      toast({ title: "Missing info", description: "Please complete all required fields." });
      return;
    }
    try {
      setLoading(true);
      
      // Check if there's a pending invitation
      const pendingInvitation = localStorage.getItem("pendingInvitation");
      const redirectUrl = pendingInvitation 
        ? `${window.location.origin}/invite/accept?token=${pendingInvitation}`
        : `${window.location.origin}/onboarding`;
        
      const { error } = await supabase.auth.signUp({
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
      if (error) throw error;
      
      if (pendingInvitation) {
        toast({ 
          title: "Check your email", 
          description: "Confirm your email to complete signup and join the group." 
        });
      } else {
        toast({ 
          title: "Check your email", 
          description: "Confirm your email to finish sign up." 
        });
      }
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
            <div className="space-y-4">
              <div>
                <Label htmlFor="email">Email *</Label>
                <Input id="email" placeholder="Email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="password">Password *</Label>
                <Input id="password" placeholder="Password" type="password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
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
    </div>
  );
};

export default Register;

