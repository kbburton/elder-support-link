import { useState } from "react";
import { Clock, Download, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { useDocumentVersions } from "@/hooks/useDocumentVersions";
import { useToast } from "@/hooks/use-toast";
import { useDemo } from "@/hooks/useDemo";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";

interface DocumentVersionHistoryProps {
  documentId: string;
  currentVersion: number;
  groupId: string;
}

const formatFileSize = (bytes?: number | null) => {
  if (!bytes) return 'Unknown';
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
};

export function DocumentVersionHistory({ documentId, currentVersion, groupId }: DocumentVersionHistoryProps) {
  const { toast } = useToast();
  const demo = useDemo();
  const queryClient = useQueryClient();

  const { data: versions = [], isLoading } = useDocumentVersions(documentId);

  const blockOperation = () => {
    if (demo.isDemo) {
      toast({
        title: "Demo Mode",
        description: "This action is not available in demo mode.",
        variant: "destructive",
      });
      return true;
    }
    return false;
  };

  const restoreVersion = useMutation({
    mutationFn: async (versionId: string) => {
      const version = versions.find((v: any) => v.id === versionId);
      if (!version) throw new Error("Version not found");

      // Update document to use this version's file
      const { error } = await supabase
        .from("documents")
        .update({
          file_url: version.file_url,
          current_version: version.version_number,
        })
        .eq("id", documentId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      queryClient.invalidateQueries({ queryKey: ["document-versions", documentId] });
      toast({
        title: "Version restored",
        description: "Document has been restored to the selected version.",
      });
    },
    onError: (error) => {
      console.error("Restore version error:", error);
      toast({
        title: "Error",
        description: "Failed to restore version.",
        variant: "destructive",
      });
    },
  });

  const handleDownloadVersion = async (fileUrl: string, versionNumber: number) => {
    try {
      const fileName = fileUrl.split('/').pop();
      const { data } = await supabase.storage
        .from('documents')
        .createSignedUrl(fileName || fileUrl, 600);

      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank');
      } else {
        toast({
          title: "Error",
          description: "Failed to generate download link.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Download error:', error);
      toast({
        title: "Error",
        description: "Failed to download version.",
        variant: "destructive",
      });
    }
  };

  const handleRestoreVersion = (versionId: string) => {
    if (blockOperation()) return;

    if (confirm("Are you sure you want to restore this version? This will replace the current document file.")) {
      restoreVersion.mutate(versionId);
    }
  };

  if (isLoading) {
    return <div>Loading version history...</div>;
  }

  if (versions.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Clock className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-lg font-medium">No version history</p>
          <p className="text-sm text-muted-foreground">
            Version history will appear here when you upload new versions
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold flex items-center gap-2">
          <Clock className="h-4 w-4" />
          Version History ({versions.length})
        </h3>
        <Badge variant="outline">
          Current: v{currentVersion}
        </Badge>
      </div>

      <div className="space-y-3">
        {versions.map((version: any) => {
          const isCurrent = version.version_number === currentVersion;

          return (
            <Card key={version.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">Version {version.version_number}</span>
                      {isCurrent && (
                        <Badge variant="default" className="text-xs">
                          Current
                        </Badge>
                      )}
                    </div>

                    <div className="text-sm text-muted-foreground space-y-1">
                      <div>
                        <span className="font-medium">Created:</span>{" "}
                        {format(new Date(version.created_at), "MMM dd, yyyy 'at' h:mm a")}
                      </div>
                      <div>
                        <span className="font-medium">Size:</span>{" "}
                        {formatFileSize(version.file_size)}
                      </div>
                      {version.file_type && (
                        <div>
                          <span className="font-medium">Type:</span>{" "}
                          {version.file_type}
                        </div>
                      )}
                      {version.notes && (
                        <div className="mt-2">
                          <span className="font-medium">Notes:</span>{" "}
                          {version.notes}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2 ml-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownloadVersion(version.file_url, version.version_number)}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    {!isCurrent && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRestoreVersion(version.id)}
                        disabled={restoreVersion.isPending || demo.isDemo}
                      >
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
