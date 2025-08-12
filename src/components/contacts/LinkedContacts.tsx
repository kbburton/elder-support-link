import { useState, useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, ExternalLink, Plus, Calendar, FileText, ListTodo } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Contact {
  id: string;
  first_name: string | null;
  last_name: string | null;
  organization_name: string | null;
  contact_type: string;
  is_emergency_contact: boolean;
  phone_primary: string | null;
  email_personal: string | null;
}

interface LinkedContactsProps {
  itemId: string;
  itemType: "task" | "appointment" | "activity_log";
  itemTitle?: string;
}

export default function LinkedContacts({ itemId, itemType, itemTitle }: LinkedContactsProps) {
  const { groupId } = useParams();
  const { toast } = useToast();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLinkedContacts();
  }, [itemId, itemType]);

  const loadLinkedContacts = async () => {
    if (!itemId || !itemType) return;
    
    try {
      let query;
      
      switch (itemType) {
        case "task":
          query = supabase
            .from("contact_tasks")
            .select(`
              contact_id,
              contacts!inner (
                id,
                first_name,
                last_name,
                organization_name,
                contact_type,
                is_emergency_contact,
                phone_primary,
                email_personal
              )
            `)
            .eq("task_id", itemId);
          break;
        case "appointment":
          query = supabase
            .from("contact_appointments")
            .select(`
              contact_id,
              contacts!inner (
                id,
                first_name,
                last_name,
                organization_name,
                contact_type,
                is_emergency_contact,
                phone_primary,
                email_personal
              )
            `)
            .eq("appointment_id", itemId);
          break;
        case "activity_log":
          query = supabase
            .from("contact_activities")
            .select(`
              contact_id,
              contacts!inner (
                id,
                first_name,
                last_name,
                organization_name,
                contact_type,
                is_emergency_contact,
                phone_primary,
                email_personal
              )
            `)
            .eq("activity_log_id", itemId);
          break;
        default:
          return;
      }

      const { data, error } = await query;
      if (error) throw error;
      
      const linkedContacts = data?.map((item: any) => item.contacts).filter(Boolean) || [];
      setContacts(linkedContacts as Contact[]);
    } catch (error) {
      console.error("Error loading linked contacts:", error);
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

  const createQuickAction = async (actionType: "activity" | "appointment" | "task", contact: Contact) => {
    if (!groupId) return;
    
    try {
      const user = await supabase.auth.getUser();
      if (!user.data.user) throw new Error("Not authenticated");

      let result;
      const contactName = getContactName(contact);
      
      switch (actionType) {
        case "activity":
          result = await supabase
            .from("activity_logs")
            .insert({
              group_id: groupId,
              created_by_user_id: user.data.user.id,
              created_by_email: user.data.user.email,
              date_time: new Date().toISOString(),
              type: "other",
              title: `Follow-up with ${contactName}`,
              notes: `Related to ${itemType}: ${itemTitle || "Unknown"}`,
            })
            .select()
            .single();
          
          if (result.data) {
            await supabase.from("contact_activities").insert({
              contact_id: contact.id,
              activity_log_id: result.data.id,
            });
          }
          break;
          
        case "appointment":
          result = await supabase
            .from("appointments")
            .insert({
              group_id: groupId,
              created_by_user_id: user.data.user.id,
              created_by_email: user.data.user.email,
              date_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
              category: "Follow-up",
              description: `Follow-up appointment with ${contactName}`,
            })
            .select()
            .single();
          
          if (result.data) {
            await supabase.from("contact_appointments").insert({
              contact_id: contact.id,
              appointment_id: result.data.id,
            });
          }
          break;
          
        case "task":
          result = await supabase
            .from("tasks")
            .insert({
              group_id: groupId,
              created_by_user_id: user.data.user.id,
              created_by_email: user.data.user.email,
              title: `Follow-up with ${contactName}`,
              description: `Related to ${itemType}: ${itemTitle || "Unknown"}`,
              status: "Open",
            })
            .select()
            .single();
          
          if (result.data) {
            await supabase.from("contact_tasks").insert({
              contact_id: contact.id,
              task_id: result.data.id,
            });
          }
          break;
      }

      if (result?.error) throw result.error;
      
      toast({
        title: "Quick action created",
        description: `Created new ${actionType} linked to ${contactName}`,
      });
    } catch (error) {
      console.error(`Error creating ${actionType}:`, error);
      toast({
        title: "Error",
        description: `Failed to create ${actionType}`,
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Users className="h-5 w-5" />
            <span>Related Contacts</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-2">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Users className="h-5 w-5" />
          <span>Related Contacts</span>
          <Badge variant="outline">{contacts.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {contacts.length === 0 ? (
          <p className="text-muted-foreground text-sm">No contacts linked to this {itemType.replace("_", " ")}.</p>
        ) : (
          <div className="space-y-4">
            {contacts.map((contact) => (
              <div key={contact.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center space-x-3">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-medium">{getContactName(contact)}</span>
                      {contact.is_emergency_contact && (
                        <Badge variant="destructive" className="text-xs">Emergency</Badge>
                      )}
                    </div>
                    <div className="flex items-center space-x-2 mt-1">
                      <Badge className={getContactTypeColor(contact.contact_type)}>
                        {contact.contact_type}
                      </Badge>
                      {contact.phone_primary && (
                        <span className="text-sm text-muted-foreground">{contact.phone_primary}</span>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  {/* Quick Actions */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => createQuickAction("activity", contact)}
                    title="Log activity"
                  >
                    <FileText className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => createQuickAction("appointment", contact)}
                    title="Schedule appointment"
                  >
                    <Calendar className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => createQuickAction("task", contact)}
                    title="Create task"
                  >
                    <ListTodo className="h-4 w-4" />
                  </Button>
                  
                  {/* View Contact */}
                  <Button variant="ghost" size="sm" asChild>
                    <Link to={`/app/${groupId}/contacts/${contact.id}`} title="View contact">
                      <ExternalLink className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}