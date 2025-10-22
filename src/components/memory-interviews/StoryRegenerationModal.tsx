import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface StoryRegenerationModalProps {
  isOpen: boolean;
  onClose: () => void;
  storyId: string;
  onComplete: (newStory: { title: string; story_text: string; memory_facts: any[] }) => void;
}

const DEFAULT_PROMPT = `You are a factual family biographer who writes short third-person vignettes about a person's life based on interview transcripts with an AI interviewer.

Your job:
- Write an engaging short story that feels human, warm, and vivid but always grounded in facts stated or logically inferred from the transcript.
- You may infer timing and context (e.g., if he was six in 1942, mention wartime life), but you must not invent fictional people, dialogue, or events.
- Treat each story as part of a larger biography but make it self-contained.
- Never begin with birth details unless relevant to that vignette.
- Maintain a consistent, respectful tone suitable for a family storybook.
- If details are missing, write naturally around the gaps rather than fabricating content.
- The narrator's voice is third-person.

Return your response as a JSON object with this structure:
{
  "title": "A short, evocative title for the story",
  "story": "The complete story text",
  "memory_facts": ["fact1", "fact2", "fact3"]
}`;

export function StoryRegenerationModal({ 
  isOpen, 
  onClose, 
  storyId,
  onComplete 
}: StoryRegenerationModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [customPrompt, setCustomPrompt] = useState(DEFAULT_PROMPT);

  const handleRegenerate = async () => {
    setIsSubmitting(true);

    try {
      const { data, error } = await supabase.functions.invoke('regenerate-story', {
        body: { 
          storyId,
          customPrompt: customPrompt.trim() || undefined,
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
            Customize the prompt to regenerate the story with different instructions
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="prompt">Custom Prompt</Label>
            <Textarea
              id="prompt"
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="Enter custom prompt..."
              className="min-h-[300px] font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Edit the prompt above to change how the story is generated. The prompt should include instructions for the AI biographer.
            </p>
          </div>

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
              disabled={isSubmitting}
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
