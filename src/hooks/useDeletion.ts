import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { softDeleteEntity, restoreEntity, bulkSoftDelete, bulkRestore } from "@/lib/delete/rpc";
import type { EntityType } from "@/lib/delete/types";
import { ENTITY_LABELS, ENTITY_LABELS_PLURAL } from "@/lib/delete/types";

export function useDeletion() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const getCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error("User not authenticated");
    }
    return {
      id: user.id,
      email: user.email || 'unknown@example.com'
    };
  };

  const softDelete = async (ids: string[], entityType: EntityType) => {
    setIsLoading(true);
    
    try {
      const user = await getCurrentUser();
      
      if (ids.length === 1) {
        const result = await softDeleteEntity(entityType, ids[0], user.id, user.email);
        
        if (result.success) {
          toast({
            title: "Item deleted",
            description: `${ENTITY_LABELS[entityType]} moved to trash. Recoverable for 30 days.`
          });
        } else {
          toast({
            title: "Delete failed",
            description: result.error || "Unknown error occurred",
            variant: "destructive"
          });
        }
        
        return result.success;
      } else {
        const results = await bulkSoftDelete(entityType, ids, user.id, user.email);
        
        if (results.successful.length > 0) {
          toast({
            title: `${results.successful.length} ${ENTITY_LABELS_PLURAL[entityType]} deleted`,
            description: "Items moved to trash. Recoverable for 30 days."
          });
        }
        
        if (results.failed.length > 0) {
          toast({
            title: `${results.failed.length} ${ENTITY_LABELS_PLURAL[entityType]} failed to delete`,
            description: results.failed[0].error,
            variant: "destructive"
          });
        }
        
        return results.successful.length === ids.length;
      }
    } catch (error) {
      toast({
        title: "Delete failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive"
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const restore = async (ids: string[], entityType: EntityType) => {
    setIsLoading(true);
    
    try {
      const user = await getCurrentUser();
      
      if (ids.length === 1) {
        const result = await restoreEntity(entityType, ids[0], user.id, user.email);
        
        if (result.success) {
          toast({
            title: "Item restored",
            description: `${ENTITY_LABELS[entityType]} has been restored.`
          });
        } else {
          toast({
            title: "Restore failed",
            description: result.error || "Unknown error occurred",
            variant: "destructive"
          });
        }
        
        return result.success;
      } else {
        const results = await bulkRestore(entityType, ids, user.id, user.email);
        
        if (results.successful.length > 0) {
          toast({
            title: `${results.successful.length} ${ENTITY_LABELS_PLURAL[entityType]} restored`,
            description: "Items have been restored from trash."
          });
        }
        
        if (results.failed.length > 0) {
          toast({
            title: `${results.failed.length} ${ENTITY_LABELS_PLURAL[entityType]} failed to restore`,
            description: results.failed[0].error,
            variant: "destructive"
          });
        }
        
        return results.successful.length === ids.length;
      }
    } catch (error) {
      toast({
        title: "Restore failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive"
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    softDelete,
    restore,
    isLoading
  };
}