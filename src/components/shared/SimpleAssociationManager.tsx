import { useState } from "react";
import { useAssociations, useAvailableItems, useCreateAssociation, useRemoveAssociation, EntityType } from "@/hooks/useUnifiedAssociations";
import { ENTITY } from "@/constants/entities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Plus, Link, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

interface SimpleAssociationManagerProps {
  entityId: string;
  entityType: EntityType;
  groupId: string;
  onNavigate?: (type: string, id: string) => void;
  showTitle?: boolean;
}

export function SimpleAssociationManager({ 
  entityId, 
  entityType, 
  groupId, 
  onNavigate,
  showTitle = true 
}: SimpleAssociationManagerProps) {
  const [selectedType, setSelectedType] = useState<EntityType | "">("")
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);

  // Use unified association hooks
  const { data: associations = [], isLoading: associationsLoading } = useAssociations(entityId, entityType);
  const { data: availableItems = [], isLoading: itemsLoading } = useAvailableItems(
    entityType, 
    selectedType as EntityType, 
    groupId, 
    searchTerm
  );
  
  const createAssociationMutation = useCreateAssociation();
  const removeAssociationMutation = useRemoveAssociation();

  const getAssociationIcon = (type: EntityType) => {
    switch (type) {
      case ENTITY.contact: return '👤';
      case ENTITY.appointment: return '📅';
      case ENTITY.task: return '✓';
      case ENTITY.document: return '📄';
      case ENTITY.activity_log: return '📝';
      default: return '🔗';
    }
  };

  const getAssociationColor = (type: EntityType) => {
    switch (type) {
      case ENTITY.contact: return 'bg-blue-100 text-blue-800 border-blue-200';
      case ENTITY.appointment: return 'bg-purple-100 text-purple-800 border-purple-200';
      case ENTITY.task: return 'bg-green-100 text-green-800 border-green-200';
      case ENTITY.document: return 'bg-orange-100 text-orange-800 border-orange-200';
      case ENTITY.activity_log: return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getItemDisplayName = (item: any, type: EntityType) => {
    switch (type) {
      case ENTITY.contact:
        return [item.first_name, item.last_name].filter(Boolean).join(' ') || item.organization_name || 'Unnamed Contact';
      case ENTITY.appointment:
        return item.description || 'Untitled Appointment';
      case ENTITY.task:
        return item.title || 'Untitled Task';
      case ENTITY.document:
        return item.title || item.original_filename || 'Untitled Document';
      case ENTITY.activity_log:
        return item.title || `${item.type} Activity`;
      default:
        return item.name || item.title || 'Unnamed Item';
    }
  };

  if (!entityId) return null;

  return (
    <div className="space-y-4">
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
                    {association.type === ENTITY.activity_log ? 'Activity' : association.type}
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
                  onClick={() => removeAssociationMutation.mutate({ 
                    entityId,
                    entityType,
                    targetType: association.type, 
                    targetId: association.id 
                  })}
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
                <Select value={selectedType} onValueChange={(value) => setSelectedType(value as EntityType)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type to add..." />
                  </SelectTrigger>
                  <SelectContent>
                    {entityType !== ENTITY.contact && <SelectItem value={ENTITY.contact}>👤 Contact</SelectItem>}
                    {entityType !== ENTITY.appointment && <SelectItem value={ENTITY.appointment}>📅 Appointment</SelectItem>}
                    {entityType !== ENTITY.task && <SelectItem value={ENTITY.task}>✅ Task</SelectItem>}
                    {entityType !== ENTITY.document && <SelectItem value={ENTITY.document}>📄 Document</SelectItem>}
                    {entityType !== ENTITY.activity_log && <SelectItem value={ENTITY.activity_log}>📝 Activity</SelectItem>}
                  </SelectContent>
                </Select>
              </div>

              {selectedType && (
                <div>
                  <Label>Search {selectedType === ENTITY.activity_log ? 'activities' : selectedType + 's'}</Label>
                  <Input
                    placeholder={`Search for ${selectedType === ENTITY.activity_log ? 'activities' : selectedType + 's'}...`}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  
                  {availableItems.length > 0 && (
                    <div className="mt-2 max-h-48 overflow-y-auto space-y-1 border rounded-md p-2">
                      {availableItems.map((item: any) => (
                        <button
                          key={item.id}
                          disabled={createAssociationMutation.isPending}
                          className="w-full text-left p-2 hover:bg-muted rounded text-sm disabled:opacity-50"
                          onClick={() => {
                            createAssociationMutation.mutate({ 
                              entityId,
                              entityType,
                              targetType: selectedType as EntityType, 
                              targetId: item.id 
                            });
                          }}
                        >
                          {getItemDisplayName(item, selectedType as EntityType)}
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
