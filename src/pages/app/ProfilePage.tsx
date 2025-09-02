import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import * as bcrypt from "bcryptjs";
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form } from "@/components/ui/form";
import SEO from "@/components/layout/SEO";

const ProfileSchema = z.object({
  first_name: z.string().min(1, "First name is required"),
  last_name: z.string().min(1, "Last name is required"),
  phone: z.string()
    .optional()
    .refine((phone) => {
      if (!phone || phone.trim() === '') return true;
      // Basic phone validation - should be 10-11 digits
      const digitsOnly = phone.replace(/\D/g, '');
      return digitsOnly.length >= 10 && digitsOnly.length <= 11;
    }, {
      message: "Phone number must be 10-11 digits",
    }),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip: z.string().optional(),
  voice_pin: z.string().regex(/^\d{4}$/, "PIN must be exactly 4 digits").optional().or(z.literal("")),
});

const PinSchema = z.object({
  current_pin: z.string().min(1, "Current PIN is required"),
  new_pin: z.string().regex(/^\d{4}$/, "PIN must be exactly 4 digits"),
  confirm_pin: z.string().regex(/^\d{4}$/, "PIN must be exactly 4 digits"),
}).refine((data) => data.new_pin === data.confirm_pin, {
  message: "PINs do not match",
  path: ["confirm_pin"],
});

type ProfileFormValues = z.infer<typeof ProfileSchema>;
type PinFormValues = z.infer<typeof PinSchema>;

const ProfilePage = () => {
  const [careGroups, setCareGroups] = useState<any[]>([]);
  const [selectedCareGroup, setSelectedCareGroup] = useState<string>("");
  const [showPinForm, setShowPinForm] = useState(false);
  const [hasPinSet, setHasPinSet] = useState(false);

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(ProfileSchema),
    defaultValues: {
      first_name: "",
      last_name: "",
      phone: "",
      address: "",
      city: "",
      state: "",
      zip: "",
      voice_pin: "",
    },
  });

  const pinForm = useForm<PinFormValues>({
    resolver: zodResolver(PinSchema),
    defaultValues: {
      current_pin: "",
      new_pin: "",
      confirm_pin: "",
    },
  });

  // Fetch user profile data and care groups
  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');
      
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;

      // Fetch care groups where user is admin
      const { data: careGroupsData, error: careGroupsError } = await supabase
        .from('care_group_members')
        .select(`
          care_groups (
            id, name, voice_pin, recipient_phone
          )
        `)
        .eq('user_id', user.id)
        .eq('is_admin', true);

      if (careGroupsError) throw careGroupsError;
      
      return { user, profile: profiles, careGroups: careGroupsData || [] };
    },
  });

  // Reset form when profile data is loaded
  useEffect(() => {
    if (profile?.profile) {
      form.reset({
        first_name: profile.profile.first_name || "",
        last_name: profile.profile.last_name || "",
        phone: profile.profile.phone || "",
        address: profile.profile.address || "",
        city: profile.profile.city || "",
        state: profile.profile.state || "",
        zip: profile.profile.zip || "",
        voice_pin: "",
      });
      // Check if user has a PIN set in their profile
      setHasPinSet(!!profile.profile.voice_pin);
    }
    if (profile?.careGroups) {
      setCareGroups(profile.careGroups.map(cg => cg.care_groups).filter(Boolean));
      if (profile.careGroups.length > 0 && !selectedCareGroup) {
        const firstGroup = profile.careGroups[0].care_groups;
        if (firstGroup) {
          setSelectedCareGroup(firstGroup.id);
        }
      }
    }
  }, [profile, form, selectedCareGroup]);

  // Handle profile save
  const saveMutation = useMutation({
    mutationFn: async (values: ProfileFormValues) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      const { error } = await supabase
        .from('profiles')
        .upsert({
          user_id: user.id,
          first_name: values.first_name,
          last_name: values.last_name,
          phone: values.phone || null,
          address: values.address || null,
          city: values.city || null,
          state: values.state || null,
          zip: values.zip || null,
        });

      if (error) throw error;

      // Handle voice PIN for new setup
      if (values.voice_pin) {
        const hashedPin = await bcrypt.hash(values.voice_pin, 10);
        const { error: pinError } = await supabase
          .from('profiles')
          .update({ voice_pin: hashedPin })
          .eq('user_id', user.id);

        if (pinError) throw pinError;
        setHasPinSet(true);
      }
    },
    onSuccess: () => {
      toast.success("Profile updated successfully!");
      form.setValue('voice_pin', '');
    },
    onError: (error) => {
      // Handle phone number duplicate error
      if (error.message?.includes('PHONE_DUPLICATE:')) {
        const errorMessage = error.message.split('PHONE_DUPLICATE:')[1]?.trim() || "That phone number is already in use. Please choose another number.";
        toast.error(errorMessage);
      } else {
        toast.error("Failed to update profile: " + error.message);
      }
    },
  });

  // Handle PIN change
  const pinMutation = useMutation({
    mutationFn: async (values: PinFormValues) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');
      
      // Get current profile to check existing PIN
      const { data: currentProfile, error: profileError } = await supabase
        .from('profiles')
        .select('voice_pin')
        .eq('user_id', user.id)
        .single();
        
      if (profileError) throw profileError;
      if (!currentProfile?.voice_pin) throw new Error('No current PIN set');

      // Verify current PIN
      const isValid = await bcrypt.compare(values.current_pin, currentProfile.voice_pin);
      if (!isValid) throw new Error('Current PIN is incorrect');

      // Hash and save new PIN
      const hashedPin = await bcrypt.hash(values.new_pin, 10);
      const { error } = await supabase
        .from('profiles')
        .update({ voice_pin: hashedPin })
        .eq('user_id', user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Voice PIN updated successfully!");
      pinForm.reset();
      setShowPinForm(false);
    },
    onError: (error) => {
      toast.error("Failed to update PIN: " + error.message);
    },
  });

  const onSubmit = (values: ProfileFormValues) => {
    saveMutation.mutate(values);
  };

  const onPinSubmit = (values: PinFormValues) => {
    pinMutation.mutate(values);
  };

  const handleCareGroupChange = (careGroupId: string) => {
    setSelectedCareGroup(careGroupId);
    // PIN is now stored in user profile, not care group, so no need to check group PIN
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <main>
      <SEO
        title="Profile - Update your information"
        description="Manage your profile information and voice authentication settings."
        canonicalPath="/app/profile"
      />
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Profile</h1>
        <p className="text-muted-foreground">Keep your information up to date for your care group.</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Profile Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div>
                <label className="text-sm font-medium">Email</label>
                <Input 
                  value={profile?.user?.email || ""} 
                  readOnly 
                  className="bg-muted text-muted-foreground cursor-not-allowed"
                  placeholder="Email address"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="first_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Name</FormLabel>
                      <FormControl>
                        <Input placeholder="First name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="last_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Last name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <Input placeholder="(555) 555-5555" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address</FormLabel>
                    <FormControl>
                      <Input placeholder="Street address" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>City</FormLabel>
                      <FormControl>
                        <Input placeholder="City" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="state"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>State</FormLabel>
                      <FormControl>
                        <Input placeholder="State" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="zip"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>ZIP Code</FormLabel>
                      <FormControl>
                        <Input placeholder="ZIP code" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Voice PIN Section */}
              <div className="space-y-4 border-t pt-6">
                <h3 className="text-lg font-semibold text-foreground">Voice Authentication</h3>
                <p className="text-sm text-muted-foreground">
                  Set up a 4-digit PIN for voice access. This PIN will work across all your care groups.
                </p>
                
                {!hasPinSet && (
                  <FormField
                    control={form.control}
                    name="voice_pin"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Set Voice PIN</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            type="password" 
                            placeholder="Enter 4-digit PIN"
                            maxLength={4}
                          />
                        </FormControl>
                        <FormDescription>
                          Create a 4-digit PIN for voice authentication across all your care groups
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
                
                {hasPinSet && (
                  <div className="space-y-2">
                    <p className="text-sm text-green-600">✓ Voice PIN is set for all your care groups</p>
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm"
                      onClick={() => setShowPinForm(!showPinForm)}
                    >
                      Change PIN
                    </Button>
                  </div>
                )}
              </div>

              <Button type="submit" disabled={isLoading || saveMutation.isPending}>
                {saveMutation.isPending ? "Saving..." : "Save changes"}
              </Button>
            </form>
          </Form>

          {/* PIN Change Form */}
          {showPinForm && hasPinSet && (
            <Form {...pinForm}>
              <form onSubmit={pinForm.handleSubmit(onPinSubmit)} className="space-y-4">
                <FormField
                  control={pinForm.control}
                  name="current_pin"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Current PIN</FormLabel>
                      <FormControl>
                        <Input {...field} type="password" placeholder="Enter current PIN" maxLength={4} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={pinForm.control}
                  name="new_pin"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>New PIN</FormLabel>
                      <FormControl>
                        <Input {...field} type="password" placeholder="Enter new 4-digit PIN" maxLength={4} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={pinForm.control}
                  name="confirm_pin"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirm New PIN</FormLabel>
                      <FormControl>
                        <Input {...field} type="password" placeholder="Confirm new PIN" maxLength={4} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="flex space-x-2">
                  <Button type="submit" disabled={pinMutation.isPending}>
                    {pinMutation.isPending ? "Updating..." : "Update PIN"}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setShowPinForm(false)}>
                    Cancel
                  </Button>
                </div>
              </form>
            </Form>
          )}
        </CardContent>
      </Card>
    </main>
  );
};

export default ProfilePage;