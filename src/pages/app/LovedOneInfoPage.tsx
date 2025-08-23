import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import SEO from "@/components/layout/SEO";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ProfileImageUpload } from "@/components/profile/ProfileImageUpload";

const GroupSchema = z.object({
  name: z.string().min(1, "Name is required"),
  recipient_first_name: z.string().optional(),
  recipient_last_name: z.string().optional(),
  recipient_address: z.string().optional(),
  recipient_city: z.string().optional(),
  recipient_state: z.string().optional(),
  recipient_zip: z.string().optional(),
  recipient_phone: z.string().optional(),
  recipient_email: z.string().email("Invalid email address").optional().or(z.literal("")),
  date_of_birth: z.string().optional(),
  profile_description: z.string().optional(),
  other_important_information: z.string().optional(),
  gender: z.string().optional(),
  profile_picture_url: z.string().optional(),
});

type GroupFormValues = z.infer<typeof GroupSchema>;

export default function LovedOneInfoPage() {
  const { groupId } = useParams();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  console.log('LovedOneInfoPage - Component loaded, groupId:', groupId);

  const form = useForm<GroupFormValues>({
    resolver: zodResolver(GroupSchema),
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
      profile_description: "",
      other_important_information: "",
      gender: "",
      profile_picture_url: "",
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ["care_group", groupId],
    enabled: !!groupId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("care_groups")
        .select("*")
        .eq("id", groupId)
        .maybeSingle();
      if (error) throw error;
      return data as GroupFormValues;
    },
  });

  useEffect(() => {
    if (data) {
      form.reset({
        name: data.name ?? "",
        recipient_first_name: data.recipient_first_name ?? "",
        recipient_last_name: data.recipient_last_name ?? "",
        recipient_address: data.recipient_address ?? "",
        recipient_city: data.recipient_city ?? "",
        recipient_state: data.recipient_state ?? "",
        recipient_zip: data.recipient_zip ?? "",
        recipient_phone: data.recipient_phone ?? "",
        recipient_email: data.recipient_email ?? "",
        date_of_birth: data.date_of_birth ?? "",
        profile_description: data.profile_description ?? "",
        other_important_information: data.other_important_information ?? "",
        gender: data.gender ?? "",
        profile_picture_url: data.profile_picture_url ?? "",
      });
    }
  }, [data, form]);

  const saveMutation = useMutation({
    mutationFn: async (values: GroupFormValues) => {
      if (!groupId) throw new Error("Missing group id");
      const { error } = await supabase
        .from("care_groups")
        .update(values)
        .eq("id", groupId);
      if (error) throw error;
    },
    onSuccess: () => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ["care_group", groupId] });
      queryClient.invalidateQueries({ queryKey: ["care_group_header", groupId] });
      queryClient.invalidateQueries({ queryKey: ["care_group_name", groupId] });
      
      toast({ title: "Saved", description: "Care recipient information updated successfully." });
    },
    onError: (err: any) => {
      toast({ title: "Update failed", description: err.message ?? "Please try again.", variant: "destructive" });
    },
  });

  const onSubmit = (values: GroupFormValues) => saveMutation.mutate(values);

  // Get the first name from the care group name for the page title
  const firstName = data?.name?.split(' ')[0] || 'Loved One';

  return (
    <main>
      <SEO
        title={`${firstName} Info - Care recipient details`}
        description="View and update care recipient information including personal details, contact info, and important notes."
        canonicalPath={typeof window !== "undefined" ? window.location.pathname : "/app/loved-one-info"}
      />

      <header className="mb-6">
        <h1 className="text-2xl font-semibold">{firstName} Info</h1>
        <p className="text-muted-foreground">Care recipient information and details.</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Care recipient details</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Profile Picture and Gender Section */}
              <div className="flex items-start gap-6 mb-6 p-4 bg-muted/20 rounded-lg">
                <div>
                  <FormLabel className="text-base font-medium mb-2 block">Profile Picture</FormLabel>
                  <ProfileImageUpload
                    currentImageUrl={data?.profile_picture_url}
                    gender={data?.gender}
                    recipientName={data?.name}
                    groupId={groupId!}
                    onImageChange={(url) => {
                      form.setValue('profile_picture_url', url || '');
                    }}
                  />
                </div>
                
                <div className="flex-1 max-w-xs">
                  <FormField
                    control={form.control}
                    name="gender"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Gender</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select gender (optional)" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="male">Male</SelectItem>
                            <SelectItem value="female">Female</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Care recipient name</FormLabel>
                    <FormControl>
                      <Input placeholder="Name" {...field} />
                    </FormControl>
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
                  name="recipient_last_name"
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

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="recipient_phone"
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
                  name="recipient_email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="example@email.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="date_of_birth"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date of birth</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
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
                    <FormLabel>Profile description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Brief description"
                        className="resize-none"
                        rows={4}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="other_important_information"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Other important information</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Anything else we should know"
                        className="resize-none"
                        rows={4}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <FormField
                  control={form.control}
                  name="recipient_address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Address</FormLabel>
                      <FormControl>
                        <Input placeholder="620 East Highland" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="recipient_city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>City</FormLabel>
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
                      <FormLabel>State</FormLabel>
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
                      <FormLabel>ZIP</FormLabel>
                      <FormControl>
                        <Input placeholder="92374" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </form>
          </Form>
        </CardContent>
        <CardFooter>
          <Button 
            onClick={form.handleSubmit(onSubmit)} 
            disabled={saveMutation.isPending || isLoading}
          >
            {saveMutation.isPending ? "Saving..." : "Save changes"}
          </Button>
        </CardFooter>
      </Card>
    </main>
  );
}