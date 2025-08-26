import { useDemo } from '@/hooks/useDemo';
import { useMemo } from 'react';

// Utility function to generate consistent random dates based on session ID
const generateSeededRandom = (sessionId: string, itemId: string) => {
  // Simple hash function for consistent seeding
  let hash = 0;
  const seedString = `${sessionId}-${itemId}`;
  for (let i = 0; i < seedString.length; i++) {
    const char = seedString.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  // Convert to 0-1 range
  return Math.abs(hash) / Math.pow(2, 31);
};

const generateRelativeDate = (sessionId: string, itemId: string, minDays: number, maxDays: number, preserveTime?: string) => {
  const random = generateSeededRandom(sessionId, itemId);
  const dayOffset = Math.floor(random * (maxDays - minDays + 1)) + minDays;
  
  const today = new Date();
  const targetDate = new Date(today);
  targetDate.setDate(today.getDate() + dayOffset);
  
  if (preserveTime) {
    const [hours, minutes] = preserveTime.split(':').map(Number);
    targetDate.setHours(hours, minutes, 0, 0);
  }
  
  return targetDate;
};

const generateCreatedAtDate = (sessionId: string, itemId: string, eventDate?: Date) => {
  const random = generateSeededRandom(sessionId, `created-${itemId}`);
  // Created date should be 1-30 days before the event date (or today if no event date)
  const referenceDate = eventDate || new Date();
  const daysBack = Math.floor(random * 30) + 1;
  
  const createdDate = new Date(referenceDate);
  createdDate.setDate(referenceDate.getDate() - daysBack);
  createdDate.setHours(9, 0, 0, 0); // Standard creation time
  
  return createdDate;
};

// Demo data hook for contacts
export const useDemoContacts = (groupId?: string) => {
  const { isDemo, demoData, demoSession } = useDemo();
  
  const contacts = useMemo(() => {
    if (!isDemo || !groupId || groupId !== demoData.demoGroupId || !demoSession?.sessionId) {
      return null;
    }

    return demoData.contacts.map(contact => {
      // Contacts: Only past dates (-30 to -1 days)
      const createdDate = generateCreatedAtDate(demoSession.sessionId, contact.id);
      
      return {
        ...contact,
        care_group_id: demoData.demoGroupId,
        created_by_user_id: demoData.familyMembers[0].id,
        created_at: createdDate.toISOString(),
        updated_at: createdDate.toISOString(),
        // Map demo data fields to database fields
        first_name: contact.firstName,
        last_name: contact.lastName,
        contact_type: contact.contactType,
        organization_name: contact.organizationName,
        email_personal: contact.emailPersonal,
        phone_number: contact.phoneNumber,
        is_emergency_contact: contact.isEmergencyContact,
        emergency_type: contact.emergencyType
      };
    });
  }, [isDemo, groupId, demoData.demoGroupId, demoData.contacts, demoData.familyMembers, demoSession?.sessionId]);

  if (!isDemo || !groupId || groupId !== demoData.demoGroupId) {
    return { data: null, isDemo: false };
  }

  return {
    data: contacts,
    isDemo: true,
    isLoading: false,
    error: null
  };
};

// Demo data hook for appointments
export const useDemoAppointments = (groupId?: string) => {
  const { isDemo, demoData, demoSession } = useDemo();
  
  const appointments = useMemo(() => {
    if (!isDemo || !groupId || groupId !== demoData.demoGroupId || !demoSession?.sessionId) {
      return null;
    }
    
    return demoData.appointments.map((appointment, index) => {
      // Appointments: Mixed timeline (-30 to +30 days)
      const originalTime = appointment.dateTime?.split('T')[1]?.substring(0, 5) || '10:00';
      const appointmentDate = generateRelativeDate(demoSession.sessionId, appointment.id, -30, 30, originalTime);
      const createdDate = generateCreatedAtDate(demoSession.sessionId, appointment.id, appointmentDate);
      
      // Determine if appointment is in the past
      const isPast = appointmentDate < new Date();
      
      // For past appointments, some can have missing outcome_notes (30% chance)
      const shouldHaveNotes = isPast && generateSeededRandom(demoSession.sessionId, `notes-${appointment.id}`) > 0.3;
      
      return {
        ...appointment,
        group_id: demoData.demoGroupId,
        date_time: appointmentDate.toISOString(),
        duration_minutes: appointment.duration,
        created_by_user_id: appointment.createdByUserId,
        created_by_email: appointment.createdByEmail,
        attending_user_id: appointment.attendingUserId,
        outcome_notes: shouldHaveNotes ? appointment.outcomeNotes : null,
        created_at: createdDate.toISOString(),
        // Map demo fields to database fields
        description: appointment.description,
        location: appointment.location,
        category: appointment.category
      };
    });
  }, [isDemo, groupId, demoData.demoGroupId, demoData.appointments, demoSession?.sessionId]);

  if (!isDemo || !groupId || groupId !== demoData.demoGroupId) {
    return { data: null, isDemo: false };
  }

  return {
    data: appointments,
    isDemo: true,
    isLoading: false,
    error: null
  };
};

// Demo data hook for tasks
export const useDemoTasks = (groupId?: string) => {
  const { isDemo, demoData, demoSession } = useDemo();
  
  const tasks = useMemo(() => {
    if (!isDemo || !groupId || groupId !== demoData.demoGroupId || !demoSession?.sessionId) {
      return null;
    }
    
    return demoData.tasks.map((task, index) => {
      // Tasks: Mixed timeline (-30 to +30 days)
      const dueDate = generateRelativeDate(demoSession.sessionId, task.id, -30, 30);
      const createdDate = generateCreatedAtDate(demoSession.sessionId, task.id, dueDate);
      
      // Check if task is overdue and should remain open
      const isOverdue = dueDate < new Date();
      const finalStatus = isOverdue && task.status === 'open' ? 'open' : task.status;
      
      return {
        ...task,
        status: finalStatus,
        group_id: demoData.demoGroupId,
        due_date: dueDate.toISOString().split('T')[0], // YYYY-MM-DD format
        primary_owner_id: task.primaryOwnerId,
        secondary_owner_id: (task as any).secondaryOwnerId || null,
        created_by_user_id: task.createdByUserId,
        created_by_email: task.createdByEmail,
        completed_by_user_id: (task as any).completedByUserId || null,
        completed_by_email: (task as any).completedByEmail || null,
        completed_at: (task as any).completedAt || null,
        created_at: createdDate.toISOString(),
        updated_at: createdDate.toISOString(),
        // Add proper primary and secondary owner data for calendar display
        primary_owner: { 
          first_name: demoData.familyMembers.find(m => m.id === task.primaryOwnerId)?.firstName || "Unknown",
          last_name: demoData.familyMembers.find(m => m.id === task.primaryOwnerId)?.lastName || "User"
        },
        secondary_owner: null,
        task_recurrence_rules: (task as any).isRecurring ? [{ id: `rule_${task.id}`, pattern_type: (task as any).recurrencePattern }] : []
      };
    });
  }, [isDemo, groupId, demoData.demoGroupId, demoData.tasks, demoSession?.sessionId]);

  if (!isDemo || !groupId || groupId !== demoData.demoGroupId) {
    return { data: null, isDemo: false };
  }

  return {
    data: tasks,
    isDemo: true,
    isLoading: false,
    error: null
  };
};

// Demo data hook for activities
export const useDemoActivities = (groupId?: string) => {
  const { isDemo, demoData, demoSession } = useDemo();
  
  const activities = useMemo(() => {
    if (!isDemo || !groupId || groupId !== demoData.demoGroupId || !demoSession?.sessionId) {
      return null;
    }
    
    return demoData.activities.map((activity, index) => {
      // Activities: Only past dates (-30 to -1 days)
      const originalTime = activity.dateTime?.split('T')[1]?.substring(0, 5) || '14:00';
      const activityDate = generateRelativeDate(demoSession.sessionId, activity.id, -30, -1, originalTime);
      const createdDate = generateCreatedAtDate(demoSession.sessionId, activity.id, activityDate);
      
      return {
        ...activity,
        group_id: demoData.demoGroupId,
        date_time: activityDate.toISOString(),
        created_by_user_id: activity.createdByUserId,
        created_by_email: activity.createdByEmail,
        created_at: createdDate.toISOString()
      };
    });
  }, [isDemo, groupId, demoData.demoGroupId, demoData.activities, demoSession?.sessionId]);

  if (!isDemo || !groupId || groupId !== demoData.demoGroupId) {
    return { data: null, isDemo: false };
  }

  return {
    data: activities,
    isDemo: true,
    isLoading: false,
    error: null
  };
};

// Demo data hook for documents
export const useDemoDocuments = (groupId?: string) => {
  const { isDemo, demoData, demoSession } = useDemo();
  
  const documents = useMemo(() => {
    if (!isDemo || !groupId || groupId !== demoData.demoGroupId || !demoSession?.sessionId) {
      return null;
    }

    return demoData.documents.map(document => {
      // Documents: Only past dates (-30 to -1 days)
      const uploadDate = generateRelativeDate(demoSession.sessionId, document.id, -30, -1);
      const createdDate = generateCreatedAtDate(demoSession.sessionId, document.id, uploadDate);
      
      return {
        ...document,
        group_id: demoData.demoGroupId,
        uploaded_by_user_id: document.uploadedByUserId,
        original_filename: document.originalFilename,
        file_type: document.fileType,
        file_size: document.fileSize,
        full_text: document.fullText,
        processing_status: document.processingStatus,
        upload_date: uploadDate.toISOString(),
        created_at: createdDate.toISOString(),
        updated_at: createdDate.toISOString(),
        file_url: `/demo/documents/${document.id}.pdf` // Demo file URL
      };
    });
  }, [isDemo, groupId, demoData.demoGroupId, demoData.documents, demoSession?.sessionId]);

  if (!isDemo || !groupId || groupId !== demoData.demoGroupId) {
    return { data: null, isDemo: false };
  }

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
  
  // Use stable base date for demo care group
  const stableTimestamp = useMemo(() => new Date('2024-01-01T00:00:00Z').toISOString(), []);
  
  const careGroup = useMemo(() => {
    if (!isDemo || !groupId || groupId !== demoData.demoGroupId) {
      return null;
    }

    return {
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
      created_at: stableTimestamp
    };
  }, [isDemo, groupId, demoData.demoGroupId, demoData.careRecipient, demoData.familyMembers, stableTimestamp]);

  if (!isDemo || !groupId || groupId !== demoData.demoGroupId) {
    return { data: null, isDemo: false };
  }

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
  
  // Use stable base date for demo profiles
  const stableBaseDate = useMemo(() => new Date('2024-01-01T00:00:00Z').toISOString(), []);
  
  const profiles = useMemo(() => {
    if (!isDemo) {
      return null;
    }

    return demoData.familyMembers.map(member => ({
      user_id: member.id,
      email: member.email,
      first_name: member.firstName,
      last_name: member.lastName,
      created_at: stableBaseDate,
      updated_at: stableBaseDate
    }));
  }, [isDemo, demoData, stableBaseDate]);

  if (!isDemo) {
    return { data: null, isDemo: false };
  }

  return {
    data: profiles,
    isDemo: true,
    isLoading: false,
    error: null
  };
};