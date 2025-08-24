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

interface AllergiesModalProps {
  /**
   * The care recipient ID to filter allergies.
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
 * A modal for viewing and managing allergies. Users can add new allergies with a severity and type,
 * and delete existing ones. Editing could be added by extending this component further.
 */
export const AllergiesModal: React.FC<AllergiesModalProps> = ({
  careRecipientId,
  isOpen,
  onClose,
}) => {
  const queryClient = useQueryClient();

  // Fetch all allergies for this recipient when the modal is open.
  const { data: allergies, isLoading } = useQuery({
    queryKey: ["allergies", careRecipientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("allergies")
        .select("*")
        .eq("care_group_id", careRecipientId)
        .order("severity", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: isOpen && !!careRecipientId,
  });

  // Local state for the new allergy form.
  const [form, setForm] = useState({
    allergen: "",
    severity: "mild",
    type: "food",
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("allergies").insert({
        care_group_id: careRecipientId,
        allergen: form.allergen,
        severity: form.severity,
        type: form.type,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setForm({ allergen: "", severity: "mild", type: "food" });
      queryClient.invalidateQueries({ queryKey: ["allergies", careRecipientId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("allergies").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["allergies", careRecipientId] });
    },
  });

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) onClose();
    }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Allergies</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 max-h-[60vh] overflow-y-auto">
          {isLoading ? (
            <p>Loading…</p>
          ) : (
            allergies?.map((allergy: any) => (
              <div
                key={allergy.id}
                className="flex items-center justify-between border-b pb-2"
              >
                <div>
                  <p className="font-medium">{allergy.allergen}</p>
                  <p className="text-xs text-muted-foreground">
                    {allergy.type} • {allergy.severity}
                  </p>
                </div>
                <Button
                  variant="destructive"
                  size="icon"
                  onClick={() => deleteMutation.mutate(allergy.id)}
                >
                  X
                </Button>
              </div>
            ))
          )}
        </div>
        {/* Form for adding a new allergy */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            addMutation.mutate();
          }}
          className="space-y-2 pt-4 border-t"
        >
          <Input
            placeholder="Allergen"
            value={form.allergen}
            onChange={(e) => setForm({ ...form, allergen: e.target.value })}
            required
          />
          <Select
            value={form.severity}
            onValueChange={(value) => setForm({ ...form, severity: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Severity" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="mild">Mild</SelectItem>
              <SelectItem value="moderate">Moderate</SelectItem>
              <SelectItem value="severe">Severe</SelectItem>
              <SelectItem value="anaphylaxis">Anaphylaxis</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={form.type}
            onValueChange={(value) => setForm({ ...form, type: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="food">Food</SelectItem>
              <SelectItem value="drug">Drug</SelectItem>
              <SelectItem value="environment">Environmental</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
          <Button type="submit">Add Allergy</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};