import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import SEO from "@/components/layout/SEO";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";

const Onboarding = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [joinLoading, setJoinLoading] = useState(false);
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        toast({ title: "Session expired", description: "Please log in again." });
        navigate("/login", { replace: true });
      }
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        toast({ title: "Session required", description: "Please log in again." });
        navigate("/login", { replace: true });
      }
    });
    return () => {
      subscription?.unsubscribe();
    };
  }, [navigate, toast]);
  // Create group form state
  const [formData, setFormData] = useState({
    name: "",
    recipientAddress: "",
    recipientCity: "",
    recipientState: "",
    recipientZip: "",
    recipientPhone: "",
    specialDates: "",
    profileDescription: "",
    mobility: "",
    memory: "",
    hearing: "",
    vision: "",
    chronicConditions: "",
    mentalHealth: "",
    dateOfBirth: ""
  });

  // Join group form state
  const [groupCode, setGroupCode] = useState("");

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleCreateGroup = async () => {
    if (!formData.name.trim()) {
      toast({ title: "Name required", description: "Please enter a name for the care recipient." });
      return;
    }

    try {
      setLoading(true);
      
      // Get current user
const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        toast({ title: "Authentication error", description: "Please log in again." });
        navigate("/login", { replace: true });
        return;
      }

      // Create care group
      const { data: group, error: groupError } = await (supabase as any)
        .from("care_groups")
        .insert({
          created_by_user_id: user.id,
          name: formData.name,
          recipient_address: formData.recipientAddress || null,
          recipient_city: formData.recipientCity || null,
          recipient_state: formData.recipientState || null,
          recipient_zip: formData.recipientZip || null,
          recipient_phone: formData.recipientPhone || null,
          date_of_birth: formData.dateOfBirth || null,
          special_dates: formData.specialDates
            ? (() => { try { return JSON.parse(formData.specialDates); } catch { return { note: formData.specialDates }; } })()
            : null,
          profile_description: formData.profileDescription || null,
          mobility: formData.mobility || null,
          memory: formData.memory || null,
          hearing: formData.hearing || null,
          vision: formData.vision || null,
          chronic_conditions: formData.chronicConditions || null,
          mental_health: formData.mentalHealth || null
        })
        .select()
        .single();

      if (groupError || !group) throw groupError;

      // Add user as admin member
      const { error: memberError } = await (supabase as any)
        .from("care_group_members")
        .insert({
          group_id: group.id,
          user_id: user.id,
          role: "admin"
        });

      if (memberError) throw memberError;

      toast({ title: "Care group created", description: "Successfully created your care group." });
      navigate(`/app/${group.id}/dashboard`);
    } catch (err: any) {
      console.error("Error creating group:", err);
      toast({
        title: "Failed to create group",
        description: err?.message || "Please try again."
      });
    } finally {
      setLoading(false);
    }
  };

  const handleJoinGroup = async () => {
    if (!groupCode.trim()) {
      toast({ title: "Group code required", description: "Please enter a group ID or invite code." });
      return;
    }

    try {
      setJoinLoading(true);
      
      // Get current user
const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        toast({ title: "Authentication error", description: "Please log in again." });
        navigate("/login", { replace: true });
        return;
      }

      // Look up the group by ID
      const { data: group, error: groupError } = await (supabase as any)
        .from("care_groups")
        .select("id")
        .eq("id", groupCode.trim())
        .single();

      if (groupError || !group) {
        toast({ title: "Group not found", description: "Invalid group ID or invite code." });
        return;
      }

      // Check if user is already a member
      const { data: existingMember } = await (supabase as any)
        .from("care_group_members")
        .select("id")
        .eq("group_id", group.id)
        .eq("user_id", user.id)
        .single();

      if (existingMember) {
        toast({ title: "Already a member", description: "You're already part of this care group." });
        navigate(`/app/${group.id}/dashboard`);
        return;
      }

      // Add user as member
      const { error: memberError } = await (supabase as any)
        .from("care_group_members")
        .insert({
          group_id: group.id,
          user_id: user.id,
          role: "member"
        });

      if (memberError) throw memberError;

      toast({ title: "Joined care group", description: "Successfully joined the care group." });
      navigate(`/app/${group.id}/dashboard`);
    } catch (err: any) {
      console.error("Error joining group:", err);
      toast({
        title: "Failed to join group",
        description: err?.message || "Please try again."
      });
    } finally {
      setJoinLoading(false);
    }
  };

  return (
    <div className="min-h-screen container py-10">
      <SEO title="Onboarding — DaveAssist" description="Create or join a care group." />
      <h1 className="text-2xl font-semibold mb-6">Welcome to DaveAssist</h1>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Create a new care group</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4">
              <div>
                <Label htmlFor="name">Care recipient name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleInputChange("name", e.target.value)}
                  placeholder="Enter the name of the person receiving care"
                />
              </div>
              
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="address">Address</Label>
                  <Input
                    id="address"
                    value={formData.recipientAddress}
                    onChange={(e) => handleInputChange("recipientAddress", e.target.value)}
                    placeholder="Home address"
                  />
                </div>
                <div>
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={formData.recipientPhone}
                    onChange={(e) => handleInputChange("recipientPhone", e.target.value)}
                    placeholder="Phone number"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    value={formData.recipientCity}
                    onChange={(e) => handleInputChange("recipientCity", e.target.value)}
                    placeholder="City"
                  />
                </div>
                <div>
                  <Label htmlFor="state">State</Label>
                  <Input
                    id="state"
                    value={formData.recipientState}
                    onChange={(e) => handleInputChange("recipientState", e.target.value)}
                    placeholder="State"
                  />
                </div>
                <div>
                  <Label htmlFor="zip">ZIP code</Label>
                  <Input
                    id="zip"
                    value={formData.recipientZip}
                    onChange={(e) => handleInputChange("recipientZip", e.target.value)}
                    placeholder="ZIP code"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="dob">Date of birth</Label>
                <Input
                  id="dob"
                  type="date"
                  value={formData.dateOfBirth}
                  onChange={(e) => handleInputChange("dateOfBirth", e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="description">Profile description</Label>
                <Textarea
                  id="description"
                  value={formData.profileDescription}
                  onChange={(e) => handleInputChange("profileDescription", e.target.value)}
                  placeholder="Brief description about the care recipient"
                />
              </div>

              <div>
                <Label htmlFor="specialDates">Special dates (JSON or free text)</Label>
                <Textarea
                  id="specialDates"
                  value={formData.specialDates}
                  onChange={(e) => handleInputChange("specialDates", e.target.value)}
                  placeholder='{"birthday": "1950-05-15", "anniversary": "1975-08-20"}'
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="mobility">Mobility notes</Label>
                  <Input
                    id="mobility"
                    value={formData.mobility}
                    onChange={(e) => handleInputChange("mobility", e.target.value)}
                    placeholder="Mobility assistance needed"
                  />
                </div>
                <div>
                  <Label htmlFor="memory">Memory notes</Label>
                  <Input
                    id="memory"
                    value={formData.memory}
                    onChange={(e) => handleInputChange("memory", e.target.value)}
                    placeholder="Memory-related care notes"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="hearing">Hearing notes</Label>
                  <Input
                    id="hearing"
                    value={formData.hearing}
                    onChange={(e) => handleInputChange("hearing", e.target.value)}
                    placeholder="Hearing assistance needed"
                  />
                </div>
                <div>
                  <Label htmlFor="vision">Vision notes</Label>
                  <Input
                    id="vision"
                    value={formData.vision}
                    onChange={(e) => handleInputChange("vision", e.target.value)}
                    placeholder="Vision assistance needed"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="chronic">Chronic conditions</Label>
                  <Input
                    id="chronic"
                    value={formData.chronicConditions}
                    onChange={(e) => handleInputChange("chronicConditions", e.target.value)}
                    placeholder="Ongoing health conditions"
                  />
                </div>
                <div>
                  <Label htmlFor="mental">Mental health notes</Label>
                  <Input
                    id="mental"
                    value={formData.mentalHealth}
                    onChange={(e) => handleInputChange("mentalHealth", e.target.value)}
                    placeholder="Mental health considerations"
                  />
                </div>
              </div>
            </div>
            
            <Button 
              className="w-full" 
              onClick={handleCreateGroup} 
              disabled={loading}
            >
              {loading ? "Creating group..." : "Create care group"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Join an existing care group</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground text-sm">
              Ask an admin for the group ID, then enter it here to join their care group.
            </p>
            <div>
              <Label htmlFor="groupCode">Group ID</Label>
              <Input
                id="groupCode"
                value={groupCode}
                onChange={(e) => setGroupCode(e.target.value)}
                placeholder="Enter group ID"
              />
            </div>
            <Button 
              className="w-full" 
              variant="outline" 
              onClick={handleJoinGroup}
              disabled={joinLoading}
            >
              {joinLoading ? "Joining..." : "Join care group"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Onboarding;
