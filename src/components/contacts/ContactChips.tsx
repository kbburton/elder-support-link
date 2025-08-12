import { Badge } from "@/components/ui/badge";
import { User } from "lucide-react";
import { useLinkedContacts, getContactDisplayName } from "@/hooks/useLinkedContacts";

interface ContactChipsProps {
  entityType: string;
  entityId: string;
  maxVisible?: number;
}

export default function ContactChips({ entityType, entityId, maxVisible = 3 }: ContactChipsProps) {
  const { data: contacts = [], isLoading } = useLinkedContacts(entityType, entityId);

  if (isLoading || contacts.length === 0) {
    return null;
  }

  const visibleContacts = contacts.slice(0, maxVisible);
  const remainingCount = Math.max(0, contacts.length - maxVisible);

  return (
    <div className="flex items-center gap-1 mt-1">
      <User className="h-3 w-3 text-muted-foreground" />
      <div className="flex gap-1 flex-wrap">
        {visibleContacts.map((contact) => (
          <Badge 
            key={contact.id} 
            variant="outline" 
            className="text-xs px-1 py-0 h-5"
          >
            {getContactDisplayName(contact)}
          </Badge>
        ))}
        {remainingCount > 0 && (
          <Badge variant="outline" className="text-xs px-1 py-0 h-5">
            +{remainingCount}
          </Badge>
        )}
      </div>
    </div>
  );
}