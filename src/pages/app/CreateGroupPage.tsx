import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import SEO from "@/components/layout/SEO";
import { AuthWrapper } from "@/components/auth/AuthWrapper";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const CreateGroupSchema = z.object({
  name: z.string().min(1, "Group name is required"),
  recipient_first_name: z.string().min(1, "First name is required"),
  recipient_last_name: z.string().min(1, "Last name is required"),
  recipient_address: z.string().min(1, "Address is required"),
  recipient_city: z.string().min(1, "City is required"),
  recipient_state: z.string().min(1, "State is required"),
  recipient_zip: z.string().min(1, "ZIP code is required"),
  recipient_phone: z.string().min(1, "Phone number is required"),
  recipient_email: z
    .string()
    .email("Invalid email address")
    .min(1, "Email is required"),
  date_of_birth: z.string().min(1, "Date of birth is required"),
  living_situation: z.string().optional(),
  profile_description: z.string().optional(),
  special_dates: z.string().optional(),
  relationship_to_recipient: z.string().min(1, "Relationship is required"),
  modules: z.object({
    calendar: z.boolean().default(true),
    tasks: z.boolean().default(true),
    documents: z.boolean().default(true),
    activities: z.boolean().default(true),
    contacts: z.boolean().default(true),
  }).default({
    calendar: true,
    tasks: true,
    documents: true,
    activities: true,
    contacts: true,
  }),
});

type CreateGroupFormValues = z.infer<typeof CreateGroupSchema>;

const livingSituationOptions = [
  "Independent living",
  "Assisted living",
  "Memory care",
  "Skilled nursing",
  "Home with family",
  "Home with caregiver",
  "Other",
];

export default function CreateGroupPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [currentUser, setCurrentUser] = useState<{ id: string; email: string } | null>(null);

  const form = useForm<CreateGroupFormValues>({
    resolver: zodResolver(CreateGroupSchema),
    defaultValues: {
      name: "",
      recipient_first_name: "",
      recipient_last_name: "",
      recipient_address: "",
      recipient_city: "",
      recipient_state: "",
      recipient_zip: "",
      recipient_phone: "",
      recipient_email: "",
      date_of_birth: "",
      living_situation: "",
      profile_description: "",
      special_dates: "",
      relationship_to_recipient: "",
      modules: {
        calendar: true,
        tasks: true,
        documents: true,
        activities: true,
        contacts: true,
      },
    },
  });

  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (auth.user) {
        setCurrentUser({
          id: auth.user.id,
          email: auth.user.email || "",
        });
      }
    };
    getCurrentUser();
  }, []);

  const createGroupMutation = useMutation({
    mutationFn: async (values: CreateGroupFormValues) => {
      console.log("Creating group with currentUser:", currentUser);
      
      if (!currentUser) throw new Error("User not authenticated");

      // Ensure we have a valid session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      console.log("Session check:", { session: !!session, user: session?.user?.id, sessionError });
      
      if (sessionError || !session?.user) {
        throw new Error("Authentication session invalid - please log in again");
      }

      console.log("User ID from session:", session.user.id);
      console.log("Calling secure database function for group creation");

      // Use the secure database function to create the group and membership
      const { data, error } = await supabase.rpc('create_care_group_with_member', {
        p_name: values.name || null,
        p_recipient_first_name: values.recipient_first_name,
        p_recipient_address: values.recipient_address,
        p_recipient_city: values.recipient_city,
        p_recipient_state: values.recipient_state,
        p_recipient_zip: values.recipient_zip,
        p_recipient_phone: values.recipient_phone,
        p_recipient_email: values.recipient_email,
        p_date_of_birth: values.date_of_birth,
        p_relationship_to_recipient: values.relationship_to_recipient,
        // Optional parameters
        p_recipient_last_name: values.recipient_last_name || null,
        p_living_situation: values.living_situation || null,
        p_profile_description: values.profile_description || null,
        p_special_dates: values.special_dates ? { dates: values.special_dates } : null,
      });

      console.log("Database function result:", { data, error });

      if (error) {
        console.error("Database function failed:", error);
        throw new Error(error.message || "Failed to create care group");
      }

      // The function returns an array with one result
      const result = data?.[0];
      if (!result?.success) {
        console.error("Care group creation failed:", result?.error_message);
        throw new Error(result?.error_message || "Failed to create care group");
      }

      console.log("Care group created successfully:", result);

      // Return a group-like object for consistency with the rest of the code
      return {
        id: result.group_id,
        name: result.group_name,
      };
    },
    onSuccess: (group) => {
      // Store the new group as current group in localStorage
      localStorage.setItem('daveassist-current-group', group.id);
      
      toast({ 
        title: "Care group created", 
        description: `"${group.name}" has been created successfully.` 
      });
      
      // Redirect to the new group's calendar
      navigate(`/app/${group.id}/calendar`);
    },
    onError: (err: any) => {
      toast({ 
        title: "Creation failed", 
        description: err.message ?? "Please try again.", 
        variant: "destructive" 
      });
    },
  });

  const onSubmit = (values: CreateGroupFormValues) => {
    createGroupMutation.mutate(values);
  };

  return (
    <AuthWrapper>
      <main className="container max-w-2xl mx-auto py-6">
        <SEO
          title="Create Care Group - DaveAssist"
          description="Create a new care group to coordinate care for your loved one"
          canonicalPath={typeof window !== "undefined" ? window.location.pathname : "/app/groups/new"}
        />

        <header className="mb-6">
          <h1 className="text-2xl font-semibold">Create Care Group</h1>
          <p className="text-muted-foreground">
            Set up a new care group to coordinate care for your loved one
          </p>
        </header>

      <Card>
        <CardHeader>
          <CardTitle>Care Group Details</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Group Name</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="e.g., Mom's Care Team, Johnson Family Care" 
                        {...field} 
                      />
                    </FormControl>
                    <FormDescription>
                      A name to identify this care group
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="recipient_first_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Care Recipient First Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="First name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="recipient_last_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Care Recipient Last Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="Last name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="recipient_phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone Number *</FormLabel>
                      <FormControl>
                        <Input placeholder="(555) 123-4567" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="recipient_email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email Address *</FormLabel>
                      <FormControl>
                        <Input placeholder="email@example.com" type="email" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="recipient_address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address *</FormLabel>
                    <FormControl>
                      <Input placeholder="620 East Highland" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="recipient_city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>City *</FormLabel>
                      <FormControl>
                        <Input placeholder="Redlands" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="recipient_state"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>State *</FormLabel>
                      <FormControl>
                        <Input placeholder="CA" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="recipient_zip"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>ZIP Code *</FormLabel>
                      <FormControl>
                        <Input placeholder="92374" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="date_of_birth"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date of Birth *</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="relationship_to_recipient"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Your Relationship *</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Son, Daughter, Spouse, Friend" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="living_situation"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Living Situation</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select living situation" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {livingSituationOptions.map((option) => (
                            <SelectItem key={option} value={option}>
                              {option}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="profile_description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Profile Description</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Brief description about the care recipient..."
                        className="min-h-[80px]"
                        {...field} 
                      />
                    </FormControl>
                    <FormDescription>
                      Include any important information about the care recipient
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="special_dates"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Special Dates</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="e.g., Anniversary: June 15th, Started medication: Jan 2024..."
                        className="min-h-[60px]"
                        {...field} 
                      />
                    </FormControl>
                    <FormDescription>
                      List any important dates to remember
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-4">
                <FormLabel className="text-base font-medium">
                  Modules to Enable
                </FormLabel>
                <FormDescription>
                  Choose which features to enable for this care group
                </FormDescription>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="modules.calendar"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>Calendar & Appointments</FormLabel>
                          <FormDescription>
                            Schedule and track appointments
                          </FormDescription>
                        </div>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="modules.tasks"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>Tasks</FormLabel>
                          <FormDescription>
                            Manage care tasks and assignments
                          </FormDescription>
                        </div>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="modules.documents"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>Documents</FormLabel>
                          <FormDescription>
                            Store and organize important documents
                          </FormDescription>
                        </div>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="modules.activities"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>Activity Log</FormLabel>
                          <FormDescription>
                            Track daily activities and notes
                          </FormDescription>
                        </div>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="modules.contacts"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>Contacts</FormLabel>
                          <FormDescription>
                            Manage care team and emergency contacts
                          </FormDescription>
                        </div>
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            </form>
          </Form>
        </CardContent>
        <CardFooter className="flex gap-3">
          <Button 
            type="button" 
            variant="outline" 
            onClick={() => navigate(-1)}
            disabled={createGroupMutation.isPending}
          >
            Cancel
          </Button>
          <Button 
            type="submit" 
            onClick={form.handleSubmit(onSubmit)}
            disabled={createGroupMutation.isPending}
          >
            {createGroupMutation.isPending ? "Creating..." : "Create Care Group"}
          </Button>
        </CardFooter>
      </Card>
    </main>
    </AuthWrapper>
  );
}