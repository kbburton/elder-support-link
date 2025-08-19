import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { X, Plus, Link, ChevronDown, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface Association {
  id: string;
  title: string;
  type: 'appointment' | 'task' | 'document' | 'contact' | 'activity';
  date?: string;
  status?: string;
  category?: string;
}

interface AssociationManagerProps {
  entityId: string | null;
  entityType: 'appointment' | 'task' | 'document' | 'contact' | 'activity';
  groupId: string;
  onNavigate?: (type: string, id: string) => void;
  showTitle?: boolean;
  className?: string;
}

export function AssociationManager({
  entityId,
  entityType,
  groupId,
  onNavigate,
  showTitle = true,
  className
}: AssociationManagerProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedType, setSelectedType] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);

  // Get existing associations
  const { data: associations = [] } = useQuery({
    queryKey: ['associations', entityType, entityId],
    queryFn: async () => {
      if (!entityId) return [];
      
      const associations: Association[] = [];
      
      // Fetch linked contacts
      if (entityType !== 'contact') {
          let contactTable = '';
          let contactIdField = '';
          
          if (entityType === 'activity') {
            contactTable = 'contact_activities';
            contactIdField = 'activity_log_id';
          } else if (entityType === 'appointment') {
            contactTable = 'contact_appointments'; 
            contactIdField = 'appointment_id';
          } else if (entityType === 'task') {
            contactTable = 'contact_tasks';
            contactIdField = 'task_id';
          } else if (entityType === 'document') {
            contactTable = 'contact_documents';
            contactIdField = 'document_id';
          }
        
        if (contactTable) {
          const { data: contactLinks } = await supabase
            .from(contactTable as any)
            .select(`
              contacts!inner(id, first_name, last_name, organization_name)
            `)
            .eq(contactIdField, entityId);
      
          contactLinks?.forEach((link: any) => {
            const contact = link.contacts;
            associations.push({
              id: contact.id,
              title: [contact.first_name, contact.last_name].filter(Boolean).join(' ') || contact.organization_name || 'Unnamed Contact',
              type: 'contact'
            });
          });
        }
      }

      // Fetch linked appointments
      if (entityType !== 'appointment') {
        let appointmentQuery = null;
        if (entityType === 'contact') {
          appointmentQuery = supabase
            .from('contact_appointments')
            .select(`
              appointments!inner(id, description, date_time, category)
            `)
            .eq('contact_id', entityId);
        } else if (entityType === 'document') {
          appointmentQuery = supabase
            .from('appointment_documents')
            .select(`
              appointments!inner(id, description, date_time, category)
            `)
            .eq('document_id', entityId);
        } else if (entityType === 'task') {
          appointmentQuery = supabase
            .from('appointment_tasks')
            .select(`
              appointments!inner(id, description, date_time, category)
            `)
            .eq('task_id', entityId);
        } else if (entityType === 'activity') {
          appointmentQuery = supabase
            .from('appointment_activities')
            .select(`
              appointments!inner(id, description, date_time, category)
            `)
            .eq('activity_log_id', entityId);
        }
        
        if (appointmentQuery) {
          const { data: appointmentLinks } = await appointmentQuery;
          appointmentLinks?.forEach((link: any) => {
            const appt = link.appointments;
            associations.push({
              id: appt.id,
              title: appt.description || 'Untitled Appointment',
              type: 'appointment',
              date: appt.date_time,
              category: appt.category
            });
          });
        }
      }

      // Fetch linked tasks
      if (entityType !== 'task') {
        let taskQuery = null;
        if (entityType === 'contact') {
          taskQuery = supabase
            .from('contact_tasks')
            .select(`
              tasks!inner(id, title, due_date, status, priority)
            `)
            .eq('contact_id', entityId);
        } else if (entityType === 'appointment') {
          taskQuery = supabase
            .from('appointment_tasks')
            .select(`
              tasks!inner(id, title, due_date, status, priority)
            `)
            .eq('appointment_id', entityId);
        } else if (entityType === 'document') {
          taskQuery = supabase
            .from('task_documents')
            .select(`
              tasks!inner(id, title, due_date, status, priority)
            `)
            .eq('document_id', entityId);
        } else if (entityType === 'activity') {
          taskQuery = supabase
            .from('task_activities')
            .select(`
              tasks!inner(id, title, due_date, status, priority)
            `)
            .eq('activity_log_id', entityId);
        }
        
        if (taskQuery) {
          const { data: taskLinks } = await taskQuery;
          taskLinks?.forEach((link: any) => {
            const task = link.tasks;
            associations.push({
              id: task.id,
              title: task.title || 'Untitled Task',
              type: 'task',
              date: task.due_date,
              status: task.status
            });
          });
        }
      }

      // Fetch linked documents
      if (entityType !== 'document') {
        let documentQuery = null;
        if (entityType === 'contact') {
          documentQuery = supabase
            .from('contact_documents')
            .select(`
              documents!inner(id, title, original_filename, upload_date, category)
            `)
            .eq('contact_id', entityId);
        } else if (entityType === 'appointment') {
          documentQuery = supabase
            .from('appointment_documents')
            .select(`
              documents!inner(id, title, original_filename, upload_date, category)
            `)
            .eq('appointment_id', entityId);
        } else if (entityType === 'task') {
          documentQuery = supabase
            .from('task_documents')
            .select(`
              documents!inner(id, title, original_filename, upload_date, category)
            `)
            .eq('task_id', entityId);
        }
        
        if (documentQuery) {
          const { data: documentLinks } = await documentQuery;
          documentLinks?.forEach((link: any) => {
            const doc = link.documents;
            associations.push({
              id: doc.id,
              title: doc.title || doc.original_filename || 'Untitled Document',
              type: 'document',
              date: doc.upload_date,
              category: doc.category
            });
          });
        }
      }

      // Fetch linked activities
      if (entityType !== 'activity') {
        let activityQuery = null;
        if (entityType === 'contact') {
          activityQuery = supabase
            .from('contact_activities')
            .select(`
              activity_logs!inner(id, title, type, date_time)
            `)
            .eq('contact_id', entityId);
        } else if (entityType === 'appointment') {
          activityQuery = supabase
            .from('appointment_activities')
            .select(`
              activity_logs!inner(id, title, type, date_time)
            `)
            .eq('appointment_id', entityId);
        } else if (entityType === 'task') {
          activityQuery = supabase
            .from('task_activities')
            .select(`
              activity_logs!inner(id, title, type, date_time)
            `)
            .eq('task_id', entityId);
        }
        
        if (activityQuery) {
          const { data: activityLinks } = await activityQuery;
          activityLinks?.forEach((link: any) => {
            const activity = link.activity_logs;
            associations.push({
              id: activity.id,
              title: activity.title || `${activity.type} Activity`,
              type: 'activity',
              date: activity.date_time
            });
          });
        }
      }

      return associations;
    },
    enabled: !!entityId
  });

  // Get available items for association
  const { data: availableItems = [] } = useQuery({
    queryKey: ['available-items', selectedType, groupId, searchTerm],
    queryFn: async () => {
      if (!selectedType || !groupId) return [];
      
      const excludeIds = associations
        .filter(a => a.type === selectedType)
        .map(a => a.id);

      let tableName: string;
      if (selectedType === 'contact') {
        tableName = 'contacts';
      } else if (selectedType === 'appointment') {
        tableName = 'appointments';
      } else if (selectedType === 'task') {
        tableName = 'tasks';
      } else if (selectedType === 'document') {
        tableName = 'documents';
      } else if (selectedType === 'activity') {
        tableName = 'activity_logs';
      } else {
        return [];
      }

      let query = supabase
        .from(tableName as any)
        .select('*')
        .eq(selectedType === 'contact' ? 'care_group_id' : 'group_id', groupId)
        .eq('is_deleted', false);

      if (excludeIds.length > 0) {
        query = query.not('id', 'in', `(${excludeIds.join(',')})`);
      }

      if (searchTerm) {
        switch (selectedType) {
          case 'contact':
            query = query.or(`first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%,organization_name.ilike.%${searchTerm}%`);
            break;
          case 'appointment':
            query = query.or(`description.ilike.%${searchTerm}%,location.ilike.%${searchTerm}%`);
            break;
          case 'task':
            query = query.or(`title.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`);
            break;
          case 'document':
            query = query.or(`title.ilike.%${searchTerm}%,original_filename.ilike.%${searchTerm}%`);
            break;
          case 'activity':
            query = query.or(`title.ilike.%${searchTerm}%,notes.ilike.%${searchTerm}%`);
            break;
        }
      }

      const { data } = await query.limit(10);
      return data || [];
    },
    enabled: !!selectedType && !!groupId
  });

  // Create association mutation
  const createAssociationMutation = useMutation({
    mutationFn: async ({ targetId }: { targetId: string }) => {
      if (!entityId) throw new Error('Entity ID is required');

      let tableName = '';
      let sourceColumn = '';
      let targetColumn = '';

      // Determine the junction table and columns based on entity types
      if (entityType === 'contact') {
        tableName = `contact_${selectedType === 'activity' ? 'activities' : selectedType}s`;
        sourceColumn = 'contact_id';
        targetColumn = `${selectedType === 'activity' ? 'activity_log' : selectedType}_id`;
      } else if (selectedType === 'contact') {
        tableName = `contact_${entityType === 'activity' ? 'activities' : entityType}s`;
        sourceColumn = 'contact_id';
        targetColumn = `${entityType === 'activity' ? 'activity_log' : entityType}_id`;
      } else if (entityType === 'appointment' && selectedType === 'document') {
        tableName = 'appointment_documents';
        sourceColumn = 'appointment_id';
        targetColumn = 'document_id';
      } else if (entityType === 'document' && selectedType === 'appointment') {
        tableName = 'appointment_documents';
        sourceColumn = 'appointment_id';
        targetColumn = 'document_id';
      } else if (entityType === 'task' && selectedType === 'document') {
        tableName = 'task_documents';
        sourceColumn = 'task_id';
        targetColumn = 'document_id';
      } else if (entityType === 'document' && selectedType === 'task') {
        tableName = 'task_documents';
        sourceColumn = 'task_id';
        targetColumn = 'document_id';
      } else if (entityType === 'appointment' && selectedType === 'task') {
        tableName = 'appointment_tasks';
        sourceColumn = 'appointment_id';
        targetColumn = 'task_id';
      } else if (entityType === 'task' && selectedType === 'appointment') {
        tableName = 'appointment_tasks';
        sourceColumn = 'appointment_id';
        targetColumn = 'task_id';
      } else if (entityType === 'appointment' && selectedType === 'activity') {
        tableName = 'appointment_activities';
        sourceColumn = 'appointment_id';
        targetColumn = 'activity_log_id';
      } else if (entityType === 'activity' && selectedType === 'appointment') {
        tableName = 'appointment_activities';
        sourceColumn = 'appointment_id';
        targetColumn = 'activity_log_id';
      } else if (entityType === 'task' && selectedType === 'activity') {
        tableName = 'task_activities';
        sourceColumn = 'task_id';
        targetColumn = 'activity_log_id';
      } else if (entityType === 'activity' && selectedType === 'task') {
        tableName = 'task_activities';
        sourceColumn = 'task_id';
        targetColumn = 'activity_log_id';
      }

      if (!tableName) {
        throw new Error(`Association between ${entityType} and ${selectedType} is not supported yet`);
      }

      const insertData = entityType === 'contact' || selectedType === 'contact' 
        ? (entityType === 'contact' 
            ? { [sourceColumn]: entityId, [targetColumn]: targetId }
            : { [sourceColumn]: targetId, [targetColumn]: entityId })
        : (entityType === 'appointment' && selectedType === 'task') || (entityType === 'task' && selectedType === 'appointment')
            ? { appointment_id: entityType === 'appointment' ? entityId : targetId, task_id: entityType === 'task' ? entityId : targetId }
        : (entityType === 'appointment' && selectedType === 'activity') || (entityType === 'activity' && selectedType === 'appointment')
            ? { appointment_id: entityType === 'appointment' ? entityId : targetId, activity_log_id: entityType === 'activity' ? entityId : targetId }
        : (entityType === 'task' && selectedType === 'activity') || (entityType === 'activity' && selectedType === 'task')
            ? { task_id: entityType === 'task' ? entityId : targetId, activity_log_id: entityType === 'activity' ? entityId : targetId }
        : { [sourceColumn]: entityId, [targetColumn]: targetId };

      const { error } = await supabase
        .from(tableName as any)
        .insert(insertData);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['associations', entityType, entityId] });
      queryClient.invalidateQueries({ queryKey: ['available-items'] });
      setSelectedType('');
      setSearchTerm('');
      setShowAddForm(false);
      toast({ title: "Success", description: "Association created successfully." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  // Remove association mutation
  const removeAssociationMutation = useMutation({
    mutationFn: async (association: Association) => {
      if (!entityId) throw new Error('Entity ID is required');

      let tableName = '';
      let sourceColumn = '';
      let targetColumn = '';

      // Same logic as create but for deletion
      if (entityType === 'contact') {
        tableName = `contact_${association.type === 'activity' ? 'activities' : association.type}s`;
        sourceColumn = 'contact_id';
        targetColumn = `${association.type === 'activity' ? 'activity_log' : association.type}_id`;
      } else if (association.type === 'contact') {
        tableName = `contact_${entityType === 'activity' ? 'activities' : entityType}s`;
        sourceColumn = 'contact_id';
        targetColumn = `${entityType === 'activity' ? 'activity_log' : entityType}_id`;
      } else if (entityType === 'appointment' && association.type === 'document') {
        tableName = 'appointment_documents';
        sourceColumn = 'appointment_id';
        targetColumn = 'document_id';
      } else if (entityType === 'document' && association.type === 'appointment') {
        tableName = 'appointment_documents';
        sourceColumn = 'appointment_id'; 
        targetColumn = 'document_id';
      } else if (entityType === 'task' && association.type === 'document') {
        tableName = 'task_documents';
        sourceColumn = 'task_id';
        targetColumn = 'document_id';
      } else if (entityType === 'document' && association.type === 'task') {
        tableName = 'task_documents';
        sourceColumn = 'task_id';
        targetColumn = 'document_id';
      } else if (entityType === 'appointment' && association.type === 'task') {
        tableName = 'appointment_tasks';
        sourceColumn = 'appointment_id';
        targetColumn = 'task_id';
      } else if (entityType === 'task' && association.type === 'appointment') {
        tableName = 'appointment_tasks';
        sourceColumn = 'appointment_id';
        targetColumn = 'task_id';
      } else if (entityType === 'appointment' && association.type === 'activity') {
        tableName = 'appointment_activities';
        sourceColumn = 'appointment_id';
        targetColumn = 'activity_log_id';
      } else if (entityType === 'activity' && association.type === 'appointment') {
        tableName = 'appointment_activities';
        sourceColumn = 'appointment_id';
        targetColumn = 'activity_log_id';
      } else if (entityType === 'task' && association.type === 'activity') {
        tableName = 'task_activities';
        sourceColumn = 'task_id';
        targetColumn = 'activity_log_id';
      } else if (entityType === 'activity' && association.type === 'task') {
        tableName = 'task_activities';
        sourceColumn = 'task_id';
        targetColumn = 'activity_log_id';
      }

      if (!tableName) return;

      const whereCondition = entityType === 'contact' || association.type === 'contact'
        ? (entityType === 'contact'
            ? { [sourceColumn]: entityId, [targetColumn]: association.id }
            : { [sourceColumn]: association.id, [targetColumn]: entityId })
        : (entityType === 'appointment' && association.type === 'task') || (entityType === 'task' && association.type === 'appointment')
            ? { appointment_id: entityType === 'appointment' ? entityId : association.id, task_id: entityType === 'task' ? entityId : association.id }
        : (entityType === 'appointment' && association.type === 'activity') || (entityType === 'activity' && association.type === 'appointment')
            ? { appointment_id: entityType === 'appointment' ? entityId : association.id, activity_log_id: entityType === 'activity' ? entityId : association.id }
        : (entityType === 'task' && association.type === 'activity') || (entityType === 'activity' && association.type === 'task')
            ? { task_id: entityType === 'task' ? entityId : association.id, activity_log_id: entityType === 'activity' ? entityId : association.id }
        : { [sourceColumn]: entityId, [targetColumn]: association.id };

      const { error } = await supabase
        .from(tableName as any)
        .delete()
        .match(whereCondition);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['associations', entityType, entityId] });
      toast({ title: "Success", description: "Association removed successfully." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  const getAssociationIcon = (type: string) => {
    switch (type) {
      case 'contact': return '👤';
      case 'appointment': return '📅';
      case 'task': return '✓';
      case 'document': return '📄';
      case 'activity': return '📝';
      default: return '🔗';
    }
  };

  const getAssociationColor = (type: string) => {
    switch (type) {
      case 'contact': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'appointment': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'task': return 'bg-green-100 text-green-800 border-green-200';
      case 'document': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'activity': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getItemDisplayName = (item: any, type: string) => {
    switch (type) {
      case 'contact':
        return [item.first_name, item.last_name].filter(Boolean).join(' ') || item.organization_name || 'Unnamed Contact';
      case 'appointment':
        return item.description || 'Untitled Appointment';
      case 'task':
        return item.title || 'Untitled Task';
      case 'document':
        return item.title || item.original_filename || 'Untitled Document';
      case 'activity':
        return item.title || `${item.type} Activity`;
      default:
        return item.name || item.title || 'Unnamed Item';
    }
  };

  if (!entityId) return null;

  return (
    <div className={cn("space-y-4", className)}>
      {showTitle && (
        <div className="flex items-center gap-2">
          <Link className="h-5 w-5 text-muted-foreground" />
          <Label className="text-base font-medium">Related Items</Label>
        </div>
      )}

      {/* Existing Associations */}
      {associations.length > 0 && (
        <div className="space-y-2">
          {associations.map((association) => (
            <div
              key={`${association.type}-${association.id}`}
              className={cn(
                "flex items-center justify-between p-3 rounded-lg border",
                getAssociationColor(association.type)
              )}
            >
              <div className="flex items-center gap-3">
                <span className="text-lg">{getAssociationIcon(association.type)}</span>
                <div>
                  <div className="font-medium">{association.title}</div>
                  <div className="text-xs opacity-75 capitalize">
                    {association.type}
                    {association.date && ` • ${new Date(association.date).toLocaleDateString()}`}
                    {association.status && ` • ${association.status}`}
                    {association.category && ` • ${association.category}`}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {onNavigate && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onNavigate(association.type, association.id)}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeAssociationMutation.mutate(association)}
                  disabled={removeAssociationMutation.isPending}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add New Association */}
      <div className="space-y-3">
        {!showAddForm ? (
          <Button
            variant="outline"
            onClick={() => setShowAddForm(true)}
            className="w-full"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Association
          </Button>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Add New Association</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label>Type</Label>
                <Select value={selectedType} onValueChange={setSelectedType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type..." />
                  </SelectTrigger>
                  <SelectContent>
                    {entityType !== 'contact' && <SelectItem value="contact">Contacts</SelectItem>}
                    {entityType !== 'appointment' && <SelectItem value="appointment">Appointments</SelectItem>}
                    {entityType !== 'task' && <SelectItem value="task">Tasks</SelectItem>}
                    {entityType !== 'document' && <SelectItem value="document">Documents</SelectItem>}
                    {entityType !== 'activity' && <SelectItem value="activity">Activities</SelectItem>}
                  </SelectContent>
                </Select>
              </div>

              {selectedType && (
                <div>
                  <Label>Search {selectedType}s</Label>
                  <Input
                    placeholder={`Search for ${selectedType}s...`}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  
                  {availableItems.length > 0 && (
                    <div className="mt-2 max-h-48 overflow-y-auto space-y-1 border rounded-md p-2">
                      {availableItems.map((item: any) => (
                        <button
                          key={item.id}
                          onClick={() => createAssociationMutation.mutate({ targetId: item.id })}
                          disabled={createAssociationMutation.isPending}
                          className="w-full text-left p-2 hover:bg-muted rounded text-sm"
                        >
                          {getItemDisplayName(item, selectedType)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowAddForm(false);
                    setSelectedType('');
                    setSearchTerm('');
                  }}
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
