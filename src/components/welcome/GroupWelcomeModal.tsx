import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";

interface GroupWelcomeModalProps {
  groupId: string;
  groupName: string;
  isOpen: boolean;
  onClose: () => void;
}

export const GroupWelcomeModal: React.FC<GroupWelcomeModalProps> = ({
  groupId,
  groupName,
  isOpen,
  onClose
}) => {
  const handleWelcome = async () => {
    // Log that user has accessed this group
    try {
      await supabase.rpc('log_group_access', { p_group_id: groupId });
    } catch (error) {
      console.error('Error logging group access:', error);
    }
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Welcome to {groupName}!</DialogTitle>
          <DialogDescription>
            You're now part of this care group. Here you can view the calendar, 
            manage tasks, share documents, and coordinate care activities.
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex justify-center">
          <Button onClick={handleWelcome} className="w-full">
            Get Started
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};