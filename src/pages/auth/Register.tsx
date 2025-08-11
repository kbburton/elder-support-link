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

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);

  const handleContinue = async () => {
    if (!name || !email) {
      toast({ title: "Missing info", description: "Name and email are required." });
      return;
    }
    try {
      setLoading(true);
      const { error } = await (supabase as any).from("users").insert({
        name,
        email,
        address: address || null,
        phone: phone || null,
      });
      if (error) throw error;
      toast({ title: "Account created", description: "Your details have been saved." });
      navigate("/onboarding");
    } catch (err: any) {
      toast({
        title: "Registration failed",
        description: err?.message || "Please try again.",
      });
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
          <Input placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} />
          <Input placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Input placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <Input placeholder="Address" value={address} onChange={(e) => setAddress(e.target.value)} />
          <Input placeholder="Phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <Button className="w-full" onClick={handleContinue} disabled={loading}>
            {loading ? "Saving..." : "Continue"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default Register;

