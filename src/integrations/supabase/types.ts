export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      activity_log_comments: {
        Row: {
          activity_log_id: string
          comment_text: string
          created_at: string
          created_by_email: string | null
          created_by_user_id: string
          id: string
          updated_at: string
        }
        Insert: {
          activity_log_id: string
          comment_text: string
          created_at?: string
          created_by_email?: string | null
          created_by_user_id: string
          id?: string
          updated_at?: string
        }
        Update: {
          activity_log_id?: string
          comment_text?: string
          created_at?: string
          created_by_email?: string | null
          created_by_user_id?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      activity_logs: {
        Row: {
          attachment_url: string | null
          created_at: string
          created_by_email: string | null
          created_by_user_id: string | null
          date_time: string
          group_id: string | null
          id: string
          linked_appointment_id: string | null
          linked_task_id: string | null
          notes: string | null
          title: string | null
          type: string | null
        }
        Insert: {
          attachment_url?: string | null
          created_at?: string
          created_by_email?: string | null
          created_by_user_id?: string | null
          date_time: string
          group_id?: string | null
          id?: string
          linked_appointment_id?: string | null
          linked_task_id?: string | null
          notes?: string | null
          title?: string | null
          type?: string | null
        }
        Update: {
          attachment_url?: string | null
          created_at?: string
          created_by_email?: string | null
          created_by_user_id?: string | null
          date_time?: string
          group_id?: string | null
          id?: string
          linked_appointment_id?: string | null
          linked_task_id?: string | null
          notes?: string | null
          title?: string | null
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_logs_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "care_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_logs_linked_appointment_id_fkey"
            columns: ["linked_appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_logs_linked_task_id_fkey"
            columns: ["linked_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_activity_logs_group_id"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "care_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_activity_logs_linked_appointment_id"
            columns: ["linked_appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_activity_logs_linked_task_id"
            columns: ["linked_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_audit_logs: {
        Row: {
          action: string
          admin_email: string
          admin_user_id: string
          created_at: string
          details: Json | null
          id: string
          ip_address: unknown | null
          target_id: string | null
          target_type: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          admin_email: string
          admin_user_id: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: unknown | null
          target_id?: string | null
          target_type?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          admin_email?: string
          admin_user_id?: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: unknown | null
          target_id?: string | null
          target_type?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      admin_roles: {
        Row: {
          created_at: string
          created_by_user_id: string | null
          id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by_user_id?: string | null
          id?: string
          role: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by_user_id?: string | null
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          created_at: string
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          created_at?: string
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          created_at?: string
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      appointment_documents: {
        Row: {
          appointment_id: string
          created_at: string
          created_by_user_id: string | null
          document_id: string
          id: string
        }
        Insert: {
          appointment_id: string
          created_at?: string
          created_by_user_id?: string | null
          document_id: string
          id?: string
        }
        Update: {
          appointment_id?: string
          created_at?: string
          created_by_user_id?: string | null
          document_id?: string
          id?: string
        }
        Relationships: []
      }
      appointment_notification_recipients: {
        Row: {
          appointment_id: string
          created_at: string
          days_before: number
          id: string
          user_id: string
        }
        Insert: {
          appointment_id: string
          created_at?: string
          days_before: number
          id?: string
          user_id: string
        }
        Update: {
          appointment_id?: string
          created_at?: string
          days_before?: number
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      appointments: {
        Row: {
          attending_user_id: string | null
          category: string | null
          created_at: string
          created_by_email: string | null
          created_by_user_id: string | null
          date_time: string
          description: string | null
          duration_minutes: number | null
          group_id: string | null
          id: string
          location: string | null
          outcome_notes: string | null
          reminder_days_before: number | null
        }
        Insert: {
          attending_user_id?: string | null
          category?: string | null
          created_at?: string
          created_by_email?: string | null
          created_by_user_id?: string | null
          date_time: string
          description?: string | null
          duration_minutes?: number | null
          group_id?: string | null
          id?: string
          location?: string | null
          outcome_notes?: string | null
          reminder_days_before?: number | null
        }
        Update: {
          attending_user_id?: string | null
          category?: string | null
          created_at?: string
          created_by_email?: string | null
          created_by_user_id?: string | null
          date_time?: string
          description?: string | null
          duration_minutes?: number | null
          group_id?: string | null
          id?: string
          location?: string | null
          outcome_notes?: string | null
          reminder_days_before?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "appointments_attending_user_id_fkey"
            columns: ["attending_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "care_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      care_group_invitations: {
        Row: {
          accepted_at: string | null
          accepted_by_user_id: string | null
          created_at: string
          expires_at: string
          group_id: string
          id: string
          invited_by_user_id: string
          invited_email: string
          message: string
          status: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by_user_id?: string | null
          created_at?: string
          expires_at?: string
          group_id: string
          id?: string
          invited_by_user_id: string
          invited_email: string
          message: string
          status?: string
          token?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by_user_id?: string | null
          created_at?: string
          expires_at?: string
          group_id?: string
          id?: string
          invited_by_user_id?: string
          invited_email?: string
          message?: string
          status?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_invitations_group_id"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "care_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      care_group_members: {
        Row: {
          created_at: string
          group_id: string | null
          id: string
          is_admin: boolean
          relationship_to_recipient: string | null
          role: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          group_id?: string | null
          id?: string
          is_admin?: boolean
          relationship_to_recipient?: string | null
          role?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          group_id?: string | null
          id?: string
          is_admin?: boolean
          relationship_to_recipient?: string | null
          role?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "care_group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "care_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      care_groups: {
        Row: {
          chronic_conditions: string | null
          created_at: string
          created_by_user_id: string | null
          date_of_birth: string | null
          hearing: string | null
          id: string
          living_situation: string | null
          memory: string | null
          mental_health: string | null
          mobility: string | null
          name: string
          other_important_information: string | null
          profile_description: string | null
          recipient_address: string | null
          recipient_city: string | null
          recipient_email: string | null
          recipient_first_name: string | null
          recipient_last_name: string | null
          recipient_phone: string | null
          recipient_state: string | null
          recipient_zip: string | null
          special_dates: Json | null
          vision: string | null
        }
        Insert: {
          chronic_conditions?: string | null
          created_at?: string
          created_by_user_id?: string | null
          date_of_birth?: string | null
          hearing?: string | null
          id?: string
          living_situation?: string | null
          memory?: string | null
          mental_health?: string | null
          mobility?: string | null
          name: string
          other_important_information?: string | null
          profile_description?: string | null
          recipient_address?: string | null
          recipient_city?: string | null
          recipient_email?: string | null
          recipient_first_name?: string | null
          recipient_last_name?: string | null
          recipient_phone?: string | null
          recipient_state?: string | null
          recipient_zip?: string | null
          special_dates?: Json | null
          vision?: string | null
        }
        Update: {
          chronic_conditions?: string | null
          created_at?: string
          created_by_user_id?: string | null
          date_of_birth?: string | null
          hearing?: string | null
          id?: string
          living_situation?: string | null
          memory?: string | null
          mental_health?: string | null
          mobility?: string | null
          name?: string
          other_important_information?: string | null
          profile_description?: string | null
          recipient_address?: string | null
          recipient_city?: string | null
          recipient_email?: string | null
          recipient_first_name?: string | null
          recipient_last_name?: string | null
          recipient_phone?: string | null
          recipient_state?: string | null
          recipient_zip?: string | null
          special_dates?: Json | null
          vision?: string | null
        }
        Relationships: []
      }
      contact_activities: {
        Row: {
          activity_log_id: string
          contact_id: string
          created_at: string | null
          id: string
        }
        Insert: {
          activity_log_id: string
          contact_id: string
          created_at?: string | null
          id?: string
        }
        Update: {
          activity_log_id?: string
          contact_id?: string
          created_at?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_activities_activity_log_id_fkey"
            columns: ["activity_log_id"]
            isOneToOne: false
            referencedRelation: "activity_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_activities_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_appointments: {
        Row: {
          appointment_id: string
          contact_id: string
          created_at: string | null
          id: string
        }
        Insert: {
          appointment_id: string
          contact_id: string
          created_at?: string | null
          id?: string
        }
        Update: {
          appointment_id?: string
          contact_id?: string
          created_at?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_appointments_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_appointments_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_documents: {
        Row: {
          contact_id: string
          created_at: string | null
          document_id: string
          id: string
        }
        Insert: {
          contact_id: string
          created_at?: string | null
          document_id: string
          id?: string
        }
        Update: {
          contact_id?: string
          created_at?: string | null
          document_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_documents_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_documents_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_tasks: {
        Row: {
          contact_id: string
          created_at: string | null
          id: string
          task_id: string
        }
        Insert: {
          contact_id: string
          created_at?: string | null
          id?: string
          task_id: string
        }
        Update: {
          contact_id?: string
          created_at?: string | null
          id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_tasks_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_tasks_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          care_group_id: string
          city: string | null
          contact_type: Database["public"]["Enums"]["contact_type_enum"]
          created_at: string | null
          created_by_user_id: string
          email_personal: string | null
          email_work: string | null
          emergency_notes: string | null
          emergency_type:
            | Database["public"]["Enums"]["emergency_type_enum"]
            | null
          first_name: string | null
          gender: Database["public"]["Enums"]["gender_enum"] | null
          id: string
          is_emergency_contact: boolean | null
          last_name: string | null
          notes: string | null
          organization_name: string | null
          phone_primary: string | null
          phone_secondary: string | null
          photo_url: string | null
          postal_code: string | null
          preferred_contact_end_local: string | null
          preferred_contact_end_weekend_local: string | null
          preferred_contact_method: string | null
          preferred_contact_start_local: string | null
          preferred_contact_start_weekend_local: string | null
          preferred_contact_timezone: string | null
          state: string | null
          updated_at: string | null
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          care_group_id: string
          city?: string | null
          contact_type: Database["public"]["Enums"]["contact_type_enum"]
          created_at?: string | null
          created_by_user_id: string
          email_personal?: string | null
          email_work?: string | null
          emergency_notes?: string | null
          emergency_type?:
            | Database["public"]["Enums"]["emergency_type_enum"]
            | null
          first_name?: string | null
          gender?: Database["public"]["Enums"]["gender_enum"] | null
          id?: string
          is_emergency_contact?: boolean | null
          last_name?: string | null
          notes?: string | null
          organization_name?: string | null
          phone_primary?: string | null
          phone_secondary?: string | null
          photo_url?: string | null
          postal_code?: string | null
          preferred_contact_end_local?: string | null
          preferred_contact_end_weekend_local?: string | null
          preferred_contact_method?: string | null
          preferred_contact_start_local?: string | null
          preferred_contact_start_weekend_local?: string | null
          preferred_contact_timezone?: string | null
          state?: string | null
          updated_at?: string | null
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          care_group_id?: string
          city?: string | null
          contact_type?: Database["public"]["Enums"]["contact_type_enum"]
          created_at?: string | null
          created_by_user_id?: string
          email_personal?: string | null
          email_work?: string | null
          emergency_notes?: string | null
          emergency_type?:
            | Database["public"]["Enums"]["emergency_type_enum"]
            | null
          first_name?: string | null
          gender?: Database["public"]["Enums"]["gender_enum"] | null
          id?: string
          is_emergency_contact?: boolean | null
          last_name?: string | null
          notes?: string | null
          organization_name?: string | null
          phone_primary?: string | null
          phone_secondary?: string | null
          photo_url?: string | null
          postal_code?: string | null
          preferred_contact_end_local?: string | null
          preferred_contact_end_weekend_local?: string | null
          preferred_contact_method?: string | null
          preferred_contact_start_local?: string | null
          preferred_contact_start_weekend_local?: string | null
          preferred_contact_timezone?: string | null
          state?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_care_group_id_fkey"
            columns: ["care_group_id"]
            isOneToOne: false
            referencedRelation: "care_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      demo_analytics: {
        Row: {
          created_at: string
          entered_at: string
          id: string
          left_at: string | null
          page_path: string
          session_id: string
          time_spent_seconds: number | null
        }
        Insert: {
          created_at?: string
          entered_at?: string
          id?: string
          left_at?: string | null
          page_path: string
          session_id: string
          time_spent_seconds?: number | null
        }
        Update: {
          created_at?: string
          entered_at?: string
          id?: string
          left_at?: string | null
          page_path?: string
          session_id?: string
          time_spent_seconds?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "demo_analytics_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "demo_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      demo_sessions: {
        Row: {
          created_at: string
          email: string
          id: string
          last_accessed: string
          session_count: number
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          last_accessed?: string
          session_count?: number
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          last_accessed?: string
          session_count?: number
        }
        Relationships: []
      }
      document_access_logs: {
        Row: {
          action: string
          created_at: string
          document_id: string
          group_id: string
          id: string
          ip_address: unknown | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          document_id: string
          group_id: string
          id?: string
          ip_address?: unknown | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          document_id?: string
          group_id?: string
          id?: string
          ip_address?: unknown | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      document_links: {
        Row: {
          created_at: string
          document_id: string
          id: string
          linked_item_id: string
          linked_item_type: string
        }
        Insert: {
          created_at?: string
          document_id: string
          id?: string
          linked_item_id: string
          linked_item_type: string
        }
        Update: {
          created_at?: string
          document_id?: string
          id?: string
          linked_item_id?: string
          linked_item_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_links_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          category: string | null
          created_at: string
          file_size: number | null
          file_type: string | null
          file_url: string | null
          full_text: string | null
          group_id: string | null
          id: string
          notes: string | null
          original_filename: string | null
          processing_status: string | null
          summary: string | null
          title: string | null
          updated_at: string | null
          upload_date: string
          uploaded_by_user_id: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string | null
          full_text?: string | null
          group_id?: string | null
          id?: string
          notes?: string | null
          original_filename?: string | null
          processing_status?: string | null
          summary?: string | null
          title?: string | null
          updated_at?: string | null
          upload_date?: string
          uploaded_by_user_id?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string | null
          full_text?: string | null
          group_id?: string | null
          id?: string
          notes?: string | null
          original_filename?: string | null
          processing_status?: string | null
          summary?: string | null
          title?: string | null
          updated_at?: string | null
          upload_date?: string
          uploaded_by_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "care_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      enhanced_audit_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          group_id: string
          id: string
          ip_address: unknown | null
          resource_id: string
          resource_type: string
          user_agent: string | null
          user_email: string
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          group_id: string
          id?: string
          ip_address?: unknown | null
          resource_id: string
          resource_type: string
          user_agent?: string | null
          user_email: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          group_id?: string
          id?: string
          ip_address?: unknown | null
          resource_id?: string
          resource_type?: string
          user_agent?: string | null
          user_email?: string
          user_id?: string
        }
        Relationships: []
      }
      feedback_comments: {
        Row: {
          body: string
          created_at: string
          created_by_email: string
          created_by_user_id: string
          feedback_id: string
          id: string
        }
        Insert: {
          body: string
          created_at?: string
          created_by_email: string
          created_by_user_id: string
          feedback_id: string
          id?: string
        }
        Update: {
          body?: string
          created_at?: string
          created_by_email?: string
          created_by_user_id?: string
          feedback_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feedback_comments_feedback_id_fkey"
            columns: ["feedback_id"]
            isOneToOne: false
            referencedRelation: "feedback_items"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback_items: {
        Row: {
          actual_result: string | null
          assigned_to_user_id: string | null
          attachments: Json | null
          care_group_id: string | null
          created_at: string
          created_by_email: string
          created_by_user_id: string
          description: string
          expected_result: string | null
          id: string
          severity: Database["public"]["Enums"]["feedback_severity_enum"]
          status: Database["public"]["Enums"]["feedback_status_enum"]
          steps_to_reproduce: string | null
          title: string
          type: Database["public"]["Enums"]["feedback_type_enum"]
          updated_at: string
          votes: number
        }
        Insert: {
          actual_result?: string | null
          assigned_to_user_id?: string | null
          attachments?: Json | null
          care_group_id?: string | null
          created_at?: string
          created_by_email: string
          created_by_user_id: string
          description: string
          expected_result?: string | null
          id?: string
          severity?: Database["public"]["Enums"]["feedback_severity_enum"]
          status?: Database["public"]["Enums"]["feedback_status_enum"]
          steps_to_reproduce?: string | null
          title: string
          type: Database["public"]["Enums"]["feedback_type_enum"]
          updated_at?: string
          votes?: number
        }
        Update: {
          actual_result?: string | null
          assigned_to_user_id?: string | null
          attachments?: Json | null
          care_group_id?: string | null
          created_at?: string
          created_by_email?: string
          created_by_user_id?: string
          description?: string
          expected_result?: string | null
          id?: string
          severity?: Database["public"]["Enums"]["feedback_severity_enum"]
          status?: Database["public"]["Enums"]["feedback_status_enum"]
          steps_to_reproduce?: string | null
          title?: string
          type?: Database["public"]["Enums"]["feedback_type_enum"]
          updated_at?: string
          votes?: number
        }
        Relationships: [
          {
            foreignKeyName: "feedback_items_care_group_id_fkey"
            columns: ["care_group_id"]
            isOneToOne: false
            referencedRelation: "care_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      group_access_logs: {
        Row: {
          created_at: string
          first_accessed_at: string
          group_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          first_accessed_at?: string
          group_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          first_accessed_at?: string
          group_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_access_logs_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "care_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          created_at: string
          group_id: string
          id: string
          notify_on_new_activity_log: boolean
          notify_on_new_appointment: boolean
          notify_on_new_document: boolean
          notify_on_new_task: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          notify_on_new_activity_log?: boolean
          notify_on_new_appointment?: boolean
          notify_on_new_document?: boolean
          notify_on_new_task?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          notify_on_new_activity_log?: boolean
          notify_on_new_appointment?: boolean
          notify_on_new_document?: boolean
          notify_on_new_task?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      platform_admins: {
        Row: {
          user_id: string
        }
        Insert: {
          user_id: string
        }
        Update: {
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          address: string | null
          created_at: string
          email: string | null
          first_name: string | null
          last_active_group_id: string | null
          last_name: string | null
          phone: string | null
          state: string | null
          updated_at: string
          user_id: string
          zip: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string
          email?: string | null
          first_name?: string | null
          last_active_group_id?: string | null
          last_name?: string | null
          phone?: string | null
          state?: string | null
          updated_at?: string
          user_id: string
          zip?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string
          email?: string | null
          first_name?: string | null
          last_active_group_id?: string | null
          last_name?: string | null
          phone?: string | null
          state?: string | null
          updated_at?: string
          user_id?: string
          zip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_last_active_group_id_fkey"
            columns: ["last_active_group_id"]
            isOneToOne: false
            referencedRelation: "care_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      search_index: {
        Row: {
          care_group_id: string
          created_at: string | null
          entity_id: string
          entity_type: string
          fts: unknown | null
          id: string
          snippet: string | null
          title: string
          updated_at: string | null
          url_path: string
        }
        Insert: {
          care_group_id: string
          created_at?: string | null
          entity_id: string
          entity_type: string
          fts?: unknown | null
          id?: string
          snippet?: string | null
          title: string
          updated_at?: string | null
          url_path: string
        }
        Update: {
          care_group_id?: string
          created_at?: string | null
          entity_id?: string
          entity_type?: string
          fts?: unknown | null
          id?: string
          snippet?: string | null
          title?: string
          updated_at?: string | null
          url_path?: string
        }
        Relationships: []
      }
      task_documents: {
        Row: {
          created_at: string
          created_by_user_id: string | null
          document_id: string
          id: string
          task_id: string
        }
        Insert: {
          created_at?: string
          created_by_user_id?: string | null
          document_id: string
          id?: string
          task_id: string
        }
        Update: {
          created_at?: string
          created_by_user_id?: string | null
          document_id?: string
          id?: string
          task_id?: string
        }
        Relationships: []
      }
      task_recurrence_rules: {
        Row: {
          created_at: string
          created_by_user_id: string
          created_occurrences: number
          end_after_occurrences: number | null
          end_type: string
          end_until_date: string | null
          group_id: string
          id: string
          interval_value: number
          last_occurrence_date: string | null
          monthly_day_of_month: number | null
          monthly_nth_weekday: number | null
          monthly_weekday: number | null
          pattern_type: string
          task_id: string
          updated_at: string
          weekly_days: number[] | null
          yearly_day: number | null
          yearly_month: number | null
        }
        Insert: {
          created_at?: string
          created_by_user_id: string
          created_occurrences?: number
          end_after_occurrences?: number | null
          end_type?: string
          end_until_date?: string | null
          group_id: string
          id?: string
          interval_value?: number
          last_occurrence_date?: string | null
          monthly_day_of_month?: number | null
          monthly_nth_weekday?: number | null
          monthly_weekday?: number | null
          pattern_type: string
          task_id: string
          updated_at?: string
          weekly_days?: number[] | null
          yearly_day?: number | null
          yearly_month?: number | null
        }
        Update: {
          created_at?: string
          created_by_user_id?: string
          created_occurrences?: number
          end_after_occurrences?: number | null
          end_type?: string
          end_until_date?: string | null
          group_id?: string
          id?: string
          interval_value?: number
          last_occurrence_date?: string | null
          monthly_day_of_month?: number | null
          monthly_nth_weekday?: number | null
          monthly_weekday?: number | null
          pattern_type?: string
          task_id?: string
          updated_at?: string
          weekly_days?: number[] | null
          yearly_day?: number | null
          yearly_month?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "task_recurrence_rules_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_updates: {
        Row: {
          content: string
          created_at: string
          id: string
          task_id: string
          updated_at: string
          user_email: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          task_id: string
          updated_at?: string
          user_email: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          task_id?: string
          updated_at?: string
          user_email?: string
          user_id?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          category: string | null
          completed_at: string | null
          completed_by_email: string | null
          completed_by_user_id: string | null
          created_at: string
          created_by_email: string | null
          created_by_user_id: string | null
          description: string | null
          due_date: string | null
          group_id: string | null
          id: string
          primary_owner_id: string | null
          priority: Database["public"]["Enums"]["task_priority"] | null
          secondary_owner_id: string | null
          status: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          completed_at?: string | null
          completed_by_email?: string | null
          completed_by_user_id?: string | null
          created_at?: string
          created_by_email?: string | null
          created_by_user_id?: string | null
          description?: string | null
          due_date?: string | null
          group_id?: string | null
          id?: string
          primary_owner_id?: string | null
          priority?: Database["public"]["Enums"]["task_priority"] | null
          secondary_owner_id?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          completed_at?: string | null
          completed_by_email?: string | null
          completed_by_user_id?: string | null
          created_at?: string
          created_by_email?: string | null
          created_by_user_id?: string | null
          description?: string | null
          due_date?: string | null
          group_id?: string | null
          id?: string
          primary_owner_id?: string | null
          priority?: Database["public"]["Enums"]["task_priority"] | null
          secondary_owner_id?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_completed_by_user_id_fkey"
            columns: ["completed_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "tasks_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "tasks_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "care_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_primary_owner_id_fkey"
            columns: ["primary_owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "tasks_secondary_owner_id_fkey"
            columns: ["secondary_owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      users: {
        Row: {
          address: string | null
          created_at: string
          email: string
          id: string
          name: string
          password_hash: string | null
          phone: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string
          email: string
          id?: string
          name: string
          password_hash?: string | null
          phone?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string
          email?: string
          id?: string
          name?: string
          password_hash?: string | null
          phone?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_invitation: {
        Args: { invitation_id: string }
        Returns: string
      }
      accept_invitation_by_token: {
        Args: { invitation_token: string }
        Returns: string
      }
      build_weighted_tsv: {
        Args: { body_text?: string; snippet_text?: string; title_text?: string }
        Returns: unknown
      }
      get_invitation_by_token: {
        Args: { invitation_token: string }
        Returns: {
          group_id: string
          group_name: string
          id: string
          invited_by_email: string
          invited_email: string
          message: string
        }[]
      }
      get_search_jobs: {
        Args: Record<PropertyKey, never>
        Returns: {
          created_at: string
          entity_id: string
          entity_type: string
          error_message: string
          id: string
          operation: string
          status: string
          updated_at: string
        }[]
      }
      gtrgm_compress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gtrgm_decompress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gtrgm_in: {
        Args: { "": unknown }
        Returns: unknown
      }
      gtrgm_options: {
        Args: { "": unknown }
        Returns: undefined
      }
      gtrgm_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      has_accessed_group_before: {
        Args: { p_group_id: string; p_user_id: string }
        Returns: boolean
      }
      is_platform_admin: {
        Args: { user_uuid?: string }
        Returns: boolean
      }
      is_system_admin: {
        Args: { user_uuid?: string }
        Returns: boolean
      }
      is_user_admin_of_group: {
        Args: { group_uuid: string }
        Returns: boolean
      }
      is_user_member_of_group: {
        Args: { group_uuid: string }
        Returns: boolean
      }
      log_admin_action: {
        Args: {
          p_action: string
          p_details?: Json
          p_target_id?: string
          p_target_type?: string
        }
        Returns: undefined
      }
      log_audit_event: {
        Args: {
          p_action: string
          p_details?: Json
          p_group_id: string
          p_resource_id: string
          p_resource_type: string
        }
        Returns: undefined
      }
      log_group_access: {
        Args: { p_group_id: string }
        Returns: undefined
      }
      rebuild_search_index: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      reindex_row: {
        Args: { p_entity_id: string; p_entity_type: string }
        Returns: undefined
      }
      remove_from_index: {
        Args: { p_entity_id: string; p_entity_type: string }
        Returns: undefined
      }
      retry_search_job: {
        Args: { p_job_id: string }
        Returns: undefined
      }
      sanitize_input: {
        Args: { input_text: string }
        Returns: string
      }
      search_all: {
        Args: { group_id: string; lim?: number; q: string }
        Returns: {
          entity_id: string
          entity_type: string
          rank: number
          snippet_html: string
          title: string
          url_path: string
        }[]
      }
      set_limit: {
        Args: { "": number }
        Returns: number
      }
      show_limit: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      show_trgm: {
        Args: { "": string }
        Returns: string[]
      }
      unaccent: {
        Args: { "": string }
        Returns: string
      }
      unaccent_init: {
        Args: { "": unknown }
        Returns: unknown
      }
    }
    Enums: {
      contact_type_enum: "medical" | "legal" | "family" | "friend" | "other"
      emergency_type_enum:
        | "medical"
        | "legal"
        | "religious"
        | "family"
        | "general"
      feedback_severity_enum: "low" | "medium" | "high" | "critical"
      feedback_status_enum:
        | "open"
        | "in_progress"
        | "resolved"
        | "closed"
        | "duplicate"
        | "wontfix"
      feedback_type_enum: "defect" | "feature"
      gender_enum: "female" | "male" | "x_or_other" | "prefer_not_to_say"
      task_priority: "High" | "Medium" | "Low"
      task_status: "Open" | "InProgress" | "Completed"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      contact_type_enum: ["medical", "legal", "family", "friend", "other"],
      emergency_type_enum: [
        "medical",
        "legal",
        "religious",
        "family",
        "general",
      ],
      feedback_severity_enum: ["low", "medium", "high", "critical"],
      feedback_status_enum: [
        "open",
        "in_progress",
        "resolved",
        "closed",
        "duplicate",
        "wontfix",
      ],
      feedback_type_enum: ["defect", "feature"],
      gender_enum: ["female", "male", "x_or_other", "prefer_not_to_say"],
      task_priority: ["High", "Medium", "Low"],
      task_status: ["Open", "InProgress", "Completed"],
    },
  },
} as const
