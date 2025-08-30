import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface RelationshipSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (relationship: string) => void;
  groupName?: string;
  loading?: boolean;
}

const RELATIONSHIP_OPTIONS = [
  { value: 'child', label: 'Child' },
  { value: 'spouse', label: 'Spouse/Partner' },
  { value: 'parent', label: 'Parent' },
  { value: 'sibling', label: 'Sibling' },
  { value: 'other_relative', label: 'Other Relative' },
  { value: 'friend', label: 'Friend' },
  { value: 'caregiver', label: 'Caregiver' },
  { value: 'healthcare_provider', label: 'Healthcare Provider' },
  { value: 'family_member', label: 'Family Member' },
  { value: 'other', label: 'Other' },
];

export const RelationshipSelectionModal: React.FC<RelationshipSelectionModalProps> = ({
  isOpen,
  onClose,
  onSelect,
  groupName,
  loading = false,
}) => {
  const [selectedRelationship, setSelectedRelationship] = useState<string>('family_member');

  const handleSubmit = () => {
    onSelect(selectedRelationship);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Join {groupName || 'Care Group'}</DialogTitle>
          <DialogDescription>
            Please select your relationship to the care recipient to complete joining this care group.
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4">
          <Label className="text-base font-medium">Your relationship to the care recipient:</Label>
          <RadioGroup
            value={selectedRelationship}
            onValueChange={setSelectedRelationship}
            className="mt-3 space-y-2"
          >
            {RELATIONSHIP_OPTIONS.map((option) => (
              <div key={option.value} className="flex items-center space-x-2">
                <RadioGroupItem value={option.value} id={option.value} />
                <Label htmlFor={option.value} className="font-normal cursor-pointer">
                  {option.label}
                </Label>
              </div>
            ))}
          </RadioGroup>
        </div>
        
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? "Joining..." : "Join Care Group"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};