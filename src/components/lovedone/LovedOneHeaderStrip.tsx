import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import React from "react";

interface LovedOneHeaderStripProps {
  /**
   * The unique identifier for the care recipient (i.e. group id).
   */
  careRecipientId: string;
  /**
   * Callback fired when the user wants to open the full allergies list.
   */
  onOpenAllergies: () => void;
  /**
   * Callback fired when the user wants to open the full preferences list.
   */
  onOpenPreferences: () => void;
}

/**
 * A header strip that surfaces the most critical allergies and the top preferences for a care
 * recipient. The strip is responsive and will display up to three items from each list. Each
 * item is colour coded according to its category or severity.
 */
export const LovedOneHeaderStrip: React.FC<LovedOneHeaderStripProps> = ({
  careRecipientId,
  onOpenAllergies,
  onOpenPreferences,
}) => {
  // Fetch allergies ordered by severity so the most severe come first.
  const { data: allergies } = useQuery({
    queryKey: ["allergies", careRecipientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("allergies")
        .select("id, allergen, severity")
        .eq("care_recipient_id", careRecipientId)
        .order("severity", { ascending: false });
      if (error) throw error;
      return data as { id: string; allergen: string; severity: string }[];
    },
    enabled: !!careRecipientId,
  });

  // Fetch preferences ordered so pinned items appear first.
  const { data: preferences } = useQuery({
    queryKey: ["preferences", careRecipientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("preferences")
        .select("id, type, text_value, pinned")
        .eq("care_recipient_id", careRecipientId)
        .order("pinned", { ascending: false })
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data as { id: string; type: string; text_value: string; pinned: boolean }[];
    },
    enabled: !!careRecipientId,
  });

  // Determine the top three allergies based on a custom severity ordering.
  const topAllergies = React.useMemo(() => {
    if (!allergies) return [];
    const order: Record<string, number> = { anaphylaxis: 4, severe: 3, moderate: 2, mild: 1 };
    return [...allergies]
      .sort((a, b) => (order[b.severity] ?? 0) - (order[a.severity] ?? 0))
      .slice(0, 3);
  }, [allergies]);

  // Determine up to three preferences, prioritising pinned ones first and filling with others as needed.
  const topPreferences = React.useMemo(() => {
    if (!preferences) return [];
    const pinned = preferences.filter((p) => p.pinned).slice(0, 3);
    if (pinned.length >= 3) return pinned;
    const others = preferences.filter((p) => !p.pinned).slice(0, 3 - pinned.length);
    return [...pinned, ...others].slice(0, 3);
  }, [preferences]);

  /**
   * Maps allergy severity to a tailwind colour pair. These classes assume that Tailwind CSS
   * utility classes for light backgrounds (e.g. `bg-red-100`) and dark text exist.
   */
  function severityClass(severity: string) {
    switch (severity) {
      case "anaphylaxis":
      case "severe":
        return "bg-red-100 text-red-800";
      case "moderate":
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-orange-100 text-orange-800";
    }
  }

  return (
    <div className="flex flex-col gap-1 w-full mb-4">
      {/* Allergies row */}
      <div className="flex items-center gap-2 flex-wrap text-sm">
        <span className="font-medium">Allergies:</span>
        {topAllergies.map((a) => (
          <span
            key={a.id}
            className={`px-2 py-1 rounded-full ${severityClass(a.severity)}`}
          >
            {a.allergen}
          </span>
        ))}
        <Button variant="link" size="sm" onClick={onOpenAllergies}>
          View all allergies
        </Button>
      </div>
      {/* Preferences row */}
      <div className="flex items-center gap-2 flex-wrap text-sm">
        <span className="font-medium">Preferences:</span>
        {topPreferences.map((p) => (
          <span
            key={p.id}
            className={`px-2 py-1 rounded-full ${
              p.type === "like"
                ? "bg-green-100 text-green-800"
                : "bg-red-100 text-red-800"
            }`}
          >
            {p.text_value}
          </span>
        ))}
        <Button variant="link" size="sm" onClick={onOpenPreferences}>
          View all preferences
        </Button>
      </div>
    </div>
  );
};