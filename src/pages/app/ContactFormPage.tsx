import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Save, User, Building2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useSimpleDemoState } from "@/hooks/useSimpleDemoState";

const contactSchema = z.object({
  is_organization: z.boolean().default(false),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  organization_name: z.string().optional(),
  company: z.string().optional(),
  contact_type: z.enum(["medical", "legal", "family", "friend", "other"]),
  gender: z.enum(["female", "male", "x_or_other", "prefer_not_to_say"]).optional().nullable(),
  phone_primary: z.string().optional(),
  phone_secondary: z.string().optional(),
  email_personal: z.string().email().optional().or(z.literal("")),
  email_work: z.string().email().optional().or(z.literal("")),
  address_line1: z.string().optional(),
  address_line2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postal_code: z.string().optional(),
  preferred_contact_method: z.enum(["phone", "email", "none"]).optional().nullable(),
  preferred_contact_start_local: z.string().optional(),
  preferred_contact_end_local: z.string().optional(),
  preferred_contact_start_weekend_local: z.string().optional(),
  preferred_contact_end_weekend_local: z.string().optional(),
  preferred_contact_timezone: z.string().optional(),
  is_emergency_contact: z.boolean().default(false),
  emergency_type: z.enum(["medical", "legal", "religious", "family", "general"]).optional().nullable(),
  emergency_notes: z.string().optional(),
  notes: z.string().optional(),
}).refine((data) => {
  // At least one contact method is required
  return data.phone_primary || data.email_personal || data.email_work;
}, {
  message: "At least one contact method (phone or email) is required",
  path: ["phone_primary"],
}).refine((data) => {
  // Name validation based on organization type
  if (data.is_organization) {
    return data.organization_name?.trim();
  } else {
    return data.first_name?.trim() || data.last_name?.trim();
  }
}, {
  message: "Name is required",
  path: ["first_name"],
});

type ContactFormData = z.infer<typeof contactSchema>;

const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY"
];

const TIMEZONES = [
  "America/New_York",
  "America/Chicago", 
  "America/Denver",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu"
];

export default function ContactFormPage() {
  const { groupId, contactId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<any>(null);
  const { isDemo, blockOperation } = useSimpleDemoState();
  
  const isEditing = !!contactId;

  const form = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      is_organization: false,
      contact_type: "other",
      is_emergency_contact: false,
      preferred_contact_method: "phone",
      preferred_contact_timezone: "America/New_York",
    },
  });

  const isOrganization = form.watch("is_organization");
  const isEmergencyContact = form.watch("is_emergency_contact");

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };
    getUser();

    if (isEditing) {
      loadContact();
    }
  }, [contactId, isEditing]);

  const loadContact = async () => {
    if (!contactId) return;
    
    try {
      const { data, error } = await supabase
        .from("contacts")
        .select("*")
        .eq("id", contactId)
        .single();

      if (error) throw error;

      // Transform the data to match form structure
      const formData: ContactFormData = {
        is_organization: !!data.organization_name,
        first_name: data.first_name || "",
        last_name: data.last_name || "",
        organization_name: data.organization_name || "",
        company: data.company || "",
        contact_type: data.contact_type as any,
        gender: data.gender as any,
        phone_primary: data.phone_primary || "",
        phone_secondary: data.phone_secondary || "",
        email_personal: data.email_personal || "",
        email_work: data.email_work || "",
        address_line1: data.address_line1 || "",
        address_line2: data.address_line2 || "",
        city: data.city || "",
        state: data.state || "",
        postal_code: data.postal_code || "",
        preferred_contact_method: data.preferred_contact_method as any,
        preferred_contact_start_local: data.preferred_contact_start_local || "",
        preferred_contact_end_local: data.preferred_contact_end_local || "",
        preferred_contact_start_weekend_local: data.preferred_contact_start_weekend_local || "",
        preferred_contact_end_weekend_local: data.preferred_contact_end_weekend_local || "",
        preferred_contact_timezone: data.preferred_contact_timezone || "America/New_York",
        is_emergency_contact: data.is_emergency_contact,
        emergency_type: data.emergency_type as any,
        emergency_notes: data.emergency_notes || "",
        notes: data.notes || "",
      };

      form.reset(formData);
    } catch (error) {
      console.error("Error loading contact:", error);
      toast({
        title: "Error",
        description: "Failed to load contact details",
        variant: "destructive",
      });
      navigate(`/app/${groupId}/contacts`);
    }
  };

  const onSubmit = async (data: ContactFormData) => {
    if (!user || !groupId) return;
    
    if (blockOperation()) {
      toast({
        title: "Demo Mode",
        description: "Cannot save contact in demo mode. This is read-only.",
        variant: "default"
      });
      return;
    }
    
    setLoading(true);
    try {
      const contactData = {
        care_group_id: groupId,
        first_name: data.is_organization ? null : (data.first_name || null),
        last_name: data.is_organization ? null : (data.last_name || null),
        organization_name: data.is_organization ? (data.organization_name || null) : null,
        company: data.is_organization ? null : (data.company || null),
        contact_type: data.contact_type,
        gender: data.is_organization ? null : (data.gender || null),
        phone_primary: data.phone_primary || null,
        phone_secondary: data.phone_secondary || null,
        email_personal: data.email_personal || null,
        email_work: data.email_work || null,
        address_line1: data.address_line1 || null,
        address_line2: data.address_line2 || null,
        city: data.city || null,
        state: data.state || null,
        postal_code: data.postal_code || null,
        preferred_contact_method: data.preferred_contact_method || null,
        preferred_contact_start_local: data.preferred_contact_start_local || null,
        preferred_contact_end_local: data.preferred_contact_end_local || null,
        preferred_contact_start_weekend_local: data.preferred_contact_start_weekend_local || null,
        preferred_contact_end_weekend_local: data.preferred_contact_end_weekend_local || null,
        preferred_contact_timezone: data.preferred_contact_timezone || null,
        is_emergency_contact: data.is_emergency_contact,
        emergency_type: data.is_emergency_contact ? (data.emergency_type || null) : null,
        emergency_notes: data.is_emergency_contact ? (data.emergency_notes || null) : null,
        notes: data.notes || null,
        created_by_user_id: user.id,
      };

      if (isEditing) {
        const { error } = await supabase
          .from("contacts")
          .update(contactData)
          .eq("id", contactId);

        if (error) throw error;

        toast({
          title: "Success",
          description: "Contact updated successfully",
        });
      } else {
        const { data: newContact, error } = await supabase
          .from("contacts")
          .insert(contactData)
          .select()
          .single();

        if (error) throw error;

        toast({
          title: "Success",
          description: "Contact created successfully",
        });

        navigate(`/app/${groupId}/contacts/${newContact.id}`);
        return;
      }

      navigate(`/app/${groupId}/contacts/${contactId}`);
    } catch (error: any) {
      console.error("Error saving contact:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to save contact",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center space-x-4">
        <Button variant="ghost" size="sm" asChild>
          <Link to={isEditing ? `/app/${groupId}/contacts/${contactId}` : `/app/${groupId}/contacts`}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold">
          {isEditing ? "Edit Contact" : "Add New Contact"}
        </h1>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Contact Type</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="is_organization"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="flex items-center space-x-2">
                        {field.value ? <Building2 className="h-4 w-4" /> : <User className="h-4 w-4" />}
                        <span>{field.value ? "Organization" : "Person"}</span>
                      </FormLabel>
                      <p className="text-sm text-muted-foreground">
                        {field.value ? "This is an organization or business" : "This is an individual person"}
                      </p>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Tabs defaultValue="basic" className="space-y-6">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="basic">Basic Info</TabsTrigger>
              <TabsTrigger value="contact">Contact Details</TabsTrigger>
              <TabsTrigger value="preferences">Preferences</TabsTrigger>
              <TabsTrigger value="emergency">Emergency</TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Basic Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {isOrganization ? (
                    <FormField
                      control={form.control}
                      name="organization_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Organization Name *</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter organization name" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  ) : (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="first_name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>First Name *</FormLabel>
                              <FormControl>
                                <Input placeholder="Enter first name" {...field} />
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
                                <Input placeholder="Enter last name" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <FormField
                        control={form.control}
                        name="company"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Company</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter company name" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="contact_type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Contact Type *</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select contact type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="medical">Medical</SelectItem>
                              <SelectItem value="legal">Legal</SelectItem>
                              <SelectItem value="family">Family</SelectItem>
                              <SelectItem value="friend">Friend</SelectItem>
                              <SelectItem value="other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {!isOrganization && (
                      <FormField
                        control={form.control}
                        name="gender"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Gender</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value || ""}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select gender" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="female">Female</SelectItem>
                                <SelectItem value="male">Male</SelectItem>
                                <SelectItem value="x_or_other">X or Other</SelectItem>
                                <SelectItem value="prefer_not_to_say">Prefer not to say</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Address (US Only)</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="address_line1"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Address Line 1</FormLabel>
                        <FormControl>
                          <Input placeholder="Street address" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="address_line2"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Address Line 2</FormLabel>
                        <FormControl>
                          <Input placeholder="Apartment, suite, etc." {...field} />
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
                          <Select onValueChange={field.onChange} defaultValue={field.value || ""}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="State" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {US_STATES.map((state) => (
                                <SelectItem key={state} value={state}>
                                  {state}
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
                      name="postal_code"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>ZIP Code</FormLabel>
                          <FormControl>
                            <Input placeholder="ZIP Code" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                     />
                   </div>
                 </CardContent>
               </Card>

               <Card>
                 <CardHeader>
                   <CardTitle>Notes</CardTitle>
                 </CardHeader>
                 <CardContent>
                   <FormField
                     control={form.control}
                     name="notes"
                     render={({ field }) => (
                       <FormItem>
                         <FormLabel>General Notes</FormLabel>
                         <FormControl>
                           <Textarea 
                             placeholder="Additional notes about this contact..."
                             rows={4}
                             {...field}
                           />
                         </FormControl>
                         <FormMessage />
                       </FormItem>
                     )}
                   />
                 </CardContent>
               </Card>
             </TabsContent>

            <TabsContent value="contact" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Contact Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="phone_primary"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Primary Phone *</FormLabel>
                          <FormControl>
                            <Input placeholder="(555) 123-4567" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="phone_secondary"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Secondary Phone</FormLabel>
                          <FormControl>
                            <Input placeholder="(555) 123-4567" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="email_personal"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Personal Email *</FormLabel>
                          <FormControl>
                            <Input type="email" placeholder="personal@example.com" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="email_work"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Work Email</FormLabel>
                          <FormControl>
                            <Input type="email" placeholder="work@company.com" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="preferred_contact_method"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Preferred Contact Method</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value || ""}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select preferred method" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="phone">Phone</SelectItem>
                            <SelectItem value="email">Email</SelectItem>
                            <SelectItem value="none">No preference</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="preferences" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Contact Preferences</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="preferred_contact_start_local"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Weekday Start Time</FormLabel>
                          <FormControl>
                            <Input type="time" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="preferred_contact_end_local"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Weekday End Time</FormLabel>
                          <FormControl>
                            <Input type="time" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="preferred_contact_start_weekend_local"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Weekend Start Time</FormLabel>
                          <FormControl>
                            <Input type="time" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="preferred_contact_end_weekend_local"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Weekend End Time</FormLabel>
                          <FormControl>
                            <Input type="time" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="preferred_contact_timezone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Timezone</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value || ""}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select timezone" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {TIMEZONES.map((tz) => (
                              <SelectItem key={tz} value={tz}>
                                {tz.replace("America/", "").replace("Pacific/", "").replace("_", " ")}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="emergency" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Emergency Contact</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="is_emergency_contact"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel>Emergency Contact</FormLabel>
                          <p className="text-sm text-muted-foreground">
                            Mark this person as an emergency contact
                          </p>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  {isEmergencyContact && (
                    <>
                      <FormField
                        control={form.control}
                        name="emergency_type"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Emergency Type</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value || ""}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select emergency type" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="medical">Medical</SelectItem>
                                <SelectItem value="legal">Legal</SelectItem>
                                <SelectItem value="religious">Religious</SelectItem>
                                <SelectItem value="family">Family</SelectItem>
                                <SelectItem value="general">General</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="emergency_notes"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Emergency Notes</FormLabel>
                            <FormControl>
                              <Textarea 
                                placeholder="Important emergency information..."
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      </>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
          </Tabs>

          <div className="flex justify-end space-x-4">
            <Button type="button" variant="outline" asChild>
              <Link to={isEditing ? `/app/${groupId}/contacts/${contactId}` : `/app/${groupId}/contacts`}>
                Cancel
              </Link>
            </Button>
            <Button 
              type="submit" 
              disabled={loading || isDemo}
              className={isDemo ? "opacity-50 cursor-not-allowed" : ""}
            >
              <Save className="h-4 w-4 mr-2" />
              {loading ? "Saving..." : isEditing ? "Update Contact" : "Create Contact"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}