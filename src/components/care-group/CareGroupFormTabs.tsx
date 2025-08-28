import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ProfileImageUpload } from "@/components/profile/ProfileImageUpload";
import { LovedOneHeaderStrip } from "@/components/lovedone/LovedOneHeaderStrip";
import { AllergiesModal } from "@/components/lovedone/AllergiesModal";
import { PreferencesModal } from "@/components/lovedone/PreferencesModal";

const CareGroupSchema = z.object({
  name: z.string().min(1, "Care group name is required"),
  recipient_first_name: z.string().min(1, "First name is required"),
  recipient_last_name: z.string().optional(),
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
  other_important_information: z.string().optional(),
  gender: z.string().optional(),
  profile_picture_url: z.string().optional(),
  relationship_to_recipient: z.string().min(1, "Relationship is required"),
  mobility: z.string().optional(),
  memory: z.string().optional(),
  hearing: z.string().optional(),
  vision: z.string().optional(),
  mental_health: z.string().optional(),
  chronic_conditions: z.string().optional(),
});

type CareGroupFormValues = z.infer<typeof CareGroupSchema>;

interface CareGroupFormTabsProps {
  mode: "onboarding" | "creating" | "editing";
  groupId?: string;
  onSuccess?: (groupId: string) => void;
}

export function CareGroupFormTabs({ mode, groupId, onSuccess }: CareGroupFormTabsProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [allergiesOpen, setAllergiesOpen] = useState(false);
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [joinGroupCode, setJoinGroupCode] = useState("");
  const [joinRelationship, setJoinRelationship] = useState("");
  const [joinLoading, setJoinLoading] = useState(false);

  const form = useForm<CareGroupFormValues>({
    resolver: zodResolver(CareGroupSchema),
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
      other_important_information: "",
      gender: "",
      profile_picture_url: "",
      relationship_to_recipient: "",
      mobility: "",
      memory: "",
      hearing: "",
      vision: "",
      mental_health: "",
      chronic_conditions: "",
    },
  });

  // Fetch existing care group data for editing mode
  const { data: careGroupData, isLoading } = useQuery({
    queryKey: ["care_group", groupId],
    enabled: !!groupId && mode === "editing",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("care_groups")
        .select("*")
        .eq("id", groupId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Fetch current user's relationship for editing mode
  const { data: membershipData } = useQuery({
    queryKey: ["user_membership", groupId],
    enabled: !!groupId && mode === "editing",
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      
      const { data, error } = await supabase
        .from("care_group_members")
        .select("relationship_to_recipient")
        .eq("group_id", groupId)
        .eq("user_id", user.id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  // Fetch living situation options
  const { data: livingSituationOptions } = useQuery({
    queryKey: ["picklist_options", "care_groups_living_situation"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("picklist_options")
        .select("value, label")
        .eq("list_type", "care_groups_living_situation")
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  // Reset form when data is loaded (editing mode)
  useEffect(() => {
    if (careGroupData && membershipData && mode === "editing") {
      form.reset({
        name: careGroupData.name ?? "",
        recipient_first_name: careGroupData.recipient_first_name ?? "",
        recipient_last_name: careGroupData.recipient_last_name ?? "",
        recipient_address: careGroupData.recipient_address ?? "",
        recipient_city: careGroupData.recipient_city ?? "",
        recipient_state: careGroupData.recipient_state ?? "",
        recipient_zip: careGroupData.recipient_zip ?? "",
        recipient_phone: careGroupData.recipient_phone ?? "",
        recipient_email: careGroupData.recipient_email ?? "",
        date_of_birth: careGroupData.date_of_birth ?? "",
        living_situation: careGroupData.living_situation ?? "",
        profile_description: careGroupData.profile_description ?? "",
        other_important_information: careGroupData.other_important_information ?? "",
        gender: careGroupData.gender ?? "",
        profile_picture_url: careGroupData.profile_picture_url ?? "",
        relationship_to_recipient: membershipData.relationship_to_recipient ?? "",
        mobility: careGroupData.mobility ?? "",
        memory: careGroupData.memory ?? "",
        hearing: careGroupData.hearing ?? "",
        vision: careGroupData.vision ?? "",
        mental_health: careGroupData.mental_health ?? "",
        chronic_conditions: careGroupData.chronic_conditions ?? "",
      });
    }
  }, [careGroupData, membershipData, form, mode]);

  // Create/Update mutation
  const saveOrCreateMutation = useMutation({
    mutationFn: async (values: CareGroupFormValues) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { relationship_to_recipient, ...careGroupValues } = values;

      if (mode === "editing" && groupId) {
        // Update existing care group
        const cleanedValues = {
          ...careGroupValues,
          date_of_birth: careGroupValues.date_of_birth || null,
          recipient_email: careGroupValues.recipient_email || null,
          recipient_last_name: careGroupValues.recipient_last_name || null,
          living_situation: careGroupValues.living_situation || null,
          other_important_information: careGroupValues.other_important_information || null,
          gender: careGroupValues.gender || null,
          profile_picture_url: careGroupValues.profile_picture_url || null,
          mobility: careGroupValues.mobility || null,
          memory: careGroupValues.memory || null,
          hearing: careGroupValues.hearing || null,
          vision: careGroupValues.vision || null,
          mental_health: careGroupValues.mental_health || null,
          chronic_conditions: careGroupValues.chronic_conditions || null,
        };

        const { error: groupError } = await supabase
          .from("care_groups")
          .update(cleanedValues)
          .eq("id", groupId);
        if (groupError) throw groupError;

        if (relationship_to_recipient) {
          const { error: memberError } = await supabase
            .from("care_group_members")
            .update({ relationship_to_recipient })
            .eq("group_id", groupId)
            .eq("user_id", user.id);
          if (memberError) throw memberError;
        }

        return groupId;
      } else {
        // Create new care group using the updated RPC function
        const { data: result, error: rpcError } = await supabase.rpc(
          "create_care_group_with_member",
          {
            p_name: careGroupValues.name,
            p_recipient_first_name: careGroupValues.recipient_first_name,
            p_recipient_address: careGroupValues.recipient_address,
            p_recipient_city: careGroupValues.recipient_city,
            p_recipient_state: careGroupValues.recipient_state,
            p_recipient_zip: careGroupValues.recipient_zip,
            p_recipient_phone: careGroupValues.recipient_phone,
            p_recipient_email: careGroupValues.recipient_email,
            p_date_of_birth: careGroupValues.date_of_birth,
            p_relationship_to_recipient: relationship_to_recipient,
            // Optional parameters
            p_recipient_last_name: careGroupValues.recipient_last_name || null,
            p_living_situation: careGroupValues.living_situation || null,
            p_profile_description: careGroupValues.profile_description || null,
            p_special_dates: null,
            p_gender: careGroupValues.gender || null,
            p_other_important_information: careGroupValues.other_important_information || null,
            p_mobility: careGroupValues.mobility || null,
            p_memory: careGroupValues.memory || null,
            p_hearing: careGroupValues.hearing || null,
            p_vision: careGroupValues.vision || null,
            p_mental_health: careGroupValues.mental_health || null,
            p_chronic_conditions: careGroupValues.chronic_conditions || null
          }
        );

        if (rpcError || !result?.[0]?.success) {
          throw new Error(result?.[0]?.error_message || rpcError?.message || "Failed to create group");
        }

        const newGroupId = result[0].group_id;
        return newGroupId;
      }
    },
    onSuccess: (resultGroupId) => {
      if (mode === "editing") {
        queryClient.invalidateQueries({ queryKey: ["care_group", groupId] });
        queryClient.invalidateQueries({ queryKey: ["care_group_header", groupId] });
        queryClient.invalidateQueries({ queryKey: ["care_group_name", groupId] });
        queryClient.invalidateQueries({ queryKey: ["user_membership", groupId] });
        toast({
          title: "Saved",
          description: "Care recipient information updated successfully.",
        });
      } else {
        toast({
          title: "Care group created",
          description: "Successfully created your care group.",
        });
        onSuccess?.(resultGroupId);
      }
    },
    onError: (err: any) => {
      toast({
        title: mode === "editing" ? "Update failed" : "Failed to create group",
        description: err.message ?? "Please try again.",
        variant: "destructive",
      });
    },
  });

  // Join group mutation
  const handleJoinGroup = async () => {
    if (!joinGroupCode.trim() || !joinRelationship) {
      toast({ 
        title: "Missing information", 
        description: !joinGroupCode.trim() ? "Please enter a group ID." : "Please select your relationship." 
      });
      return;
    }

    try {
      setJoinLoading(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Look up the group by ID
      const { data: group, error: groupError } = await supabase
        .from("care_groups")
        .select("id")
        .eq("id", joinGroupCode.trim())
        .single();

      if (groupError || !group) {
        toast({ title: "Group not found", description: "Invalid group ID." });
        return;
      }

      // Check if user is already a member
      const { data: existingMember } = await supabase
        .from("care_group_members")
        .select("id")
        .eq("group_id", group.id)
        .eq("user_id", user.id)
        .single();

      if (existingMember) {
        toast({ title: "Already a member", description: "You're already part of this care group." });
        onSuccess?.(group.id);
        return;
      }

      // Add user as member
      const { error: memberError } = await supabase
        .from("care_group_members")
        .insert({
          group_id: group.id,
          user_id: user.id,
          role: "member",
          relationship_to_recipient: joinRelationship
        });

      if (memberError) throw memberError;

      toast({ title: "Joined care group", description: "Successfully joined the care group." });
      onSuccess?.(group.id);
    } catch (err: any) {
      toast({
        title: "Failed to join group",
        description: err?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setJoinLoading(false);
    }
  };

  const onSubmit = (values: CareGroupFormValues) => saveOrCreateMutation.mutate(values);

  const showTabs = mode === "onboarding" || mode === "creating";
  const showAllergiesPreferences = mode === "editing";

  return (
    <div className="space-y-6">
      {showAllergiesPreferences && (
        <LovedOneHeaderStrip
          careRecipientId={groupId ?? ""}
          onOpenAllergies={() => setAllergiesOpen(true)}
          onOpenPreferences={() => setPreferencesOpen(true)}
        />
      )}

      {showTabs ? (
        <Tabs defaultValue="create" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="create">Create Care Group</TabsTrigger>
            <TabsTrigger value="join">Join Existing Group</TabsTrigger>
          </TabsList>
          
          <TabsContent value="create">
            <CareGroupFormCard 
              form={form}
              onSubmit={onSubmit}
              isLoading={saveOrCreateMutation.isPending || isLoading}
              livingSituationOptions={livingSituationOptions}
              careGroupData={careGroupData}
              mode={mode}
            />
          </TabsContent>
          
          <TabsContent value="join">
            <Card>
              <CardHeader>
                <CardTitle>Join an existing care group</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Group ID</label>
                  <Input
                    value={joinGroupCode}
                    onChange={(e) => setJoinGroupCode(e.target.value)}
                    placeholder="Enter group ID"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Your relationship to care recipient</label>
                  <Select value={joinRelationship} onValueChange={setJoinRelationship}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select relationship" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="spouse">Spouse</SelectItem>
                      <SelectItem value="child">Child</SelectItem>
                      <SelectItem value="other_relative">Other relative</SelectItem>
                      <SelectItem value="friend">Friend</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
              <CardFooter>
                <Button 
                  onClick={handleJoinGroup}
                  disabled={joinLoading}
                >
                  {joinLoading ? "Joining..." : "Join Care Group"}
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>
        </Tabs>
      ) : (
        <CareGroupFormCard 
          form={form}
          onSubmit={onSubmit}
          isLoading={saveOrCreateMutation.isPending || isLoading}
          livingSituationOptions={livingSituationOptions}
          careGroupData={careGroupData}
          mode={mode}
          groupId={groupId}
        />
      )}

      {/* Modals for allergies and preferences (editing mode only) */}
      {showAllergiesPreferences && (
        <>
          <AllergiesModal
            careRecipientId={groupId ?? ""}
            isOpen={allergiesOpen}
            onClose={() => setAllergiesOpen(false)}
          />
          <PreferencesModal
            careRecipientId={groupId ?? ""}
            isOpen={preferencesOpen}
            onClose={() => setPreferencesOpen(false)}
          />
        </>
      )}
    </div>
  );
}

interface CareGroupFormCardProps {
  form: any;
  onSubmit: (values: CareGroupFormValues) => void;
  isLoading: boolean;
  livingSituationOptions?: Array<{ value: string; label: string }>;
  careGroupData?: any;
  mode: "onboarding" | "creating" | "editing";
  groupId?: string;
}

function CareGroupFormCard({ 
  form, 
  onSubmit, 
  isLoading, 
  livingSituationOptions, 
  careGroupData, 
  mode,
  groupId 
}: CareGroupFormCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {mode === "editing" ? "Care recipient details" : "Create a new care group"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Profile Picture, Gender, and Relationship Section */}
            <div className="flex gap-6 mb-6 p-4 bg-muted/20 rounded-lg">
              <div className="flex flex-col">
                <FormLabel className="text-base font-medium mb-4 block">
                  Profile Picture
                </FormLabel>
                <div className="flex items-center justify-start">
                  <ProfileImageUpload
                    currentImageUrl={careGroupData?.profile_picture_url}
                    gender={careGroupData?.gender}
                    recipientName={careGroupData?.name}
                    groupId={groupId || ""}
                    onImageChange={(url) => {
                      form.setValue("profile_picture_url", url || "");
                    }}
                  />
                </div>
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
                          <SelectTrigger className="h-10">
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

              <div className="flex-1 max-w-xs">
                <FormField
                  control={form.control}
                  name="relationship_to_recipient"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Your relationship to care recipient *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="h-10">
                            <SelectValue placeholder="Select relationship" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="spouse">Spouse</SelectItem>
                          <SelectItem value="child">Child</SelectItem>
                          <SelectItem value="other_relative">Other relative</SelectItem>
                          <SelectItem value="friend">Friend</SelectItem>
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
                  <FormLabel>Care Group name *</FormLabel>
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
                    <FormLabel>First Name *</FormLabel>
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
                    <FormLabel>Phone *</FormLabel>
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
                    <FormLabel>Email *</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="example@email.com"
                        {...field}
                      />
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
                    <FormLabel>Date of birth *</FormLabel>
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
              name="living_situation"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Living situation</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select living situation (optional)" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {livingSituationOptions?.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

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

            {/* Health Notes Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="mobility"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mobility notes</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Mobility information"
                        className="resize-none"
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="memory"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Memory notes</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Memory information"
                        className="resize-none"
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="hearing"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Hearing notes</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Hearing information"
                        className="resize-none"
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="vision"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vision notes</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Vision information"
                        className="resize-none"
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="mental_health"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mental health notes</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Mental health information"
                        className="resize-none"
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="chronic_conditions"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Chronic conditions notes</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Chronic conditions information"
                        className="resize-none"
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <FormField
                control={form.control}
                name="recipient_address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address *</FormLabel>
                    <FormControl>
                      <Input placeholder="123 Main Street" {...field} />
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
                    <FormLabel>City *</FormLabel>
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
                    <FormLabel>State *</FormLabel>
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
                    <FormLabel>ZIP *</FormLabel>
                    <FormControl>
                      <Input placeholder="12345" {...field} />
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
          disabled={isLoading}
        >
          {isLoading 
            ? (mode === "editing" ? "Saving..." : "Creating...") 
            : (mode === "editing" ? "Save changes" : "Create Care Group")
          }
        </Button>
      </CardFooter>
    </Card>
  );
}