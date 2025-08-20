import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { triggerReindex } from "@/utils/reindex";

export type EntityType = "contact" | "appointment" | "task" | "document" | "activity";

interface Association {
  id: string;
  title: string;
  type: EntityType;
  date?: string;
  status?: string;
  category?: string;
}

// Junction table mapping for all bidirectional relationships
const JUNCTION_TABLES = {
  // Activity associations
  "activity-appointment": "appointment_activities",
  "appointment-activity": "appointment_activities",
  "activity-contact": "contact_activities",
  "contact-activity": "contact_activities",
  "activity-document": "activity_documents",
  "document-activity": "activity_documents",
  "activity-task": "task_activities",
  "task-activity": "task_activities",
  
  // Appointment associations
  "appointment-contact": "contact_appointments",
  "contact-appointment": "contact_appointments",
  "appointment-document": "appointment_documents", 
  "document-appointment": "appointment_documents",
  "appointment-task": "appointment_tasks",
  "task-appointment": "appointment_tasks",
  
  // Contact associations
  "contact-document": "contact_documents",
  "document-contact": "contact_documents",
  "contact-task": "contact_tasks",
  "task-contact": "contact_tasks",
  
  // Document-Task association
  "document-task": "task_documents",
  "task-document": "task_documents"
} as const;

// Column mapping for junction tables
const COLUMN_MAPPING = {
  "contact_appointments": { left: "contact_id", right: "appointment_id" },
  "contact_tasks": { left: "contact_id", right: "task_id" },
  "contact_documents": { left: "contact_id", right: "document_id" },
  "contact_activities": { left: "contact_id", right: "activity_log_id" },
  "appointment_tasks": { left: "appointment_id", right: "task_id" },
  "appointment_documents": { left: "appointment_id", right: "document_id" },
  "appointment_activities": { left: "appointment_id", right: "activity_log_id" },
  "task_documents": { left: "task_id", right: "document_id" },
  "task_activities": { left: "task_id", right: "activity_log_id" },
  "activity_documents": { left: "activity_log_id", right: "document_id" }
} as const;

function getJunctionTableKey(entityType1: EntityType, entityType2: EntityType): string {
  const types = [entityType1, entityType2].sort();
  return `${types[0]}-${types[1]}`;
}

function getJunctionTable(entityType1: EntityType, entityType2: EntityType): string | null {
  const key = getJunctionTableKey(entityType1, entityType2);
  return JUNCTION_TABLES[key as keyof typeof JUNCTION_TABLES] || null;
}

export function useAssociations(entityId: string, entityType: EntityType) {
  return useQuery({
    queryKey: ["associations", entityType, entityId],
    queryFn: async (): Promise<Association[]> => {
      if (!entityId) return [];
      
      console.log(`🔍 [ASSOCIATIONS] Fetching associations for ${entityType}:${entityId}`);
      console.log(`🌍 [ENV] Environment: ${window.location.hostname}`);
      console.log(`🔗 [TABLES] Available junction tables:`, Object.keys(JUNCTION_TABLES));
      
      const associations: Association[] = [];
      
      // Query all possible associations for this entity
      for (const [key, tableName] of Object.entries(JUNCTION_TABLES)) {
        const [type1, type2] = key.split('-') as [EntityType, EntityType];
        
        // Skip if this entity type is not part of this relationship
        if (type1 !== entityType && type2 !== entityType) continue;
        
        const targetType = type1 === entityType ? type2 : type1;
        const columns = COLUMN_MAPPING[tableName as keyof typeof COLUMN_MAPPING];
        
        // Determine which column represents our entity and which represents the target
        let ourColumn: string;
        let targetColumn: string;
        
        // Use the alphabetical mapping from COLUMN_MAPPING
        const isFirstType = entityType === type1;
        ourColumn = isFirstType ? columns.left : columns.right;
        targetColumn = isFirstType ? columns.right : columns.left;
        
        // Build the query based on target entity type
        let selectClause = "";
        if (targetType === "contact") {
          selectClause = `contacts!inner(id, first_name, last_name, organization_name)`;
        } else if (targetType === "appointment") {
          selectClause = `appointments!inner(id, description, date_time, category)`;
        } else if (targetType === "task") {
          selectClause = `tasks!inner(id, title, status, priority, due_date, category)`;
        } else if (targetType === "document") {
          selectClause = `documents!inner(id, title, original_filename, category)`;
        } else if (targetType === "activity") {
          selectClause = `activity_logs!inner(id, title, type, date_time, notes)`;
        }
        
        console.log(`📋 [QUERY] ${tableName}: ${selectClause} WHERE ${ourColumn} = ${entityId}`);
        
        const { data, error } = await supabase
          .from(tableName as any)
          .select(selectClause)
          .eq(ourColumn, entityId);
        
        if (error) {
          console.error(`❌ [ERROR] ${targetType} associations from ${tableName}:`, error);
          continue;
        }
        
        console.log(`✅ [RESULT] ${targetType} from ${tableName}:`, data?.length || 0, "items");
        
        // Transform the data
        data?.forEach((item: any) => {
          const targetEntity = item[`${targetType}s`] || item.contacts || item.activity_logs;
          if (!targetEntity) return;
          
          let title = "";
          let date = "";
          let status = "";
          let category = "";
          
          if (targetType === "contact") {
            title = [targetEntity.first_name, targetEntity.last_name].filter(Boolean).join(" ") || 
                   targetEntity.organization_name || "Unknown Contact";
          } else if (targetType === "appointment") {
            title = targetEntity.description || "Appointment";
            date = targetEntity.date_time;
            category = targetEntity.category;
          } else if (targetType === "task") {
            title = targetEntity.title || "Task";
            status = targetEntity.status;
            date = targetEntity.due_date;
            category = targetEntity.category;
          } else if (targetType === "document") {
            title = targetEntity.title || targetEntity.original_filename || "Document";
            category = targetEntity.category;
          } else if (targetType === "activity") {
            title = targetEntity.title || `${targetEntity.type} - ${new Date(targetEntity.date_time).toLocaleDateString()}`;
            date = targetEntity.date_time;
          }
          
          associations.push({
            id: targetEntity.id,
            title,
            type: targetType,
            date,
            status,
            category
          });
        });
      }
      
      console.log(`🎯 [FINAL] Found ${associations.length} total associations for ${entityType}:${entityId}`);
      console.log(`📊 [BREAKDOWN]`, associations.map(a => `${a.type}: ${a.title}`));
      
      return associations;
    },
    enabled: !!entityId,
  });
}

export function useAvailableItems(entityType: EntityType, targetType: EntityType, groupId: string, searchTerm: string = "") {
  return useQuery({
    queryKey: ["available-items", entityType, targetType, groupId, searchTerm],
    queryFn: async () => {
      if (!groupId || !targetType) return [];
      
      let tableName = "";
      let selectClause = "";
      let groupColumn = "";
      
      if (targetType === "contact") {
        tableName = "contacts";
        selectClause = "id, first_name, last_name, organization_name";
        groupColumn = "care_group_id";
      } else if (targetType === "appointment") {
        tableName = "appointments";
        selectClause = "id, description, date_time, category";
        groupColumn = "group_id";
      } else if (targetType === "task") {
        tableName = "tasks";
        selectClause = "id, title, status, priority, due_date, category";
        groupColumn = "group_id";
      } else if (targetType === "document") {
        tableName = "documents";
        selectClause = "id, title, original_filename, category";
        groupColumn = "group_id";
      } else if (targetType === "activity") {
        tableName = "activity_logs";
        selectClause = "id, title, type, date_time, notes";
        groupColumn = "group_id";
      }
      
      let query = supabase
        .from(tableName as any)
        .select(selectClause)
        .eq(groupColumn, groupId)
        .eq("is_deleted", false);
        
      if (searchTerm && targetType === "contact") {
        query = query.or(`first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%,organization_name.ilike.%${searchTerm}%`);
      } else if (searchTerm && targetType === "appointment") {
        query = query.ilike("description", `%${searchTerm}%`);
      } else if (searchTerm && targetType === "task") {
        query = query.ilike("title", `%${searchTerm}%`);
      } else if (searchTerm && targetType === "document") {
        query = query.or(`title.ilike.%${searchTerm}%,original_filename.ilike.%${searchTerm}%`);
      } else if (searchTerm && targetType === "activity") {
        query = query.or(`title.ilike.%${searchTerm}%,type.ilike.%${searchTerm}%,notes.ilike.%${searchTerm}%`);
      }
      
      const { data, error } = await query.limit(20);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!groupId && !!targetType,
  });
}

export function useCreateAssociation() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async ({ 
      entityId, 
      entityType, 
      targetId, 
      targetType 
    }: { 
      entityId: string; 
      entityType: EntityType; 
      targetId: string; 
      targetType: EntityType; 
    }) => {
      const junctionTable = getJunctionTable(entityType, targetType);
      if (!junctionTable) {
        throw new Error(`Unsupported association: ${entityType} ↔ ${targetType}. This combination is not available.`);
      }
      
      console.log(`🔧 [CREATE] Starting association creation: ${entityType}:${entityId} ↔ ${targetType}:${targetId}`);
      console.log(`🌍 [ENV] Environment: ${window.location.hostname}`);
      
      // Validate both entities exist using security definer function
      console.log(`🔍 [VALIDATE] Checking entity existence...`);
      const { data: entityExists, error: entityError } = await supabase.rpc('validate_entity_exists', {
        p_entity_type: entityType,
        p_entity_id: entityId
      });
      
      const { data: targetExists, error: targetError } = await supabase.rpc('validate_entity_exists', {
        p_entity_type: targetType,
        p_entity_id: targetId
      });
      
      console.log(`✅ [VALIDATE] Results: ${entityType} exists = ${entityExists}, ${targetType} exists = ${targetExists}`);
      if (entityError) console.error(`❌ [VALIDATE ERROR] Entity:`, entityError);
      if (targetError) console.error(`❌ [VALIDATE ERROR] Target:`, targetError);
      
      if (!entityExists) {
        throw new Error(`${entityType} not found or has been deleted`);
      }
      
      if (!targetExists) {
        throw new Error(`${targetType} not found or has been deleted`);
      }
      
      const columns = COLUMN_MAPPING[junctionTable as keyof typeof COLUMN_MAPPING];
      const [type1, type2] = getJunctionTableKey(entityType, targetType).split('-') as [EntityType, EntityType];
      
      // Get user ID first
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      
      // Determine which ID goes in which column using alphabetical mapping
      const isFirstType = entityType === type1;
      const entityColumn = isFirstType ? columns.left : columns.right;
      const targetColumn = isFirstType ? columns.right : columns.left;
      
      // Build insert data - only include created_by_user_id for tables that have it
      const insertData: any = {
        [entityColumn]: entityId,
        [targetColumn]: targetId
      };
      
      // Only certain junction tables have created_by_user_id column
      const tablesWithCreatedBy = ['activity_documents', 'task_activities', 'appointment_activities', 'appointment_documents', 'appointment_tasks'];
      if (tablesWithCreatedBy.includes(junctionTable)) {
        insertData.created_by_user_id = user.id;
      }
      
      console.log(`🔗 [INSERT] Table: ${junctionTable}`);
      console.log(`📝 [INSERT] Data:`, insertData);
      console.log(`🎯 [INSERT] Column mapping:`, { entityColumn, targetColumn });
      
      const { error } = await supabase
        .from(junctionTable as any)
        .insert(insertData);
      
      if (error) {
        console.error(`❌ [INSERT ERROR] Association creation failed:`, error);
        console.error(`🔍 [ERROR DETAILS] Code: ${error.code}, Message: ${error.message}`);
        
        // Handle Postgres duplicate key error (23505)
        if (error.code === '23505' || error.message?.includes("duplicate") || error.message?.includes("unique")) {
          console.log(`⚠️ [DUPLICATE] Already linked - showing user message`);
          throw new Error("Already linked.");
        }
        
        throw error;
      }
      
      console.log(`✅ [SUCCESS] Association created successfully!`);
      
      // Trigger reindex for both entities - map entity types to table names
      const entityToTable = (type: EntityType) => {
        switch(type) {
          case "contact": return "contacts";
          case "appointment": return "appointments"; 
          case "task": return "tasks";
          case "document": return "documents";
          case "activity": return "activity_logs";
          default: return type;
        }
      };
      
      triggerReindex(entityToTable(entityType), entityId);
      triggerReindex(entityToTable(targetType), targetId);
    },
    onSuccess: (_, { entityId, entityType, targetType }) => {
      // Invalidate association queries for both entities
      queryClient.invalidateQueries({ queryKey: ["associations", entityType, entityId] });
      queryClient.invalidateQueries({ queryKey: ["associations"] });
      
      toast({
        title: "Success",
        description: "Association created successfully",
      });
    },
    onError: (error: any) => {
      console.error("Error creating association:", error);
      toast({
        title: "Error", 
        description: error.message || "Failed to create association",
        variant: "destructive",
      });
    },
  });
}

export function useRemoveAssociation() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async ({ 
      entityId, 
      entityType, 
      targetId, 
      targetType 
    }: { 
      entityId: string; 
      entityType: EntityType; 
      targetId: string; 
      targetType: EntityType; 
    }) => {
      const junctionTable = getJunctionTable(entityType, targetType);
      if (!junctionTable) {
        throw new Error(`No junction table found for ${entityType} ↔ ${targetType}`);
      }
      
      const columns = COLUMN_MAPPING[junctionTable as keyof typeof COLUMN_MAPPING];
      const [type1, type2] = getJunctionTableKey(entityType, targetType).split('-') as [EntityType, EntityType];
      
      // Determine which ID goes in which column using alphabetical mapping
      const isFirstType = entityType === type1;
      const entityColumn = isFirstType ? columns.left : columns.right;
      const targetColumn = isFirstType ? columns.right : columns.left;
      
      console.log(`🗑️ [DELETE] Removing association from ${junctionTable}`);
      console.log(`🎯 [DELETE] Where: ${entityColumn} = ${entityId} AND ${targetColumn} = ${targetId}`);
      console.log(`🌍 [ENV] Environment: ${window.location.hostname}`);
      
      const { error } = await supabase
        .from(junctionTable as any)
        .delete()
        .eq(entityColumn, entityId)
        .eq(targetColumn, targetId);
      
      if (error) {
        console.error(`❌ [DELETE ERROR] Association removal failed:`, error);
        throw error;
      }
      
      console.log(`✅ [DELETE SUCCESS] Association removed successfully!`);
      
      // Trigger reindex for both entities - map entity types to table names
      const entityToTable = (type: EntityType) => {
        switch(type) {
          case "contact": return "contacts";
          case "appointment": return "appointments"; 
          case "task": return "tasks";
          case "document": return "documents";
          case "activity": return "activity_logs";
          default: return type;
        }
      };
      
      triggerReindex(entityToTable(entityType), entityId);
      triggerReindex(entityToTable(targetType), targetId);
    },
    onSuccess: (_, { entityId, entityType }) => {
      // Invalidate association queries for both entities
      queryClient.invalidateQueries({ queryKey: ["associations", entityType, entityId] });
      queryClient.invalidateQueries({ queryKey: ["associations"] });
      
      toast({
        title: "Success", 
        description: "Association removed successfully",
      });
    },
    onError: (error: any) => {
      console.error("Error removing association:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to remove association", 
        variant: "destructive",
      });
    },
  });
}