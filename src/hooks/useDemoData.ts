import { useDemo } from '@/hooks/useDemo';

// Demo data hook for contacts
export const useDemoContacts = (groupId?: string) => {
  const { isDemo, demoData } = useDemo();
  
  if (!isDemo || !groupId || groupId !== demoData.demoGroupId) {
    return { data: null, isDemo: false };
  }

  const contacts = demoData.contacts.map(contact => ({
    ...contact,
    care_group_id: demoData.demoGroupId,
    created_by_user_id: demoData.familyMembers[0].id,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }));

  return {
    data: contacts,
    isDemo: true,
    isLoading: false,
    error: null
  };
};

// Demo data hook for appointments
export const useDemoAppointments = (groupId?: string) => {
  const { isDemo, demoData } = useDemo();
  
  if (!isDemo || !groupId || groupId !== demoData.demoGroupId) {
    return { data: null, isDemo: false };
  }

  const appointments = demoData.appointments.map(appointment => ({
    ...appointment,
    group_id: demoData.demoGroupId,
    date_time: appointment.dateTime,
    duration_minutes: appointment.duration,
    created_by_user_id: appointment.createdByUserId,
    created_by_email: appointment.createdByEmail,
    attending_user_id: appointment.attendingUserId,
    outcome_notes: appointment.outcomeNotes,
    created_at: new Date().toISOString()
  }));

  return {
    data: appointments,
    isDemo: true,
    isLoading: false,
    error: null
  };
};

// Demo data hook for tasks
export const useDemoTasks = (groupId?: string) => {
  const { isDemo, demoData } = useDemo();
  
  if (!isDemo || !groupId || groupId !== demoData.demoGroupId) {
    return { data: null, isDemo: false };
  }

  const tasks = demoData.tasks.map(task => ({
    ...task,
    group_id: demoData.demoGroupId,
    due_date: task.dueDate,
    primary_owner_id: task.primaryOwnerId,
    secondary_owner_id: (task as any).secondaryOwnerId || null,
    created_by_user_id: task.createdByUserId,
    created_by_email: task.createdByEmail,
    completed_by_user_id: (task as any).completedByUserId || null,
    completed_by_email: (task as any).completedByEmail || null,
    completed_at: (task as any).completedAt || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }));

  return {
    data: tasks,
    isDemo: true,
    isLoading: false,
    error: null
  };
};

// Demo data hook for activities
export const useDemoActivities = (groupId?: string) => {
  const { isDemo, demoData } = useDemo();
  
  if (!isDemo || !groupId || groupId !== demoData.demoGroupId) {
    return { data: null, isDemo: false };
  }

  const activities = demoData.activities.map(activity => ({
    ...activity,
    group_id: demoData.demoGroupId,
    date_time: activity.dateTime,
    created_by_user_id: activity.createdByUserId,
    created_by_email: activity.createdByEmail,
    linked_appointment_id: (activity as any).linkedAppointments?.[0] || null,
    linked_task_id: (activity as any).linkedTasks?.[0] || null,
    created_at: new Date().toISOString()
  }));

  return {
    data: activities,
    isDemo: true,
    isLoading: false,
    error: null
  };
};

// Demo data hook for documents
export const useDemoDocuments = (groupId?: string) => {
  const { isDemo, demoData } = useDemo();
  
  if (!isDemo || !groupId || groupId !== demoData.demoGroupId) {
    return { data: null, isDemo: false };
  }

  const documents = demoData.documents.map(document => ({
    ...document,
    group_id: demoData.demoGroupId,
    uploaded_by_user_id: document.uploadedByUserId,
    original_filename: document.originalFilename,
    file_type: document.fileType,
    file_size: document.fileSize,
    full_text: document.fullText,
    processing_status: document.processingStatus,
    upload_date: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    file_url: `/demo/documents/${document.id}.pdf` // Demo file URL
  }));

  return {
    data: documents,
    isDemo: true,
    isLoading: false,
    error: null
  };
};

// Demo data hook for care group
export const useDemoCareGroup = (groupId?: string) => {
  const { isDemo, demoData } = useDemo();
  
  if (!isDemo || !groupId || groupId !== demoData.demoGroupId) {
    return { data: null, isDemo: false };
  }

  const careGroup = {
    id: demoData.demoGroupId,
    name: demoData.careRecipient.name,
    recipient_first_name: demoData.careRecipient.name.split(' ')[0],
    recipient_last_name: demoData.careRecipient.name.split(' ')[2], // "Bob" "Williams"
    date_of_birth: demoData.careRecipient.dateOfBirth,
    recipient_address: demoData.careRecipient.address,
    recipient_phone: demoData.careRecipient.phone,
    living_situation: demoData.careRecipient.livingsituation,
    mobility: demoData.careRecipient.mobility,
    memory: demoData.careRecipient.memory,
    hearing: demoData.careRecipient.hearing,
    vision: demoData.careRecipient.vision,
    mental_health: demoData.careRecipient.mentalHealth,
    chronic_conditions: demoData.careRecipient.conditions.join(', '),
    other_important_information: demoData.careRecipient.otherInfo,
    created_by_user_id: demoData.familyMembers[0].id,
    created_at: new Date().toISOString()
  };

  return {
    data: careGroup,
    isDemo: true,
    isLoading: false,
    error: null
  };
};

// Demo data hook for profiles
export const useDemoProfiles = () => {
  const { isDemo, demoData } = useDemo();
  
  if (!isDemo) {
    return { data: null, isDemo: false };
  }

  const profiles = demoData.familyMembers.map(member => ({
    user_id: member.id,
    email: member.email,
    first_name: member.firstName,
    last_name: member.lastName,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }));

  return {
    data: profiles,
    isDemo: true,
    isLoading: false,
    error: null
  };
};