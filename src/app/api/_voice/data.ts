import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { format, addDays, startOfDay, endOfDay } from 'date-fns';

export interface UpcomingAppointment {
  id: string;
  description: string;
  dateTime: string;
  category: string;
  streetAddress?: string;
  city?: string;
  state?: string;
}

export interface PcpContact {
  id: string;
  firstName: string;
  lastName: string;
  phonePrimary?: string;
  phoneSecondary?: string;
  organizationName?: string;
}

export interface OpenTask {
  id: string;
  title: string;
  description?: string;
  dueDate?: string;
  priority: string;
  assignedToName?: string;
}

export interface DocumentSummary {
  id: string;
  title: string;
  summary?: string;
  category?: string;
  uploadDate: string;
}

export interface RecentActivity {
  id: string;
  title?: string;
  type?: string;
  dateTime: string;
  notes?: string;
}

/**
 * Get upcoming appointments for the next 7 days
 */
export async function getUpcomingAppointments(careGroupId: string): Promise<UpcomingAppointment[]> {
  try {
    const startDate = startOfDay(new Date());
    const endDate = endOfDay(addDays(new Date(), 7));

    const { data, error } = await supabaseAdmin
      .from('appointments')
      .select(`
        id,
        description,
        date_time,
        category,
        street_address,
        city,
        state
      `)
      .eq('group_id', careGroupId)
      .eq('is_deleted', false)
      .gte('date_time', startDate.toISOString())
      .lte('date_time', endDate.toISOString())
      .order('date_time', { ascending: true })
      .limit(5);

    if (error) {
      console.error('Error fetching upcoming appointments:', error);
      return [];
    }

    return (data || []).map(appointment => ({
      id: appointment.id,
      description: appointment.description || 'Appointment',
      dateTime: appointment.date_time,
      category: appointment.category || '',
      streetAddress: appointment.street_address || undefined,
      city: appointment.city || undefined,
      state: appointment.state || undefined
    }));
  } catch (error) {
    console.error('Error in getUpcomingAppointments:', error);
    return [];
  }
}

/**
 * Get primary care physician contact information
 */
export async function getPcpContact(careGroupId: string): Promise<PcpContact | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from('contacts')
      .select(`
        id,
        first_name,
        last_name,
        phone_primary,
        phone_secondary,
        organization_name
      `)
      .eq('care_group_id', careGroupId)
      .eq('is_deleted', false)
      .eq('contact_type', 'medical')
      .order('created_at', { ascending: true })
      .limit(1)
      .single();

    if (error || !data) {
      return null;
    }

    return {
      id: data.id,
      firstName: data.first_name || '',
      lastName: data.last_name || '',
      phonePrimary: data.phone_primary || undefined,
      phoneSecondary: data.phone_secondary || undefined,
      organizationName: data.organization_name || undefined
    };
  } catch (error) {
    console.error('Error in getPcpContact:', error);
    return null;
  }
}

/**
 * Get open tasks (not completed)
 */
export async function getOpenTasks(careGroupId: string): Promise<OpenTask[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from('tasks')
      .select(`
        id,
        title,
        description,
        due_date,
        priority,
        primary_owner_id,
        profiles!tasks_primary_owner_id_fkey(first_name, last_name)
      `)
      .eq('group_id', careGroupId)
      .eq('is_deleted', false)
      .neq('status', 'Completed')
      .order('due_date', { ascending: true, nullsFirst: false })
      .limit(10);

    if (error) {
      console.error('Error fetching open tasks:', error);
      return [];
    }

    return (data || []).map(task => ({
      id: task.id,
      title: task.title || 'Untitled Task',
      description: task.description || undefined,
      dueDate: task.due_date || undefined,
      priority: task.priority || 'medium',
      assignedToName: task.profiles ? `${task.profiles.first_name || ''} ${task.profiles.last_name || ''}`.trim() : undefined
    }));
  } catch (error) {
    console.error('Error in getOpenTasks:', error);
    return [];
  }
}

/**
 * Get recent document summaries
 */
export async function getDocumentSummaries(careGroupId: string): Promise<DocumentSummary[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from('documents')
      .select(`
        id,
        title,
        summary,
        category,
        upload_date
      `)
      .eq('group_id', careGroupId)
      .eq('is_deleted', false)
      .not('summary', 'is', null)
      .order('upload_date', { ascending: false })
      .limit(5);

    if (error) {
      console.error('Error fetching document summaries:', error);
      return [];
    }

    return (data || []).map(doc => ({
      id: doc.id,
      title: doc.title || 'Untitled Document',
      summary: doc.summary || undefined,
      category: doc.category || undefined,
      uploadDate: doc.upload_date
    }));
  } catch (error) {
    console.error('Error in getDocumentSummaries:', error);
    return [];
  }
}

/**
 * Get recent activities from the last 7 days
 */
export async function getRecentActivities(careGroupId: string): Promise<RecentActivity[]> {
  try {
    const startDate = startOfDay(addDays(new Date(), -7));

    const { data, error } = await supabaseAdmin
      .from('activity_logs')
      .select(`
        id,
        title,
        type,
        date_time,
        notes
      `)
      .eq('group_id', careGroupId)
      .eq('is_deleted', false)
      .gte('date_time', startDate.toISOString())
      .order('date_time', { ascending: false })
      .limit(5);

    if (error) {
      console.error('Error fetching recent activities:', error);
      return [];
    }

    return (data || []).map(activity => ({
      id: activity.id,
      title: activity.title || undefined,
      type: activity.type || undefined,
      dateTime: activity.date_time,
      notes: activity.notes || undefined
    }));
  } catch (error) {
    console.error('Error in getRecentActivities:', error);
    return [];
  }
}