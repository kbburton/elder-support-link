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

  const handleUpload = async () => {
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
        throw new Error('User not authenticated');
      }

      const totalFiles = selectedFiles.length;
      const progressPerFile = 80 / totalFiles; // Reserve 20% for completion
      let currentProgress = 0;

      const uploadedDocuments = [];

      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        
        // Server-side validation will be done in the edge function
        const fileExt = file.name.split('.').pop();
        const baseName = file.name.replace(/\.[^/.]+$/, "");
        const timestamp = Date.now();
        const fileName = `${baseName}_${timestamp}_${i}.${fileExt}`;

        // Upload file to storage with improved error handling
        try {
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('documents')
            .upload(fileName, file);

          if (uploadError) {
            console.error('Storage upload failed:', uploadError);
            throw new Error(`Storage upload failed for ${file.name}: ${uploadError.message}`);
          }

          // Create document record
          const documentTitle = selectedFiles.length === 1 && title ? title : file.name;
          
          const { data: documentData, error: dbError } = await supabase
            .from('documents')
            .insert({
              title: documentTitle,
              category,
              file_url: uploadData.path,
              file_type: file.type,
              file_size: file.size,
              notes,
              uploaded_by_user_id: user.id,
              group_id: groupId,
              processing_status: 'pending',
              original_filename: file.name
            })
            .select()
            .single();

          if (dbError) {
            console.error('Database insert failed:', dbError);
            // Delete uploaded file since DB insert failed
            await supabase.storage
              .from('documents')
              .remove([uploadData.path]);
            throw new Error(`Database error for ${file.name}: ${dbError.message}`);
          }

          uploadedDocuments.push(documentData);
          currentProgress += progressPerFile;
          setUploadProgress(Math.round(currentProgress));

          // Enhance file type with AI
          try {
            await supabase.functions.invoke('enhance-document-metadata', {
              body: { 
                documentId: documentData.id,
                filename: file.name,
                currentFileType: file.type
              }
            });
          } catch (error) {
            console.warn(`File type enhancement failed for ${file.name}:`, error);
          }

          // Process document with AI (don't await to avoid blocking)  
          try {
            const { data: processResult, error: processError } = await supabase.functions.invoke('process-document', {
              body: { documentId: documentData.id }
            });
            
            if (processError) {
              console.error(`AI processing failed for ${file.name}:`, processError);
              // Update document to show processing failed
              await supabase
                .from('documents')
                .update({ processing_status: 'failed' })
                .eq('id', documentData.id);
            }
          } catch (error) {
            console.error(`AI processing error for ${file.name}:`, error);
            // Update document to show processing failed
            await supabase
              .from('documents')
              .update({ processing_status: 'failed' })
              .eq('id', documentData.id);
          }

        } catch (fileError) {
          console.error(`File processing failed for ${file.name}:`, fileError);
          throw fileError; // Re-throw to be handled by outer catch
        }
      }

      setUploadProgress(100);

      toast({
        title: 'Upload successful',
        description: `${totalFiles} document${totalFiles > 1 ? 's' : ''} uploaded successfully. AI processing and text extraction will complete shortly.`
      });

      onUploadComplete();
      onClose();

    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: 'Upload failed',
        description: error instanceof Error ? error.message : 'An unexpected error occurred',
        variant: 'destructive'
      });
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
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

        {/* Actions */}
        <div className="flex space-x-2">
          <Button onClick={onClose} variant="outline" disabled={uploading}>
            Cancel
          </Button>
          <Button 
            onClick={handleUpload} 
            disabled={selectedFiles.length === 0 || !category || uploading}
            className="flex-1"
          >
            {uploading ? 'Uploading...' : `Upload ${selectedFiles.length} Document${selectedFiles.length > 1 ? 's' : ''}`}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};