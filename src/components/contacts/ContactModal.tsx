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
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { AssociationManager } from "@/components/shared/AssociationManager";
import { useDemoOperations } from "@/hooks/useDemoOperations";

interface Contact {
  id: string;
  first_name?: string;
  last_name?: string;
  organization_name?: string;
  email_personal?: string;
  email_work?: string;
  phone_primary?: string;
  phone_secondary?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  contact_type: 'primary' | 'secondary' | 'emergency' | 'professional';
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
    first_name: "",
    last_name: "",
    organization_name: "",
    email_personal: "",
    email_work: "",
    phone_primary: "",
    phone_secondary: "",
    address_line1: "",
    address_line2: "",
    city: "",
    state: "",
    postal_code: "",
    contact_type: "primary" as Contact['contact_type'],
    notes: "",
  });
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { blockOperation } = useDemoOperations();

  useEffect(() => {
    if (contact) {
      setFormData({
        first_name: contact.first_name || "",
        last_name: contact.last_name || "",
        organization_name: contact.organization_name || "",
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
        first_name: "",
        last_name: "",
        organization_name: "",
        email_personal: "",
        email_work: "",
        phone_primary: "",
        phone_secondary: "",
        address_line1: "",
        address_line2: "",
        city: "",
        state: "",
        postal_code: "",
        contact_type: "primary",
        notes: "",
      });
    }
  }, [contact]);

  const createContact = useMutation({
    mutationFn: async (data: any) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: newContact, error } = await supabase
        .from("contacts")
        .insert({
          ...data,
          care_group_id: groupId,
          created_by_user_id: user.id,
        })
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
      const { error } = await supabase
        .from("contacts")
        .update(data)
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
            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium">Basic Information</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="first_name">First Name</Label>
                  <Input
                    id="first_name"
                    value={formData.first_name}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="last_name">Last Name</Label>
                  <Input
                    id="last_name"
                    value={formData.last_name}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="organization_name">Organization</Label>
                <Input
                  id="organization_name"
                  value={formData.organization_name}
                  onChange={(e) => setFormData({ ...formData, organization_name: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="contact_type">Contact Type</Label>
                <Select
                  value={formData.contact_type}
                  onValueChange={(value) => setFormData({ ...formData, contact_type: value as any })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="primary">Primary Contact</SelectItem>
                    <SelectItem value="secondary">Secondary Contact</SelectItem>
                    <SelectItem value="emergency">Emergency Contact</SelectItem>
                    <SelectItem value="professional">Professional</SelectItem>
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
              <AssociationManager
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