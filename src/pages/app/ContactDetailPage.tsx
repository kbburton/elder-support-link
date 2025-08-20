import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Edit, Phone, Mail, MapPin, Clock, AlertTriangle, User, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import ReverseLinkedItems from "@/components/contacts/ReverseLinkedItems";
import { UnifiedAssociationManager } from "@/components/shared/UnifiedAssociationManager";
import { generateVCardFile } from "@/utils/vcard";
import { useDemoContacts } from "@/hooks/useDemoData";
import { useDemo } from "@/hooks/useDemo";

interface Contact {
  id: string;
  first_name: string | null;
  last_name: string | null;
  organization_name: string | null;
  contact_type: string;
  gender: string | null;
  phone_primary: string | null;
  phone_secondary: string | null;
  email_personal: string | null;
  email_work: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  photo_url: string | null;
  preferred_contact_method: string | null;
  preferred_contact_start_local: string | null;
  preferred_contact_end_local: string | null;
  preferred_contact_start_weekend_local: string | null;
  preferred_contact_end_weekend_local: string | null;
  preferred_contact_timezone: string | null;
  is_emergency_contact: boolean;
  emergency_type: string | null;
  emergency_notes: string | null;
  notes: string | null;
  created_by_user_id: string;
  created_at: string;
  updated_at: string;
}

export default function ContactDetailPage() {
  const { groupId, contactId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [contact, setContact] = useState<Contact | null>(null);
  const [loading, setLoading] = useState(true);
  const [createdByName, setCreatedByName] = useState<string>("");

  const { isDemo } = useDemo();
  const demoData = useDemoContacts(groupId);

  useEffect(() => {
    if (isDemo && demoData.data) {
      loadDemoContact();
    } else {
      loadContact();
    }
  }, [contactId, isDemo, demoData.data]);

  const loadDemoContact = () => {
    if (!contactId || !demoData.data) return;
    
    try {
      const demoContact = demoData.data.find(c => c.id === contactId);
      
      if (!demoContact) {
        console.error("Demo contact not found:", contactId);
        navigate(`/app/${groupId}/contacts`);
        return;
      }
      
      // Transform demo contact to match interface
      const transformedContact: Contact = {
        id: demoContact.id,
        first_name: demoContact.first_name || demoContact.firstName || null,
        last_name: demoContact.last_name || demoContact.lastName || null,
        organization_name: demoContact.organization_name || demoContact.organizationName || null,
        contact_type: demoContact.contact_type || demoContact.contactType,
        gender: null,
        phone_primary: demoContact.phone_primary || demoContact.phoneNumber || null,
        phone_secondary: null,
        email_personal: demoContact.email_personal || demoContact.emailPersonal || null,
        email_work: null,
        address_line1: demoContact.address || null,
        address_line2: null,
        city: null,
        state: null,
        postal_code: null,
        photo_url: null,
        preferred_contact_method: null,
        preferred_contact_start_local: null,
        preferred_contact_end_local: null,
        preferred_contact_start_weekend_local: null,
        preferred_contact_end_weekend_local: null,
        preferred_contact_timezone: null,
        is_emergency_contact: demoContact.is_emergency_contact || demoContact.isEmergencyContact || false,
        emergency_type: demoContact.emergency_type || demoContact.emergencyType || null,
        emergency_notes: null,
        notes: demoContact.notes || null,
        created_by_user_id: demoContact.created_by_user_id || "22222222-2222-2222-2222-222222222222",
        created_at: demoContact.created_at || "2024-01-01T00:00:00Z",
        updated_at: demoContact.updated_at || "2024-01-01T00:00:00Z"
      };
      
      setContact(transformedContact);
      setCreatedByName("Mary Williams"); // Demo data
    } catch (error) {
      console.error("Error loading demo contact:", error);
      toast({
        title: "Error",
        description: "Failed to load contact details",
        variant: "destructive",
      });
      navigate(`/app/${groupId}/contacts`);
    } finally {
      setLoading(false);
    }
  };

  const loadContact = async () => {
    if (!contactId) return;
    
    try {
      const { data, error } = await supabase
        .from("contacts")
        .select("*")
        .eq("id", contactId)
        .maybeSingle();

      if (error) throw error;
      
      if (!data) {
        console.error("Contact not found:", contactId);
        navigate(`/app/${groupId}/contacts`);
        return;
      }
      
      setContact(data);

      // Load creator name
      if (data.created_by_user_id) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("first_name, last_name, email")
          .eq("user_id", data.created_by_user_id)
          .maybeSingle();
        
        if (profile) {
          setCreatedByName(`${profile.first_name || ""} ${profile.last_name || ""}`.trim() || profile.email || "Unknown");
        }
      }
    } catch (error) {
      console.error("Error loading contact:", error);
      toast({
        title: "Error",
        description: "Failed to load contact details",
        variant: "destructive",
      });
      navigate(`/app/${groupId}/contacts`);
    } finally {
      setLoading(false);
    }
  };

  const exportContact = () => {
    if (!contact) return;
    generateVCardFile([contact]);
    toast({
      title: "Export successful",
      description: "Contact exported to vCard file.",
    });
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

  const formatAddress = (contact: Contact) => {
    const parts = [
      contact.address_line1,
      contact.address_line2,
      contact.city && contact.state ? `${contact.city}, ${contact.state}` : null,
      contact.postal_code
    ].filter(Boolean);
    
    return parts.length > 0 ? parts.join(", ") : null;
  };

  const formatTime = (timeStr: string | null) => {
    if (!timeStr) return null;
    try {
      const time = new Date(`1970-01-01T${timeStr}`);
      return format(time, "h:mm a");
    } catch {
      return timeStr;
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-96 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (!contact) {
    return (
      <div className="p-6">
        <div className="text-center">
          <h2 className="text-2xl font-semibold mb-2">Contact Not Found</h2>
          <p className="text-muted-foreground mb-4">The contact you're looking for doesn't exist.</p>
          <Button asChild>
            <Link to={`/app/${groupId}/contacts`}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Contacts
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="sm" asChild>
            <Link to={`/app/${groupId}/contacts`}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Link>
          </Button>
          <div className="flex items-center space-x-3">
            <User className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-semibold">{getContactName(contact)}</h1>
            <Badge className={getContactTypeColor(contact.contact_type)}>
              {contact.contact_type}
            </Badge>
            {contact.is_emergency_contact && (
              <Badge variant="destructive">Emergency Contact</Badge>
            )}
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" onClick={exportContact}>
            <Download className="h-4 w-4 mr-2" />
            Export vCard
          </Button>
          <Button asChild>
            <Link to={isDemo ? `/app/${groupId}/contacts` : `/app/${groupId}/contacts/${contact.id}/edit`}>
              <Edit className="h-4 w-4 mr-2" />
              {isDemo ? "View Only (Demo)" : "Edit"}
            </Link>
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="associations">Contact Associations</TabsTrigger>
          <TabsTrigger value="activities">Activities</TabsTrigger>
          <TabsTrigger value="appointments">Appointments</TabsTrigger>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <User className="h-5 w-5" />
                  <span>Basic Information</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {contact.first_name && contact.last_name && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Name</label>
                    <p className="text-base">{contact.first_name} {contact.last_name}</p>
                  </div>
                )}
                
                {contact.organization_name && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Organization</label>
                    <p className="text-base">{contact.organization_name}</p>
                  </div>
                )}
                
                {contact.gender && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Gender</label>
                    <p className="text-base capitalize">{contact.gender.replace(/_/g, " ")}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Phone className="h-5 w-5" />
                  <span>Contact Information</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {contact.phone_primary && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Primary Phone</label>
                    <p className="text-base">{contact.phone_primary}</p>
                  </div>
                )}
                
                {contact.phone_secondary && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Secondary Phone</label>
                    <p className="text-base">{contact.phone_secondary}</p>
                  </div>
                )}
                
                {contact.email_personal && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Personal Email</label>
                    <p className="text-base">{contact.email_personal}</p>
                  </div>
                )}
                
                {contact.email_work && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Work Email</label>
                    <p className="text-base">{contact.email_work}</p>
                  </div>
                )}
                
                {contact.preferred_contact_method && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Preferred Contact Method</label>
                    <p className="text-base capitalize">{contact.preferred_contact_method}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {contact.notes && (
              <Card>
                <CardHeader>
                  <CardTitle>Notes</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-base whitespace-pre-wrap">{contact.notes}</p>
                </CardContent>
              </Card>
            )}

            {formatAddress(contact) && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <MapPin className="h-5 w-5" />
                    <span>Address</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-base">{formatAddress(contact)}</p>
                </CardContent>
              </Card>
            )}

            {(contact.preferred_contact_start_local || contact.preferred_contact_start_weekend_local) && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Clock className="h-5 w-5" />
                    <span>Contact Preferences</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {contact.preferred_contact_start_local && contact.preferred_contact_end_local && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Weekday Hours</label>
                      <p className="text-base">
                        {formatTime(contact.preferred_contact_start_local)} - {formatTime(contact.preferred_contact_end_local)}
                      </p>
                    </div>
                  )}
                  
                  {contact.preferred_contact_start_weekend_local && contact.preferred_contact_end_weekend_local && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Weekend Hours</label>
                      <p className="text-base">
                        {formatTime(contact.preferred_contact_start_weekend_local)} - {formatTime(contact.preferred_contact_end_weekend_local)}
                      </p>
                    </div>
                  )}
                  
                  {contact.preferred_contact_timezone && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Timezone</label>
                      <p className="text-base">{contact.preferred_contact_timezone}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {contact.is_emergency_contact && (
              <Card className="border-red-200">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2 text-red-700">
                    <AlertTriangle className="h-5 w-5" />
                    <span>Emergency Contact</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {contact.emergency_type && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Emergency Type</label>
                      <p className="text-base capitalize">{contact.emergency_type}</p>
                    </div>
                  )}
                  
                  {contact.emergency_notes && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Emergency Notes</label>
                      <p className="text-base">{contact.emergency_notes}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {contact.notes && (
              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle>Notes</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-base whitespace-pre-wrap">{contact.notes}</p>
                </CardContent>
              </Card>
            )}
          </div>

          <Separator />

          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Created by {createdByName} on {format(new Date(contact.created_at), "MMMM d, yyyy 'at' h:mm a")}</span>
            <span>Last updated {format(new Date(contact.updated_at), "MMMM d, yyyy 'at' h:mm a")}</span>
          </div>
        </TabsContent>

        <TabsContent value="associations" className="space-y-6">
          <UnifiedAssociationManager
            entityId={contact.id}
            entityType="contact"
            groupId={groupId}
            onNavigate={(type: string, id: string) => {
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
            }}
          />
        </TabsContent>

        <TabsContent value="activities">
          <ReverseLinkedItems contactId={contact.id} itemType="activity_logs" />
        </TabsContent>

        <TabsContent value="appointments">
          <ReverseLinkedItems contactId={contact.id} itemType="appointments" />
        </TabsContent>

        <TabsContent value="tasks">
          <ReverseLinkedItems contactId={contact.id} itemType="tasks" />
        </TabsContent>

        <TabsContent value="documents">
          <ReverseLinkedItems contactId={contact.id} itemType="documents" />
        </TabsContent>
      </Tabs>
    </div>
  );
}