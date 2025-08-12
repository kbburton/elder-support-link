import { useState, useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ExternalLink } from "lucide-react";

interface ReverseLinkedItemsProps {
  contactId: string;
  itemType: "activity_logs" | "appointments" | "tasks" | "documents";
}

export default function ReverseLinkedItems({ contactId, itemType }: ReverseLinkedItemsProps) {
  const { groupId } = useParams();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLinkedItems();
  }, [contactId, itemType]);

  const loadLinkedItems = async () => {
    try {
      let query;
      switch (itemType) {
        case "activity_logs":
          query = supabase
            .from("contact_activities")
            .select(`activity_logs!inner(id, title, date_time, type)`)
            .eq("contact_id", contactId);
          break;
        case "appointments":
          query = supabase
            .from("contact_appointments")
            .select(`appointments!inner(id, category, description, date_time)`)
            .eq("contact_id", contactId);
          break;
        case "tasks":
          query = supabase
            .from("contact_tasks")
            .select(`tasks!inner(id, title, status, due_date)`)
            .eq("contact_id", contactId);
          break;
        case "documents":
          query = supabase
            .from("contact_documents")
            .select(`documents!inner(id, title, category, upload_date)`)
            .eq("contact_id", contactId);
          break;
      }

      const { data, error } = await query;
      if (error) throw error;
      
      const linkedItems = data?.map((item: any) => item[itemType.slice(0, -1)] || item[itemType]).filter(Boolean) || [];
      setItems(linkedItems);
    } catch (error) {
      console.error("Error loading linked items:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Related {itemType.replace("_", " ").replace("s", "s")}</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="animate-pulse space-y-2">
            <div className="h-4 bg-gray-200 rounded"></div>
          </div>
        ) : items.length === 0 ? (
          <p className="text-muted-foreground">No {itemType.replace("_", " ")} linked to this contact.</p>
        ) : (
          <div className="space-y-2">
            {items.map((item) => (
              <div key={item.id} className="flex items-center justify-between p-2 border rounded">
                <div>
                  <span className="font-medium">{item.title || item.category}</span>
                  {item.date_time && (
                    <span className="text-sm text-muted-foreground ml-2">
                      {format(new Date(item.date_time), "MMM d, yyyy")}
                    </span>
                  )}
                </div>
                <Button variant="ghost" size="sm" asChild>
                  <Link to={`/app/${groupId}/${itemType === "activity_logs" ? "activity" : itemType}/${item.id}`}>
                    <ExternalLink className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}