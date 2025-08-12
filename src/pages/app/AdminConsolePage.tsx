import { useState } from "react";
import SEO from "@/components/layout/SEO";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Search, Database } from "lucide-react";

const AdminConsolePage = () => {
  const { groupId } = useParams();
  const { toast } = useToast();
  const [rebuildingIndex, setRebuildingIndex] = useState(false);
  
  const base = `/app/${groupId ?? 'demo'}/admin`;

  const handleRebuildSearchIndex = async () => {
    setRebuildingIndex(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-rebuild-search');
      
      if (error) {
        throw new Error(error.message);
      }

      toast({
        title: "Search Index Rebuilt",
        description: `Successfully rebuilt search index with ${data.total_entries} entries`,
      });
    } catch (error) {
      console.error('Error rebuilding search index:', error);
      toast({
        title: "Error",
        description: "Failed to rebuild search index. Please try again.",
        variant: "destructive"
      });
    } finally {
      setRebuildingIndex(false);
    }
  };
  return (
    <div className="space-y-6">
      <SEO title="Admin — DaveAssist" description="Manage groups, users, and analytics." />
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Admin console</h2>
        <Button 
          onClick={handleRebuildSearchIndex}
          disabled={rebuildingIndex}
          variant="outline"
          className="gap-2"
        >
          <Search className="h-4 w-4" />
          {rebuildingIndex ? "Rebuilding..." : "Reindex Search"}
        </Button>
      </div>
      
      {/* Search Management Section */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium">Search Management</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Search Index
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Rebuild the full-text search index for all entities across all groups.
              </p>
              <Button 
                onClick={handleRebuildSearchIndex}
                disabled={rebuildingIndex}
                className="w-full"
              >
                {rebuildingIndex ? "Rebuilding Index..." : "Rebuild Search Index"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Data Management Section */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium">Data Management</h3>
        <div className="grid gap-4 md:grid-cols-3">
          <Link to={`${base}/users`}>
            <Card className="h-full hover:bg-muted/50 transition-colors">
              <CardHeader><CardTitle>Users</CardTitle></CardHeader>
              <CardContent className="text-muted-foreground">Manage users</CardContent>
            </Card>
          </Link>
          <Link to={`${base}/care-groups`}>
            <Card className="h-full hover:bg-muted/50 transition-colors">
              <CardHeader><CardTitle>Care Groups</CardTitle></CardHeader>
              <CardContent className="text-muted-foreground">Manage care groups</CardContent>
            </Card>
          </Link>
          <Link to={`${base}/members`}>
            <Card className="h-full hover:bg-muted/50 transition-colors">
              <CardHeader><CardTitle>Group Members</CardTitle></CardHeader>
              <CardContent className="text-muted-foreground">Manage group members</CardContent>
            </Card>
          </Link>
          <Link to={`${base}/appointments`}>
            <Card className="h-full hover:bg-muted/50 transition-colors">
              <CardHeader><CardTitle>Appointments</CardTitle></CardHeader>
              <CardContent className="text-muted-foreground">CRUD appointments</CardContent>
            </Card>
          </Link>
          <Link to={`${base}/tasks`}>
            <Card className="h-full hover:bg-muted/50 transition-colors">
              <CardHeader><CardTitle>Tasks</CardTitle></CardHeader>
              <CardContent className="text-muted-foreground">CRUD tasks</CardContent>
            </Card>
          </Link>
          <Link to={`${base}/documents`}>
            <Card className="h-full hover:bg-muted/50 transition-colors">
              <CardHeader><CardTitle>Documents</CardTitle></CardHeader>
              <CardContent className="text-muted-foreground">CRUD documents</CardContent>
            </Card>
          </Link>
          <Link to={`${base}/activity-logs`}>
            <Card className="h-full hover:bg-muted/50 transition-colors">
              <CardHeader><CardTitle>Activity Logs</CardTitle></CardHeader>
              <CardContent className="text-muted-foreground">CRUD activity logs</CardContent>
            </Card>
          </Link>
          <Link to={`${base}/search-jobs`}>
            <Card className="h-full hover:bg-muted/50 transition-colors">
              <CardHeader><CardTitle>Search Jobs</CardTitle></CardHeader>
              <CardContent className="text-muted-foreground">Monitor search indexing</CardContent>
            </Card>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default AdminConsolePage;
