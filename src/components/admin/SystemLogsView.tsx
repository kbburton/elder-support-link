import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { Search, AlertCircle, Info, AlertTriangle, XCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSystemLogs, SystemLog } from "@/hooks/useSystemLogs";
import { Loader2 } from "lucide-react";

const LogLevelBadge = ({ level }: { level: string }) => {
  const variants = {
    ERROR: "destructive",
    WARN: "secondary", 
    INFO: "default",
    DEBUG: "outline"
  } as const;

  const icons = {
    ERROR: XCircle,
    WARN: AlertTriangle,
    INFO: Info,
    DEBUG: AlertCircle
  };

  const Icon = icons[level as keyof typeof icons] || Info;
  const variant = variants[level as keyof typeof variants] || "default";

  return (
    <Badge variant={variant} className="flex items-center gap-1">
      <Icon className="h-3 w-3" />
      {level}
    </Badge>
  );
};

export default function SystemLogsView() {
  const [searchTerm, setSearchTerm] = useState("");
  const { data: logs = [], isLoading, error, refetch } = useSystemLogs();

  const filteredLogs = logs.filter((log: SystemLog) =>
    log.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.component.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.operation.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <XCircle className="h-5 w-5" />
            Error Loading Logs
          </CardTitle>
          <CardDescription>
            Failed to load system logs. Please try refreshing.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => refetch()} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5" />
                System Logs
              </CardTitle>
              <CardDescription>
                Monitor system operations, document processing, and errors
              </CardDescription>
            </div>
            <Button 
              onClick={() => refetch()} 
              variant="outline" 
              size="sm"
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search logs by message, component, or operation..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Logs Table */}
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="ml-2">Loading logs...</span>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchTerm ? "No logs found matching your search." : "No system logs found."}
            </div>
          ) : (
            <ScrollArea className="h-[600px] rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">Level</TableHead>
                    <TableHead className="w-[150px]">Component</TableHead>
                    <TableHead className="w-[150px]">Operation</TableHead>
                    <TableHead>Message</TableHead>
                    <TableHead className="w-[180px]">Timestamp</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>
                        <LogLevelBadge level={log.level} />
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {log.component}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {log.operation}
                      </TableCell>
                      <TableCell>
                        <div className="max-w-[400px] break-words">
                          <p className="text-sm">{log.message}</p>
                          {log.metadata && Object.keys(log.metadata).length > 0 && (
                            <details className="mt-1">
                              <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                                Metadata ({Object.keys(log.metadata).length} items)
                              </summary>
                              <pre className="text-xs bg-muted p-2 rounded mt-1 overflow-auto max-w-full">
                                {JSON.stringify(log.metadata, null, 2)}
                              </pre>
                            </details>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(log.created_at), "MMM dd, HH:mm:ss")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}