import { useState } from 'react';
import { format } from 'date-fns';
import { 
  File, 
  FileText, 
  Image, 
  FileSpreadsheet, 
  Download, 
  Eye, 
  Trash2, 
  RefreshCw,
  AlertCircle 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { DocumentLinker } from './DocumentLinker';

interface Document {
  id: string;
  title: string;
  category: string;
  file_url: string;
  file_type: string;
  file_size: number;
  upload_date: string;
  summary: string;
  full_text: string;
  notes: string;
  processing_status: string;
  uploaded_by_user_id: string;
  group_id: string;
  original_filename?: string;
}

interface DocumentListProps {
  documents: Document[];
  onRefresh: () => void;
  userProfiles: Array<{ id: string; email: string }>;
}

const getFileIcon = (fileType: string) => {
  if (!fileType) return File;
  if (fileType.includes('pdf')) return FileText;
  if (fileType.includes('image')) return Image;
  if (fileType.includes('sheet') || fileType.includes('excel')) return FileSpreadsheet;
  if (fileType.includes('word')) return FileText;
  return File;
};

const getCategoryColor = (category: string) => {
  const colors = {
    Medical: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100',
    Legal: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100',
    Financial: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100',
    Personal: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100',
    Other: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-100'
  };
  return colors[category as keyof typeof colors] || colors.Other;
};

export const DocumentList = ({ documents, onRefresh, userProfiles }: DocumentListProps) => {
  const { toast } = useToast();
  const [processingDocument, setProcessingDocument] = useState<string | null>(null);

  const logDocumentAccess = async (documentId: string, action: 'view' | 'download') => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const document = documents.find(d => d.id === documentId);
      if (!document) return;

      await supabase.from('document_access_logs').insert({
        document_id: documentId,
        user_id: user.id,
        action,
        group_id: document.group_id
      });
    } catch (error) {
      console.error('Failed to log document access:', error);
    }
  };

  const handleView = async (document: Document) => {
    try {
      await logDocumentAccess(document.id, 'view');
      
      const { data, error } = await supabase.storage
        .from('documents')
        .createSignedUrl(document.file_url, 3600); // 1 hour expiry

      if (error) {
        throw new Error(`Failed to get file URL: ${error.message}`);
      }

      // Open in new tab
      window.open(data.signedUrl, '_blank');
    } catch (error) {
      console.error('View error:', error);
      toast({
        title: 'Failed to view document',
        description: error instanceof Error ? error.message : 'An unexpected error occurred',
        variant: 'destructive'
      });
    }
  };

  const handleDownload = async (document: Document) => {
    try {
      await logDocumentAccess(document.id, 'download');
      
      const { data, error } = await supabase.storage
        .from('documents')
        .download(document.file_url);

      if (error) {
        throw new Error(`Failed to download file: ${error.message}`);
      }

      // Create download link
      const url = URL.createObjectURL(data);
      const a = window.document.createElement('a');
      a.href = url;
      a.download = document.title || 'document';
      window.document.body.appendChild(a);
      a.click();
      window.document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: 'Download started',
        description: 'Document is being downloaded'
      });
    } catch (error) {
      console.error('Download error:', error);
      toast({
        title: 'Failed to download document',
        description: error instanceof Error ? error.message : 'An unexpected error occurred',
        variant: 'destructive'
      });
    }
  };

  const handleDelete = async (document: Document) => {
    try {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('documents')
        .remove([document.file_url]);

      if (storageError) {
        console.warn('Storage deletion failed:', storageError);
      }

      // Delete from database
      const { error: dbError } = await supabase
        .from('documents')
        .delete()
        .eq('id', document.id);

      if (dbError) {
        throw new Error(`Failed to delete document: ${dbError.message}`);
      }

      toast({
        title: 'Document deleted',
        description: 'Document has been permanently deleted'
      });

      onRefresh();
    } catch (error) {
      console.error('Delete error:', error);
      toast({
        title: 'Failed to delete document',
        description: error instanceof Error ? error.message : 'An unexpected error occurred',
        variant: 'destructive'
      });
    }
  };

  const reprocessDocument = async (documentId: string) => {
    setProcessingDocument(documentId);
    try {
      const { error } = await supabase.functions.invoke('process-document', {
        body: { documentId }
      });

      if (error) {
        throw new Error(`Processing failed: ${error.message}`);
      }

      toast({
        title: 'Processing started',
        description: 'Document is being reprocessed with AI'
      });

      // Refresh after a delay
      setTimeout(() => {
        onRefresh();
      }, 2000);
    } catch (error) {
      console.error('Reprocess error:', error);
      toast({
        title: 'Failed to reprocess document',
        description: error instanceof Error ? error.message : 'An unexpected error occurred',
        variant: 'destructive'
      });
    } finally {
      setProcessingDocument(null);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getUploaderEmail = (userId: string) => {
    const profile = userProfiles.find(p => p.id === userId);
    return profile?.email || 'Unknown user';
  };

  const getFileName = (fileUrl: string, originalFilename?: string) => {
    // Use original filename if available, otherwise extract from URL
    if (originalFilename) return originalFilename;
    if (!fileUrl) return 'Unknown file';
    const parts = fileUrl.split('/');
    return parts[parts.length - 1] || 'Unknown file';
  };

  if (documents.length === 0) {
    return (
      <div className="text-center py-12">
        <File className="h-12 w-12 mx-auto text-muted-foreground" />
        <h3 className="text-lg font-medium mt-4">No documents yet</h3>
        <p className="text-muted-foreground">Upload your first document to get started</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {documents.map((doc) => {
        const FileIcon = getFileIcon(doc.file_type);
        
        return (
          <Card key={doc.id} className="flex flex-col h-full">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center space-x-2 min-w-0 flex-1">
                  <FileIcon className="h-5 w-5 text-primary flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <CardTitle className="text-sm font-medium truncate" title={doc.title}>
                      {doc.title}
                    </CardTitle>
                  </div>
                </div>
                {doc.processing_status === 'processing' && (
                  <RefreshCw className="h-4 w-4 animate-spin text-primary" />
                )}
                {doc.processing_status === 'failed' && (
                  <div title="Document processing failed - click Retry to reprocess">
                    <AlertCircle className="h-4 w-4 text-destructive" />
                  </div>
                )}
              </div>
              <div className="flex items-center space-x-2">
                <Badge variant="secondary" className={getCategoryColor(doc.category)}>
                  {doc.category}
                </Badge>
              </div>
            </CardHeader>
            
            <CardContent className="flex-1 space-y-3">
              {/* Document Info */}
              <div className="text-xs text-muted-foreground space-y-1">
                <div>File: {getFileName(doc.file_url, doc.original_filename)}</div>
                <div>Uploaded: {doc.upload_date ? format(new Date(doc.upload_date), 'MMM d, yyyy') : 'Unknown'}</div>
                <div>By: {getUploaderEmail(doc.uploaded_by_user_id)}</div>
                <div>Size: {formatFileSize(doc.file_size || 0)}</div>
                <div>Type: {doc.file_type}</div>
              </div>

              {/* AI Summary */}
              {doc.summary && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">AI Summary:</p>
                  <p className="text-sm text-foreground line-clamp-3">{doc.summary}</p>
                </div>
              )}

              {/* Notes */}
              {doc.notes && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Notes:</p>
                  <p className="text-sm text-foreground line-clamp-2">{doc.notes}</p>
                </div>
              )}

              {/* Document Links */}
              <DocumentLinker
                documentId={doc.id}
                documentTitle={doc.title}
                onLinksChange={onRefresh}
              />

              {/* Actions */}
              <div className="flex flex-wrap gap-2 pt-2">
                <Button size="sm" variant="outline" onClick={() => handleView(doc)} className="flex-shrink-0">
                  <Eye className="h-3 w-3 mr-1" />
                  View
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleDownload(doc)} className="flex-shrink-0">
                  <Download className="h-3 w-3 mr-1" />
                  Download
                </Button>
                
                {doc.processing_status === 'failed' && (
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => reprocessDocument(doc.id)}
                    disabled={processingDocument === doc.id}
                    className="flex-shrink-0"
                  >
                    <RefreshCw className={`h-3 w-3 mr-1 ${processingDocument === doc.id ? 'animate-spin' : ''}`} />
                    Retry
                  </Button>
                )}

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" variant="outline" className="text-destructive hover:text-destructive flex-shrink-0">
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Document</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to delete "{doc.title}"? This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction 
                        onClick={() => handleDelete(doc)}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};