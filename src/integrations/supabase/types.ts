export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      activity_logs: {
        Row: {
          attachment_url: string | null
          created_at: string
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
            foreignKeyName: "activity_logs_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
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
      appointments: {
        Row: {
          attending_user_id: string | null
          category: string | null
          created_at: string
          created_by_email: string | null
          created_by_user_id: string | null
          date_time: string
          description: string | null
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
      care_group_members: {
        Row: {
          created_at: string
          group_id: string | null
          id: string
          relationship_to_recipient: string | null
          role: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          group_id?: string | null
          id?: string
          relationship_to_recipient?: string | null
          role?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          group_id?: string | null
          id?: string
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
          memory: string | null
          mental_health: string | null
          mobility: string | null
          name: string
          other_important_information: string | null
          profile_description: string | null
          recipient_address: string | null
          recipient_city: string | null
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
          memory?: string | null
          mental_health?: string | null
          mobility?: string | null
          name: string
          other_important_information?: string | null
          profile_description?: string | null
          recipient_address?: string | null
          recipient_city?: string | null
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
          memory?: string | null
          mental_health?: string | null
          mobility?: string | null
          name?: string
          other_important_information?: string | null
          profile_description?: string | null
          recipient_address?: string | null
          recipient_city?: string | null
          recipient_phone?: string | null
          recipient_state?: string | null
          recipient_zip?: string | null
          special_dates?: Json | null
          vision?: string | null
        }
        Relationships: []
      }
      documents: {
        Row: {
          category: string | null
          created_at: string
          file_type: string | null
          file_url: string | null
          full_text: string | null
          group_id: string | null
          id: string
          summary: string | null
          title: string | null
          upload_date: string
          uploaded_by_user_id: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          file_type?: string | null
          file_url?: string | null
          full_text?: string | null
          group_id?: string | null
          id?: string
          summary?: string | null
          title?: string | null
          upload_date?: string
          uploaded_by_user_id?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string
          file_type?: string | null
          file_url?: string | null
          full_text?: string | null
          group_id?: string | null
          id?: string
          summary?: string | null
          title?: string | null
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
          {
            foreignKeyName: "documents_uploaded_by_user_id_fkey"
            columns: ["uploaded_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
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
      profiles: {
        Row: {
          address: string | null
          created_at: string
          email: string | null
          first_name: string | null
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
          last_name?: string | null
          phone?: string | null
          state?: string | null
          updated_at?: string
          user_id?: string
          zip?: string | null
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
          secondary_owner_id: string | null
          status: string
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
          secondary_owner_id?: string | null
          status?: string
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
          secondary_owner_id?: string | null
          status?: string
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
      is_user_member_of_group: {
        Args: { group_uuid: string }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
