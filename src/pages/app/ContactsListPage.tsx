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
    const fullName = [contact.first_name, contact.last_name].filter(Boolean).join(' ');
    return fullName || contact.organization_name || 'Unnamed Contact';
  };

  const getContactTypeColor = (type: string) => {
    switch (type?.toLowerCase()) {
      case 'family': return 'bg-blue-100 text-blue-800';
      case 'friend': return 'bg-green-100 text-green-800';
      case 'healthcare': return 'bg-red-100 text-red-800';
      case 'caregiver': return 'bg-purple-100 text-purple-800';
      case 'professional': return 'bg-orange-100 text-orange-800';
      case 'emergency': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const columns = [
    { 
      key: 'name', 
      label: 'Name', 
      sortable: true,
      width: '48',
      render: (value: any, row: any) => getContactName(row)
    },
    { 
      key: 'contact_type', 
      label: 'Type', 
      sortable: true,
      type: 'badge' as const,
      getBadgeVariant: (value: string) => 'secondary',
      width: '24',
      render: (value: any) => (
        <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getContactTypeColor(value)}`}>
          {value || 'Unknown'}
        </div>
      )
    },
    { 
      key: 'phone_primary', 
      label: 'Phone', 
      sortable: true,
      width: '32'
    },
    { 
      key: 'email_personal', 
      label: 'Email', 
      sortable: true,
      width: '32',
      render: (value: any, row: any) => value || row.email_work || '-'
    },
    { 
      key: 'location', 
      label: 'Location', 
      sortable: true,
      width: '32',
      render: (value: any, row: any) => {
        const location = [row.city, row.state].filter(Boolean).join(', ');
        return location || '-';
      }
    },
    { 
      key: 'associations', 
      label: 'Related Items', 
      type: 'associations' as const,
      width: '48',
      getAssociations: (row: any) => {
        // This would be populated with actual association data
        return [];
      }
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