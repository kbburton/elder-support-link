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
  onSummaryUpdated,
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
      const { data, error } = await supabase.functions.invoke("process-document", {
        body: {
          documentId: document.id,
          mode: "regenerate",
          category: selectedCategory || document.category,
          customPrompt: customPrompt.trim() || undefined,
        },
      });

      if (error) throw error;

      const newSummary: string | undefined =
        data?.document?.summary ?? data?.summary ?? undefined;

      if (newSummary) {
        onSummaryUpdated(newSummary);
        toast({
          title: "Summary regenerated",
          description: "The AI summary has been updated.",
        });
        onClose();
      } else {
        throw new Error("No summary returned from function.");
      }
    } catch (err) {
      console.error("Error regenerating summary:", err);
      toast({
        title: "Regeneration failed",
        description: err instanceof Error ? err.message : "Unknown error",
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
            <Sparkles className="h-5 w-5" />
            Regenerate document summary
          </DialogTitle>
          <DialogDescription>
            Use a category-specific prompt or your own custom instructions.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              The AI analyzes the document content and generates a new summary based on the chosen
              category or your custom prompt. This replaces the current summary.
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
                Each category uses specialized prompts from your database if available.
              </p>
            </div>

            <div>
              <Label htmlFor="customPrompt">Custom Instructions (optional)</Label>
              <Textarea
                id="customPrompt"
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="Example: Focus on action items and follow-up steps relevant to caregivers."
                rows={4}
              />
              <p className="text-xs text-muted-foreground mt-1">
                If filled, this overrides the category prompt for this one summary.
              </p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={regenerating}>
            Cancel
          </Button>
          <Button onClick={handleRegenerate} disabled={regenerating || !selectedCategory}>
            <RefreshCw className={`h-4 w-4 mr-2 ${regenerating ? "animate-spin" : ""}`} />
            {regenerating ? "Regenerating..." : "Regenerate Summary"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
