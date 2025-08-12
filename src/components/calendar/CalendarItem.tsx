import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Clock, CheckSquare } from "lucide-react";
import { format, parseISO } from "date-fns";

export type CalendarItemProps = {
  entityType: "appointment" | "task";
  id: string;
  title: string;
  startTime?: string; // ISO datetime for appointments
  dueDate?: string; // ISO date for tasks
  category: string | null;
  isCompleted?: boolean;
  isOverdue?: boolean;
  location?: string | null;
  created_by_email?: string | null;
  onClick: () => void;
  className?: string;
  size?: "small" | "medium" | "large";
  showDetails?: boolean;
};

const CATEGORIES = ["Medical", "Financial/Legal", "Personal/Social", "Other"] as const;
type Category = typeof CATEGORIES[number];

const categoryToToken: Record<Category, { badgeVariant: "default" | "secondary" | "outline"; dotClass: string }> = {
  "Medical": { badgeVariant: "default", dotClass: "bg-purple-600" },
  "Financial/Legal": { badgeVariant: "secondary", dotClass: "bg-red-600" },
  "Personal/Social": { badgeVariant: "outline", dotClass: "bg-teal-600" },
  "Other": { badgeVariant: "outline", dotClass: "bg-teal-600" },
};

export function CalendarItem({
  entityType,
  id,
  title,
  startTime,
  dueDate,
  category,
  isCompleted = false,
  isOverdue = false,
  location,
  created_by_email,
  onClick,
  className,
  size = "medium",
  showDetails = false,
}: CalendarItemProps) {
  const getCategoryColor = (category: string | null, type: "appointment" | "task", isCompleted: boolean, isOverdue: boolean) => {
    const opacity = isCompleted ? "opacity-50" : "";
    
    if (type === "task") {
      const taskClass = "bg-blue-100 text-blue-800 border-blue-200";
      return `${taskClass} ${opacity}`;
    }
    
    switch (category) {
      case "Medical": return `bg-purple-100 text-purple-800 border-purple-200 ${opacity}`;
      case "Financial/Legal": return `bg-red-100 text-red-800 border-red-200 ${opacity}`;
      case "Personal/Social": return `bg-teal-100 text-teal-800 border-teal-200 ${opacity}`;
      default: return `bg-teal-100 text-teal-800 border-teal-200 ${opacity}`; // Personal/Other default
    }
  };

  const formatTime = () => {
    if (entityType === "appointment" && startTime) {
      return format(parseISO(startTime), "h:mm a");
    }
    if (entityType === "task" && dueDate) {
      return `Due: ${format(new Date(dueDate), "MMM d")}`;
    }
    return "";
  };

  const sizeClasses = {
    small: "text-xs p-1",
    medium: "text-sm p-2",
    large: "text-base p-3",
  };

  const iconSize = {
    small: "h-3 w-3",
    medium: "h-4 w-4",
    large: "h-5 w-5",
  };

  return (
    <div
      role="button"
      tabIndex={0}
      className={cn(
        "rounded border cursor-pointer hover:scale-105 transition-transform focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1",
        getCategoryColor(category, entityType, isCompleted, isOverdue),
        isOverdue && "border-red-500 border-l-4",
        sizeClasses[size],
        className
      )}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        onClick();
      }}
      title={`${title}${formatTime() ? ` • ${formatTime()}` : ''}${location ? ` • ${location}` : ''}${created_by_email ? ` • Created by ${created_by_email}` : ''}`}
    >
      <div className="flex items-center gap-1">
        {entityType === "appointment" ? (
          <Clock className={cn(iconSize[size], "flex-shrink-0")} />
        ) : (
          <CheckSquare className={cn(
            iconSize[size], 
            "flex-shrink-0",
            isCompleted ? "text-green-600" : "text-current"
          )} />
        )}
        <span className="truncate flex-1">{title}</span>
        {category && size !== "small" && (
          <Badge 
            variant={categoryToToken[category as Category]?.badgeVariant ?? "outline"}
            className="text-xs"
          >
            {category}
          </Badge>
        )}
        {isCompleted && size !== "small" && (
          <Badge variant="secondary" className="text-xs">
            {entityType === "appointment" ? "Recorded" : "Done"}
          </Badge>
        )}
        {isOverdue && (
          <Badge variant="destructive" className="text-xs">
            Overdue
          </Badge>
        )}
      </div>

      {/* Time/Date info */}
      {formatTime() && size !== "small" && (
        <div className="text-[10px] opacity-75 mt-1 ml-4">
          {formatTime()}
        </div>
      )}

      {/* Location for appointments */}
      {location && showDetails && (
        <div className="text-[10px] opacity-75 mt-1 ml-4 truncate">
          {location}
        </div>
      )}

      {/* Additional details for large size */}
      {showDetails && size === "large" && created_by_email && (
        <div className="text-xs text-muted-foreground mt-2">
          Created by: {created_by_email}
        </div>
      )}
    </div>
  );
}