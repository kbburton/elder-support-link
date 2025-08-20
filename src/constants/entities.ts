export const ENTITY = {
  task: 'task',
  document: 'document',
  activity_log: 'activity_log',
  appointment: 'appointment',
  contact: 'contact',
} as const;

export type EntityType = typeof ENTITY[keyof typeof ENTITY];

// Map entity types to their actual database table names
export const ENTITY_TABLE_MAP = {
  [ENTITY.task]: 'tasks',
  [ENTITY.document]: 'documents', 
  [ENTITY.activity_log]: 'activity_logs',
  [ENTITY.appointment]: 'appointments',
  [ENTITY.contact]: 'contacts',
} as const;

// Map entity types to their group column names
export const ENTITY_GROUP_COLUMN_MAP = {
  [ENTITY.task]: 'group_id',
  [ENTITY.document]: 'group_id',
  [ENTITY.activity_log]: 'group_id', 
  [ENTITY.appointment]: 'group_id',
  [ENTITY.contact]: 'care_group_id',
} as const;