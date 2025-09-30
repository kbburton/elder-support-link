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
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

/**
 * DocumentSummaryRegenerationModal
 * --------------------------------
 * This version is resilient to different Edge Function response shapes.
 * It will first try `regenerate-summary`. If that function is missing or
 * returns a non-2xx response, it falls back to `process-document`.
 *
 * Expected shapes (all supported):
 *  A) { summary: "..." }
 *  B) { success: true, document: { summary: "..." } }
 *  C) { document: { summary: "..." } }
 *  D) { result: { summary: "..." } }
 */
type RegenerateTarget = "regenerate-summary" | "process-document";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  documentId: string;
  category?: string | null;
  onComplete?: (newSummary: string) => void;
}

function extractSummaryFromEdgeResponse(data: any): string | null {
  if (!data) return null;
  if (typeof data.summary === "string" && data.summary.trim()) return data.summary.trim();
  if (typeof data.document?.summary === "string" && data.document.summary.trim()) {
    return data.document.summary.trim();
  }
  if (typeof data.result?.summary === "string" && data.result.summary.trim()) {
    return data.result.summary.trim();
  }
  if (typeof data.data?.summary === "string" && data.data.summary.trim()) {
    return data.data.summary.trim();
  }
  return null;
}

export default function DocumentSummaryRegenerationModal({
  isOpen,
  onClose,
  documentId,
  category,
  onComplete,
}: Props) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [promptOverride, setPromptOverride] = useState("");
  const [temperature, setTemperature] = useState<string>("0.3");

  const callEdge = async (fn: RegenerateTarget) => {
    return supabase.functions.invoke(fn, {
      body: {
        documentId,
        // Optional advanced knobs the edge fn may ignore if not supported
        promptOverride: promptOverride?.trim() || undefined,
        temperature: Number(temperature),
        category: category ?? undefined,
      },
    });
  };

  const handleRegenerate = async () => {
    setIsSubmitting(true);
    try {
      // Try the "new" function first
      let { data, error } = await callEdge("regenerate-summary");
      if (error) {
        const status = (error as any)?.context?.response?.status ?? (error as any)?.status;
        const message = (error as any)?.message ?? '';
        const isNotFound = status === 404 || /not\s*found/i.test(String(message));
        if (isNotFound) {
          ({ data, error } = await callEdge("process-document"));
        }
      }

      if (error) {
        toast({
          title: "Regeneration failed",
          description: (error as any)?.message || "Edge Function returned an error.",
          variant: "destructive",
        });
        return;
      }

      const summary = extractSummaryFromEdgeResponse(data);
      if (!summary) {
        // Show debug in console to help us diagnose payload shape if needed
        // eslint-disable-next-line no-console
        console.warn("[DocumentSummaryRegenerationModal] Unexpected Edge response shape:", data);
        toast({
          title: "Regeneration failed",
          description: "No summary returned from function.",
          variant: "destructive",
        });
        return;
      }

      toast({ title: "Summary updated", description: "AI summary was regenerated." });
      onComplete?.(summary);
      onClose();
    } catch (err: any) {
      toast({
        title: "Regeneration failed",
        description: err?.message || "Unexpected error.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Regenerate Summary with AI</DialogTitle>
          <DialogDescription>
            This will re-run the AI summary for the selected document using the category-specific prompt.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="prompt">Optional prompt override</Label>
            <Textarea
              id="prompt"
              placeholder="Leave blank to use the saved prompt for this category."
              value={promptOverride}
              onChange={(e) => setPromptOverride(e.target.value)}
              rows={4}
            />
          </div>

          <div className="grid gap-2">
            <Label>Temperature</Label>
            <Select value={temperature} onValueChange={setTemperature}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="0.3" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0.0">0.0</SelectItem>
                <SelectItem value="0.2">0.2</SelectItem>
                <SelectItem value="0.3">0.3</SelectItem>
                <SelectItem value="0.5">0.5</SelectItem>
                <SelectItem value="0.7">0.7</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleRegenerate} disabled={isSubmitting}>
            {isSubmitting ? "Regenerating…" : "Regenerate Summary"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
