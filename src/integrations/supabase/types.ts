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
      ai_profiles: {
        Row: {
          created_at: string
          description: string | null
          id: string
          model: string | null
          name: string
          org_id: string
          stop_ai_after_handoff: boolean | null
          system_prompt: string | null
          temperature: number | null
          transfer_conditions: string | null
          welcome_message: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          model?: string | null
          name: string
          org_id: string
          stop_ai_after_handoff?: boolean | null
          system_prompt?: string | null
          temperature?: number | null
          transfer_conditions?: string | null
          welcome_message?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          model?: string | null
          name?: string
          org_id?: string
          stop_ai_after_handoff?: boolean | null
          system_prompt?: string | null
          temperature?: number | null
          transfer_conditions?: string | null
          welcome_message?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_profiles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_sessions: {
        Row: {
          ai_profile_id: string
          created_at: string
          id: string
          model: string | null
          temperature: number | null
          thread_id: string
        }
        Insert: {
          ai_profile_id: string
          created_at?: string
          id?: string
          model?: string | null
          temperature?: number | null
          thread_id: string
        }
        Update: {
          ai_profile_id?: string
          created_at?: string
          id?: string
          model?: string | null
          temperature?: number | null
          thread_id?: string
        }
        Relationships: []
      }
      alert_rules: {
        Row: {
          created_at: string | null
          id: string
          is_enabled: boolean
          kind: string
          org_id: string
          threshold: number
          window_minutes: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_enabled?: boolean
          kind: string
          org_id: string
          threshold: number
          window_minutes: number
        }
        Update: {
          created_at?: string | null
          id?: string
          is_enabled?: boolean
          kind?: string
          org_id?: string
          threshold?: number
          window_minutes?: number
        }
        Relationships: [
          {
            foreignKeyName: "alert_rules_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      alerts: {
        Row: {
          acked_at: string | null
          acked_by: string | null
          id: string
          kind: string
          meta: Json | null
          org_id: string
          rule_id: string | null
          triggered_at: string
          value: number
        }
        Insert: {
          acked_at?: string | null
          acked_by?: string | null
          id?: string
          kind: string
          meta?: Json | null
          org_id: string
          rule_id?: string | null
          triggered_at?: string
          value: number
        }
        Update: {
          acked_at?: string | null
          acked_by?: string | null
          id?: string
          kind?: string
          meta?: Json | null
          org_id?: string
          rule_id?: string | null
          triggered_at?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "alerts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "alert_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      channel_agents: {
        Row: {
          channel_id: string
          user_id: string
        }
        Insert: {
          channel_id: string
          user_id: string
        }
        Update: {
          channel_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_agents_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_agents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_users"
            referencedColumns: ["id"]
          },
        ]
      }
      channels: {
        Row: {
          ai_profile_id: string | null
          created_at: string
          credentials: Json | null
          display_name: string | null
          external_id: string | null
          id: string
          is_active: boolean | null
          org_id: string
          profile_photo_url: string | null
          provider: Database["public"]["Enums"]["channel_type"]
          secret_token: string | null
          type: string
        }
        Insert: {
          ai_profile_id?: string | null
          created_at?: string
          credentials?: Json | null
          display_name?: string | null
          external_id?: string | null
          id?: string
          is_active?: boolean | null
          org_id: string
          profile_photo_url?: string | null
          provider: Database["public"]["Enums"]["channel_type"]
          secret_token?: string | null
          type: string
        }
        Update: {
          ai_profile_id?: string | null
          created_at?: string
          credentials?: Json | null
          display_name?: string | null
          external_id?: string | null
          id?: string
          is_active?: boolean | null
          org_id?: string
          profile_photo_url?: string | null
          provider?: Database["public"]["Enums"]["channel_type"]
          secret_token?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "channels_ai_profile_id_fkey"
            columns: ["ai_profile_id"]
            isOneToOne: false
            referencedRelation: "ai_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channels_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_identities: {
        Row: {
          channel_id: string
          contact_id: string
          external_id: string
          id: string
          org_id: string
        }
        Insert: {
          channel_id: string
          contact_id: string
          external_id: string
          id?: string
          org_id: string
        }
        Update: {
          channel_id?: string
          contact_id?: string
          external_id?: string
          id?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_identities_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_identities_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_identities_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_labels: {
        Row: {
          contact_id: string
          label_id: string
        }
        Insert: {
          contact_id: string
          label_id: string
        }
        Update: {
          contact_id?: string
          label_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_labels_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_labels_label_id_fkey"
            columns: ["label_id"]
            isOneToOne: false
            referencedRelation: "labels"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          created_at: string
          email: string | null
          external_id: string | null
          id: string
          locale: string | null
          name: string | null
          notes: string | null
          org_id: string
          phone: string | null
          stage_id: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          external_id?: string | null
          id?: string
          locale?: string | null
          name?: string | null
          notes?: string | null
          org_id: string
          phone?: string | null
          stage_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          external_id?: string | null
          id?: string
          locale?: string | null
          name?: string | null
          notes?: string | null
          org_id?: string
          phone?: string | null
          stage_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      csat_responses: {
        Row: {
          created_at: string
          feedback: string | null
          id: string
          message_id: string | null
          org_id: string
          score: number | null
          thread_id: string | null
        }
        Insert: {
          created_at?: string
          feedback?: string | null
          id?: string
          message_id?: string | null
          org_id: string
          score?: number | null
          thread_id?: string | null
        }
        Update: {
          created_at?: string
          feedback?: string | null
          id?: string
          message_id?: string | null
          org_id?: string
          score?: number | null
          thread_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "csat_responses_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      labels: {
        Row: {
          color: string | null
          id: string
          name: string
          org_id: string
          scope: Database["public"]["Enums"]["label_scope"]
        }
        Insert: {
          color?: string | null
          id?: string
          name: string
          org_id: string
          scope: Database["public"]["Enums"]["label_scope"]
        }
        Update: {
          color?: string | null
          id?: string
          name?: string
          org_id?: string
          scope?: Database["public"]["Enums"]["label_scope"]
        }
        Relationships: [
          {
            foreignKeyName: "labels_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          actor_id: string | null
          actor_kind: string | null
          body: string | null
          created_at: string
          direction: Database["public"]["Enums"]["message_direction"] | null
          edit_reason: string | null
          edited_at: string | null
          id: string
          in_reply_to: string | null
          payload: Json | null
          role: Database["public"]["Enums"]["message_role"]
          seq: number
          thread_id: string
          type: Database["public"]["Enums"]["message_type"]
        }
        Insert: {
          actor_id?: string | null
          actor_kind?: string | null
          body?: string | null
          created_at?: string
          direction?: Database["public"]["Enums"]["message_direction"] | null
          edit_reason?: string | null
          edited_at?: string | null
          id?: string
          in_reply_to?: string | null
          payload?: Json | null
          role?: Database["public"]["Enums"]["message_role"]
          seq?: number
          thread_id: string
          type?: Database["public"]["Enums"]["message_type"]
        }
        Update: {
          actor_id?: string | null
          actor_kind?: string | null
          body?: string | null
          created_at?: string
          direction?: Database["public"]["Enums"]["message_direction"] | null
          edit_reason?: string | null
          edited_at?: string | null
          id?: string
          in_reply_to?: string | null
          payload?: Json | null
          role?: Database["public"]["Enums"]["message_role"]
          seq?: number
          thread_id?: string
          type?: Database["public"]["Enums"]["message_type"]
        }
        Relationships: [
          {
            foreignKeyName: "messages_in_reply_to_fkey"
            columns: ["in_reply_to"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "threads"
            referencedColumns: ["id"]
          },
        ]
      }
      n8n_chat_histories: {
        Row: {
          id: number
          message: Json
          session_id: string
        }
        Insert: {
          id?: number
          message: Json
          session_id: string
        }
        Update: {
          id?: number
          message?: Json
          session_id?: string
        }
        Relationships: []
      }
      openai_usage_snapshots: {
        Row: {
          captured_at: string
          end_date: string
          id: number
          input_tokens: number
          output_tokens: number
          range_label: string
          raw: Json
          start_date: string
          total_tokens: number
        }
        Insert: {
          captured_at?: string
          end_date: string
          id?: number
          input_tokens?: number
          output_tokens?: number
          range_label: string
          raw?: Json
          start_date: string
          total_tokens?: number
        }
        Update: {
          captured_at?: string
          end_date?: string
          id?: number
          input_tokens?: number
          output_tokens?: number
          range_label?: string
          raw?: Json
          start_date?: string
          total_tokens?: number
        }
        Relationships: []
      }
      org_members: {
        Row: {
          created_at: string
          org_id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          org_id: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          org_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_members_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_users"
            referencedColumns: ["id"]
          },
        ]
      }
      org_settings: {
        Row: {
          ai_default_profile_id: string | null
          created_at: string
          default_locale: string | null
          org_id: string
          retention_days: number | null
        }
        Insert: {
          ai_default_profile_id?: string | null
          created_at?: string
          default_locale?: string | null
          org_id: string
          retention_days?: number | null
        }
        Update: {
          ai_default_profile_id?: string | null
          created_at?: string
          default_locale?: string | null
          org_id?: string
          retention_days?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "org_settings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      orgs: {
        Row: {
          created_at: string
          id: string
          name: string
          plan: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          plan?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          plan?: string | null
        }
        Relationships: []
      }
      permissions: {
        Row: {
          action: string
          created_at: string | null
          id: string
          name: string
          resource: string
        }
        Insert: {
          action: string
          created_at?: string | null
          id?: string
          name: string
          resource: string
        }
        Update: {
          action?: string
          created_at?: string | null
          id?: string
          name?: string
          resource?: string
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          created_at: string | null
          permission_id: string
          role_id: string
        }
        Insert: {
          created_at?: string | null
          permission_id: string
          role_id: string
        }
        Update: {
          created_at?: string | null
          permission_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "v_current_user_permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      thread_collaborators: {
        Row: {
          added_at: string
          thread_id: string
          user_id: string
        }
        Insert: {
          added_at?: string
          thread_id: string
          user_id: string
        }
        Update: {
          added_at?: string
          thread_id?: string
          user_id?: string
        }
        Relationships: []
      }
      threads: {
        Row: {
          additional_data: Json
          ai_access_enabled: boolean
          ai_handoff_at: string | null
          assigned_at: string | null
          assigned_by_user_id: string | null
          assignee_user_id: string | null
          channel_id: string
          contact_id: string
          created_at: string
          id: string
          is_blocked: boolean
          last_msg_at: string
          notes: string | null
          org_id: string
          resolved_at: string | null
          resolved_by_user_id: string | null
          status: Database["public"]["Enums"]["thread_status"]
        }
        Insert: {
          additional_data?: Json
          ai_access_enabled?: boolean
          ai_handoff_at?: string | null
          assigned_at?: string | null
          assigned_by_user_id?: string | null
          assignee_user_id?: string | null
          channel_id: string
          contact_id: string
          created_at?: string
          id?: string
          is_blocked?: boolean
          last_msg_at?: string
          notes?: string | null
          org_id: string
          resolved_at?: string | null
          resolved_by_user_id?: string | null
          status?: Database["public"]["Enums"]["thread_status"]
        }
        Update: {
          additional_data?: Json
          ai_access_enabled?: boolean
          ai_handoff_at?: string | null
          assigned_at?: string | null
          assigned_by_user_id?: string | null
          assignee_user_id?: string | null
          channel_id?: string
          contact_id?: string
          created_at?: string
          id?: string
          is_blocked?: boolean
          last_msg_at?: string
          notes?: string | null
          org_id?: string
          resolved_at?: string | null
          resolved_by_user_id?: string | null
          status?: Database["public"]["Enums"]["thread_status"]
        }
        Relationships: [
          {
            foreignKeyName: "threads_assignee_user_id_fkey"
            columns: ["assignee_user_id"]
            isOneToOne: false
            referencedRelation: "v_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "threads_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "threads_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "threads_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      token_balances: {
        Row: {
          balance_tokens: number
          org_id: string
          updated_at: string | null
        }
        Insert: {
          balance_tokens?: number
          org_id: string
          updated_at?: string | null
        }
        Update: {
          balance_tokens?: number
          org_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "token_balances_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      token_topups: {
        Row: {
          amount_tokens: number
          created_at: string | null
          created_by: string | null
          id: string
          org_id: string
          reason: string | null
        }
        Insert: {
          amount_tokens: number
          created_at?: string | null
          created_by?: string | null
          id?: string
          org_id: string
          reason?: string | null
        }
        Update: {
          amount_tokens?: number
          created_at?: string | null
          created_by?: string | null
          id?: string
          org_id?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "token_topups_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "token_topups_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      token_usage_logs: {
        Row: {
          completion_tokens: number
          error_code: string | null
          id: string
          made_at: string
          meta: Json | null
          model: string
          org_id: string
          prompt_tokens: number
          provider: string
          status: string
          thread_id: string | null
          total_tokens: number
          user_id: string | null
        }
        Insert: {
          completion_tokens: number
          error_code?: string | null
          id?: string
          made_at?: string
          meta?: Json | null
          model: string
          org_id: string
          prompt_tokens: number
          provider?: string
          status?: string
          thread_id?: string | null
          total_tokens: number
          user_id?: string | null
        }
        Update: {
          completion_tokens?: number
          error_code?: string | null
          id?: string
          made_at?: string
          meta?: Json | null
          model?: string
          org_id?: string
          prompt_tokens?: number
          provider?: string
          status?: string
          thread_id?: string | null
          total_tokens?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "token_usage_logs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "token_usage_logs_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "threads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "token_usage_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          role_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          role_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          role_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_users"
            referencedColumns: ["id"]
          },
        ]
      }
      users_profile: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          max_tokens_per_day: number
          max_tokens_per_month: number
          timezone: string | null
          token_limit_enabled: boolean
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          max_tokens_per_day?: number
          max_tokens_per_month?: number
          timezone?: string | null
          token_limit_enabled?: boolean
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          max_tokens_per_day?: number
          max_tokens_per_month?: number
          timezone?: string | null
          token_limit_enabled?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "users_profile_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "v_users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_current_user_permissions: {
        Row: {
          action: string | null
          created_at: string | null
          id: string | null
          name: string | null
          resource: string | null
        }
        Relationships: []
      }
      v_users: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          display_name: string | null
          email: string | null
          id: string | null
          roles: string[] | null
          timezone: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      binary_quantize: {
        Args: { "": string } | { "": unknown }
        Returns: unknown
      }
      grant_role_permission: {
        Args: { p_perm: string; p_role: string }
        Returns: undefined
      }
      halfvec_avg: {
        Args: { "": number[] }
        Returns: unknown
      }
      halfvec_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      halfvec_send: {
        Args: { "": unknown }
        Returns: string
      }
      halfvec_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
      has_perm: {
        Args: { p_action: string; p_resource: string }
        Returns: boolean
      }
      hnsw_bit_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnsw_halfvec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnsw_sparsevec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnswhandler: {
        Args: { "": unknown }
        Returns: unknown
      }
      ivfflat_bit_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      ivfflat_halfvec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      ivfflathandler: {
        Args: { "": unknown }
        Returns: unknown
      }
      l2_norm: {
        Args: { "": unknown } | { "": unknown }
        Returns: number
      }
      l2_normalize: {
        Args: { "": string } | { "": unknown } | { "": unknown }
        Returns: string
      }
      revoke_role_permission: {
        Args: { p_perm: string; p_role: string }
        Returns: undefined
      }
      sparsevec_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      sparsevec_send: {
        Args: { "": unknown }
        Returns: string
      }
      sparsevec_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
      takeover_thread: {
        Args: { p_thread_id: string }
        Returns: undefined
      }
      vector_avg: {
        Args: { "": number[] }
        Returns: string
      }
      vector_dims: {
        Args: { "": string } | { "": unknown }
        Returns: number
      }
      vector_norm: {
        Args: { "": string }
        Returns: number
      }
      vector_out: {
        Args: { "": string }
        Returns: unknown
      }
      vector_send: {
        Args: { "": string }
        Returns: string
      }
      vector_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
    }
    Enums: {
      channel_type: "whatsapp" | "web" | "telegram"
      label_scope: "contact" | "thread"
      message_direction: "in" | "out"
      message_role: "user" | "assistant" | "agent" | "system"
      message_type: "text" | "image" | "file" | "voice" | "event" | "note"
      thread_status: "open" | "pending" | "closed"
      user_role: "agent" | "supervisor" | "super_agent"
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
      channel_type: ["whatsapp", "web", "telegram"],
      label_scope: ["contact", "thread"],
      message_direction: ["in", "out"],
      message_role: ["user", "assistant", "agent", "system"],
      message_type: ["text", "image", "file", "voice", "event", "note"],
      thread_status: ["open", "pending", "closed"],
      user_role: ["agent", "supervisor", "super_agent"],
    },
  },
} as const
