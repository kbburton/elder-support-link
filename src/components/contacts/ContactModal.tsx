import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building2, User, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useSimpleDemoState } from "@/hooks/useSimpleDemoState";
import { UnifiedAssociationManager } from "@/components/shared/UnifiedAssociationManager";
import { ENTITY } from "@/constants/entities";
import { softDeleteEntity } from "@/lib/delete/rpc";

const contactSchema = z.object({
  is_organization: z.boolean().default(false),
  title: z.string().optional(),
  first_name: z.string().min(1, "First name is required"),
  last_name: z.string().optional(),
  organization_name: z.string().optional(),
  company: z.string().optional(),
  contact_type: z.enum(["medical", "legal", "family", "friend", "other"], {
    required_error: "Contact type is required"
  }),
  gender: z.enum(["female", "male", "x_or_other", "prefer_not_to_say"]).optional().nullable(),
  phone_primary: z.string().min(1, "Primary phone is required"),
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
  // Organization validation
  if (data.is_organization) {
    return data.organization_name?.trim();
  }
  return true;
}, {
  message: "Organization name is required",
  path: ["organization_name"],
});

type ContactFormData = z.infer<typeof contactSchema>;

interface Contact {
  id: string;
  title?: string;
  first_name?: string;
  last_name?: string;
  organization_name?: string;
  company?: string;
  contact_type: string;
  gender?: string;
  phone_primary?: string;
  phone_secondary?: string;
  email_personal?: string;
  email_work?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  preferred_contact_method?: string;
  preferred_contact_start_local?: string;
  preferred_contact_end_local?: string;
  preferred_contact_start_weekend_local?: string;
  preferred_contact_end_weekend_local?: string;
  preferred_contact_timezone?: string;
  is_emergency_contact: boolean;
  emergency_type?: string;
  emergency_notes?: string;
  notes?: string;
}

interface ContactModalProps {
  contact: Contact | null;
  isOpen: boolean;
  onClose: () => void;
  groupId: string;
}

const TITLE_OPTIONS = [
  { value: "dr", label: "Dr." },
  { value: "mr", label: "Mr." },
  { value: "mrs", label: "Mrs." },
  { value: "ms", label: "Ms." },
  { value: "prof", label: "Prof." },
  { value: "rev", label: "Rev." },
  { value: "other", label: "Other" },
];

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

export function ContactModal({ contact, isOpen, onClose, groupId }: ContactModalProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [user, setUser] = useState<any>(null);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isDemo, blockOperation } = useSimpleDemoState();
  
  const isEditing = !!contact;

  const form = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      is_organization: false,
      title: "",
      first_name: "",
      last_name: "",
      organization_name: "",
      company: "",
      contact_type: "other",
      gender: undefined,
      phone_primary: "",
      phone_secondary: "",
      email_personal: "",
      email_work: "",
      address_line1: "",
      address_line2: "",
      city: "",
      state: "",
      postal_code: "",
      preferred_contact_method: "phone",
      preferred_contact_start_local: "",
      preferred_contact_end_local: "",
      preferred_contact_start_weekend_local: "",
      preferred_contact_end_weekend_local: "",
      preferred_contact_timezone: "America/New_York",
      is_emergency_contact: false,
      emergency_type: undefined,
      emergency_notes: "",
      notes: "",
    },
  });

  const isOrganization = form.watch("is_organization");
  const isEmergencyContact = form.watch("is_emergency_contact");
  const selectedTitle = form.watch("title");

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };
    getUser();
  }, []);

  // Reset form when modal opens/closes or contact changes
  useEffect(() => {
    if (isOpen) {
      if (contact) {
        const formData: ContactFormData = {
          is_organization: !!contact.organization_name,
          title: contact.title || "",
          first_name: contact.first_name || "",
          last_name: contact.last_name || "",
          organization_name: contact.organization_name || "",
          company: contact.company || "",
          contact_type: contact.contact_type as any,
          gender: contact.gender as any,
          phone_primary: contact.phone_primary || "",
          phone_secondary: contact.phone_secondary || "",
          email_personal: contact.email_personal || "",
          email_work: contact.email_work || "",
          address_line1: contact.address_line1 || "",
          address_line2: contact.address_line2 || "",
          city: contact.city || "",
          state: contact.state || "",
          postal_code: contact.postal_code || "",
          preferred_contact_method: contact.preferred_contact_method as any,
          preferred_contact_start_local: contact.preferred_contact_start_local || "",
          preferred_contact_end_local: contact.preferred_contact_end_local || "",
          preferred_contact_start_weekend_local: contact.preferred_contact_start_weekend_local || "",
          preferred_contact_end_weekend_local: contact.preferred_contact_end_weekend_local || "",
          preferred_contact_timezone: contact.preferred_contact_timezone || "America/New_York",
          is_emergency_contact: contact.is_emergency_contact,
          emergency_type: contact.emergency_type as any,
          emergency_notes: contact.emergency_notes || "",
          notes: contact.notes || "",
        };
        form.reset(formData);
      } else {
        // Reset to completely blank form for new contacts
        form.reset({
          is_organization: false,
          title: "",
          first_name: "",
          last_name: "",
          organization_name: "",
          company: "",
          contact_type: "other",
          gender: undefined,
          phone_primary: "",
          phone_secondary: "",
          email_personal: "",
          email_work: "",
          address_line1: "",
          address_line2: "",
          city: "",
          state: "",
          postal_code: "",
          preferred_contact_method: "phone",
          preferred_contact_start_local: "",
          preferred_contact_end_local: "",
          preferred_contact_start_weekend_local: "",
          preferred_contact_end_weekend_local: "",
          preferred_contact_timezone: "America/New_York",
          is_emergency_contact: false,
          emergency_type: undefined,
          emergency_notes: "",
          notes: "",
        });
      }
    }
  }, [contact, isOpen, form]);

  const createContact = useMutation({
    mutationFn: async (data: ContactFormData) => {
      if (!user || !groupId) throw new Error("Not authenticated or no group");

      // Get the final title value - no more custom title support
      const finalTitle = data.title || null;

      const contactData = {
        care_group_id: groupId,
        title: finalTitle || null,
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

      const { data: newContact, error } = await supabase
        .from("contacts")
        .insert(contactData)
        .select()
        .single();

      if (error) throw error;
      return newContact;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      toast({
        title: "Contact created",
        description: "Contact has been created successfully.",
      });
      onClose();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create contact.",
        variant: "destructive",
      });
    },
  });

  const updateContact = useMutation({
    mutationFn: async (data: ContactFormData) => {
      if (!contact) throw new Error("No contact to update");

      // Get the final title value - no more custom title support
      const finalTitle = data.title || null;

      const contactData = {
        title: finalTitle || null,
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
      };

      const { error } = await supabase
        .from("contacts")
        .update(contactData)
        .eq("id", contact.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      toast({
        title: "Contact updated",
        description: "Contact has been updated successfully.",
      });
      onClose();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update contact.",
        variant: "destructive",
      });
    },
  });

  const deleteContact = useMutation({
    mutationFn: async () => {
      if (!contact) throw new Error("No contact to delete");
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      await softDeleteEntity("contact", contact.id, user.id, user.email || "");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      toast({
        title: "Contact deleted",
        description: "Contact has been moved to trash and can be restored within 30 days.",
      });
      onClose();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete contact.",
        variant: "destructive",
      });
    },
  });

  const validateRequiredFields = (data: ContactFormData): string[] => {
    const errors: string[] = [];
    
    if (!data.first_name?.trim() && !data.is_organization) {
      errors.push("First name is required");
    }
    
    if (!data.organization_name?.trim() && data.is_organization) {
      errors.push("Organization name is required");
    }
    
    if (!data.contact_type) {
      errors.push("Contact type is required");
    }
    
    if (!data.phone_primary?.trim()) {
      errors.push("Primary phone is required");
    }
    
    return errors;
  };

  const handleSubmit = (data: ContactFormData) => {
    if (blockOperation()) return;

    // Custom validation for required fields
    const errors = validateRequiredFields(data);
    if (errors.length > 0) {
      setValidationErrors(errors);
      setShowValidationModal(true);
      return;
    }

    if (contact) {
      updateContact.mutate(data);
    } else {
      createContact.mutate(data);
    }
  };

  const handleDelete = () => {
    if (blockOperation()) return;
    setShowDeleteConfirm(true);
  };

  const confirmDelete = () => {
    deleteContact.mutate();
    setShowDeleteConfirm(false);
  };

  const handleNavigate = (type: string, id: string) => {
    const baseUrl = `/app/${groupId}`;
    let url = '';
    
    switch (type) {
      case ENTITY.appointment:
        url = `${baseUrl}/calendar`;
        break;
      case ENTITY.task:
        url = `${baseUrl}/tasks`;
        break;
      case ENTITY.document:
        url = `${baseUrl}/documents`;
        break;
      case ENTITY.activity_log:
        url = `${baseUrl}/activities`;
        break;
      default:
        return;
    }
    
    window.open(url, '_blank');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{contact ? "Edit Contact" : "Add New Contact"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Contact Form */}
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
              {/* Contact Type */}
              <div className="space-y-4">
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
              </div>

              <Tabs defaultValue="basic" className="space-y-6">
                <TabsList className="grid w-full grid-cols-5">
                  <TabsTrigger value="basic">Basic Info</TabsTrigger>
                  <TabsTrigger value="contact">Contact Details</TabsTrigger>
                  <TabsTrigger value="preferences">Preferences</TabsTrigger>
                  <TabsTrigger value="emergency">Emergency</TabsTrigger>
                  <TabsTrigger value="associations">Associations</TabsTrigger>
                </TabsList>

                <TabsContent value="basic" className="space-y-4">
                  <h3 className="text-sm font-medium">Basic Information</h3>
                  
                  {/* Title Field for Persons */}
                  {!isOrganization && (
                    <div className="space-y-4">
                      {/* Combined Title, First Name, Last Name Row */}
                      <div className="grid grid-cols-12 gap-4">
                        <div className="col-span-2">
                          <FormField
                            control={form.control}
                            name="title"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Title</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value || ""}>
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Title" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {TITLE_OPTIONS.map((title) => (
                                      <SelectItem key={title.value} value={title.value}>
                                        {title.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        <div className="col-span-5">
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
                        </div>
                        <div className="col-span-5">
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
                      </div>
                    </div>
                  )}
                  
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
                    // Empty div since name fields are now combined with title above
                    <></>
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

                  {/* Phone Numbers */}
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

                  {/* Organization Name and Company for persons */}
                  {!isOrganization && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="organization_name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Organization Name</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter organization name" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
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
                </TabsContent>

                <TabsContent value="contact" className="space-y-4">
                  <h3 className="text-sm font-medium">Contact Information</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="email_personal"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Personal Email</FormLabel>
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

                  {/* Address */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-medium text-muted-foreground">Address (US Only)</h4>
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
                  </div>

                  {/* Notes */}
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
                </TabsContent>

                <TabsContent value="preferences" className="space-y-4">
                  <h3 className="text-sm font-medium">Contact Preferences</h3>
                  
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
                </TabsContent>

                <TabsContent value="emergency" className="space-y-4">
                  <h3 className="text-sm font-medium">Emergency Contact</h3>
                  
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
                </TabsContent>

                <TabsContent value="associations" className="space-y-4">
                  <h3 className="text-sm font-medium">Associated Items</h3>
                  {contact && (
                    <UnifiedAssociationManager
                      entityId={contact.id}
                      entityType={ENTITY.contact}
                      groupId={groupId}
                      onNavigate={handleNavigate}
                    />
                  )}
                  {!contact && (
                    <p className="text-sm text-muted-foreground">
                      Save the contact first to manage associations.
                    </p>
                  )}
                </TabsContent>
              </Tabs>

              <Separator />

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-3">
                <Button 
                  type="submit" 
                  disabled={createContact.isPending || updateContact.isPending}
                >
                  {createContact.isPending || updateContact.isPending 
                    ? 'Saving...' 
                    : contact 
                      ? 'Update Contact' 
                      : 'Add New Contact'
                  }
                </Button>
                
                {contact && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleDelete}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </Button>
                )}
                
                <Button type="button" variant="outline" onClick={onClose}>
                  Cancel
                </Button>
              </div>
            </form>
          </Form>
        </div>

        {/* Validation Modal */}
        <AlertDialog open={showValidationModal} onOpenChange={setShowValidationModal}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Required Fields Missing</AlertDialogTitle>
              <AlertDialogDescription>
                Please fill in the following required fields before saving:
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="py-4">
              <ul className="list-disc list-inside space-y-1">
                {validationErrors.map((error, index) => (
                  <li key={index} className="text-sm text-destructive">{error}</li>
                ))}
              </ul>
            </div>
            <AlertDialogFooter>
              <AlertDialogAction onClick={() => setShowValidationModal(false)}>
                OK
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Contact</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this contact? It will be moved to trash and can be restored within 30 days.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90">
                Delete Contact
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}