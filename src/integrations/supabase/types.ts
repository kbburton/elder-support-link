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
      activity_documents: {
        Row: {
          activity_log_id: string
          created_at: string
          created_by_user_id: string | null
          document_id: string
          id: string
        }
        Insert: {
          activity_log_id: string
          created_at?: string
          created_by_user_id?: string | null
          document_id: string
          id?: string
        }
        Update: {
          activity_log_id?: string
          created_at?: string
          created_by_user_id?: string | null
          document_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_documents_activity_log_id_fkey"
            columns: ["activity_log_id"]
            isOneToOne: false
            referencedRelation: "activity_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_documents_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_documents_v2: {
        Row: {
          activity_log_id: string
          created_at: string
          created_by_user_id: string | null
          document_id: string
          id: string
        }
        Insert: {
          activity_log_id: string
          created_at?: string
          created_by_user_id?: string | null
          document_id: string
          id?: string
        }
        Update: {
          activity_log_id?: string
          created_at?: string
          created_by_user_id?: string | null
          document_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_documents_v2_activity_log_id_fkey"
            columns: ["activity_log_id"]
            isOneToOne: false
            referencedRelation: "activity_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_documents_v2_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents_v2"
            referencedColumns: ["id"]
          },
        ]
      }
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
          deleted_at: string | null
          deleted_by_email: string | null
          deleted_by_user_id: string | null
          group_id: string | null
          id: string
          is_deleted: boolean
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
          deleted_at?: string | null
          deleted_by_email?: string | null
          deleted_by_user_id?: string | null
          group_id?: string | null
          id?: string
          is_deleted?: boolean
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
          deleted_at?: string | null
          deleted_by_email?: string | null
          deleted_by_user_id?: string | null
          group_id?: string | null
          id?: string
          is_deleted?: boolean
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
      ai_prompts: {
        Row: {
          category: string
          created_at: string
          id: string
          prompt_text: string
          target_field: string
          target_table: string
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          prompt_text: string
          target_field?: string
          target_table?: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          prompt_text?: string
          target_field?: string
          target_table?: string
          updated_at?: string
        }
        Relationships: []
      }
      allergies: {
        Row: {
          allergen: string
          care_group_id: string
          created_at: string
          has_epipen: boolean
          id: string
          notes: string | null
          reaction: string | null
          severity: Database["public"]["Enums"]["allergy_severity"]
          type: Database["public"]["Enums"]["allergy_type"]
          updated_at: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          allergen: string
          care_group_id: string
          created_at?: string
          has_epipen?: boolean
          id?: string
          notes?: string | null
          reaction?: string | null
          severity?: Database["public"]["Enums"]["allergy_severity"]
          type?: Database["public"]["Enums"]["allergy_type"]
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          allergen?: string
          care_group_id?: string
          created_at?: string
          has_epipen?: boolean
          id?: string
          notes?: string | null
          reaction?: string | null
          severity?: Database["public"]["Enums"]["allergy_severity"]
          type?: Database["public"]["Enums"]["allergy_type"]
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "allergies_care_group_id_fkey"
            columns: ["care_group_id"]
            isOneToOne: false
            referencedRelation: "care_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      analytics_data: {
        Row: {
          bounce: boolean | null
          created_at: string | null
          id: string
          login_time: string | null
          page_path: string
          referrer_page: string | null
          session_id: string
          time_spent_seconds: number | null
          user_id: string | null
        }
        Insert: {
          bounce?: boolean | null
          created_at?: string | null
          id?: string
          login_time?: string | null
          page_path: string
          referrer_page?: string | null
          session_id: string
          time_spent_seconds?: number | null
          user_id?: string | null
        }
        Update: {
          bounce?: boolean | null
          created_at?: string | null
          id?: string
          login_time?: string | null
          page_path?: string
          referrer_page?: string | null
          session_id?: string
          time_spent_seconds?: number | null
          user_id?: string | null
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
      appointment_activities: {
        Row: {
          activity_log_id: string
          appointment_id: string
          created_at: string
          created_by_user_id: string | null
          id: string
        }
        Insert: {
          activity_log_id: string
          appointment_id: string
          created_at?: string
          created_by_user_id?: string | null
          id?: string
        }
        Update: {
          activity_log_id?: string
          appointment_id?: string
          created_at?: string
          created_by_user_id?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointment_activities_activity_log_id_fkey"
            columns: ["activity_log_id"]
            isOneToOne: false
            referencedRelation: "activity_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_activities_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "appointment_documents_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_documents_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      appointment_documents_v2: {
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
        Relationships: [
          {
            foreignKeyName: "appointment_documents_v2_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_documents_v2_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents_v2"
            referencedColumns: ["id"]
          },
        ]
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
      appointment_tasks: {
        Row: {
          appointment_id: string
          created_at: string
          created_by_user_id: string | null
          id: string
          task_id: string
        }
        Insert: {
          appointment_id: string
          created_at?: string
          created_by_user_id?: string | null
          id?: string
          task_id: string
        }
        Update: {
          appointment_id?: string
          created_at?: string
          created_by_user_id?: string | null
          id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointment_tasks_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_tasks_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          attending_user_id: string | null
          category: string | null
          city: string | null
          created_at: string
          created_by_email: string | null
          created_by_user_id: string | null
          date_time: string
          deleted_at: string | null
          deleted_by_email: string | null
          deleted_by_user_id: string | null
          description: string | null
          duration_minutes: number | null
          group_id: string | null
          id: string
          is_deleted: boolean
          outcome_notes: string | null
          reminder_days_before: number | null
          state: string | null
          street_address: string | null
          street_address_2: string | null
          transportation_information: string | null
          zip_code: string | null
        }
        Insert: {
          attending_user_id?: string | null
          category?: string | null
          city?: string | null
          created_at?: string
          created_by_email?: string | null
          created_by_user_id?: string | null
          date_time: string
          deleted_at?: string | null
          deleted_by_email?: string | null
          deleted_by_user_id?: string | null
          description?: string | null
          duration_minutes?: number | null
          group_id?: string | null
          id?: string
          is_deleted?: boolean
          outcome_notes?: string | null
          reminder_days_before?: number | null
          state?: string | null
          street_address?: string | null
          street_address_2?: string | null
          transportation_information?: string | null
          zip_code?: string | null
        }
        Update: {
          attending_user_id?: string | null
          category?: string | null
          city?: string | null
          created_at?: string
          created_by_email?: string | null
          created_by_user_id?: string | null
          date_time?: string
          deleted_at?: string | null
          deleted_by_email?: string | null
          deleted_by_user_id?: string | null
          description?: string | null
          duration_minutes?: number | null
          group_id?: string | null
          id?: string
          is_deleted?: boolean
          outcome_notes?: string | null
          reminder_days_before?: number | null
          state?: string | null
          street_address?: string | null
          street_address_2?: string | null
          transportation_information?: string | null
          zip_code?: string | null
        }
        Relationships: [
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
          accepted_by: string | null
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
          used_at: string | null
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
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
          used_at?: string | null
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
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
          used_at?: string | null
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
          relationship_to_recipient: string
          role: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          group_id?: string | null
          id?: string
          is_admin?: boolean
          relationship_to_recipient: string
          role?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          group_id?: string | null
          id?: string
          is_admin?: boolean
          relationship_to_recipient?: string
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
          created_by_user_id: string
          date_of_birth: string
          gender: string | null
          hearing: string | null
          id: string
          living_situation: string | null
          memory: string | null
          mental_health: string | null
          mobility: string | null
          name: string
          other_important_information: string | null
          phone_auth_attempts: number | null
          phone_lockout_until: string | null
          profile_description: string | null
          profile_picture_url: string | null
          recipient_address: string
          recipient_city: string
          recipient_email: string
          recipient_first_name: string
          recipient_last_name: string | null
          recipient_phone: string
          recipient_state: string
          recipient_zip: string
          special_dates: Json | null
          vision: string | null
          voice_pin: string | null
        }
        Insert: {
          chronic_conditions?: string | null
          created_at?: string
          created_by_user_id: string
          date_of_birth: string
          gender?: string | null
          hearing?: string | null
          id?: string
          living_situation?: string | null
          memory?: string | null
          mental_health?: string | null
          mobility?: string | null
          name: string
          other_important_information?: string | null
          phone_auth_attempts?: number | null
          phone_lockout_until?: string | null
          profile_description?: string | null
          profile_picture_url?: string | null
          recipient_address: string
          recipient_city: string
          recipient_email: string
          recipient_first_name: string
          recipient_last_name?: string | null
          recipient_phone: string
          recipient_state: string
          recipient_zip: string
          special_dates?: Json | null
          vision?: string | null
          voice_pin?: string | null
        }
        Update: {
          chronic_conditions?: string | null
          created_at?: string
          created_by_user_id?: string
          date_of_birth?: string
          gender?: string | null
          hearing?: string | null
          id?: string
          living_situation?: string | null
          memory?: string | null
          mental_health?: string | null
          mobility?: string | null
          name?: string
          other_important_information?: string | null
          phone_auth_attempts?: number | null
          phone_lockout_until?: string | null
          profile_description?: string | null
          profile_picture_url?: string | null
          recipient_address?: string
          recipient_city?: string
          recipient_email?: string
          recipient_first_name?: string
          recipient_last_name?: string | null
          recipient_phone?: string
          recipient_state?: string
          recipient_zip?: string
          special_dates?: Json | null
          vision?: string | null
          voice_pin?: string | null
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
      contact_documents_v2: {
        Row: {
          contact_id: string
          created_at: string
          document_id: string
          id: string
        }
        Insert: {
          contact_id: string
          created_at?: string
          document_id: string
          id?: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          document_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_documents_v2_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_documents_v2_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents_v2"
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
          company: string | null
          contact_type: Database["public"]["Enums"]["contact_type_enum"]
          created_at: string | null
          created_by_user_id: string
          deleted_at: string | null
          deleted_by_email: string | null
          deleted_by_user_id: string | null
          email_personal: string | null
          email_work: string | null
          emergency_notes: string | null
          emergency_type:
            | Database["public"]["Enums"]["emergency_type_enum"]
            | null
          first_name: string | null
          gender: Database["public"]["Enums"]["gender_enum"] | null
          id: string
          is_deleted: boolean
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
          title: string | null
          updated_at: string | null
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          care_group_id: string
          city?: string | null
          company?: string | null
          contact_type: Database["public"]["Enums"]["contact_type_enum"]
          created_at?: string | null
          created_by_user_id: string
          deleted_at?: string | null
          deleted_by_email?: string | null
          deleted_by_user_id?: string | null
          email_personal?: string | null
          email_work?: string | null
          emergency_notes?: string | null
          emergency_type?:
            | Database["public"]["Enums"]["emergency_type_enum"]
            | null
          first_name?: string | null
          gender?: Database["public"]["Enums"]["gender_enum"] | null
          id?: string
          is_deleted?: boolean
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
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          care_group_id?: string
          city?: string | null
          company?: string | null
          contact_type?: Database["public"]["Enums"]["contact_type_enum"]
          created_at?: string | null
          created_by_user_id?: string
          deleted_at?: string | null
          deleted_by_email?: string | null
          deleted_by_user_id?: string | null
          email_personal?: string | null
          email_work?: string | null
          emergency_notes?: string | null
          emergency_type?:
            | Database["public"]["Enums"]["emergency_type_enum"]
            | null
          first_name?: string | null
          gender?: Database["public"]["Enums"]["gender_enum"] | null
          id?: string
          is_deleted?: boolean
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
          title?: string | null
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
      deletion_audit: {
        Row: {
          action: string
          entity: string
          group_id: string | null
          id: string
          performed_at: string
          performed_by_email: string | null
          performed_by_user_id: string
          previous_links: Json | null
          record_id: string
        }
        Insert: {
          action: string
          entity: string
          group_id?: string | null
          id?: string
          performed_at?: string
          performed_by_email?: string | null
          performed_by_user_id: string
          previous_links?: Json | null
          record_id: string
        }
        Update: {
          action?: string
          entity?: string
          group_id?: string | null
          id?: string
          performed_at?: string
          performed_by_email?: string | null
          performed_by_user_id?: string
          previous_links?: Json | null
          record_id?: string
        }
        Relationships: []
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
      document_categories: {
        Row: {
          care_group_id: string | null
          created_at: string
          created_by_user_id: string
          description: string | null
          display_order: number
          id: string
          is_default: boolean
          name: string
          parent_id: string | null
          updated_at: string
        }
        Insert: {
          care_group_id?: string | null
          created_at?: string
          created_by_user_id: string
          description?: string | null
          display_order?: number
          id?: string
          is_default?: boolean
          name: string
          parent_id?: string | null
          updated_at?: string
        }
        Update: {
          care_group_id?: string | null
          created_at?: string
          created_by_user_id?: string
          description?: string | null
          display_order?: number
          id?: string
          is_default?: boolean
          name?: string
          parent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_categories_care_group_id_fkey"
            columns: ["care_group_id"]
            isOneToOne: false
            referencedRelation: "care_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "document_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      document_notes: {
        Row: {
          care_group_id: string | null
          content: string
          created_at: string
          created_by_user_id: string
          document_id: string
          id: string
          is_locked: boolean
          last_edited_by_user_id: string | null
          locked_at: string | null
          locked_by_user_id: string | null
          owner_user_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          care_group_id?: string | null
          content?: string
          created_at?: string
          created_by_user_id: string
          document_id: string
          id?: string
          is_locked?: boolean
          last_edited_by_user_id?: string | null
          locked_at?: string | null
          locked_by_user_id?: string | null
          owner_user_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          care_group_id?: string | null
          content?: string
          created_at?: string
          created_by_user_id?: string
          document_id?: string
          id?: string
          is_locked?: boolean
          last_edited_by_user_id?: string | null
          locked_at?: string | null
          locked_by_user_id?: string | null
          owner_user_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      document_tag_assignments: {
        Row: {
          created_at: string
          document_id: string
          document_v2_id: string | null
          id: string
          tag_id: string
        }
        Insert: {
          created_at?: string
          document_id: string
          document_v2_id?: string | null
          id?: string
          tag_id: string
        }
        Update: {
          created_at?: string
          document_id?: string
          document_v2_id?: string | null
          id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_tag_assignments_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_tag_assignments_document_v2_id_fkey"
            columns: ["document_v2_id"]
            isOneToOne: false
            referencedRelation: "documents_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_tag_assignments_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "document_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      document_tags: {
        Row: {
          care_group_id: string
          color: string | null
          created_at: string
          created_by_user_id: string
          id: string
          name: string
        }
        Insert: {
          care_group_id: string
          color?: string | null
          created_at?: string
          created_by_user_id: string
          id?: string
          name: string
        }
        Update: {
          care_group_id?: string
          color?: string | null
          created_at?: string
          created_by_user_id?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_tags_care_group_id_fkey"
            columns: ["care_group_id"]
            isOneToOne: false
            referencedRelation: "care_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      document_v2_group_shares: {
        Row: {
          created_at: string
          document_id: string
          group_id: string
          id: string
          shared_by_user_id: string
        }
        Insert: {
          created_at?: string
          document_id: string
          group_id: string
          id?: string
          shared_by_user_id: string
        }
        Update: {
          created_at?: string
          document_id?: string
          group_id?: string
          id?: string
          shared_by_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_v2_group_shares_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_v2_group_shares_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "care_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      document_versions: {
        Row: {
          created_at: string
          created_by_user_id: string
          document_id: string
          document_v2_id: string | null
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          notes: string | null
          version_number: number
        }
        Insert: {
          created_at?: string
          created_by_user_id: string
          document_id: string
          document_v2_id?: string | null
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          notes?: string | null
          version_number: number
        }
        Update: {
          created_at?: string
          created_by_user_id?: string
          document_id?: string
          document_v2_id?: string | null
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          notes?: string | null
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "document_versions_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_versions_document_v2_id_fkey"
            columns: ["document_v2_id"]
            isOneToOne: false
            referencedRelation: "documents_v2"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          category: string | null
          category_id: string | null
          created_at: string
          current_version: number
          deleted_at: string | null
          deleted_by_email: string | null
          deleted_by_user_id: string | null
          file_metadata: Json | null
          file_size: number | null
          file_type: string | null
          file_url: string | null
          full_text: string | null
          group_id: string | null
          id: string
          is_deleted: boolean
          is_shared_with_group: boolean
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
          category_id?: string | null
          created_at?: string
          current_version?: number
          deleted_at?: string | null
          deleted_by_email?: string | null
          deleted_by_user_id?: string | null
          file_metadata?: Json | null
          file_size?: number | null
          file_type?: string | null
          file_url?: string | null
          full_text?: string | null
          group_id?: string | null
          id?: string
          is_deleted?: boolean
          is_shared_with_group?: boolean
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
          category_id?: string | null
          created_at?: string
          current_version?: number
          deleted_at?: string | null
          deleted_by_email?: string | null
          deleted_by_user_id?: string | null
          file_metadata?: Json | null
          file_size?: number | null
          file_type?: string | null
          file_url?: string | null
          full_text?: string | null
          group_id?: string | null
          id?: string
          is_deleted?: boolean
          is_shared_with_group?: boolean
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
            foreignKeyName: "documents_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "document_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "care_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      documents_v2: {
        Row: {
          admin_only_visible: boolean
          ai_metadata: Json | null
          category_id: string | null
          created_at: string
          deleted_at: string | null
          deleted_by_email: string | null
          deleted_by_user_id: string | null
          file_size: number | null
          file_url: string
          full_text: string | null
          group_id: string | null
          id: string
          is_deleted: boolean | null
          is_shared_with_group: boolean | null
          mime_type: string | null
          notes: string | null
          original_filename: string
          processing_error: string | null
          processing_status: string | null
          summary: string | null
          title: string | null
          updated_at: string
          uploaded_by_email: string | null
          uploaded_by_user_id: string
        }
        Insert: {
          admin_only_visible?: boolean
          ai_metadata?: Json | null
          category_id?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by_email?: string | null
          deleted_by_user_id?: string | null
          file_size?: number | null
          file_url: string
          full_text?: string | null
          group_id?: string | null
          id?: string
          is_deleted?: boolean | null
          is_shared_with_group?: boolean | null
          mime_type?: string | null
          notes?: string | null
          original_filename: string
          processing_error?: string | null
          processing_status?: string | null
          summary?: string | null
          title?: string | null
          updated_at?: string
          uploaded_by_email?: string | null
          uploaded_by_user_id: string
        }
        Update: {
          admin_only_visible?: boolean
          ai_metadata?: Json | null
          category_id?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by_email?: string | null
          deleted_by_user_id?: string | null
          file_size?: number | null
          file_url?: string
          full_text?: string | null
          group_id?: string | null
          id?: string
          is_deleted?: boolean | null
          is_shared_with_group?: boolean | null
          mime_type?: string | null
          notes?: string | null
          original_filename?: string
          processing_error?: string | null
          processing_status?: string | null
          summary?: string | null
          title?: string | null
          updated_at?: string
          uploaded_by_email?: string | null
          uploaded_by_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_v2_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "document_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_v2_group_id_fkey"
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
      entity_associations: {
        Row: {
          created_at: string
          created_by_user_id: string
          entity_1_id: string
          entity_1_type: string
          entity_2_id: string
          entity_2_type: string
          group_id: string
          id: string
        }
        Insert: {
          created_at?: string
          created_by_user_id: string
          entity_1_id: string
          entity_1_type: string
          entity_2_id: string
          entity_2_type: string
          group_id: string
          id?: string
        }
        Update: {
          created_at?: string
          created_by_user_id?: string
          entity_1_id?: string
          entity_1_type?: string
          entity_2_id?: string
          entity_2_type?: string
          group_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "entity_associations_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "care_groups"
            referencedColumns: ["id"]
          },
        ]
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
      interview_question_usage: {
        Row: {
          care_group_id: string
          id: string
          interview_id: string
          question_id: string
          used_at: string | null
        }
        Insert: {
          care_group_id: string
          id?: string
          interview_id: string
          question_id: string
          used_at?: string | null
        }
        Update: {
          care_group_id?: string
          id?: string
          interview_id?: string
          question_id?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "interview_question_usage_care_group_id_fkey"
            columns: ["care_group_id"]
            isOneToOne: false
            referencedRelation: "care_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interview_question_usage_interview_id_fkey"
            columns: ["interview_id"]
            isOneToOne: false
            referencedRelation: "memory_interviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interview_question_usage_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "interview_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      interview_questions: {
        Row: {
          category: string
          created_at: string | null
          display_order: number
          id: string
          is_active: boolean | null
          question_text: string
        }
        Insert: {
          category: string
          created_at?: string | null
          display_order: number
          id?: string
          is_active?: boolean | null
          question_text: string
        }
        Update: {
          category?: string
          created_at?: string | null
          display_order?: number
          id?: string
          is_active?: boolean | null
          question_text?: string
        }
        Relationships: []
      }
      invitation_nonces: {
        Row: {
          created_at: string
          expires_at: string
          invitation_id: string
          nonce: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          expires_at: string
          invitation_id: string
          nonce: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          expires_at?: string
          invitation_id?: string
          nonce?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invitation_nonces_invitation_id_fkey"
            columns: ["invitation_id"]
            isOneToOne: false
            referencedRelation: "care_group_invitations"
            referencedColumns: ["id"]
          },
        ]
      }
      memory_interviews: {
        Row: {
          care_group_id: string
          completed_at: string | null
          created_at: string | null
          created_by_user_id: string
          custom_instructions: string | null
          duration_seconds: number | null
          failure_reason: string | null
          id: string
          interview_type: string
          is_test: boolean | null
          phone_number: string
          raw_transcript: string | null
          recipient_phone: string | null
          recurring_completed_count: number | null
          recurring_frequency: string | null
          recurring_total_count: number | null
          scheduled_at: string
          selected_question_id: string | null
          status: string
          twilio_call_sid: string | null
          updated_at: string | null
          voicemail_detected: boolean | null
        }
        Insert: {
          care_group_id: string
          completed_at?: string | null
          created_at?: string | null
          created_by_user_id: string
          custom_instructions?: string | null
          duration_seconds?: number | null
          failure_reason?: string | null
          id?: string
          interview_type?: string
          is_test?: boolean | null
          phone_number: string
          raw_transcript?: string | null
          recipient_phone?: string | null
          recurring_completed_count?: number | null
          recurring_frequency?: string | null
          recurring_total_count?: number | null
          scheduled_at: string
          selected_question_id?: string | null
          status?: string
          twilio_call_sid?: string | null
          updated_at?: string | null
          voicemail_detected?: boolean | null
        }
        Update: {
          care_group_id?: string
          completed_at?: string | null
          created_at?: string | null
          created_by_user_id?: string
          custom_instructions?: string | null
          duration_seconds?: number | null
          failure_reason?: string | null
          id?: string
          interview_type?: string
          is_test?: boolean | null
          phone_number?: string
          raw_transcript?: string | null
          recipient_phone?: string | null
          recurring_completed_count?: number | null
          recurring_frequency?: string | null
          recurring_total_count?: number | null
          scheduled_at?: string
          selected_question_id?: string | null
          status?: string
          twilio_call_sid?: string | null
          updated_at?: string | null
          voicemail_detected?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "memory_interviews_care_group_id_fkey"
            columns: ["care_group_id"]
            isOneToOne: false
            referencedRelation: "care_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      memory_stories: {
        Row: {
          audio_url: string | null
          care_group_id: string
          created_at: string | null
          flagged_content: Json | null
          id: string
          interview_id: string
          memory_facts: Json | null
          pii_redacted: boolean | null
          published_at: string | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by_user_id: string | null
          status: string
          story_text: string
          title: string
          transcript_url: string | null
          updated_at: string | null
        }
        Insert: {
          audio_url?: string | null
          care_group_id: string
          created_at?: string | null
          flagged_content?: Json | null
          id?: string
          interview_id: string
          memory_facts?: Json | null
          pii_redacted?: boolean | null
          published_at?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by_user_id?: string | null
          status?: string
          story_text: string
          title: string
          transcript_url?: string | null
          updated_at?: string | null
        }
        Update: {
          audio_url?: string | null
          care_group_id?: string
          created_at?: string | null
          flagged_content?: Json | null
          id?: string
          interview_id?: string
          memory_facts?: Json | null
          pii_redacted?: boolean | null
          published_at?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by_user_id?: string | null
          status?: string
          story_text?: string
          title?: string
          transcript_url?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "memory_stories_care_group_id_fkey"
            columns: ["care_group_id"]
            isOneToOne: false
            referencedRelation: "care_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memory_stories_interview_id_fkey"
            columns: ["interview_id"]
            isOneToOne: false
            referencedRelation: "memory_interviews"
            referencedColumns: ["id"]
          },
        ]
      }
      memory_story_versions: {
        Row: {
          created_at: string | null
          edit_notes: string | null
          edited_by_user_id: string
          id: string
          story_id: string
          story_text: string
          version_number: number
        }
        Insert: {
          created_at?: string | null
          edit_notes?: string | null
          edited_by_user_id: string
          id?: string
          story_id: string
          story_text: string
          version_number: number
        }
        Update: {
          created_at?: string | null
          edit_notes?: string | null
          edited_by_user_id?: string
          id?: string
          story_id?: string
          story_text?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "memory_story_versions_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "memory_stories"
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
      picklist_options: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          label: string
          list_type: string
          sort_order: number
          updated_at: string
          value: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          label: string
          list_type: string
          sort_order?: number
          updated_at?: string
          value: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string
          list_type?: string
          sort_order?: number
          updated_at?: string
          value?: string
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
      preferences: {
        Row: {
          care_group_id: string
          category: Database["public"]["Enums"]["preference_category"]
          created_at: string
          id: string
          order_index: number
          pinned: boolean
          text_value: string
          type: Database["public"]["Enums"]["preference_type"]
          updated_at: string
        }
        Insert: {
          care_group_id: string
          category?: Database["public"]["Enums"]["preference_category"]
          created_at?: string
          id?: string
          order_index?: number
          pinned?: boolean
          text_value: string
          type: Database["public"]["Enums"]["preference_type"]
          updated_at?: string
        }
        Update: {
          care_group_id?: string
          category?: Database["public"]["Enums"]["preference_category"]
          created_at?: string
          id?: string
          order_index?: number
          pinned?: boolean
          text_value?: string
          type?: Database["public"]["Enums"]["preference_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "preferences_care_group_id_fkey"
            columns: ["care_group_id"]
            isOneToOne: false
            referencedRelation: "care_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          address: string | null
          address2: string | null
          city: string | null
          created_at: string
          first_name: string | null
          last_active_group_id: string | null
          last_login: string | null
          last_name: string | null
          phone: string | null
          phone_auth_attempts: number | null
          phone_lockout_until: string | null
          state: string | null
          updated_at: string
          user_id: string
          voice_pin: string | null
          zip: string | null
        }
        Insert: {
          address?: string | null
          address2?: string | null
          city?: string | null
          created_at?: string
          first_name?: string | null
          last_active_group_id?: string | null
          last_login?: string | null
          last_name?: string | null
          phone?: string | null
          phone_auth_attempts?: number | null
          phone_lockout_until?: string | null
          state?: string | null
          updated_at?: string
          user_id: string
          voice_pin?: string | null
          zip?: string | null
        }
        Update: {
          address?: string | null
          address2?: string | null
          city?: string | null
          created_at?: string
          first_name?: string | null
          last_active_group_id?: string | null
          last_login?: string | null
          last_name?: string | null
          phone?: string | null
          phone_auth_attempts?: number | null
          phone_lockout_until?: string | null
          state?: string | null
          updated_at?: string
          user_id?: string
          voice_pin?: string | null
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
      role_history: {
        Row: {
          created_at: string | null
          granted_at: string | null
          granted_by_user_id: string | null
          id: string
          revoked_at: string | null
          revoked_by_user_id: string | null
          role_type: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          granted_at?: string | null
          granted_by_user_id?: string | null
          id?: string
          revoked_at?: string | null
          revoked_by_user_id?: string | null
          role_type?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          granted_at?: string | null
          granted_by_user_id?: string | null
          id?: string
          revoked_at?: string | null
          revoked_by_user_id?: string | null
          role_type?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      role_promotion_confirmations: {
        Row: {
          confirmation_token: string
          confirmed_at: string | null
          created_at: string
          expires_at: string
          group_id: string | null
          id: string
          promoted_by_email: string
          promoted_by_user_id: string
          promotion_type: string
          target_email: string
          target_user_id: string
        }
        Insert: {
          confirmation_token?: string
          confirmed_at?: string | null
          created_at?: string
          expires_at?: string
          group_id?: string | null
          id?: string
          promoted_by_email: string
          promoted_by_user_id: string
          promotion_type: string
          target_email: string
          target_user_id: string
        }
        Update: {
          confirmation_token?: string
          confirmed_at?: string | null
          created_at?: string
          expires_at?: string
          group_id?: string | null
          id?: string
          promoted_by_email?: string
          promoted_by_user_id?: string
          promotion_type?: string
          target_email?: string
          target_user_id?: string
        }
        Relationships: []
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
      system_logs: {
        Row: {
          component: string | null
          context: Json | null
          created_at: string
          error_details: string | null
          group_id: string | null
          id: string
          level: string
          message: string
          operation: string | null
          user_id: string | null
        }
        Insert: {
          component?: string | null
          context?: Json | null
          created_at?: string
          error_details?: string | null
          group_id?: string | null
          id?: string
          level: string
          message: string
          operation?: string | null
          user_id?: string | null
        }
        Update: {
          component?: string | null
          context?: Json | null
          created_at?: string
          error_details?: string | null
          group_id?: string | null
          id?: string
          level?: string
          message?: string
          operation?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      task_activities: {
        Row: {
          activity_log_id: string
          created_at: string
          created_by_user_id: string | null
          id: string
          task_id: string
        }
        Insert: {
          activity_log_id: string
          created_at?: string
          created_by_user_id?: string | null
          id?: string
          task_id: string
        }
        Update: {
          activity_log_id?: string
          created_at?: string
          created_by_user_id?: string | null
          id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_activities_activity_log_id_fkey"
            columns: ["activity_log_id"]
            isOneToOne: false
            referencedRelation: "activity_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_activities_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "task_documents_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_documents_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_documents_v2: {
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
        Relationships: [
          {
            foreignKeyName: "task_documents_v2_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_documents_v2_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
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
          deleted_at: string | null
          deleted_by_email: string | null
          deleted_by_user_id: string | null
          description: string | null
          due_date: string | null
          group_id: string | null
          id: string
          is_deleted: boolean
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
          deleted_at?: string | null
          deleted_by_email?: string | null
          deleted_by_user_id?: string | null
          description?: string | null
          due_date?: string | null
          group_id?: string | null
          id?: string
          is_deleted?: boolean
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
          deleted_at?: string | null
          deleted_by_email?: string | null
          deleted_by_user_id?: string | null
          description?: string | null
          due_date?: string | null
          group_id?: string | null
          id?: string
          is_deleted?: boolean
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_invitation: {
        Args:
          | { invitation_id: string }
          | { invitation_id: string; p_relationship_to_recipient?: string }
          | { invitation_id: string; user_id: string }
        Returns: undefined
      }
      accept_invitation_by_token: {
        Args: { invitation_token: string }
        Returns: string
      }
      build_weighted_tsv: {
        Args: { body_text?: string; snippet_text?: string; title_text?: string }
        Returns: unknown
      }
      can_access_group: {
        Args: { target_group_id: string }
        Returns: boolean
      }
      confirm_role_promotion: {
        Args: { p_token: string }
        Returns: Json
      }
      create_appointment_activity_association: {
        Args: {
          p_activity_log_id: string
          p_appointment_id: string
          p_user_id: string
        }
        Returns: string
      }
      create_care_group_with_member: {
        Args: {
          p_chronic_conditions?: string
          p_date_of_birth: string
          p_gender?: string
          p_hearing?: string
          p_living_situation?: string
          p_memory?: string
          p_mental_health?: string
          p_mobility?: string
          p_name: string
          p_other_important_information?: string
          p_profile_description?: string
          p_recipient_address: string
          p_recipient_city: string
          p_recipient_email: string
          p_recipient_first_name: string
          p_recipient_last_name?: string
          p_recipient_phone: string
          p_recipient_state: string
          p_recipient_zip: string
          p_relationship_to_recipient: string
          p_special_dates?: Json
          p_vision?: string
        }
        Returns: {
          error_message: string
          group_id: string
          group_name: string
          success: boolean
        }[]
      }
      create_contact_activity_association: {
        Args: {
          p_activity_log_id: string
          p_contact_id: string
          p_user_id: string
        }
        Returns: string
      }
      create_contact_appointment_association: {
        Args: {
          p_appointment_id: string
          p_contact_id: string
          p_user_id: string
        }
        Returns: string
      }
      create_task_activity_association: {
        Args: {
          p_activity_log_id: string
          p_task_id: string
          p_user_id: string
        }
        Returns: string
      }
      current_user_email: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      debug_associations: {
        Args: { p_entity_id: string; p_entity_type: string }
        Returns: {
          associated_id: string
          associated_title: string
          associated_type: string
          association_count: number
          junction_table: string
        }[]
      }
      get_group_header_data: {
        Args: { p_care_group_id: string }
        Returns: {
          care_group_id: string
          pinned_preferences: Json
          top_allergy: string
        }[]
      }
      get_group_members: {
        Args: { p_group_id: string }
        Returns: {
          display_name: string
          email: string
          first_name: string
          is_admin: boolean
          last_name: string
          role: string
          user_id: string
        }[]
      }
      get_invitation_by_token: {
        Args: { invitation_token: string }
        Returns: {
          expires_at: string
          group_id: string
          group_name: string
          id: string
          invited_email: string
          status: string
          used_at: string
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
      get_system_logs: {
        Args: Record<PropertyKey, never>
        Returns: {
          component: string
          created_at: string
          id: string
          level: string
          message: string
          metadata: Json
          operation: string
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
      is_document_owner: {
        Args: { _document_id: string; _user_id: string }
        Returns: boolean
      }
      is_group_member: {
        Args: { _group_id: string; _user_id: string }
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
      log_deletion_action: {
        Args: {
          p_action: string
          p_actor_email: string
          p_actor_user_id: string
          p_entity: string
          p_group_id: string
          p_previous_links?: Json
          p_record_id: string
        }
        Returns: undefined
      }
      log_group_access: {
        Args: { p_group_id: string }
        Returns: undefined
      }
      purge_soft_deleted: {
        Args: Record<PropertyKey, never>
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
      release_stale_note_locks: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      remove_from_index: {
        Args: { p_entity_id: string; p_entity_type: string }
        Returns: undefined
      }
      restore_activity: {
        Args:
          | { p_activity_id: string }
          | {
              p_activity_id: string
              p_actor_email: string
              p_actor_user_id: string
            }
          | { p_activity_id: string; p_by_email: string; p_by_user_id: string }
        Returns: undefined
      }
      restore_appointment: {
        Args:
          | {
              p_actor_email: string
              p_actor_user_id: string
              p_appointment_id: string
            }
          | { p_appointment_id: string }
          | {
              p_appointment_id: string
              p_by_email: string
              p_by_user_id: string
            }
        Returns: undefined
      }
      restore_contact: {
        Args:
          | {
              p_actor_email: string
              p_actor_user_id: string
              p_contact_id: string
            }
          | { p_contact_id: string }
        Returns: undefined
      }
      restore_document: {
        Args:
          | {
              p_actor_email: string
              p_actor_user_id: string
              p_document_id: string
            }
          | { p_by_email: string; p_by_user_id: string; p_document_id: string }
          | { p_document_id: string }
        Returns: undefined
      }
      restore_task: {
        Args:
          | {
              p_actor_email: string
              p_actor_user_id: string
              p_task_id: string
            }
          | { p_by_email: string; p_by_user_id: string; p_task_id: string }
          | { p_task_id: string }
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
      soft_delete_activity: {
        Args:
          | { p_activity_id: string }
          | {
              p_activity_id: string
              p_actor_email: string
              p_actor_user_id: string
            }
          | { p_activity_id: string; p_by_email: string; p_by_user_id: string }
        Returns: undefined
      }
      soft_delete_appointment: {
        Args:
          | { p_appointment_id: string }
          | {
              p_appointment_id: string
              p_by_email: string
              p_by_user_id: string
            }
        Returns: undefined
      }
      soft_delete_contact: {
        Args:
          | { p_by_email: string; p_by_user_id: string; p_contact_id: string }
          | { p_contact_id: string }
        Returns: undefined
      }
      soft_delete_document: {
        Args:
          | {
              p_actor_email: string
              p_actor_user_id: string
              p_document_id: string
            }
          | { p_by_email: string; p_by_user_id: string; p_document_id: string }
          | { p_document_id: string }
        Returns: undefined
      }
      soft_delete_task: {
        Args:
          | {
              p_actor_email: string
              p_actor_user_id: string
              p_task_id: string
            }
          | { p_by_email: string; p_by_user_id: string; p_task_id: string }
          | { p_task_id: string }
        Returns: undefined
      }
      unaccent: {
        Args: { "": string }
        Returns: string
      }
      unaccent_init: {
        Args: { "": unknown }
        Returns: unknown
      }
      validate_entity_exists: {
        Args: { p_entity_id: string; p_entity_type: string }
        Returns: boolean
      }
    }
    Enums: {
      allergy_severity: "mild" | "moderate" | "severe" | "anaphylaxis"
      allergy_type: "food" | "drug" | "environment" | "other"
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
      preference_category:
        | "food"
        | "activities"
        | "people"
        | "environment"
        | "media"
        | "other"
      preference_type: "like" | "dislike"
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
      allergy_severity: ["mild", "moderate", "severe", "anaphylaxis"],
      allergy_type: ["food", "drug", "environment", "other"],
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
      preference_category: [
        "food",
        "activities",
        "people",
        "environment",
        "media",
        "other",
      ],
      preference_type: ["like", "dislike"],
      task_priority: ["High", "Medium", "Low"],
      task_status: ["Open", "InProgress", "Completed"],
    },
  },
} as const
