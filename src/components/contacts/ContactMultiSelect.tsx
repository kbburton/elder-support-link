import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Users, X, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface Contact {
  id: string;
  first_name: string | null;
  last_name: string | null;
  organization_name: string | null;
  contact_type: string;
  is_emergency_contact: boolean;
}

interface ContactMultiSelectProps {
  selectedContactIds: string[];
  onSelectionChange: (contactIds: string[]) => void;
  placeholder?: string;
  className?: string;
}

export default function ContactMultiSelect({
  selectedContactIds,
  onSelectionChange,
  placeholder = "Select contacts...",
  className
}: ContactMultiSelectProps) {
  const { groupId } = useParams();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    loadContacts();
  }, [groupId]);

  const loadContacts = async () => {
    if (!groupId) return;
    
    try {
      const { data, error } = await supabase
        .from("contacts")
        .select("id, first_name, last_name, organization_name, contact_type, is_emergency_contact")
        .eq("care_group_id", groupId)
        .order("last_name", { ascending: true });

      if (error) throw error;
      setContacts(data || []);
    } catch (error) {
      console.error("Error loading contacts:", error);
    } finally {
      setLoading(false);
    }
  };

  const getContactName = (contact: Contact) => {
    if (contact.organization_name) {
      return contact.organization_name;
    }
    return `${contact.first_name || ""} ${contact.last_name || ""}`.trim() || "Unnamed Contact";
  };

  const getContactTypeColor = (type: string) => {
    switch (type) {
      case "medical": return "bg-red-500/10 text-red-700 border-red-200";
      case "legal": return "bg-blue-500/10 text-blue-700 border-blue-200";
      case "family": return "bg-green-500/10 text-green-700 border-green-200";
      case "friend": return "bg-yellow-500/10 text-yellow-700 border-yellow-200";
      default: return "bg-gray-500/10 text-gray-700 border-gray-200";
    }
  };

  const selectedContacts = contacts.filter(contact => 
    selectedContactIds.includes(contact.id)
  );

  const handleContactToggle = (contactId: string) => {
    const newSelection = selectedContactIds.includes(contactId)
      ? selectedContactIds.filter(id => id !== contactId)
      : [...selectedContactIds, contactId];
    
    onSelectionChange(newSelection);
  };

  const removeContact = (contactId: string) => {
    onSelectionChange(selectedContactIds.filter(id => id !== contactId));
  };

  if (loading) {
    return (
      <div className={cn("w-full", className)}>
        <div className="animate-pulse h-10 bg-gray-200 rounded"></div>
      </div>
    );
  }

  return (
    <div className={cn("w-full", className)}>
      <div className="space-y-2">
        {/* Selected contacts display */}
        {selectedContacts.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {selectedContacts.map((contact) => (
              <Badge
                key={contact.id}
                variant="secondary"
                className="text-xs px-2 py-1 flex items-center gap-1"
              >
                <span>{getContactName(contact)}</span>
                {contact.is_emergency_contact && (
                  <span className="text-red-600 font-bold">!</span>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-3 w-3 p-0 hover:bg-transparent"
                  onClick={() => removeContact(contact.id)}
                >
                  <X className="h-2 w-2" />
                </Button>
              </Badge>
            ))}
          </div>
        )}

        {/* Contact selector */}
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="w-full justify-between h-10"
            >
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">
                  {selectedContacts.length > 0
                    ? `${selectedContacts.length} contact${selectedContacts.length === 1 ? '' : 's'} selected`
                    : placeholder
                  }
                </span>
              </div>
              <ChevronDown className="h-4 w-4 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-full p-0 bg-background z-50 shadow-lg border" side="bottom" align="start">
            <Command>
              <CommandInput placeholder="Search contacts..." />
              <CommandList>
                <CommandEmpty>No contacts found.</CommandEmpty>
                <CommandGroup>
                  <ScrollArea className="h-60">
                    {contacts.map((contact) => (
                      <CommandItem
                        key={contact.id}
                        value={getContactName(contact)}
                        onSelect={() => handleContactToggle(contact.id)}
                        className="cursor-pointer"
                      >
                        <div className="flex items-center space-x-2 w-full">
                          <Checkbox
                            checked={selectedContactIds.includes(contact.id)}
                            onChange={() => handleContactToggle(contact.id)}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-2">
                                <span className="font-medium truncate">
                                  {getContactName(contact)}
                                </span>
                                {contact.is_emergency_contact && (
                                  <Badge variant="destructive" className="text-xs px-1">
                                    Emergency
                                  </Badge>
                                )}
                              </div>
                              <Badge className={cn("text-xs", getContactTypeColor(contact.contact_type))}>
                                {contact.contact_type}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </CommandItem>
                    ))}
                  </ScrollArea>
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}