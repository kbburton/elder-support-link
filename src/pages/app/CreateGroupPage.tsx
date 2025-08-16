import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import SEO from "@/components/layout/SEO";
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
  date_of_birth: z.string().optional(),
  living_situation: z.string().optional(),
  profile_description: z.string().optional(),
  special_dates: z.string().optional(),
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
      date_of_birth: "",
      living_situation: "",
      profile_description: "",
      special_dates: "",
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

      // Double-check authentication
      const { data: authUser } = await supabase.auth.getUser();
      console.log("Auth user from getUser():", authUser.user);
      
      if (!authUser.user) {
        throw new Error("Authentication failed - please log in again");
      }

      // Combine first and last name for group name if not provided
      const groupName = values.name || `${values.recipient_first_name} ${values.recipient_last_name}`;

      const insertData = {
        name: groupName,
        recipient_first_name: values.recipient_first_name,
        recipient_last_name: values.recipient_last_name,
        date_of_birth: values.date_of_birth || null,
        living_situation: values.living_situation || null,
        profile_description: values.profile_description || null,
        special_dates: values.special_dates ? { dates: values.special_dates } : null,
        created_by_user_id: authUser.user.id, // Use the fresh auth user ID
      };
      
      console.log("Inserting care group data:", insertData);

      // Create the care group
      const { data: group, error: groupError } = await supabase
        .from("care_groups")
        .insert(insertData)
        .select()
        .single();

      console.log("Insert result:", { group, groupError });
      if (groupError) throw groupError;

      // Add current user as admin member
      const { error: memberError } = await supabase
        .from("care_group_members")
        .insert({
          group_id: group.id,
          user_id: authUser.user.id, // Use the fresh auth user ID here too
          role: "admin",
          is_admin: true,
        });

      if (memberError) throw memberError;

      return group;
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
                  name="date_of_birth"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date of Birth</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormDescription>Optional</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

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
  );
}