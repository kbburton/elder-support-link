import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import SEO from "@/components/layout/SEO";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw, AlertCircle, CheckCircle, Clock, RotateCcw } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface SearchJob {
  id: string;
  entity_type: string;
  entity_id: string;
  operation: string;
  status: string;
  error_message?: string;
  created_at: string;
  updated_at: string;
}

const SearchJobsPage = () => {
  const { groupId } = useParams();
  const { toast } = useToast();
  const [jobs, setJobs] = useState<SearchJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState<string | null>(null);

  const fetchJobs = async () => {
    try {
      // Use RPC to get search jobs since they're in admin schema
      const { data, error } = await supabase.rpc('get_search_jobs') as { data: SearchJob[] | null, error: any };

      if (error) throw error;
      setJobs((data as SearchJob[]) || []);
    } catch (error) {
      console.error('Error fetching search jobs:', error);
      toast({
        title: "Error",
        description: "Failed to fetch search jobs",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const retryJob = async (jobId: string) => {
    setRetrying(jobId);
    try {
      const { error } = await supabase.rpc('retry_search_job', {
        p_job_id: jobId
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Search job retried successfully",
      });

      // Refresh the jobs list
      await fetchJobs();
    } catch (error) {
      console.error('Error retrying search job:', error);
      toast({
        title: "Error",
        description: "Failed to retry search job",
        variant: "destructive"
      });
    } finally {
      setRetrying(null);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'success':
        return 'default' as const;
      case 'failed':
        return 'destructive' as const;
      case 'pending':
        return 'secondary' as const;
      default:
        return 'outline' as const;
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <SEO title="Search Jobs — DaveAssist" description="Monitor search indexing jobs" />
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SEO title="Search Jobs — DaveAssist" description="Monitor search indexing jobs" />
      
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Search Jobs</h2>
        <Button onClick={fetchJobs} variant="outline" className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Search Index Operations</CardTitle>
        </CardHeader>
        <CardContent>
          {jobs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No search jobs found
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Operation</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Error</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.map((job) => (
                  <TableRow key={job.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(job.status)}
                        <Badge variant={getStatusVariant(job.status)}>
                          {job.status}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="font-medium">{job.entity_type}</div>
                        <div className="text-sm text-muted-foreground font-mono">
                          {job.entity_id.substring(0, 8)}...
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{job.operation}</TableCell>
                    <TableCell>
                      {formatDistanceToNow(new Date(job.created_at), { addSuffix: true })}
                    </TableCell>
                    <TableCell>
                      {job.error_message && (
                        <div className="text-sm text-red-600 max-w-xs truncate" title={job.error_message}>
                          {job.error_message}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {job.status === 'failed' && (
                        <Button
                          onClick={() => retryJob(job.id)}
                          disabled={retrying === job.id}
                          size="sm"
                          variant="outline"
                          className="gap-2"
                        >
                          <RotateCcw className="h-3 w-3" />
                          {retrying === job.id ? 'Retrying...' : 'Retry'}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SearchJobsPage;