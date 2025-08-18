import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, NotebookPen, Calendar, User } from "lucide-react";
import SEO from "@/components/layout/SEO";
import ActivityLogForm from "@/components/activity-log/ActivityLogForm";
import { format } from "date-fns";

export default function ActivityPage() {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [showForm, setShowForm] = useState(false);

  const { data: activities = [], isLoading, refetch } = useQuery({
    queryKey: ["activities", groupId],
    queryFn: async () => {
      if (!groupId || groupId === ':groupId' || groupId === 'undefined' || groupId.startsWith(':')) {
        return [];
      }
      
      const { data, error } = await supabase
        .from("activity_logs")
        .select(`
          *,
          created_by_email
        `)
        .eq("group_id", groupId)
        .eq("is_deleted", false)
        .order("date_time", { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!groupId && groupId !== ':groupId' && groupId !== 'undefined' && !groupId.startsWith(':'),
  });

  const filteredActivities = activities.filter(activity => {
    const searchLower = searchTerm.toLowerCase();
    return (activity.title?.toLowerCase() || '').includes(searchLower) ||
           (activity.type?.toLowerCase() || '').includes(searchLower) ||
           (activity.notes?.toLowerCase() || '').includes(searchLower);
  });

  const getTypeColor = (type: string) => {
    switch (type?.toLowerCase()) {
      case 'medical': return 'bg-red-100 text-red-800';
      case 'personal': return 'bg-blue-100 text-blue-800';
      case 'communication': return 'bg-green-100 text-green-800';
      case 'appointment': return 'bg-purple-100 text-purple-800';
      case 'medication': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (!groupId || groupId === ':groupId' || groupId === 'undefined' || groupId.startsWith(':')) {
    return (
      <div className="p-6 text-center">
        <h2 className="text-xl font-semibold mb-2">Invalid Group</h2>
        <p className="text-muted-foreground">Please select a valid care group.</p>
      </div>
    );
  }

  return (
    <>
      <SEO 
        title="Activity Log - Care Coordination"
        description="Track and manage daily activities and care notes for your care group."
      />
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <NotebookPen className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold">Activity Log</h1>
          </div>
          <Button onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Activity
          </Button>
        </div>

        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search activities..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader>
                  <div className="h-4 bg-muted rounded w-3/4"></div>
                  <div className="h-3 bg-muted rounded w-1/2"></div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="h-3 bg-muted rounded"></div>
                    <div className="h-3 bg-muted rounded w-2/3"></div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredActivities.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <NotebookPen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No activities found</h3>
              <p className="text-muted-foreground mb-4">
                {searchTerm ? "No activities match your search." : "Start by adding your first activity entry."}
              </p>
              <Button onClick={() => setShowForm(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Activity
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredActivities.map((activity) => (
              <Card key={activity.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>{activity.title || `${activity.type} Activity`}</span>
                    <div className="flex items-center gap-2">
                      {activity.type && (
                        <Badge className={getTypeColor(activity.type)}>
                          {activity.type}
                        </Badge>
                      )}
                    </div>
                  </CardTitle>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      <span>{format(new Date(activity.date_time), 'MMM dd, yyyy at h:mm a')}</span>
                    </div>
                    {activity.created_by_email && (
                      <div className="flex items-center gap-1">
                        <User className="h-4 w-4" />
                        <span>by {activity.created_by_email}</span>
                      </div>
                    )}
                  </div>
                </CardHeader>
                {activity.notes && (
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      {activity.notes}
                    </p>
                  </CardContent>
                )}
              </Card>
            ))}
          </div>
        )}

        {showForm && (
          <ActivityLogForm
            onSave={() => {
              setShowForm(false);
              refetch();
            }}
            onCancel={() => setShowForm(false)}
          />
        )}
      </div>
    </>
  );
}