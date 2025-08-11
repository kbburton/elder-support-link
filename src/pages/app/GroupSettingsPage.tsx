import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import SEO from "@/components/layout/SEO";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

const GroupSchema = z.object({
  name: z.string().min(1, "Name is required"),
  recipient_address: z.string().optional(),
  recipient_city: z.string().optional(),
  recipient_state: z.string().optional(),
  recipient_zip: z.string().optional(),
  recipient_phone: z.string().optional(),
  date_of_birth: z.string().optional(),
  profile_description: z.string().optional(),
});

type GroupFormValues = z.infer<typeof GroupSchema>;

export default function GroupSettingsPage() {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const form = useForm<GroupFormValues>({
    resolver: zodResolver(GroupSchema),
    defaultValues: {
      name: "",
      recipient_address: "",
      recipient_city: "",
      recipient_state: "",
      recipient_zip: "",
      recipient_phone: "",
      date_of_birth: "",
      profile_description: "",
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ["care_group", groupId],
    enabled: !!groupId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("care_groups")
        .select(
          "name, recipient_address, recipient_city, recipient_state, recipient_zip, recipient_phone, date_of_birth, profile_description"
        )
        .eq("id", groupId)
        .single();
      if (error) throw error;
      return data as GroupFormValues;
    },
  });

  useEffect(() => {
    if (data) {
      form.reset({
        name: data.name ?? "",
        recipient_address: data.recipient_address ?? "",
        recipient_city: data.recipient_city ?? "",
        recipient_state: data.recipient_state ?? "",
        recipient_zip: data.recipient_zip ?? "",
        recipient_phone: data.recipient_phone ?? "",
        date_of_birth: data.date_of_birth ?? "",
        profile_description: data.profile_description ?? "",
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
      toast({ title: "Saved", description: "Care group updated successfully." });
    },
    onError: (err: any) => {
      toast({ title: "Update failed", description: err.message ?? "Please try again.", variant: "destructive" });
    },
  });

const deleteMutation = useMutation({
  mutationFn: async () => {
    if (!groupId || groupId === "demo") throw new Error("Cannot delete this group.");
    const { error } = await supabase.from("care_groups").delete().eq("id", groupId);
    if (error) throw error;
  },
  onSuccess: () => {
    toast({ title: "Group deleted", description: "This care group has been removed." });
    navigate("/app/demo/calendar");
  },
  onError: (err: any) => {
    toast({ title: "Delete failed", description: err.message ?? "Please try again.", variant: "destructive" });
  },
});

const onSubmit = (values: GroupFormValues) => saveMutation.mutate(values);

  return (
    <main>
      <SEO
        title="Group Settings - Edit care group"
        description="Update care group information like name, address, phone, and description."
        canonicalPath={typeof window !== "undefined" ? window.location.pathname : "/app/settings"}
      />

      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Group Settings</h1>
        <p className="text-muted-foreground">Edit details for this care group.</p>
      </header>

      <section>
        <Card>
          <CardHeader>
            <CardTitle>Care group details</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
                        <Textarea placeholder="Brief description" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="recipient_address"
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

                  <FormField
                    control={form.control}
                    name="recipient_city"
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
                    name="recipient_state"
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
                    name="recipient_zip"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>ZIP</FormLabel>
                        <FormControl>
                          <Input placeholder="ZIP code" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <CardFooter className="px-0">
                  <Button type="submit" disabled={isLoading || saveMutation.isPending}>
                    {saveMutation.isPending ? "Saving..." : "Save changes"}
                  </Button>
                </CardFooter>
              </form>
            </Form>
          </CardContent>
        </Card>
      </section>

      <section className="mt-8">
        <Card className="border-destructive/30">
          <CardHeader>
            <CardTitle>Danger zone</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">
              Deleting a care group is permanent and cannot be undone.
            </p>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={groupId === "demo" || deleteMutation.isPending}>
                  {deleteMutation.isPending ? "Deleting..." : "Delete this group"}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this care group?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete the group. Appointments, tasks, and documents that reference this group will no longer be accessible from this group.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => deleteMutation.mutate()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Confirm delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
