import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Trash2 } from 'lucide-react';
import { usePlatformAdmin } from '@/hooks/usePlatformAdmin';
import { useStoryPrompts, useDeletePrompt, type StoryPrompt } from '@/hooks/useStoryPrompts';
import { StoryPromptModal } from '@/components/admin/StoryPromptModal';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

const StoryPromptsAdminPage = () => {
  const adminStatus = usePlatformAdmin();
  const { data: prompts, isLoading } = useStoryPrompts();
  const deleteMutation = useDeletePrompt();
  
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<StoryPrompt | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [promptToDelete, setPromptToDelete] = useState<StoryPrompt | null>(null);
  
  if (!adminStatus.canAccessAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>
              You don't have permission to access this page.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }
  
  const handleEdit = (prompt: StoryPrompt) => {
    setEditingPrompt(prompt);
    setModalOpen(true);
  };
  
  const handleCreate = () => {
    setEditingPrompt(null);
    setModalOpen(true);
  };
  
  const handleDelete = (prompt: StoryPrompt) => {
    setPromptToDelete(prompt);
    setDeleteDialogOpen(true);
  };
  
  const confirmDelete = async () => {
    if (promptToDelete) {
      await deleteMutation.mutateAsync(promptToDelete.id);
      setDeleteDialogOpen(false);
      setPromptToDelete(null);
    }
  };
  
  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Story Generation Prompts</h1>
          <p className="text-muted-foreground mt-2">
            Manage AI prompts used to generate memory stories from interview transcripts
          </p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="w-4 h-4 mr-2" />
          New Prompt
        </Button>
      </div>
      
      {isLoading ? (
        <div className="text-center py-8">Loading prompts...</div>
      ) : (
        <div className="grid gap-4">
          {prompts?.map((prompt) => (
            <Card key={prompt.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <CardTitle>{prompt.title}</CardTitle>
                      {prompt.is_default && (
                        <Badge variant="default">Default</Badge>
                      )}
                    </div>
                    <CardDescription className="mt-2">
                      {prompt.prompt_text.substring(0, 150)}
                      {prompt.prompt_text.length > 150 && '...'}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(prompt)}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(prompt)}
                      disabled={prompt.is_default}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
            </Card>
          ))}
          
          {!prompts || prompts.length === 0 && (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-muted-foreground">No prompts created yet</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    
      <StoryPromptModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingPrompt(null);
        }}
        prompt={editingPrompt}
      />
      
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Prompt</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{promptToDelete?.title}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default StoryPromptsAdminPage;