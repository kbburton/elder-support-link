import { Badge } from "@/components/ui/badge";
import { Clock, CheckSquare } from "lucide-react";

export function CalendarLegend() {
  return (
    <div className="flex flex-wrap gap-4 p-3 bg-muted/30 rounded-lg text-sm">
      {/* Entity Type Legend */}
      <div className="flex items-center gap-1">
        <Clock className="h-4 w-4" />
        <span>Appointments</span>
      </div>
      <div className="flex items-center gap-1">
        <CheckSquare className="h-4 w-4" />
        <span>Tasks</span>
      </div>
      
      {/* Appointment Categories */}
      <div className="flex items-center gap-1">
        <div className="w-3 h-3 rounded bg-purple-100 border border-purple-200"></div>
        <span>Medical</span>
      </div>
      <div className="flex items-center gap-1">
        <div className="w-3 h-3 rounded bg-red-100 border border-red-200"></div>
        <span>Financial/Legal</span>
      </div>
      <div className="flex items-center gap-1">
        <div className="w-3 h-3 rounded bg-teal-100 border border-teal-200"></div>
        <span>Personal/Social</span>
      </div>
      <div className="flex items-center gap-1">
        <div className="w-3 h-3 rounded bg-gray-100 border border-gray-200"></div>
        <span>Other</span>
      </div>
      
      {/* Task Status */}
      <div className="flex items-center gap-1">
        <div className="w-3 h-3 rounded bg-blue-100 border border-blue-200"></div>
        <span>Tasks</span>
      </div>
      <div className="flex items-center gap-1">
        <div className="w-3 h-3 rounded bg-blue-100 border-l-4 border-l-red-500 border-blue-200"></div>
        <span>Overdue Tasks</span>
      </div>
    </div>
  );
}