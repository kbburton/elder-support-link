import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, ChevronDown } from "lucide-react";
import { useStoryPrompts } from "@/hooks/useStoryPrompts";

interface StoryRegenerationModalProps {
  isOpen: boolean;
  onClose: () => void;
  storyId: string;
  onComplete: (newStory: { title: string; story_text: string; memory_facts: any[] }) => void;
}

export function StoryRegenerationModal({ 
  isOpen, 
  onClose, 
  storyId,
  onComplete 
}: StoryRegenerationModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedPromptId, setSelectedPromptId] = useState<string>('');
  const [previewOpen, setPreviewOpen] = useState(false);
  
  const { data: prompts, isLoading: promptsLoading } = useStoryPrompts();
  
  const selectedPrompt = prompts?.find(p => p.id === selectedPromptId);
  
  // Set default prompt when prompts load
  useEffect(() => {
    if (prompts && prompts.length > 0 && !selectedPromptId) {
      const defaultPrompt = prompts.find(p => p.is_default);
      if (defaultPrompt) {
        setSelectedPromptId(defaultPrompt.id);
      }
    }
  }, [prompts, selectedPromptId]);

  const handleRegenerate = async () => {
    if (!selectedPromptId) {
      toast.error('Please select a prompt');
      return;
    }
    
    setIsSubmitting(true);

    try {
      const { data, error } = await supabase.functions.invoke('regenerate-story', {
        body: { 
          storyId,
          promptId: selectedPromptId,
        }
      });

      if (error) throw error;

      if (data?.success) {
        toast.success("Story regenerated successfully!");
        onComplete({
          title: data.title,
          story_text: data.story_text,
          memory_facts: data.memory_facts,
        });
        onClose();
      } else {
        throw new Error(data?.error || "Failed to regenerate story");
      }
    } catch (error: any) {
      console.error('Regeneration error:', error);
      toast.error(error.message || "Failed to regenerate story");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Regenerate Story</DialogTitle>
          <DialogDescription>
            Select a generation prompt to regenerate the story with different instructions
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="prompt">Select Generation Prompt</Label>
            <Select value={selectedPromptId} onValueChange={setSelectedPromptId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a prompt..." />
              </SelectTrigger>
              <SelectContent>
                {promptsLoading ? (
                  <div className="p-2 text-sm text-muted-foreground">Loading prompts...</div>
                ) : (
                  prompts?.map((prompt) => (
                    <SelectItem key={prompt.id} value={prompt.id}>
                      {prompt.title}
                      {prompt.is_default && ' (Default)'}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          
          {selectedPrompt && (
            <Collapsible open={previewOpen} onOpenChange={setPreviewOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="w-full justify-between">
                  <span>Preview Prompt Text</span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${previewOpen ? 'rotate-180' : ''}`} />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="mt-2 p-4 bg-muted rounded-md">
                  <pre className="text-sm whitespace-pre-wrap font-mono">
                    {selectedPrompt.prompt_text}
                  </pre>
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleRegenerate}
              disabled={isSubmitting || !selectedPromptId}
            >
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Regenerate Story
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
