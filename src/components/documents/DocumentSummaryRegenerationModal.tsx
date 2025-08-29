import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RefreshCw, Sparkles, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface DocumentSummaryRegenerationModalProps {
  isOpen: boolean;
  onClose: () => void;
  document: {
    id: string;
    title?: string;
    category?: string;
    original_filename?: string;
  } | null;
  onSummaryUpdated: (newSummary: string) => void;
}

export function DocumentSummaryRegenerationModal({
  isOpen,
  onClose,
  document,
  onSummaryUpdated
}: DocumentSummaryRegenerationModalProps) {
  const [selectedCategory, setSelectedCategory] = useState(document?.category || "");
  const [customPrompt, setCustomPrompt] = useState("");
  const [regenerating, setRegenerating] = useState(false);
  const { toast } = useToast();

  const categories = [
    { value: "Medical", label: "Medical" },
    { value: "Legal", label: "Legal" },
    { value: "Financial", label: "Financial" },
    { value: "Insurance", label: "Insurance" },
    { value: "Personal", label: "Personal" },
    { value: "Other", label: "Other" },
  ];

  const handleRegenerate = async () => {
    if (!document) return;

    setRegenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('regenerate-summary', {
        body: { 
          documentId: document.id,
          category: selectedCategory || document.category,
          customPrompt: customPrompt.trim() || undefined
        }
      });

      if (error) throw error;

      if (data?.summary) {
        onSummaryUpdated(data.summary);
        toast({
          title: "Summary Regenerated",
          description: "The AI summary has been updated successfully.",
        });
        onClose();
      } else {
        throw new Error("No summary returned from regeneration");
      }
    } catch (error) {
      console.error('Error regenerating summary:', error);
      toast({
        title: "Regeneration Failed",
        description: error instanceof Error ? error.message : "Failed to regenerate summary",
        variant: "destructive",
      });
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Regenerate AI Summary
          </DialogTitle>
          <DialogDescription>
            Generate a new AI summary for "{document?.title || document?.original_filename || 'this document'}" 
            using category-specific prompts or a custom prompt.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              The AI will analyze the document's content and generate a new summary based on the selected category 
              or your custom instructions. This will replace the current summary.
            </AlertDescription>
          </Alert>

          <div className="space-y-4">
            <div>
              <Label htmlFor="category">Document Category</Label>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a category for optimized prompts" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category.value} value={category.value}>
                      {category.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Each category uses specialized prompts for better results.
              </p>
            </div>

            <div>
              <Label htmlFor="custom-prompt">Custom Instructions (Optional)</Label>
              <Textarea
                id="custom-prompt"
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="Add specific instructions for the AI summary (e.g., 'Focus on key dates and financial amounts', 'Summarize treatment recommendations', etc.)"
                rows={4}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground mt-1">
                If provided, these instructions will be added to the category-specific prompt.
              </p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={regenerating}>
            Cancel
          </Button>
          <Button 
            onClick={handleRegenerate} 
            disabled={regenerating || !selectedCategory}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${regenerating ? 'animate-spin' : ''}`} />
            {regenerating ? 'Regenerating...' : 'Regenerate Summary'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}