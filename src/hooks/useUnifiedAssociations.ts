import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { triggerReindex } from "@/utils/reindex";
import { ENTITY, EntityType, ENTITY_TABLE_MAP, ENTITY_GROUP_COLUMN_MAP } from "@/constants/entities";

export type { EntityType } from "@/constants/entities";

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
  "activity_log-appointment": "appointment_activities",
  "appointment-activity_log": "appointment_activities",
  "activity_log-contact": "contact_activities",
  "contact-activity_log": "contact_activities",
  "activity_log-document": "activity_documents",
  "document-activity_log": "activity_documents",
  "activity_log-task": "task_activities",
  "task-activity_log": "task_activities",
  
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
        if (targetType === ENTITY.contact) {
          selectClause = `contacts!inner(id, first_name, last_name, organization_name)`;
        } else if (targetType === ENTITY.appointment) {
          selectClause = `appointments!inner(id, description, date_time, category)`;
        } else if (targetType === ENTITY.task) {
          selectClause = `tasks!inner(id, title, status, priority, due_date, category)`;
        } else if (targetType === ENTITY.document) {
          selectClause = `documents!inner(id, title, original_filename, category)`;
        } else if (targetType === ENTITY.activity_log) {
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
          
          if (targetType === ENTITY.contact) {
            title = [targetEntity.first_name, targetEntity.last_name].filter(Boolean).join(" ") || 
                   targetEntity.organization_name || "Unknown Contact";
          } else if (targetType === ENTITY.appointment) {
            title = targetEntity.description || "Appointment";
            date = targetEntity.date_time;
            category = targetEntity.category;
          } else if (targetType === ENTITY.task) {
            title = targetEntity.title || "Task";
            status = targetEntity.status;
            date = targetEntity.due_date;
            category = targetEntity.category;
          } else if (targetType === ENTITY.document) {
            title = targetEntity.title || targetEntity.original_filename || "Document";
            category = targetEntity.category;
          } else if (targetType === ENTITY.activity_log) {
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

export function useAvailableItems(entityType: EntityType, targetType: EntityType, groupId: string, searchTerm: string = "", entityId?: string) {
  return useQuery({
    queryKey: ["available-items", entityType, targetType, groupId, searchTerm, entityId],
    queryFn: async () => {
      if (!groupId || !targetType) return [];
      
      let tableName = "";
      let selectClause = "";
      let groupColumn = "";
      
      if (targetType === ENTITY.contact) {
        tableName = ENTITY_TABLE_MAP[ENTITY.contact];
        selectClause = "id, first_name, last_name, organization_name";
        groupColumn = ENTITY_GROUP_COLUMN_MAP[ENTITY.contact];
      } else if (targetType === ENTITY.appointment) {
        tableName = ENTITY_TABLE_MAP[ENTITY.appointment];
        selectClause = "id, description, date_time, category";
        groupColumn = ENTITY_GROUP_COLUMN_MAP[ENTITY.appointment];
      } else if (targetType === ENTITY.task) {
        tableName = ENTITY_TABLE_MAP[ENTITY.task];
        selectClause = "id, title, status, priority, due_date, category";
        groupColumn = ENTITY_GROUP_COLUMN_MAP[ENTITY.task];
      } else if (targetType === ENTITY.document) {
        tableName = ENTITY_TABLE_MAP[ENTITY.document];
        selectClause = "id, title, original_filename, category";
        groupColumn = ENTITY_GROUP_COLUMN_MAP[ENTITY.document];
      } else if (targetType === ENTITY.activity_log) {
        tableName = ENTITY_TABLE_MAP[ENTITY.activity_log];
        selectClause = "id, title, type, date_time, notes";
        groupColumn = ENTITY_GROUP_COLUMN_MAP[ENTITY.activity_log];
      }
      
      let query = supabase
        .from(tableName as any)
        .select(selectClause)
        .eq(groupColumn, groupId)
        .eq("is_deleted", false);
        
      if (searchTerm && targetType === ENTITY.contact) {
        query = query.or(`first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%,organization_name.ilike.%${searchTerm}%`);
      } else if (searchTerm && targetType === ENTITY.appointment) {
        query = query.ilike("description", `%${searchTerm}%`);
      } else if (searchTerm && targetType === ENTITY.task) {
        query = query.ilike("title", `%${searchTerm}%`);
      } else if (searchTerm && targetType === ENTITY.document) {
        query = query.or(`title.ilike.%${searchTerm}%,original_filename.ilike.%${searchTerm}%`);
      } else if (searchTerm && targetType === ENTITY.activity_log) {
        query = query.or(`title.ilike.%${searchTerm}%,type.ilike.%${searchTerm}%,notes.ilike.%${searchTerm}%`);
      }
      
      const { data, error } = await query.limit(100); // Increased limit since we'll filter
      
      if (error) throw error;
      let items = data || [];
      
      // Filter out already associated items if entityId is provided
      if (entityId && entityType) {
        const existingIds = new Set<string>();
        
        // Build set of existing document_ids from task_documents for taskId
        if (entityType === ENTITY.task && targetType === ENTITY.document) {
          const { data: existingDocs } = await supabase
            .from("task_documents")
            .select("document_id")
            .eq("task_id", entityId);
          
          if (existingDocs) {
            existingDocs.forEach(doc => existingIds.add(doc.document_id));
          }
        }
        
        // Build set of existing activity_log_ids from task_activities for taskId
        if (entityType === ENTITY.task && targetType === ENTITY.activity_log) {
          const { data: existingActivities } = await supabase
            .from("task_activities")
            .select("activity_log_id")
            .eq("task_id", entityId);
          
          if (existingActivities) {
            existingActivities.forEach(activity => existingIds.add(activity.activity_log_id));
          }
        }
        
        // Filter for other entity types using junction tables
        if (existingIds.size === 0) {
          const junctionTable = getJunctionTable(entityType, targetType);
          if (junctionTable) {
            const columns = COLUMN_MAPPING[junctionTable as keyof typeof COLUMN_MAPPING];
            const [type1, type2] = getJunctionTableKey(entityType, targetType).split('-') as [EntityType, EntityType];
            
            const isFirstType = entityType === type1;
            const entityColumn = isFirstType ? columns.left : columns.right;
            const targetColumn = isFirstType ? columns.right : columns.left;
            
            const { data: existingAssociations } = await supabase
              .from(junctionTable as any)
              .select(targetColumn)
              .eq(entityColumn, entityId);
            
            if (existingAssociations) {
              existingAssociations.forEach((assoc: any) => existingIds.add(assoc[targetColumn]));
            }
          }
        }
        
      // Filter out existing associations
      items = items.filter((item: any) => item && item.id && !existingIds.has(item.id));
      }
      
      return items;
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
      
      let data, error;
      
      // Use security definer functions to bypass auth context issues
      if ((entityType === 'activity_log' && targetType === 'appointment') || 
          (entityType === 'appointment' && targetType === 'activity_log')) {
        const appointmentId = entityType === 'appointment' ? entityId : targetId;
        const activityId = entityType === 'activity_log' ? entityId : targetId;
        
        ({ data, error } = await supabase.rpc('create_appointment_activity_association', {
          p_appointment_id: appointmentId,
          p_activity_log_id: activityId,
          p_user_id: user.id
        }));
        
      } else if ((entityType === 'activity_log' && targetType === 'contact') || 
                 (entityType === 'contact' && targetType === 'activity_log')) {
        const contactId = entityType === 'contact' ? entityId : targetId;
        const activityId = entityType === 'activity_log' ? entityId : targetId;
        
        ({ data, error } = await supabase.rpc('create_contact_activity_association', {
          p_contact_id: contactId,
          p_activity_log_id: activityId,
          p_user_id: user.id
        }));
        
      } else if ((entityType === 'activity_log' && targetType === 'task') || 
                 (entityType === 'task' && targetType === 'activity_log')) {
        const taskId = entityType === 'task' ? entityId : targetId;
        const activityId = entityType === 'activity_log' ? entityId : targetId;
        
        ({ data, error } = await supabase.rpc('create_task_activity_association', {
          p_task_id: taskId,
          p_activity_log_id: activityId,
          p_user_id: user.id
        }));
        
      } else {
        // For other associations, use direct insert (documents still work)
        ({ data, error } = await supabase
          .from(junctionTable as any)
          .insert(insertData)
          .select());
      }
      
      if (error) {
        console.error(`❌ [INSERT ERROR] Association creation failed:`, error);
        console.error(`🔍 [ERROR DETAILS] Code: ${error.code}, Message: ${error.message}`);
        
        // Handle Postgres duplicate key error (23505)
        if (error.code === '23505' || error.message?.includes("duplicate") || error.message?.includes("unique") || error.message?.includes("Already linked")) {
          console.log(`⚠️ [DUPLICATE] Already linked - showing user message`);
          throw new Error("Already linked.");
        }
        
        throw error;
      }
      
      // For RPC calls, data is just the UUID, so format it properly
      if (typeof data === 'string') {
        data = [{ id: data }];
      }
      
      // Verify the association was actually created
      if (!data || (Array.isArray(data) && data.length === 0)) {
        console.error(`❌ [INSERT ERROR] No data returned from insert operation`);
        throw new Error("Failed to create association - no data returned");
      }
      
      console.log(`✅ [SUCCESS] Association created successfully!`, data);
      
      // Trigger reindex for both entities - use ENTITY_TABLE_MAP for consistency
      const entityToTable = (type: EntityType) => {
        return ENTITY_TABLE_MAP[type] || type;
      };
      
      triggerReindex(entityToTable(entityType) as "tasks" | "appointments" | "activity_logs" | "documents" | "contacts", entityId);
      triggerReindex(entityToTable(targetType) as "tasks" | "appointments" | "activity_logs" | "documents" | "contacts", targetId);
      
      return data;
    },
    onSuccess: (data, { entityId, entityType, targetType }) => {
      // Only show success toast if we have valid data
      if (data && data.length > 0) {
        // Invalidate association queries for both entities
        queryClient.invalidateQueries({ queryKey: ["associations", entityType, entityId] });
        queryClient.invalidateQueries({ queryKey: ["associations"] });
        
        toast({
          title: "Success",
          description: "Association created successfully",
        });
      } else {
        toast({
          title: "Error",
          description: "Failed to create association - no data returned",
          variant: "destructive",
        });
      }
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
      
      const { data, error, count } = await supabase
        .from(junctionTable as any)
        .delete()
        .eq(entityColumn, entityId)
        .eq(targetColumn, targetId)
        .select();
      
      if (error) {
        console.error(`❌ [DELETE ERROR] Association removal failed:`, error);
        throw error;
      }
      
      // Verify the association was actually deleted
      if (count === 0) {
        console.error(`❌ [DELETE ERROR] No rows were deleted - association may not have existed`);
        throw new Error("Association not found or already removed");
      }
      
      console.log(`✅ [DELETE SUCCESS] Association removed successfully! Deleted ${count} row(s)`, data);
      
      // Trigger reindex for both entities - use ENTITY_TABLE_MAP for consistency
      const entityToTable = (type: EntityType) => {
        return ENTITY_TABLE_MAP[type] || type;
      };
      
      triggerReindex(entityToTable(entityType) as "tasks" | "appointments" | "activity_logs" | "documents" | "contacts", entityId);
      triggerReindex(entityToTable(targetType) as "tasks" | "appointments" | "activity_logs" | "documents" | "contacts", targetId);
      
      return { data, count };
    },
    onSuccess: (result, { entityId, entityType }) => {
      // Only show success toast if we actually deleted something
      if (result && result.count > 0) {
        // Invalidate association queries for both entities
        queryClient.invalidateQueries({ queryKey: ["associations", entityType, entityId] });
        queryClient.invalidateQueries({ queryKey: ["associations"] });
        
        toast({
          title: "Success", 
          description: "Association removed successfully",
        });
      } else {
        toast({
          title: "Error",
          description: "Association not found or already removed",
          variant: "destructive",
        });
      }
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