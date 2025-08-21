import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Users, Phone, Mail, Link as LinkIcon } from "lucide-react";
import SEO from "@/components/layout/SEO";
import { ContactModal } from "@/components/contacts/ContactModal";
import { UnifiedTableView, TableColumn } from "@/components/shared/UnifiedTableView";
import { UnifiedAssociationManager } from "@/components/shared/UnifiedAssociationManager";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { softDeleteEntity, bulkSoftDelete } from "@/lib/delete/rpc";
import { useToast } from "@/hooks/use-toast";
import { useDemo } from "@/hooks/useDemo";
import { useDemoContacts } from "@/hooks/useDemoData";

export default function ContactsPage() {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const [showContactModal, setShowContactModal] = useState(false);
  const [selectedContact, setSelectedContact] = useState<any>(null);
  const [selectedContactForAssociations, setSelectedContactForAssociations] = useState<any>(null);
  const [isAssociationsModalOpen, setIsAssociationsModalOpen] = useState(false);

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isDemo } = useDemo();
  
  // Use demo data if in demo mode
  const demoContacts = useDemoContacts(groupId);

  const { data: realContacts = [], isLoading: realLoading } = useQuery({
    queryKey: ["contacts", groupId],
    queryFn: async () => {
      if (!groupId || groupId === ':groupId' || groupId === 'undefined' || groupId.startsWith(':')) {
        return [];
      }
      
      const { data, error } = await supabase
        .from("contacts")
        .select("*")
        .eq("care_group_id", groupId)
        .eq("is_deleted", false)
        .order("first_name", { ascending: true });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!groupId && groupId !== ':groupId' && groupId !== 'undefined' && !groupId.startsWith(':') && !isDemo,
  });

  // Use demo data if available, otherwise use real data
  const contacts = isDemo && demoContacts.data ? demoContacts.data : realContacts;
  const isLoading = isDemo ? false : realLoading;

  const blockOperation = () => {
    if (isDemo) {
      toast({
        title: "Demo Mode",
        description: "This action is not available in demo mode.",
        variant: "destructive",
      });
      return true;
    }
    return false;
  };

  // Delete mutations
  const deleteContactMutation = useMutation({
    mutationFn: async (contactId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      
      await softDeleteEntity("contact", contactId, user.id, user.email || "");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      toast({
        title: "Contact deleted",
        description: "Contact has been moved to trash and can be restored within 30 days.",
      });
    },
    onError: (error) => {
      console.error("Delete error:", error);
      toast({
        title: "Error",
        description: "Failed to delete contact.",
        variant: "destructive",
      });
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (contactIds: string[]) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      
      await bulkSoftDelete("contact", contactIds, user.id, user.email || "");
    },
    onSuccess: (_, contactIds) => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      toast({
        title: "Contacts deleted", 
        description: `${contactIds.length} contact(s) moved to trash and can be restored within 30 days.`,
      });
    },
    onError: (error) => {
      console.error("Bulk delete error:", error);
      toast({
        title: "Error",
        description: "Failed to delete contacts.",
        variant: "destructive",
      });
    },
  });

  const handleEditContact = (contact: any) => {
    if (blockOperation()) return;
    setSelectedContact(contact);
    setShowContactModal(true);
  };

  const handleDeleteContact = (contactId: string) => {
    if (blockOperation()) return;
    if (confirm("Are you sure you want to delete this contact? It will be moved to trash and can be restored within 30 days.")) {
      deleteContactMutation.mutate(contactId);
    }
  };

  const handleBulkDelete = (contactIds: string[]) => {
    if (blockOperation()) return;
    bulkDeleteMutation.mutate(contactIds);
  };

  const getContactDisplayName = (contact: any) => {
    const fullName = [contact.first_name, contact.last_name].filter(Boolean).join(" ");
    return fullName || contact.organization_name || "Unknown Contact";
  };

  const getContactTypeColor = (type: string) => {
    switch (type) {
      case 'family': return 'default';
      case 'friend': return 'secondary';
      case 'medical': return 'destructive';
      case 'professional': return 'outline';
      case 'emergency': return 'destructive';
      default: return 'secondary';
    }
  };

  const getEmailForContact = (contact: any) => {
    return contact.email_personal || contact.email_work || "-";
  };

  const getLocationForContact = (contact: any) => {
    const parts = [contact.city, contact.state].filter(Boolean);
    return parts.length > 0 ? parts.join(", ") : "-";
  };

  // Define table columns
  const columns: TableColumn[] = [
    {
      key: "name",
      label: "Name/Organization",
      sortable: true,
      render: (_, row) => (
        <div className="font-medium">
          {getContactDisplayName(row)}
        </div>
      ),
    },
    {
      key: "contact_type",
      label: "Type",
      sortable: true,
      type: "badge",
      getBadgeVariant: getContactTypeColor,
      render: (value) => (
        <Badge variant={getContactTypeColor(value)}>
          {value}
        </Badge>
      ),
    },
    {
      key: "phone_primary",
      label: "Phone",
      sortable: true,
      render: (value) => value ? (
        <div className="flex items-center gap-2 text-sm">
          <Phone className="h-4 w-4" />
          <span>{value}</span>
        </div>
      ) : "-",
    },
    {
      key: "email",
      label: "Email",
      sortable: true,
      render: (_, row) => {
        const email = getEmailForContact(row);
        return email !== "-" ? (
          <div className="flex items-center gap-2 text-sm">
            <Mail className="h-4 w-4" />
            <span>{email}</span>
          </div>
        ) : "-";
      },
    },
    {
      key: "location",
      label: "Location",
      sortable: true,
      render: (_, row) => (
        <div className="text-sm">{getLocationForContact(row)}</div>
      ),
    },
  ];

  if (!groupId || groupId === ':groupId' || groupId === 'undefined' || groupId.startsWith(':')) {
    return (
      <div className="p-6 text-center">
        <h2 className="text-xl font-semibold mb-2">Invalid Group</h2>
        <p className="text-muted-foreground">Please select a valid care group.</p>
      </div>
    );
  }

  return (
    <>
      <SEO 
        title="Contacts - Care Coordination"
        description="Manage and view contact information for your care group members and related contacts."
      />
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Users className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold">Contacts</h1>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => navigate(`/app/${groupId}/contacts/import`)} variant="outline">
              Import Contacts
            </Button>
            <Button onClick={() => {
              setSelectedContact(null);
              setShowContactModal(true);
            }}>
              <Plus className="h-4 w-4 mr-2" />
              Add Contact
            </Button>
          </div>
        </div>

        <UnifiedTableView
          title=""
          data={contacts}
          columns={columns}
          loading={isLoading}
          onEdit={handleEditContact}
          onDelete={handleDeleteContact}
          onBulkDelete={handleBulkDelete}
          searchable={true}
          searchPlaceholder="Search contacts..."
          defaultSortBy="name"
          defaultSortOrder="asc"
          entityType="contact"
          getItemTitle={getContactDisplayName}
          emptyMessage="No contacts found"
          emptyDescription="Start by adding your first contact."
          customActions={(item) => (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedContactForAssociations(item);
                setIsAssociationsModalOpen(true);
              }}
              disabled={isDemo}
              title="Manage associations"
              className="h-8 w-8 p-0"
            >
              <LinkIcon className="h-4 w-4" />
            </Button>
          )}
        />

        <ContactModal
          contact={selectedContact}
          isOpen={showContactModal}
          onClose={() => {
            setShowContactModal(false);
            setSelectedContact(null);
          }}
          groupId={groupId || ''}
        />

        <Dialog open={isAssociationsModalOpen} onOpenChange={setIsAssociationsModalOpen}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                Contact Associations - {selectedContactForAssociations ? getContactDisplayName(selectedContactForAssociations) : ''}
              </DialogTitle>
            </DialogHeader>
            {selectedContactForAssociations && (
              <UnifiedAssociationManager
                entityId={selectedContactForAssociations.id}
                entityType="contact"
                groupId={groupId || ''}
                onNavigate={(path) => {
                  setIsAssociationsModalOpen(false);
                  navigate(path);
                }}
                showTitle={false}
              />
            )}
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
}