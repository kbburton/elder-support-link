import { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Check, ChevronDown, Plus, X, User } from "lucide-react";
import { cn } from "@/lib/utils";

interface Contact {
  id: string;
  first_name: string | null;
  last_name: string | null;
  organization_name: string | null;
  phone_primary: string | null;
  email_personal: string | null;
  email_work: string | null;
  contact_type: string;
}

interface ContactMultiSelectProps {
  value?: string[];
  onChange?: (contactIds: string[]) => void;
  entityType?: "appointments" | "tasks" | "activity_logs" | "documents";
  placeholder?: string;
  disabled?: boolean;
  // Legacy props for backward compatibility
  selectedContactIds?: string[];
  onSelectionChange?: (contactIds: string[]) => void;
  className?: string;
}

export default function ContactMultiSelect({
  value: propValue,
  onChange: propOnChange,
  entityType,
  placeholder = "Select contacts...",
  disabled = false,
  // Legacy props
  selectedContactIds,
  onSelectionChange,
  className,
}: ContactMultiSelectProps) {
  const { groupId } = useParams();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
  const [quickCreateData, setQuickCreateData] = useState({
    first_name: "",
    last_name: "",
    phone_primary: "",
    email_personal: "",
  });
  const inputRef = useRef<HTMLInputElement>(null);

  // Handle backward compatibility - prioritize new props, fallback to legacy
  const value = propValue !== undefined ? propValue : (selectedContactIds || []);
  const onChange = propOnChange || onSelectionChange || (() => {});

  // Fetch all contacts in the group
  const { data: allContacts = [] } = useQuery({
    queryKey: ["contacts", groupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select("id, first_name, last_name, organization_name, phone_primary, email_personal, email_work, contact_type")
        .eq("care_group_id", groupId!)
        .order("first_name", { ascending: true });
      
      if (error) throw error;
      return data as Contact[];
    },
    enabled: !!groupId,
  });

  // Get smart defaults based on entity type
  const getSmartDefaults = () => {
    if (!allContacts.length) return [];
    
    if (entityType === "appointments") {
      // Pre-suggest medical and legal contacts
      return allContacts.filter(contact => 
        contact.contact_type === "medical" || contact.contact_type === "legal"
      ).slice(0, 3);
    }
    
    if (entityType === "tasks") {
      // For now, just return recent contacts (could be enhanced with actual usage data)
      return allContacts.slice(0, 3);
    }
    
    return [];
  };

  const smartDefaults = getSmartDefaults();

  // Get contact display name
  const getContactName = (contact: Contact) => {
    const fullName = [contact.first_name, contact.last_name].filter(Boolean).join(" ");
    return fullName || contact.organization_name || "Unknown Contact";
  };

  // Get contact details for display
  const getContactDetails = (contact: Contact) => {
    const details = [];
    if (contact.organization_name && contact.first_name) {
      details.push(contact.organization_name);
    }
    if (contact.phone_primary) {
      details.push(contact.phone_primary);
    }
    if (contact.email_personal) {
      details.push(contact.email_personal);
    } else if (contact.email_work) {
      details.push(contact.email_work);
    }
    return details.join(" • ");
  };

  // Filter contacts based on search query
  const filteredContacts = allContacts.filter(contact => {
    if (!searchQuery.trim()) return true;
    
    const query = searchQuery.toLowerCase();
    const name = getContactName(contact).toLowerCase();
    const org = contact.organization_name?.toLowerCase() || "";
    const phone = contact.phone_primary || "";
    const email = contact.email_personal?.toLowerCase() || contact.email_work?.toLowerCase() || "";
    
    return name.includes(query) || 
           org.includes(query) || 
           phone.includes(query) || 
           email.includes(query);
  });

  // Get selected contacts
  const selectedContacts = allContacts.filter(contact => value.includes(contact.id));

  // Handle contact selection
  const handleContactSelect = (contactId: string) => {
    const newValue = value.includes(contactId)
      ? value.filter(id => id !== contactId)
      : [...value, contactId];
    onChange(newValue);
  };

  // Handle contact removal
  const handleContactRemove = (contactId: string) => {
    onChange(value.filter(id => id !== contactId));
  };

  // Handle quick create contact
  const handleQuickCreate = async () => {
    if (!quickCreateData.first_name && !quickCreateData.last_name) {
      toast({
        title: "Error",
        description: "Please provide at least a first or last name",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data: newContact, error } = await supabase
        .from("contacts")
        .insert({
          care_group_id: groupId!,
          first_name: quickCreateData.first_name || null,
          last_name: quickCreateData.last_name || null,
          phone_primary: quickCreateData.phone_primary || null,
          email_personal: quickCreateData.email_personal || null,
          contact_type: "other",
          created_by_user_id: (await supabase.auth.getUser()).data.user?.id,
        })
        .select()
        .single();

      if (error) throw error;

      // Refresh contacts query
      queryClient.invalidateQueries({ queryKey: ["contacts", groupId] });

      // Auto-select the new contact
      onChange([...value, newContact.id]);

      // Reset form and close dialog
      setQuickCreateData({
        first_name: "",
        last_name: "",
        phone_primary: "",
        email_personal: "",
      });
      setQuickCreateOpen(false);

      toast({
        title: "Success",
        description: "Contact created and linked successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create contact",
        variant: "destructive",
      });
    }
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !searchQuery && selectedContacts.length > 0) {
      e.preventDefault();
      handleContactRemove(selectedContacts[selectedContacts.length - 1].id);
    }
  };

  return (
    <div className={cn("space-y-2", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              "w-full justify-between",
              disabled && "opacity-50 cursor-not-allowed"
            )}
            disabled={disabled}
          >
            <span className="truncate">
              {selectedContacts.length > 0
                ? `${selectedContacts.length} contact${selectedContacts.length === 1 ? '' : 's'} selected`
                : placeholder}
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0" style={{ width: "var(--radix-popover-trigger-width)" }}>
          <Command>
            <CommandInput
              ref={inputRef}
              placeholder="Search contacts..."
              value={searchQuery}
              onValueChange={setSearchQuery}
              onKeyDown={handleKeyDown}
            />
            <CommandList>
              <CommandEmpty>
                <div className="p-4 text-center">
                  <p className="text-sm text-muted-foreground mb-2">No contacts found</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setQuickCreateOpen(true);
                      setOpen(false);
                    }}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create new contact
                  </Button>
                </div>
              </CommandEmpty>
              
              {smartDefaults.length > 0 && !searchQuery && (
                <CommandGroup heading="Suggested">
                  {smartDefaults.map((contact) => (
                    <CommandItem
                      key={contact.id}
                      onSelect={() => handleContactSelect(contact.id)}
                      className="cursor-pointer"
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          value.includes(contact.id) ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <User className="mr-2 h-4 w-4 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">
                          {getContactName(contact)}
                        </div>
                        {getContactDetails(contact) && (
                          <div className="text-sm text-muted-foreground truncate">
                            {getContactDetails(contact)}
                          </div>
                        )}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

              <CommandGroup heading={searchQuery ? "Search Results" : "All Contacts"}>
                {filteredContacts
                  .filter(contact => !smartDefaults.some(def => def.id === contact.id) || searchQuery)
                  .map((contact) => (
                  <CommandItem
                    key={contact.id}
                    onSelect={() => handleContactSelect(contact.id)}
                    className="cursor-pointer"
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value.includes(contact.id) ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <User className="mr-2 h-4 w-4 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">
                        {getContactName(contact)}
                      </div>
                      {getContactDetails(contact) && (
                        <div className="text-sm text-muted-foreground truncate">
                          {getContactDetails(contact)}
                        </div>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>

              {filteredContacts.length > 0 && (
                <CommandGroup>
                  <CommandItem
                    onSelect={() => {
                      setQuickCreateOpen(true);
                      setOpen(false);
                    }}
                    className="cursor-pointer border-t"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Create new contact
                  </CommandItem>
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Selected contacts chips */}
      {selectedContacts.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedContacts.map((contact) => (
            <Badge key={contact.id} variant="secondary" className="pr-1">
              {getContactName(contact)}
              <Button
                variant="ghost"
                size="sm"
                className="h-4 w-4 p-0 ml-1 hover:bg-destructive hover:text-destructive-foreground"
                onClick={() => handleContactRemove(contact.id)}
                disabled={disabled}
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          ))}
        </div>
      )}

      {/* Quick create contact dialog */}
      <Dialog open={quickCreateOpen} onOpenChange={setQuickCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Contact</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="first_name">First Name</Label>
                <Input
                  id="first_name"
                  value={quickCreateData.first_name}
                  onChange={(e) => setQuickCreateData(prev => ({ ...prev, first_name: e.target.value }))}
                  placeholder="First name"
                />
              </div>
              <div>
                <Label htmlFor="last_name">Last Name</Label>
                <Input
                  id="last_name"
                  value={quickCreateData.last_name}
                  onChange={(e) => setQuickCreateData(prev => ({ ...prev, last_name: e.target.value }))}
                  placeholder="Last name"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="phone_primary">Phone</Label>
              <Input
                id="phone_primary"
                value={quickCreateData.phone_primary}
                onChange={(e) => setQuickCreateData(prev => ({ ...prev, phone_primary: e.target.value }))}
                placeholder="Phone number"
              />
            </div>
            <div>
              <Label htmlFor="email_personal">Email</Label>
              <Input
                id="email_personal"
                type="email"
                value={quickCreateData.email_personal}
                onChange={(e) => setQuickCreateData(prev => ({ ...prev, email_personal: e.target.value }))}
                placeholder="Email address"
              />
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setQuickCreateOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleQuickCreate}>
                Create & Link
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}