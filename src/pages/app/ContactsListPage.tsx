import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import SEO from "@/components/layout/SEO";
import { UnifiedTableView } from "@/components/shared/UnifiedTableView";
import { useToast } from "@/hooks/use-toast";
import { useDemoOperations } from "@/hooks/useDemoOperations";
import { softDeleteEntity } from "@/lib/delete/rpc";

export default function ContactsListPage() {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { blockOperation } = useDemoOperations();

  const { data: contacts = [], isLoading } = useQuery({
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
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!groupId && groupId !== ':groupId' && groupId !== 'undefined' && !groupId.startsWith(':'),
  });

  // Get current user for permissions
  const { data: currentUser } = useQuery({
    queryKey: ["currentUser"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    },
  });

  // Check if user is group admin
  const { data: isGroupAdmin = false } = useQuery({
    queryKey: ["isGroupAdmin", groupId, currentUser?.id],
    queryFn: async () => {
      if (!currentUser?.id || !groupId) return false;
      
      const { data } = await supabase
        .from("care_group_members")
        .select("is_admin")
        .eq("group_id", groupId)
        .eq("user_id", currentUser.id)
        .single();
      
      return data?.is_admin || false;
    },
    enabled: !!currentUser?.id && !!groupId,
  });

  const deleteContactMutation = useMutation({
    mutationFn: async (contactId: string) => {
      if (blockOperation()) return { success: false, error: "Operation blocked in demo mode" };
      
      if (!currentUser) throw new Error('User not authenticated');
      
      const result = await softDeleteEntity('contact', contactId, currentUser.id, currentUser.email!);
      if (!result.success) {
        throw new Error(result.error || 'Delete failed');
      }
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      toast({ title: "Success", description: "Contact moved to trash successfully." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (contactIds: string[]) => {
      if (blockOperation()) return { success: false, error: "Operation blocked in demo mode" };
      
      if (!currentUser) throw new Error('User not authenticated');
      
      const results = [];
      for (const id of contactIds) {
        try {
          const result = await softDeleteEntity('contact', id, currentUser.id, currentUser.email!);
          results.push(result);
        } catch (error) {
          results.push({ success: false, error: error.message });
        }
      }
      
      const failures = results.filter(r => !r.success);
      if (failures.length > 0) {
        throw new Error(`${failures.length} contacts could not be deleted`);
      }
      
      return results;
    },
    onSuccess: (_, contactIds) => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      toast({ 
        title: "Success", 
        description: `${contactIds.length} contact(s) moved to trash. Items can be restored in group settings for 30 days.`
      });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  const handleEdit = (contact: any) => {
    navigate(`/app/${groupId}/contacts/${contact.id}`);
  };

  const handleDelete = async (contactId: string) => {
    await deleteContactMutation.mutateAsync(contactId);
  };

  const handleBulkDelete = async (contactIds: string[]) => {
    await bulkDeleteMutation.mutateAsync(contactIds);
  };

  const canDeleteContact = (contact: any) => {
    if (!currentUser) return false;
    return isGroupAdmin || contact.created_by_user_id === currentUser.id;
  };

  const getContactName = (contact: any) => {
    if (contact.organization_name) {
      return contact.organization_name;
    }
    const lastName = contact.last_name ? `${contact.last_name}, ` : '';
    const firstName = contact.first_name || '';
    return `${lastName}${firstName}`.trim() || contact.email_personal || contact.email_work || 'Unnamed Contact';
  };

  const getContactTypeColor = (type: string) => {
    switch (type?.toLowerCase()) {
      case 'medical': return 'bg-red-100 text-red-800';
      case 'legal': return 'bg-blue-100 text-blue-800';
      case 'family': return 'bg-green-100 text-green-800';
      case 'friend': return 'bg-yellow-100 text-yellow-800';
      case 'other': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getEmailForContact = (contact: any) => {
    const contactType = contact.contact_type?.toLowerCase();
    
    // Medical/Legal → business email, Emergency/Family → personal email
    if (contactType === 'medical' || contactType === 'legal') {
      return contact.email_work || contact.email_personal || '-';
    } else if (contactType === 'emergency' || contactType === 'family') {
      return contact.email_personal || contact.email_work || '-';
    } else {
      // Default to personal email for others
      return contact.email_personal || contact.email_work || '-';
    }
  };

  const getOrganization = (contact: any) => {
    if (contact.organization_name) {
      return contact.organization_name;
    }
    return contact.company || '';
  };

  // Get current user for creator names
  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles", groupId],
    queryFn: async () => {
      if (!groupId || contacts.length === 0) return [];
      
      const userIds = [...new Set(contacts.map(c => c.created_by_user_id).filter(Boolean))];
      if (userIds.length === 0) return [];
      
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, first_name, last_name, email")
        .in("user_id", userIds);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!groupId && contacts.length > 0,
  });

  const getCreatorName = (contact: any) => {
    const profile = profiles.find(p => p.user_id === contact.created_by_user_id);
    if (profile) {
      const fullName = [profile.first_name, profile.last_name].filter(Boolean).join(' ');
      return fullName || profile.email || 'Unknown';
    }
    return 'Unknown';
  };

  const columns = [
    { 
      key: 'contact_type', 
      label: 'Type', 
      sortable: true,
      width: '20',
      render: (value: any) => (
        <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getContactTypeColor(value)}`}>
          {value || 'Unknown'}
        </div>
      )
    },
    { 
      key: 'name', 
      label: 'Name', 
      sortable: true,
      width: '32',
      render: (value: any, row: any) => getContactName(row)
    },
    { 
      key: 'phone_primary', 
      label: 'Phone', 
      sortable: true,
      width: '24'
    },
    { 
      key: 'organization', 
      label: 'Organization', 
      sortable: false,
      width: '24',
      render: (value: any, row: any) => getOrganization(row) || ''
    },
    { 
      key: 'email', 
      label: 'Email', 
      sortable: false,
      width: '32',
      render: (value: any, row: any) => getEmailForContact(row)
    },
    { 
      key: 'created_by', 
      label: 'Created By', 
      sortable: false,
      width: '24',
      render: (value: any, row: any) => getCreatorName(row)
    }
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
        description="Manage contacts and relationships within your care group."
      />
      <div className="container mx-auto p-6 space-y-6">
        <UnifiedTableView
          title="Contacts"
          data={contacts}
          columns={columns}
          loading={isLoading}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onBulkDelete={handleBulkDelete}
          entityType="contact"
          canDelete={canDeleteContact}
          getItemTitle={getContactName}
          searchPlaceholder="Search contacts..."
          defaultSortBy="created_at"
          emptyMessage="No contacts found"
          emptyDescription="Start by adding your first contact."
          onCreateNew={() => navigate(`/app/${groupId}/contacts/new`)}
          createButtonLabel="Add Contact"
        />
      </div>
    </>
  );
}