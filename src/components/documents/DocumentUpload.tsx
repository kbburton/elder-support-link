import { useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { Upload, File, X, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from "@/hooks/use-toast";
import { supabase } from '@/integrations/supabase/client';
import { Progress } from '@/components/ui/progress';
import { validateFile, validateBatch, FILE_LIMITS } from '@/utils/file-limits';
import { logger } from '@/utils/logger';
import { DuplicateConfirmDialog } from './DuplicateConfirmDialog';

interface DocumentUploadProps {
  onUploadComplete: () => void;
  onClose: () => void;
}

const DOCUMENT_CATEGORIES = [
  'Medical',
  'Legal',
  'Financial',
  'Personal',
  'Other'
];

const ACCEPTED_FILE_TYPES = FILE_LIMITS.ALLOWED_DOCUMENT_TYPES.reduce((acc, type) => {
  acc[type] = [];
  return acc;
}, {} as Record<string, string[]>);

export const DocumentUpload = ({ onUploadComplete, onClose }: DocumentUploadProps) => {
  const { groupId } = useParams();
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [notes, setNotes] = useState('');
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
  const [duplicateFiles, setDuplicateFiles] = useState<string[]>([]);
  const [pendingUpload, setPendingUpload] = useState(false);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const validFiles: File[] = [];
    const errors: string[] = [];
    
    for (const file of acceptedFiles) {
      // Validate individual file
      const fileValidation = validateFile(file);
      if (!fileValidation.isValid) {
        errors.push(`${file.name}: ${fileValidation.message}`);
        continue;
      }
      validFiles.push(file);
    }
    
    if (validFiles.length === 0) {
      toast({
        title: 'No valid files',
        description: errors.join('\n'),
        variant: 'destructive'
      });
      return;
    }
    
    // Validate batch size
    const batchValidation = validateBatch([...selectedFiles, ...validFiles]);
    if (!batchValidation.isValid) {
      toast({
        title: 'Batch size exceeded',
        description: batchValidation.message,
        variant: 'destructive'
      });
      return;
    }
    
    setSelectedFiles(prev => [...prev, ...validFiles]);
    
    if (errors.length > 0) {
      toast({
        title: 'Some files skipped',
        description: errors.join('\n'),
        variant: 'destructive'
      });
    }
    
    if (!title && validFiles.length === 1) {
      setTitle(validFiles[0].name.split('.')[0]);
    }
  }, [selectedFiles, title, toast]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED_FILE_TYPES,
    multiple: true,
    maxSize: FILE_LIMITS.MAX_FILE_SIZE
  });

  // Check for duplicate filenames within the care group
  const checkForDuplicates = async (files: File[]): Promise<string[]> => {
    if (!groupId) return [];

    try {
      const { data: existingDocs, error } = await supabase
        .from('documents')
        .select('original_filename, file_url')
        .eq('group_id', groupId)
        .eq('is_deleted', false);

      if (error) {
        logger.warn('Failed to check for duplicates', { groupId }, error);
        return [];
      }

      const duplicates: string[] = [];
      const existingFilenames = new Set(existingDocs?.map(doc => doc.original_filename.toLowerCase()) || []);

      for (const file of files) {
        if (existingFilenames.has(file.name.toLowerCase())) {
          duplicates.push(file.name);
        }
      }

      return duplicates;
    } catch (error) {
      logger.warn('Error checking duplicates', { groupId }, error as Error);
      return [];
    }
  };

  // Handle the actual upload process
  const performUpload = async () => {
    if (selectedFiles.length === 0 || !category || !groupId) {
      toast({
        title: 'Missing information',
        description: 'Please select files and category',
        variant: 'destructive'
      });
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Authentication Required",
          description: "Please log in to upload documents.",
          variant: "destructive",
        });
        return;
      }

      logger.info('Starting batch upload', {
        operation: 'batch_upload_start',
        component: 'DocumentUpload',
        fileCount: selectedFiles.length,
        groupId: groupId!,
        userId: user.id,
      });

      const batchSize = selectedFiles.length;
      let successCount = 0;
      let errorCount = 0;
      const uploadErrors: string[] = [];

      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        let filePath: string | null = null;
        let documentId: string | null = null;
        
        try {
          logger.documentUploadStart(file.name, file.size, groupId!, user.id);

          // Create filename with new format: filename_timestamp_groupId.ext
          const fileExt = file.name.split('.').pop();
          const baseName = file.name.replace(/\.[^/.]+$/, "");
          const timestamp = Date.now();
          const fileName = `${baseName}_${timestamp}_${groupId}.${fileExt}`;
          filePath = fileName;

          let uploadSuccess = false;
          let lastUploadError: Error | null = null;

          // Try upload with collision handling
          for (let attempt = 1; attempt <= 3; attempt++) {
            try {
              // Check if file already exists
              const { data: existingFiles } = await supabase.storage
                .from('documents')
                .list('', {
                  limit: 1,
                  search: filePath.split('/').pop()
                });

              if (existingFiles && existingFiles.length > 0) {
                // File exists, regenerate filename with new timestamp
                const newTimestamp = Date.now() + attempt;
                filePath = `${baseName}_${newTimestamp}_${groupId}.${fileExt}`;
                continue; // Try again with new filename
              }

              const { data: uploadData, error: uploadError } = await supabase.storage
                .from('documents')
                .upload(filePath, file);

              if (uploadError) {
                if (uploadError.message.includes('already exists')) {
                  // File was created between our check and upload, try with new filename
                  const newTimestamp = Date.now() + attempt;
                  filePath = `${baseName}_${newTimestamp}_${groupId}.${fileExt}`;
                  continue;
                }
                throw new Error(`Storage upload failed: ${uploadError.message}`);
              }

              // Upload successful - no validation needed as upload API confirms success
              logger.info('Storage upload successful', { filePath, fileSize: file.size });
              uploadSuccess = true;
              break;
            } catch (error) {
              lastUploadError = error as Error;
              logger.warn(`Upload attempt ${attempt} failed for ${file.name}`, {
                operation: 'upload_attempt_failed',
                filename: file.name,
                attempt,
                currentFilePath: filePath
              }, error as Error);

              if (attempt < 3) {
                // Wait before retry
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                // Generate completely new filename for next attempt
                const newTimestamp = Date.now() + attempt;
                filePath = `${baseName}_${newTimestamp}_${groupId}.${fileExt}`;
              }
            }
          }

          if (!uploadSuccess) {
            throw lastUploadError || new Error('Upload failed after retries');
          }

          // Create document record only after successful storage upload
          const documentTitle = selectedFiles.length === 1 && title ? title : file.name;
          
          const { data: documentData, error: insertError } = await supabase
            .from('documents')
            .insert({
              title: documentTitle,
              original_filename: file.name,
              file_type: file.type,
              file_size: file.size,
              file_url: filePath,
              category: category,
              notes: notes,
              group_id: groupId,
              uploaded_by_user_id: user.id,
              processing_status: 'pending'
            })
            .select()
            .single();

          if (insertError) {
            // Database insert failed - log error but don't rollback file (file remains in storage)
            throw new Error(`Failed to create document record: ${insertError.message}`);
          }

          documentId = documentData.id;

          // Trigger AI processing for supported file types
          if (file.type.startsWith('image/') || file.type === 'application/pdf' || 
              file.type === 'text/plain' || file.type.includes('document')) {
            try {
              await supabase.functions.invoke('process-document', {
                body: { documentId }
              });
              logger.info('AI processing initiated successfully', {
                operation: 'ai_processing_start',
                documentId,
                filename: file.name,
              });
            } catch (processingError) {
              logger.warn('AI processing failed - document uploaded but summary will remain blank', {
                operation: 'ai_processing_failed',
                documentId,
                filename: file.name,
              }, processingError as Error);
              
              // Update document to indicate AI processing failed (leave summary blank)
              await supabase
                .from('documents')
                .update({ 
                  processing_status: 'failed',
                  // summary remains null - don't put error message there
                })
                .eq('id', documentId);
            }
          }

          logger.documentUploadSuccess(documentId, file.name, 'pending');
          successCount++;
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          logger.documentUploadError(file.name, error as Error, {
            groupId: groupId!,
            userId: user.id,
            filePath,
            documentId,
          });
          
          errorCount++;
          uploadErrors.push(`${file.name}: ${errorMsg}`);
        }

        // Update progress
        setUploadProgress(((i + 1) / batchSize) * 100);
      }

      // Show results
      if (successCount > 0) {
        logger.info('Batch upload completed', {
          operation: 'batch_upload_complete',
          successCount,
          errorCount,
          totalFiles: batchSize,
        });

        toast({
          title: "Upload Complete",
          description: `Successfully uploaded ${successCount} file${successCount === 1 ? '' : 's'}.${errorCount > 0 ? ` ${errorCount} failed.` : ''}`,
          variant: successCount === batchSize ? "default" : "destructive",
        });
      }

      if (errorCount > 0) {
        logger.error('Upload batch had errors', {
          operation: 'batch_upload_errors',
          errorCount,
          errors: uploadErrors,
        });
        
        toast({
          title: "Upload Issues",
          description: `${errorCount} file${errorCount === 1 ? '' : 's'} failed to upload. Check console for details.`,
          variant: "destructive",
        });
      }

      if (successCount > 0) {
        onUploadComplete();
        if (successCount === batchSize) {
          onClose();
        }
      }

    } catch (error) {
      logger.error('Upload process failed', {
        operation: 'upload_process_error',
        component: 'DocumentUpload',
      }, error as Error);
      
      toast({
        title: "Upload Failed",
        description: error instanceof Error ? error.message : "An unexpected error occurred during upload.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      setUploadProgress(0);
      setPendingUpload(false);
    }
  };

  const handleUpload = async () => {
    // Check for duplicates first
    try {
      const duplicates = await checkForDuplicates(selectedFiles);
      if (duplicates.length > 0) {
        setDuplicateFiles(duplicates);
        setShowDuplicateDialog(true);
        setPendingUpload(true);
        return;
      }
    } catch (error) {
      // If duplicate check fails, show warning but continue
      toast({
        title: "Warning",
        description: "Could not check for duplicate files. Upload will continue.",
        variant: "default",
      });
    }

    // Proceed with upload
    await performUpload();
  };

  const handleConfirmDuplicateUpload = () => {
    setShowDuplicateDialog(false);
    performUpload();
  };

  const handleCancelDuplicateUpload = () => {
    setShowDuplicateDialog(false);
    setPendingUpload(false);
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Upload Document</CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* File Drop Zone */}
        <div
          {...getRootProps()}
          className={`
            border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
            ${isDragActive ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}
          `}
        >
          <input {...getInputProps()} />
          {selectedFiles.length > 0 ? (
            <div className="space-y-2">
              <div className="flex items-center justify-center space-x-2 mb-3">
                <File className="h-8 w-8 text-primary" />
                <div>
                  <p className="font-medium">{selectedFiles.length} file{selectedFiles.length > 1 ? 's' : ''} selected</p>
                  <p className="text-sm text-muted-foreground">
                    {(selectedFiles.reduce((sum, f) => sum + f.size, 0) / 1024 / 1024).toFixed(2)} MB total
                  </p>
                </div>
              </div>
              <div className="max-h-32 overflow-y-auto space-y-1">
                {selectedFiles.map((file, index) => (
                  <div key={index} className="flex items-center justify-between text-sm bg-muted/50 rounded p-2">
                    <span className="truncate">{file.name}</span>
                    <div className="flex items-center space-x-2">
                      <span className="text-muted-foreground">
                        {(file.size / 1024 / 1024).toFixed(1)}MB
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedFiles(prev => prev.filter((_, i) => i !== index));
                        }}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Upload className="h-12 w-12 mx-auto text-muted-foreground" />
              <div>
                <p className="text-lg font-medium">
                  {isDragActive ? 'Drop files here' : 'Click or drag files to upload'}
                </p>
                <p className="text-sm text-muted-foreground">
                  PDF, DOCX, XLSX, PPTX, TXT, JPG, PNG, WebP up to 25MB each
                </p>
                <div className="flex items-center justify-center space-x-1 text-xs text-muted-foreground mt-2">
                  <AlertTriangle className="h-3 w-3" />
                  <span>Executable files are blocked for security</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Form Fields */}
        <div className="space-y-4">
          <div>
            <Label htmlFor="title">Document Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter document title"
            />
          </div>

          <div>
            <Label htmlFor="category">Category *</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {DOCUMENT_CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional context or notes about this document"
              rows={3}
            />
          </div>
        </div>

        {/* Upload Progress */}
        {uploading && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Uploading...</span>
              <span>{uploadProgress}%</span>
            </div>
            <Progress value={uploadProgress} />
          </div>
        )}

        {/* Upload Actions */}
        <div className="flex justify-end space-x-2 pt-4">
          <Button variant="outline" onClick={onClose} disabled={uploading || pendingUpload}>
            Cancel
          </Button>
          <Button 
            onClick={handleUpload} 
            disabled={selectedFiles.length === 0 || !category || uploading || pendingUpload}
          >
            {uploading ? "Uploading..." : pendingUpload ? "Checking..." : "Upload"}
          </Button>
        </div>

        {/* Duplicate Confirmation Dialog */}
        <DuplicateConfirmDialog
          isOpen={showDuplicateDialog}
          onClose={handleCancelDuplicateUpload}
          onConfirm={handleConfirmDuplicateUpload}
          duplicateFiles={duplicateFiles}
        />
      </CardContent>
    </Card>
  );
};