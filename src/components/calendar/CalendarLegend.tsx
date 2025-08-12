import { Clock, CheckSquare } from "lucide-react";

export type LegendProps = {
  className?: string;
  layout?: "horizontal" | "compact";
};

export function CalendarLegend({ className = "", layout = "horizontal" }: LegendProps) {
  const containerClass = layout === "compact" 
    ? "flex flex-wrap gap-4 text-xs" 
    : "flex flex-wrap gap-6 text-xs";

  return (
    <div className={`${containerClass} ${className}`}>
      {/* Appointments */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1">
          <Clock className="h-3 w-3 text-muted-foreground" />
          <span className="font-medium">Appointments:</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-purple-100 border border-purple-200 rounded"></div>
          <span>Medical</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-red-100 border border-red-200 rounded"></div>
          <span>Legal/Financial</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-teal-100 border border-teal-200 rounded"></div>
          <span>Personal/Other</span>
        </div>
      </div>
      
      {/* Tasks */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1">
          <CheckSquare className="h-3 w-3 text-muted-foreground" />
          <span className="font-medium">Tasks:</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-blue-100 border border-blue-200 rounded"></div>
          <span>Normal</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-blue-100 border border-blue-200 rounded opacity-50"></div>
          <span>Completed</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-blue-100 border-l-4 border-l-red-500 border-r border-r-blue-200 border-t border-t-blue-200 border-b border-b-blue-200 rounded"></div>
          <span>Overdue</span>
        </div>
      </div>
    </div>
  );
}