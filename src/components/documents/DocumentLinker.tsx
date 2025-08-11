import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Link, Unlink, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface DocumentLinkerProps {
  documentId: string;
  documentTitle: string;
  onLinksChange: () => void;
}

interface Task {
  id: string;
  title: string;
  status: string;
}

interface Appointment {
  id: string;
  description: string;
  date_time: string;
}

export const DocumentLinker = ({ documentId, documentTitle, onLinksChange }: DocumentLinkerProps) => {
  const { groupId } = useParams();
  const { toast } = useToast();
  const [showDialog, setShowDialog] = useState(false);
  const [linkType, setLinkType] = useState<'task' | 'appointment'>('task');
  const [selectedId, setSelectedId] = useState<string>('');
  const [isLinking, setIsLinking] = useState(false);

  // Fetch tasks
  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks', groupId],
    queryFn: async () => {
      if (!groupId) return [];
      const { data, error } = await supabase
        .from('tasks')
        .select('id, title, status')
        .eq('group_id', groupId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as Task[];
    },
    enabled: !!groupId && showDialog && linkType === 'task',
  });

  // Fetch appointments
  const { data: appointments = [] } = useQuery({
    queryKey: ['appointments', groupId],
    queryFn: async () => {
      if (!groupId) return [];
      const { data, error } = await supabase
        .from('appointments')
        .select('id, description, date_time')
        .eq('group_id', groupId)
        .order('date_time', { ascending: false });
      
      if (error) throw error;
      return data as Appointment[];
    },
    enabled: !!groupId && showDialog && linkType === 'appointment',
  });

  // Fetch existing links
  const { data: existingLinks = [], refetch: refetchLinks } = useQuery({
    queryKey: ['document-links', documentId],
    queryFn: async () => {
      // Fetch task links with task details
      const { data: taskLinksData } = await supabase
        .from('task_documents')
        .select('task_id')
        .eq('document_id', documentId);

      const { data: appointmentLinksData } = await supabase
        .from('appointment_documents')
        .select('appointment_id')
        .eq('document_id', documentId);

      // Fetch task details separately
      const taskIds = taskLinksData?.map(link => link.task_id) || [];
      const appointmentIds = appointmentLinksData?.map(link => link.appointment_id) || [];

      const [tasksData, appointmentsData] = await Promise.all([
        taskIds.length > 0 
          ? supabase.from('tasks').select('id, title').in('id', taskIds)
          : Promise.resolve({ data: [] }),
        appointmentIds.length > 0
          ? supabase.from('appointments').select('id, description').in('id', appointmentIds)
          : Promise.resolve({ data: [] })
      ]);

      const links = [
        ...(tasksData.data || []).map(task => ({
          type: 'task' as const,
          id: task.id,
          title: task.title || 'Unknown Task'
        })),
        ...(appointmentsData.data || []).map(appointment => ({
          type: 'appointment' as const,
          id: appointment.id,
          title: appointment.description || 'Unknown Appointment'
        }))
      ];

      return links;
    },
    enabled: !!documentId,
  });

  const handleLink = async () => {
    if (!selectedId) return;

    setIsLinking(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      if (linkType === 'task') {
        const { error } = await supabase
          .from('task_documents')
          .insert({
            document_id: documentId,
            task_id: selectedId,
            created_by_user_id: user.id
          });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('appointment_documents')
          .insert({
            document_id: documentId,
            appointment_id: selectedId,
            created_by_user_id: user.id
          });
        if (error) throw error;
      }

      toast({
        title: 'Document linked',
        description: `Document linked to ${linkType} successfully`
      });

      setShowDialog(false);
      setSelectedId('');
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

  const handleUnlink = async (linkType: 'task' | 'appointment', linkId: string) => {
    try {
      if (linkType === 'task') {
        const { error } = await supabase
          .from('task_documents')
          .delete()
          .eq('document_id', documentId)
          .eq('task_id', linkId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('appointment_documents')
          .delete()
          .eq('document_id', documentId)
          .eq('appointment_id', linkId);
        if (error) throw error;
      }

      toast({
        title: 'Link removed',
        description: `Document unlinked from ${linkType} successfully`
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

  return (
    <div className="space-y-2">
      {/* Existing links */}
      {existingLinks.length > 0 && (
        <div className="space-y-1">
          {existingLinks.map((link) => (
            <div key={`${link.type}-${link.id}`} className="flex items-center justify-between gap-2">
              <Badge variant="outline" className="text-xs flex-1 justify-start">
                <Link className="h-3 w-3 mr-1" />
                {link.type}: {link.title}
              </Badge>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleUnlink(link.type, link.id)}
                className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
              >
                <Unlink className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Add link button */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogTrigger asChild>
          <Button size="sm" variant="outline" className="w-full">
            <Plus className="h-3 w-3 mr-1" />
            Link to Task/Appointment
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Link Document: {documentTitle}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Link Type</label>
              <Select value={linkType} onValueChange={(value: 'task' | 'appointment') => {
                setLinkType(value);
                setSelectedId('');
              }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="task">Task</SelectItem>
                  <SelectItem value="appointment">Appointment</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium">
                Select {linkType === 'task' ? 'Task' : 'Appointment'}
              </label>
              <Select value={selectedId} onValueChange={setSelectedId}>
                <SelectTrigger>
                  <SelectValue placeholder={`Choose a ${linkType}...`} />
                </SelectTrigger>
                <SelectContent>
                  {linkType === 'task' 
                    ? tasks.map((task) => (
                        <SelectItem key={task.id} value={task.id}>
                          {task.title} ({task.status})
                        </SelectItem>
                      ))
                    : appointments.map((appointment) => (
                        <SelectItem key={appointment.id} value={appointment.id}>
                          {appointment.description} ({new Date(appointment.date_time).toLocaleDateString()})
                        </SelectItem>
                      ))
                  }
                </SelectContent>
              </Select>
            </div>

            <div className="flex space-x-2 pt-4">
              <Button 
                onClick={handleLink} 
                disabled={!selectedId || isLinking}
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
