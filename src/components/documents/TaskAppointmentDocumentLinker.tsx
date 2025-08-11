import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Link, Unlink, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface TaskAppointmentDocumentLinkerProps {
  itemId: string;
  itemType: 'task' | 'appointment';
  itemTitle: string;
  onLinksChange: () => void;
}

interface Document {
  id: string;
  title: string;
  category: string;
  original_filename?: string;
}

export const TaskAppointmentDocumentLinker = ({ 
  itemId, 
  itemType, 
  itemTitle, 
  onLinksChange 
}: TaskAppointmentDocumentLinkerProps) => {
  const { groupId } = useParams();
  const { toast } = useToast();
  const [showDialog, setShowDialog] = useState(false);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string>('');
  const [isLinking, setIsLinking] = useState(false);

  // Fetch available documents
  const { data: documents = [] } = useQuery({
    queryKey: ['documents', groupId],
    queryFn: async () => {
      if (!groupId || groupId === ':groupId') return [];
      const { data, error } = await supabase
        .from('documents')
        .select('id, title, category, original_filename')
        .eq('group_id', groupId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as Document[];
    },
    enabled: !!groupId && groupId !== ':groupId' && showDialog,
  });

  // Fetch existing links
  const { data: existingLinks = [], refetch: refetchLinks } = useQuery({
    queryKey: ['item-document-links', itemType, itemId],
    queryFn: async () => {
      if (!itemId) return [];
      

      if (itemType === 'task') {
        const { data: linksData } = await supabase
          .from('task_documents')
          .select('document_id')
          .eq('task_id', itemId);
        
        if (!linksData || linksData.length === 0) return [];
        
        // Get document details
        const documentIds = linksData.map(link => link.document_id);
        const { data: documentsData } = await supabase
          .from('documents')
          .select('id, title, category, original_filename')
          .in('id', documentIds);
          
        return documentsData?.map(doc => ({
          id: doc.id,
          title: doc.title || 'Unknown Document',
          category: doc.category || 'Other',
          filename: doc.original_filename || doc.title || 'Unknown'
        })) || [];
      } else {
        const { data: linksData } = await supabase
          .from('appointment_documents')
          .select('document_id')
          .eq('appointment_id', itemId);
        
        if (!linksData || linksData.length === 0) return [];
        
        // Get document details
        const documentIds = linksData.map(link => link.document_id);
        const { data: documentsData } = await supabase
          .from('documents')
          .select('id, title, category, original_filename')
          .in('id', documentIds);
          
        return documentsData?.map(doc => ({
          id: doc.id,
          title: doc.title || 'Unknown Document',
          category: doc.category || 'Other',
          filename: doc.original_filename || doc.title || 'Unknown'
        })) || [];
      }
    },
    enabled: !!itemId,
  });

  const handleLink = async () => {
    if (!selectedDocumentId) return;

    setIsLinking(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');


      if (itemType === 'task') {
        const { error } = await supabase
          .from('task_documents')
          .insert({
            document_id: selectedDocumentId,
            task_id: itemId,
            created_by_user_id: user.id
          });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('appointment_documents')
          .insert({
            document_id: selectedDocumentId,
            appointment_id: itemId,
            created_by_user_id: user.id
          });
        if (error) throw error;
      }

      toast({
        title: 'Document linked',
        description: `Document linked to ${itemType} successfully`
      });

      setShowDialog(false);
      setSelectedDocumentId('');
      refetchLinks();
      onLinksChange();
    } catch (error) {
      console.error('Link error:', error);
      toast({
        title: 'Failed to link document',
        description: error instanceof Error ? error.message : 'An unexpected error occurred',
        variant: 'destructive'
      });
    } finally {
      setIsLinking(false);
    }
  };

  const handleUnlink = async (documentId: string) => {
    try {

      if (itemType === 'task') {
        const { error } = await supabase
          .from('task_documents')
          .delete()
          .eq('document_id', documentId)
          .eq('task_id', itemId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('appointment_documents')
          .delete()
          .eq('document_id', documentId)
          .eq('appointment_id', itemId);
        if (error) throw error;
      }

      toast({
        title: 'Link removed',
        description: `Document unlinked from ${itemType} successfully`
      });

      refetchLinks();
      onLinksChange();
    } catch (error) {
      console.error('Unlink error:', error);
      toast({
        title: 'Failed to unlink document',
        description: error instanceof Error ? error.message : 'An unexpected error occurred',
        variant: 'destructive'
      });
    }
  };

  // Available documents (excluding already linked ones)
  const availableDocuments = documents.filter(
    doc => !existingLinks.some(link => link.id === doc.id)
  );

  return (
    <div className="space-y-1">
      {/* Existing links */}
      {existingLinks.map((link) => (
        <div key={link.id} className="flex items-center justify-between gap-2 text-xs">
          <Badge variant="outline" className="flex-1 justify-start text-xs">
            <Link className="h-2 w-2 mr-1" />
            {link.filename}
          </Badge>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleUnlink(link.id)}
            className="h-4 w-4 p-0 text-muted-foreground hover:text-destructive"
          >
            <Unlink className="h-2 w-2" />
          </Button>
        </div>
      ))}

      {/* Add link button */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogTrigger asChild>
          <Button size="sm" variant="outline" className="w-full text-xs h-6">
            <Plus className="h-2 w-2 mr-1" />
            Link Document
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Link Document to {itemType}: {itemTitle}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Select Document</label>
              <Select value={selectedDocumentId} onValueChange={setSelectedDocumentId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a document..." />
                </SelectTrigger>
                <SelectContent>
                  {availableDocuments.map((doc) => (
                    <SelectItem key={doc.id} value={doc.id}>
                      {doc.original_filename || doc.title} ({doc.category})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {availableDocuments.length === 0 && (
                <p className="text-sm text-muted-foreground mt-1">
                  No available documents to link (all documents are already linked or none exist)
                </p>
              )}
            </div>

            <div className="flex space-x-2 pt-4">
              <Button 
                onClick={handleLink} 
                disabled={!selectedDocumentId || isLinking || availableDocuments.length === 0}
                className="flex-1"
              >
                {isLinking ? 'Linking...' : 'Link Document'}
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setShowDialog(false)}
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
