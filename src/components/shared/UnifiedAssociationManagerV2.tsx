import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { X, Plus, Search, FileText, CheckSquare, Calendar, Users, ClipboardList, ExternalLink } from "lucide-react";
import { 
  useAssociationsV2, 
  useAvailableItemsV2, 
  useCreateAssociationV2, 
  useRemoveAssociationV2,
  EntityType 
} from "@/hooks/useUnifiedAssociationsV2";

interface UnifiedAssociationManagerV2Props {
  entityId: string;
  entityType: EntityType;
  groupId: string;
  onNavigate?: (type: EntityType, id: string) => void;
  showAddForm?: boolean;
}

const entityTypeLabels: Record<EntityType, string> = {
  document: "Documents",
  task: "Tasks",
  appointment: "Appointments",
  contact: "Contacts",
  activity_log: "Activities",
};

const entityTypeIcons: Record<EntityType, any> = {
  document: FileText,
  task: CheckSquare,
  appointment: Calendar,
  contact: Users,
  activity_log: ClipboardList,
};

const entityTypeColors: Record<EntityType, string> = {
  document: "bg-blue-500",
  task: "bg-green-500",
  appointment: "bg-purple-500",
  contact: "bg-orange-500",
  activity_log: "bg-pink-500",
};

export function UnifiedAssociationManagerV2({
  entityId,
  entityType,
  groupId,
  onNavigate,
  showAddForm: initialShowAddForm = false,
}: UnifiedAssociationManagerV2Props) {
  const [showAddForm, setShowAddForm] = useState(initialShowAddForm);
  const [selectedType, setSelectedType] = useState<EntityType | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const { data: associations = [], isLoading: loadingAssociations } = useAssociationsV2(
    entityId,
    entityType,
    groupId
  );

  const { data: availableItems = [], isLoading: loadingAvailable } = useAvailableItemsV2(
    selectedType,
    groupId,
    entityId,
    entityType
  );

  const createMutation = useCreateAssociationV2(entityId, entityType, groupId);
  const removeMutation = useRemoveAssociationV2(entityId, entityType, groupId);

  const handleAdd = async (targetId: string, targetType: EntityType) => {
    await createMutation.mutateAsync({ targetId, targetType });
    setSearchTerm("");
  };

  const handleRemove = async (targetId: string, targetType: EntityType) => {
    await removeMutation.mutateAsync({ targetId, targetType });
  };

  const filteredItems = availableItems.filter((item) =>
    item.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getIcon = (type: EntityType) => {
    const Icon = entityTypeIcons[type];
    return <Icon className="h-4 w-4" />;
  };

  const getColorClass = (type: EntityType) => entityTypeColors[type];

  return (
    <div className="space-y-4">
      {/* Existing Associations */}
      <div>
        <h3 className="text-sm font-medium mb-3">Related Items</h3>
        {loadingAssociations ? (
          <p className="text-sm text-muted-foreground">Loading associations...</p>
        ) : associations.length === 0 ? (
          <p className="text-sm text-muted-foreground">No associations yet</p>
        ) : (
          <div className="space-y-2">
            {associations.map((item) => (
              <Card key={`${item.type}-${item.id}`} className="p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-1">
                    <div className={`p-1.5 rounded ${getColorClass(item.type)}`}>
                      {getIcon(item.type)}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{item.title}</p>
                      <Badge variant="outline" className="text-xs">
                        {entityTypeLabels[item.type]}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {onNavigate && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onNavigate(item.type, item.id)}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemove(item.id, item.type)}
                      disabled={removeMutation.isPending}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Add New Association */}
      {!showAddForm ? (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowAddForm(true)}
          className="w-full"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Association
        </Button>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Add Association</CardTitle>
            <CardDescription>Link this item to another entity in this group</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Select
              value={selectedType || ""}
              onValueChange={(value) => {
                setSelectedType(value as EntityType);
                setSearchTerm("");
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select type..." />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(entityTypeLabels).map(([type, label]) => (
                  <SelectItem key={type} value={type}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {selectedType && (
              <>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={`Search ${entityTypeLabels[selectedType]}...`}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>

                {loadingAvailable ? (
                  <p className="text-sm text-muted-foreground">Loading...</p>
                ) : filteredItems.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {searchTerm ? "No matching items found" : "No items available"}
                  </p>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {filteredItems.map((item) => (
                      <Card
                        key={item.id}
                        className="p-3 cursor-pointer hover:bg-accent transition-colors"
                        onClick={() => handleAdd(item.id, item.type)}
                      >
                        <div className="flex items-center gap-2">
                          <div className={`p-1.5 rounded ${getColorClass(item.type)}`}>
                            {getIcon(item.type)}
                          </div>
                          <p className="text-sm font-medium flex-1">{item.title}</p>
                          <Plus className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </>
            )}

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowAddForm(false);
                  setSelectedType(null);
                  setSearchTerm("");
                }}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
