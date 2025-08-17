import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Users, Plus, Search, Filter, Phone, Mail, MapPin, Download, Trash2, MoreVertical, RotateCcw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { generateVCardFile } from "@/utils/vcard";
import { useDemoContacts } from "@/hooks/useDemoData";
import { useDemoOperations } from "@/hooks/useDemoOperations";
import { useDeletion } from "@/hooks/useDeletion";
import { DeleteConfirm } from "@/components/delete/DeleteConfirm";
import { BulkDeleteBar } from "@/components/delete/BulkDeleteBar";
import SEO from "@/components/layout/SEO";

interface Contact {
  id: string;
  first_name: string | null;
  last_name: string | null;
  organization_name: string | null;
  contact_type: string;
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
  is_emergency_contact: boolean;
  created_at: string;
  is_deleted?: boolean;
}

export default function ContactsPage() {
  const { groupId } = useParams();
  const { toast } = useToast();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [emergencyFilter, setEmergencyFilter] = useState(false);
  const [showTrash, setShowTrash] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    ids: string[];
    isRestore?: boolean;
  }>({ isOpen: false, ids: [] });

  const { blockCreate, blockUpload } = useDemoOperations();
  const demoData = useDemoContacts(groupId);
  const { softDelete, restore, isLoading: deletionLoading } = useDeletion();

  useEffect(() => {
    // Use demo data if in demo mode
    if (demoData.isDemo) {
      setContacts(demoData.data || []);
      setLoading(false);
      return;
    }
    
    loadContacts();
  }, [groupId, demoData.isDemo, showTrash]);

  const loadContacts = async () => {
    if (!groupId) return;
    
    try {
      const { data, error } = await supabase
        .from("contacts")
        .select("*")
        .eq("care_group_id", groupId)
        .order("last_name");

      if (error) throw error;
      setContacts((data || []).filter((contact: any) => 
        showTrash ? contact.is_deleted : !contact.is_deleted
      ));
    } catch (error) {
      console.error("Error loading contacts:", error);
      toast({
        title: "Error",
        description: "Failed to load contacts",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredContacts = contacts.filter(contact => {
    const matchesSearch = searchTerm === "" || 
      (contact.first_name?.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (contact.last_name?.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (contact.organization_name?.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesType = typeFilter === "all" || contact.contact_type === typeFilter;
    const matchesEmergency = !emergencyFilter || contact.is_emergency_contact;
    
    return matchesSearch && matchesType && matchesEmergency;
  });

  const exportContacts = (selectedContacts?: Contact[]) => {
    const contactsToExport = selectedContacts || filteredContacts;
    if (contactsToExport.length === 0) {
      toast({
        title: "No contacts to export",
        description: "Please select contacts to export or clear your filters.",
        variant: "destructive",
      });
      return;
    }
    
    generateVCardFile(contactsToExport);
    toast({
      title: "Export successful",
      description: `Exported ${contactsToExport.length} contact(s) to vCard file.`,
    });
  };

  const handleAddContact = () => {
    if (blockCreate()) return;
    window.location.href = `/app/${groupId}/contacts/new`;
  };

  const handleImportContacts = () => {
    if (blockUpload()) return;
    window.location.href = `/app/${groupId}/contacts/import`;
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(filteredContacts.map(c => c.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectContact = (contactId: string, checked: boolean) => {
    if (checked) {
      setSelectedIds(prev => [...prev, contactId]);
    } else {
      setSelectedIds(prev => prev.filter(id => id !== contactId));
    }
  };

  const handleDelete = (ids: string[]) => {
    setDeleteConfirm({ isOpen: true, ids, isRestore: false });
  };

  const handleRestore = (ids: string[]) => {
    setDeleteConfirm({ isOpen: true, ids, isRestore: true });
  };

  const confirmAction = async () => {
    const success = deleteConfirm.isRestore 
      ? await restore(deleteConfirm.ids, 'contact')
      : await softDelete(deleteConfirm.ids, 'contact');
    
    if (success) {
      setSelectedIds([]);
      loadContacts();
    }
    
    setDeleteConfirm({ isOpen: false, ids: [] });
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

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-10 bg-gray-200 rounded"></div>
          <div className="h-96 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <>
      <SEO title="Contacts — DaveAssist" description="Manage care team contacts and emergency information" />
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Users className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-semibold">
              {showTrash ? "Deleted Contacts" : "Contacts"}
            </h1>
            <Badge variant="outline">{contacts.length} contacts</Badge>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant={showTrash ? "default" : "outline"}
              onClick={() => {
                setShowTrash(!showTrash);
                setSelectedIds([]);
              }}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {showTrash ? "Exit Trash" : "View Trash"}
            </Button>
            {!showTrash && (
              <>
                <Button onClick={handleAddContact}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Contact
                </Button>
                <Button variant="outline" onClick={handleImportContacts}>
                  <Plus className="h-4 w-4 mr-2" />
                  Import CSV
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => exportContacts()}
                  disabled={filteredContacts.length === 0}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export vCard
                </Button>
              </>
            )}
          </div>
        </div>

        <BulkDeleteBar
          selectedIds={selectedIds}
          entityType="contact"
          onDelete={showTrash ? handleRestore : handleDelete}
          onClearSelection={() => setSelectedIds([])}
          isLoading={deletionLoading}
        />

        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search contacts..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-48">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Filter by type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="medical">Medical</SelectItem>
                  <SelectItem value="legal">Legal</SelectItem>
                  <SelectItem value="family">Family</SelectItem>
                  <SelectItem value="friend">Friend</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant={emergencyFilter ? "default" : "outline"}
                onClick={() => setEmergencyFilter(!emergencyFilter)}
                className="whitespace-nowrap"
              >
                Emergency Only
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectedIds.length === filteredContacts.length && filteredContacts.length > 0}
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Organization</TableHead>
                  <TableHead>Primary Phone</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredContacts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      {showTrash 
                        ? "No deleted contacts found"
                        : searchTerm || typeFilter !== "all" || emergencyFilter 
                          ? "No contacts match your filters" 
                          : "No contacts found. Create your first contact to get started."
                      }
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredContacts.map((contact) => (
                    <TableRow key={contact.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.includes(contact.id)}
                          onCheckedChange={(checked) => handleSelectContact(contact.id, checked as boolean)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <div>
                            <div className="font-medium">{getContactName(contact)}</div>
                            {contact.is_emergency_contact && (
                              <Badge variant="destructive" className="text-xs">Emergency</Badge>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={getContactTypeColor(contact.contact_type)}>
                          {contact.contact_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {contact.organization_name || "-"}
                      </TableCell>
                      <TableCell>
                        {contact.phone_primary ? (
                          <div className="flex items-center space-x-2">
                            <Phone className="h-3 w-3 text-muted-foreground" />
                            <span className="text-sm">{contact.phone_primary}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {contact.city && contact.state ? (
                          <div className="flex items-center space-x-2">
                            <MapPin className="h-3 w-3 text-muted-foreground" />
                            <span className="text-sm">{contact.city}, {contact.state}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {format(new Date(contact.created_at), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {!showTrash ? (
                              <>
                                <DropdownMenuItem asChild>
                                  <Link to={`/app/${groupId}/contacts/${contact.id}`}>
                                    View Details
                                  </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleDelete([contact.id])}
                                  className="text-destructive"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </>
                            ) : (
                              <DropdownMenuItem
                                onClick={() => handleRestore([contact.id])}
                              >
                                <RotateCcw className="h-4 w-4 mr-2" />
                                Restore
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <DeleteConfirm
          isOpen={deleteConfirm.isOpen}
          onClose={() => setDeleteConfirm({ isOpen: false, ids: [] })}
          onConfirm={confirmAction}
          entityType="contact"
          count={deleteConfirm.ids.length}
          isLoading={deletionLoading}
        />
      </div>
    </>
  );
}