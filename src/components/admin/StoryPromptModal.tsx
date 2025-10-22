import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { StoryPrompt, useCreatePrompt, useUpdatePrompt } from '@/hooks/useStoryPrompts';

interface StoryPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  prompt?: StoryPrompt | null;
}

export const StoryPromptModal = ({ isOpen, onClose, prompt }: StoryPromptModalProps) => {
  const [title, setTitle] = useState('');
  const [promptText, setPromptText] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  
  const createMutation = useCreatePrompt();
  const updateMutation = useUpdatePrompt();
  
  useEffect(() => {
    if (prompt) {
      setTitle(prompt.title);
      setPromptText(prompt.prompt_text);
      setIsDefault(prompt.is_default);
    } else {
      setTitle('');
      setPromptText('');
      setIsDefault(false);
    }
  }, [prompt, isOpen]);
  
  const handleSave = async () => {
    if (!title.trim() || !promptText.trim()) {
      return;
    }
    
    if (prompt) {
      await updateMutation.mutateAsync({
        id: prompt.id,
        title,
        prompt_text: promptText,
        is_default: isDefault
      });
    } else {
      await createMutation.mutateAsync({
        title,
        prompt_text: promptText,
        is_default: isDefault
      });
    }
    
    onClose();
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {prompt ? 'Edit Story Generation Prompt' : 'Create Story Generation Prompt'}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Prompt Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Warm Family Biography"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="promptText">Prompt Text</Label>
            <Textarea
              id="promptText"
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              placeholder="Enter the full prompt text that will be sent to the AI..."
              className="font-mono text-sm min-h-[300px]"
            />
          </div>
          
          <div className="flex items-center space-x-2">
            <Switch
              id="isDefault"
              checked={isDefault}
              onCheckedChange={setIsDefault}
            />
            <Label htmlFor="isDefault">Set as default prompt</Label>
          </div>
          
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              onClick={handleSave}
              disabled={!title.trim() || !promptText.trim() || createMutation.isPending || updateMutation.isPending}
            >
              {prompt ? 'Update' : 'Create'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};