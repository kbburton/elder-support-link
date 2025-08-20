import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { User, Building2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { UnifiedAssociationManager } from "@/components/shared/UnifiedAssociationManager";
import { useDemoOperations } from "@/hooks/useDemoOperations";

interface Contact {
  id: string;
  first_name?: string;
  last_name?: string;
  organization_name?: string;
  company?: string;
  email_personal?: string;
  email_work?: string;
  phone_primary?: string;
  phone_secondary?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  contact_type: 'medical' | 'legal' | 'family' | 'friend' | 'other';
  notes?: string;
}

interface ContactModalProps {
  contact: Contact | null;
  isOpen: boolean;
  onClose: () => void;
  groupId: string;
}

export function ContactModal({ contact, isOpen, onClose, groupId }: ContactModalProps) {
  const [formData, setFormData] = useState({
    is_organization: false,
    first_name: "",
    last_name: "",
    organization_name: "",
    company: "",
    email_personal: "",
    email_work: "",
    phone_primary: "",
    phone_secondary: "",
    address_line1: "",
    address_line2: "",
    city: "",
    state: "",
    postal_code: "",
    contact_type: "other" as Contact['contact_type'],
    notes: "",
  });
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { blockOperation } = useDemoOperations();

  useEffect(() => {
    if (contact) {
      setFormData({
        is_organization: !!contact.organization_name,
        first_name: contact.first_name || "",
        last_name: contact.last_name || "",
        organization_name: contact.organization_name || "",
        company: contact.company || "",
        email_personal: contact.email_personal || "",
        email_work: contact.email_work || "",
        phone_primary: contact.phone_primary || "",
        phone_secondary: contact.phone_secondary || "",
        address_line1: contact.address_line1 || "",
        address_line2: contact.address_line2 || "",
        city: contact.city || "",
        state: contact.state || "",
        postal_code: contact.postal_code || "",
        contact_type: contact.contact_type,
        notes: contact.notes || "",
      });
    } else {
      setFormData({
        is_organization: false,
        first_name: "",
        last_name: "",
        organization_name: "",
        company: "",
        email_personal: "",
        email_work: "",
        phone_primary: "",
        phone_secondary: "",
        address_line1: "",
        address_line2: "",
        city: "",
        state: "",
        postal_code: "",
        contact_type: "other",
        notes: "",
      });
    }
  }, [contact]);

  const createContact = useMutation({
    mutationFn: async (data: any) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const contactData = {
        care_group_id: groupId,
        first_name: data.is_organization ? null : (data.first_name || null),
        last_name: data.is_organization ? null : (data.last_name || null),
        organization_name: data.is_organization ? (data.organization_name || null) : null,
        company: data.is_organization ? null : (data.company || null),
        contact_type: data.contact_type,
        email_personal: data.email_personal || null,
        email_work: data.email_work || null,
        phone_primary: data.phone_primary || null,
        phone_secondary: data.phone_secondary || null,
        address_line1: data.address_line1 || null,
        address_line2: data.address_line2 || null,
        city: data.city || null,
        state: data.state || null,
        postal_code: data.postal_code || null,
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
    mutationFn: async (data: any) => {
      const contactData = {
        first_name: data.is_organization ? null : (data.first_name || null),
        last_name: data.is_organization ? null : (data.last_name || null),
        organization_name: data.is_organization ? (data.organization_name || null) : null,
        company: data.is_organization ? null : (data.company || null),
        contact_type: data.contact_type,
        email_personal: data.email_personal || null,
        email_work: data.email_work || null,
        phone_primary: data.phone_primary || null,
        phone_secondary: data.phone_secondary || null,
        address_line1: data.address_line1 || null,
        address_line2: data.address_line2 || null,
        city: data.city || null,
        state: data.state || null,
        postal_code: data.postal_code || null,
        notes: data.notes || null,
      };

      const { error } = await supabase
        .from("contacts")
        .update(contactData)
        .eq("id", contact!.id);

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (blockOperation()) return;

    if (contact) {
      updateContact.mutate(formData);
    } else {
      createContact.mutate(formData);
    }
  };

  const handleNavigate = (type: string, id: string) => {
    // Navigate to the related item
    const baseUrl = `/app/${groupId}`;
    let url = '';
    
    switch (type) {
      case 'appointment':
        url = `${baseUrl}/appointments`;
        break;
      case 'task':
        url = `${baseUrl}/tasks`;
        break;
      case 'document':
        url = `${baseUrl}/documents`;
        break;
      case 'activity':
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
          <DialogTitle>{contact ? "Edit Contact" : "Create Contact"}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Contact Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Organization/Person Toggle */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium">Contact Type</h3>
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label className="flex items-center space-x-2">
                    {formData.is_organization ? <Building2 className="h-4 w-4" /> : <User className="h-4 w-4" />}
                    <span>{formData.is_organization ? "Organization" : "Person"}</span>
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    {formData.is_organization ? "This is an organization or business" : "This is an individual person"}
                  </p>
                </div>
                <Switch
                  checked={formData.is_organization}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_organization: checked })}
                />
              </div>
            </div>

            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium">Basic Information</h3>
              
              {formData.is_organization ? (
                <div>
                  <Label htmlFor="organization_name">Organization Name *</Label>
                  <Input
                    id="organization_name"
                    value={formData.organization_name}
                    onChange={(e) => setFormData({ ...formData, organization_name: e.target.value })}
                    placeholder="Enter organization name"
                  />
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="first_name">First Name *</Label>
                      <Input
                        id="first_name"
                        value={formData.first_name}
                        onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                        placeholder="Enter first name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="last_name">Last Name</Label>
                      <Input
                        id="last_name"
                        value={formData.last_name}
                        onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                        placeholder="Enter last name"
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="company">Company</Label>
                    <Input
                      id="company"
                      value={formData.company}
                      onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                      placeholder="Enter company name"
                    />
                  </div>
                </div>
              )}

              <div>
                <Label htmlFor="contact_type">Contact Type *</Label>
                <Select
                  value={formData.contact_type}
                  onValueChange={(value) => setFormData({ ...formData, contact_type: value as any })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="medical">Medical</SelectItem>
                    <SelectItem value="legal">Legal</SelectItem>
                    <SelectItem value="family">Family</SelectItem>
                    <SelectItem value="friend">Friend</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator />

            {/* Contact Information */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium">Contact Information</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="email_personal">Personal Email</Label>
                  <Input
                    id="email_personal"
                    type="email"
                    value={formData.email_personal}
                    onChange={(e) => setFormData({ ...formData, email_personal: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="email_work">Work Email</Label>
                  <Input
                    id="email_work"
                    type="email"
                    value={formData.email_work}
                    onChange={(e) => setFormData({ ...formData, email_work: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="phone_primary">Primary Phone</Label>
                  <Input
                    id="phone_primary"
                    type="tel"
                    value={formData.phone_primary}
                    onChange={(e) => setFormData({ ...formData, phone_primary: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="phone_secondary">Secondary Phone</Label>
                  <Input
                    id="phone_secondary"
                    type="tel"
                    value={formData.phone_secondary}
                    onChange={(e) => setFormData({ ...formData, phone_secondary: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Address */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium">Address</h3>
              
              <div>
                <Label htmlFor="address_line1">Address Line 1</Label>
                <Input
                  id="address_line1"
                  value={formData.address_line1}
                  onChange={(e) => setFormData({ ...formData, address_line1: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="address_line2">Address Line 2</Label>
                <Input
                  id="address_line2"
                  value={formData.address_line2}
                  onChange={(e) => setFormData({ ...formData, address_line2: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="state">State</Label>
                  <Input
                    id="state"
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="postal_code">Postal Code</Label>
                  <Input
                    id="postal_code"
                    value={formData.postal_code}
                    onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Notes */}
            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
              />
            </div>

            <div className="flex gap-2">
              <Button type="submit" disabled={createContact.isPending || updateContact.isPending}>
                {contact ? "Update" : "Create"} Contact
              </Button>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
            </div>
          </form>

          {/* Associations Panel */}
          {contact && (
            <div className="space-y-4">
              <UnifiedAssociationManager
                entityId={contact.id}
                entityType="contact"
                groupId={groupId}
                onNavigate={handleNavigate}
              />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}