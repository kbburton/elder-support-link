export const getPriorityBadgeVariant = (priority: string | null | undefined): "default" | "secondary" | "destructive" | "outline" => {
  if (!priority) return "outline";
  
  switch (priority.toLowerCase()) {
    case "high":
      return "destructive";
    case "medium":
      return "secondary";
    case "low":
      return "outline";
    default:
      return "default";
  }
};