import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

interface PreferencesModalProps {
  /**
   * The care recipient ID to filter preferences.
   */
  careRecipientId: string;
  /**
   * Controls whether the modal is visible.
   */
  isOpen: boolean;
  /**
   * Called when the user dismisses the modal. The parent is responsible for updating
   * the `isOpen` prop accordingly.
   */
  onClose: () => void;
}

/**
 * A modal for viewing and managing preferences (likes and dislikes). Users can add new
 * preferences, toggle pinned status, and delete existing ones. Editing existing text values
 * could be added later.
 */
export const PreferencesModal: React.FC<PreferencesModalProps> = ({
  careRecipientId,
  isOpen,
  onClose,
}) => {
  const queryClient = useQueryClient();

  // Fetch preferences for this recipient. Pinned items come first.
  const { data: preferences, isLoading } = useQuery({
    queryKey: ["preferences", careRecipientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("preferences")
        .select("*")
        .eq("care_recipient_id", careRecipientId)
        .order("pinned", { ascending: false })
        .order("order_index", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: isOpen && !!careRecipientId,
  });

  // Local state for the new preference form.
  const [form, setForm] = useState({
    type: "like",
    text_value: "",
    category: "other",
    pinned: false,
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("preferences").insert({
        care_recipient_id: careRecipientId,
        type: form.type,
        text_value: form.text_value,
        category: form.category,
        pinned: form.pinned,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setForm({ type: "like", text_value: "", category: "other", pinned: false });
      queryClient.invalidateQueries({ queryKey: ["preferences", careRecipientId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("preferences").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["preferences", careRecipientId] });
    },
  });

  const togglePinned = useMutation({
    mutationFn: async ({ id, pinned }: { id: string; pinned: boolean }) => {
      const { error } = await supabase
        .from("preferences")
        .update({ pinned })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["preferences", careRecipientId] });
    },
  });

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) onClose();
    }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Preferences</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 max-h-[60vh] overflow-y-auto">
          {isLoading ? (
            <p>Loading…</p>
          ) : (
            preferences?.map((pref: any) => (
              <div
                key={pref.id}
                className="flex items-center justify-between border-b pb-2"
              >
                <div>
                  <p className="font-medium">{pref.text_value}</p>
                  <p className="text-xs text-muted-foreground">
                    {pref.type} • {pref.category}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={pref.pinned}
                    onCheckedChange={(checked) =>
                      togglePinned.mutate({ id: pref.id, pinned: checked })
                    }
                  />
                  <Button
                    variant="destructive"
                    size="icon"
                    onClick={() => deleteMutation.mutate(pref.id)}
                  >
                    X
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
        {/* Form for adding a new preference */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            addMutation.mutate();
          }}
          className="space-y-2 pt-4 border-t"
        >
          <Select
            value={form.type}
            onValueChange={(value) => setForm({ ...form, type: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="like">Like</SelectItem>
              <SelectItem value="dislike">Dislike</SelectItem>
            </SelectContent>
          </Select>
          <Input
            placeholder="Preference text"
            value={form.text_value}
            onChange={(e) => setForm({ ...form, text_value: e.target.value })}
            required
          />
          <Select
            value={form.category}
            onValueChange={(value) => setForm({ ...form, category: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="food">Food</SelectItem>
              <SelectItem value="activities">Activities</SelectItem>
              <SelectItem value="people">People</SelectItem>
              <SelectItem value="environment">Environment</SelectItem>
              <SelectItem value="media">Media</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2">
            <Switch
              checked={form.pinned}
              onCheckedChange={(checked) => setForm({ ...form, pinned: checked })}
            />
            <span>Pin to top</span>
          </div>
          <Button type="submit">Add Preference</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};