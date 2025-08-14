import { useDemo } from '@/hooks/useDemo';
import { useMemo } from 'react';

// Demo data hook for contacts
export const useDemoContacts = (groupId?: string) => {
  const { isDemo, demoData } = useDemo();
  
  const contacts = useMemo(() => {
    if (!isDemo || !groupId || groupId !== demoData.demoGroupId) {
      return null;
    }

    return demoData.contacts.map(contact => ({
      ...contact,
      care_group_id: demoData.demoGroupId,
      created_by_user_id: demoData.familyMembers[0].id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      // Map demo data fields to database fields
      first_name: contact.firstName,
      last_name: contact.lastName,
      contact_type: contact.contactType,
      organization_name: contact.organizationName,
      email_personal: contact.emailPersonal,
      phone_number: contact.phoneNumber,
      is_emergency_contact: contact.isEmergencyContact,
      emergency_type: contact.emergencyType
    }));
  }, [isDemo, groupId, demoData.demoGroupId, demoData.contacts, demoData.familyMembers]);

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
  const { isDemo, demoData } = useDemo();
  
  const appointments = useMemo(() => {
    if (!isDemo || !groupId || groupId !== demoData.demoGroupId) {
      return null;
    }

    const baseDate = new Date('2025-01-15'); // Fixed base date to prevent re-renders
    
    return demoData.appointments.map((appointment, index) => {
      // Generate stable dates based on index
      const appointmentDate = new Date(baseDate);
      appointmentDate.setDate(baseDate.getDate() + index);
      appointmentDate.setHours(10 + index * 2, 0, 0, 0);
      
      return {
        ...appointment,
        group_id: demoData.demoGroupId,
        date_time: appointmentDate.toISOString(),
        duration_minutes: appointment.duration,
        created_by_user_id: appointment.createdByUserId,
        created_by_email: appointment.createdByEmail,
        attending_user_id: appointment.attendingUserId,
        outcome_notes: appointment.outcomeNotes,
        created_at: new Date().toISOString(),
        // Map demo fields to database fields
        description: appointment.description,
        location: appointment.location,
        category: appointment.category
      };
    });
  }, [isDemo, groupId, demoData.demoGroupId, demoData.appointments]);

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
  const { isDemo, demoData } = useDemo();
  
  const tasks = useMemo(() => {
    if (!isDemo || !groupId || groupId !== demoData.demoGroupId) {
      return null;
    }

    const baseDate = new Date('2025-01-15'); // Fixed base date to prevent re-renders
    
    return demoData.tasks.map((task, index) => {
      // Generate stable dates based on index
      const dueDate = new Date(baseDate);
      dueDate.setDate(baseDate.getDate() + index + 1);
      
      return {
        ...task,
        group_id: demoData.demoGroupId,
        due_date: dueDate.toISOString().split('T')[0], // YYYY-MM-DD format
        primary_owner_id: task.primaryOwnerId,
        secondary_owner_id: (task as any).secondaryOwnerId || null,
        created_by_user_id: task.createdByUserId,
        created_by_email: task.createdByEmail,
        completed_by_user_id: (task as any).completedByUserId || null,
        completed_by_email: (task as any).completedByEmail || null,
        completed_at: (task as any).completedAt || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
    });
  }, [isDemo, groupId, demoData.demoGroupId, demoData.tasks]);

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
  const { isDemo, demoData } = useDemo();
  
  const activities = useMemo(() => {
    if (!isDemo || !groupId || groupId !== demoData.demoGroupId) {
      return null;
    }

    const baseDate = new Date('2025-01-12'); // Fixed base date to prevent re-renders
    
    return demoData.activities.map((activity, index) => {
      // Generate stable dates based on index
      const activityDate = new Date(baseDate);
      activityDate.setDate(baseDate.getDate() + index);
      activityDate.setHours(14 + index, 0, 0, 0);
      
      return {
        ...activity,
        group_id: demoData.demoGroupId,
        date_time: activityDate.toISOString(),
        created_by_user_id: activity.createdByUserId,
        created_by_email: activity.createdByEmail,
        linked_appointment_id: (activity as any).linkedAppointments?.[0] || null,
        linked_task_id: (activity as any).linkedTasks?.[0] || null,
        created_at: new Date().toISOString()
      };
    });
  }, [isDemo, groupId, demoData.demoGroupId, demoData.activities]);

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
  const { isDemo, demoData } = useDemo();
  
  const documents = useMemo(() => {
    if (!isDemo || !groupId || groupId !== demoData.demoGroupId) {
      return null;
    }

    return demoData.documents.map(document => ({
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
  }, [isDemo, groupId, demoData.demoGroupId, demoData.documents]);

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
      created_at: new Date().toISOString()
    };
  }, [isDemo, groupId, demoData.demoGroupId, demoData.careRecipient, demoData.familyMembers]);

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
  
  const profiles = useMemo(() => {
    if (!isDemo) {
      return null;
    }

    return demoData.familyMembers.map(member => ({
      user_id: member.id,
      email: member.email,
      first_name: member.firstName,
      last_name: member.lastName,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }));
  }, [isDemo, demoData.familyMembers]);

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