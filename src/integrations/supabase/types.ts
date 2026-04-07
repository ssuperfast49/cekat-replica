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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      ai_models: {
        Row: {
          cost_per_1m_tokens: number | null
          created_at: string | null
          description: string | null
          display_name: string
          id: string
          input_cost_per_1m: number | null
          is_active: boolean | null
          is_fallback: boolean | null
          latency_ms: number | null
          max_context_tokens: number | null
          model_name: string
          output_cost_per_1m: number | null
          priority: number | null
          provider: string
          temperature: number | null
          updated_at: string | null
        }
        Insert: {
          cost_per_1m_tokens?: number | null
          created_at?: string | null
          description?: string | null
          display_name: string
          id?: string
          input_cost_per_1m?: number | null
          is_active?: boolean | null
          is_fallback?: boolean | null
          latency_ms?: number | null
          max_context_tokens?: number | null
          model_name: string
          output_cost_per_1m?: number | null
          priority?: number | null
          provider: string
          temperature?: number | null
          updated_at?: string | null
        }
        Update: {
          cost_per_1m_tokens?: number | null
          created_at?: string | null
          description?: string | null
          display_name?: string
          id?: string
          input_cost_per_1m?: number | null
          is_active?: boolean | null
          is_fallback?: boolean | null
          latency_ms?: number | null
          max_context_tokens?: number | null
          model_name?: string
          output_cost_per_1m?: number | null
          priority?: number | null
          provider?: string
          temperature?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      ai_profiles: {
        Row: {
          auto_resolve_after_minutes: number
          context_limit: number
          created_at: string
          description: string | null
          enable_followup_assigned: boolean | null
          enable_followup_message: boolean | null
          enable_resolve: boolean
          followup_delay_assigned: number | null
          followup_message: string | null
          followup_message_delay: number | null
          guide_content: string | null
          history_limit: number
          id: string
          message_await: number
          message_limit: number
          model_id: string
          name: string
          org_id: string
          qna: Json
          read_file_limit: number
          response_temperature: string | null
          stop_ai_after_handoff: boolean | null
          super_agent_id: string | null
          system_prompt: string | null
          transfer_conditions: string | null
          welcome_message: string | null
        }
        Insert: {
          auto_resolve_after_minutes?: number
          context_limit?: number
          created_at?: string
          description?: string | null
          enable_followup_assigned?: boolean | null
          enable_followup_message?: boolean | null
          enable_resolve?: boolean
          followup_delay_assigned?: number | null
          followup_message?: string | null
          followup_message_delay?: number | null
          guide_content?: string | null
          history_limit?: number
          id?: string
          message_await?: number
          message_limit?: number
          model_id?: string
          name: string
          org_id: string
          qna?: Json
          read_file_limit?: number
          response_temperature?: string | null
          stop_ai_after_handoff?: boolean | null
          super_agent_id?: string | null
          system_prompt?: string | null
          transfer_conditions?: string | null
          welcome_message?: string | null
        }
        Update: {
          auto_resolve_after_minutes?: number
          context_limit?: number
          created_at?: string
          description?: string | null
          enable_followup_assigned?: boolean | null
          enable_followup_message?: boolean | null
          enable_resolve?: boolean
          followup_delay_assigned?: number | null
          followup_message?: string | null
          followup_message_delay?: number | null
          guide_content?: string | null
          history_limit?: number
          id?: string
          message_await?: number
          message_limit?: number
          model_id?: string
          name?: string
          org_id?: string
          qna?: Json
          read_file_limit?: number
          response_temperature?: string | null
          stop_ai_after_handoff?: boolean | null
          super_agent_id?: string | null
          system_prompt?: string | null
          transfer_conditions?: string | null
          welcome_message?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_profiles_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "ai_models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_profiles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_profiles_super_agent_id_fkey"
            columns: ["super_agent_id"]
            isOneToOne: false
            referencedRelation: "users_profile"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "ai_profiles_super_agent_id_fkey"
            columns: ["super_agent_id"]
            isOneToOne: false
            referencedRelation: "v_human_agents"
            referencedColumns: ["user_id"]
          },
        ]
      }
      ai_wallet_topups: {
        Row: {
          amount_usd: number
          created_at: string
          created_by: string | null
          id: string
          org_id: string
          provider: string
        }
        Insert: {
          amount_usd: number
          created_at?: string
          created_by?: string | null
          id?: string
          org_id: string
          provider?: string
        }
        Update: {
          amount_usd?: number
          created_at?: string
          created_by?: string | null
          id?: string
          org_id?: string
          provider?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_wallet_topups_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_wallet_topups_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_wallets: {
        Row: {
          balance_usd: number
          battery_100_usd: number
          created_at: string
          id: string
          org_id: string
          provider: string
          updated_at: string
        }
        Insert: {
          balance_usd?: number
          battery_100_usd?: number
          created_at?: string
          id?: string
          org_id: string
          provider?: string
          updated_at?: string
        }
        Update: {
          balance_usd?: number
          battery_100_usd?: number
          created_at?: string
          id?: string
          org_id?: string
          provider?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_wallets_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
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
      audit_logs: {
        Row: {
          action: string
          context: Json
          created_at: string
          id: string
          ip: string | null
          org_id: string
          resource: string
          resource_id: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          context?: Json
          created_at?: string
          id?: string
          ip?: string | null
          org_id: string
          resource: string
          resource_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          context?: Json
          created_at?: string
          id?: string
          ip?: string | null
          org_id?: string
          resource?: string
          resource_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_org_fk"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      bundle_permissions: {
        Row: {
          bundle_id: string
          created_at: string
          permission_id: string
        }
        Insert: {
          bundle_id: string
          created_at?: string
          permission_id: string
        }
        Update: {
          bundle_id?: string
          created_at?: string
          permission_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bundle_permissions_bundle_id_fkey"
            columns: ["bundle_id"]
            isOneToOne: false
            referencedRelation: "permission_bundles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bundle_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
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
            foreignKeyName: "channel_agents_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "v_channels_with_agents"
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
      channel_status_counts: {
        Row: {
          channel_id: string
          count: number | null
          status: string
        }
        Insert: {
          channel_id: string
          count?: number | null
          status: string
        }
        Update: {
          channel_id?: string
          count?: number | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_status_counts_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_status_counts_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "v_channels_with_agents"
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
          logo_url: string | null
          org_id: string
          profile_photo_url: string | null
          provider: Database["public"]["Enums"]["channel_type"]
          secret_token: string | null
          super_agent_id: string | null
          type: string
          website_id: string | null
        }
        Insert: {
          ai_profile_id?: string | null
          created_at?: string
          credentials?: Json | null
          display_name?: string | null
          external_id?: string | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          org_id: string
          profile_photo_url?: string | null
          provider: Database["public"]["Enums"]["channel_type"]
          secret_token?: string | null
          super_agent_id?: string | null
          type: string
          website_id?: string | null
        }
        Update: {
          ai_profile_id?: string | null
          created_at?: string
          credentials?: Json | null
          display_name?: string | null
          external_id?: string | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          org_id?: string
          profile_photo_url?: string | null
          provider?: Database["public"]["Enums"]["channel_type"]
          secret_token?: string | null
          super_agent_id?: string | null
          type?: string
          website_id?: string | null
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
          {
            foreignKeyName: "channels_super_agent_id_fkey"
            columns: ["super_agent_id"]
            isOneToOne: false
            referencedRelation: "users_profile"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "channels_super_agent_id_fkey"
            columns: ["super_agent_id"]
            isOneToOne: false
            referencedRelation: "v_human_agents"
            referencedColumns: ["user_id"]
          },
        ]
      }
      contact_informations: {
        Row: {
          account_name: string | null
          account_number: string | null
          bank_name: string | null
          contact_id: string
          created_at: string
          email: string | null
          id: string
          name: string | null
          phone_number: string | null
          username: string | null
          website: string | null
        }
        Insert: {
          account_name?: string | null
          account_number?: string | null
          bank_name?: string | null
          contact_id: string
          created_at?: string
          email?: string | null
          id?: string
          name?: string | null
          phone_number?: string | null
          username?: string | null
          website?: string | null
        }
        Update: {
          account_name?: string | null
          account_number?: string | null
          bank_name?: string | null
          contact_id?: string
          created_at?: string
          email?: string | null
          id?: string
          name?: string | null
          phone_number?: string | null
          username?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contact_informations_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: true
            referencedRelation: "contacts"
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
          super_agent_id: string | null
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
          super_agent_id?: string | null
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
          super_agent_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_super_agent_id_fkey"
            columns: ["super_agent_id"]
            isOneToOne: false
            referencedRelation: "v_users"
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
      debug_events: {
        Row: {
          details: Json | null
          event_timestamp: string | null
          event_type: string | null
          id: string
          user_id: string | null
        }
        Insert: {
          details?: Json | null
          event_timestamp?: string | null
          event_type?: string | null
          id?: string
          user_id?: string | null
        }
        Update: {
          details?: Json | null
          event_timestamp?: string | null
          event_type?: string | null
          id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      documents: {
        Row: {
          content: string | null
          embedding: string | null
          file_id: string | null
          fts: unknown
          id: number
          metadata: Json | null
        }
        Insert: {
          content?: string | null
          embedding?: string | null
          file_id?: string | null
          fts?: unknown
          id?: number
          metadata?: Json | null
        }
        Update: {
          content?: string | null
          embedding?: string | null
          file_id?: string | null
          fts?: unknown
          id?: number
          metadata?: Json | null
        }
        Relationships: []
      }
      files: {
        Row: {
          ai_profile_id: string | null
          bucket: string
          byte_size: number | null
          checksum: string | null
          created_at: string
          filename: string
          id: string
          is_enabled: boolean | null
          mime_type: string | null
          org_id: string
          path: string
          uploaded_by: string | null
        }
        Insert: {
          ai_profile_id?: string | null
          bucket: string
          byte_size?: number | null
          checksum?: string | null
          created_at?: string
          filename: string
          id?: string
          is_enabled?: boolean | null
          mime_type?: string | null
          org_id: string
          path: string
          uploaded_by?: string | null
        }
        Update: {
          ai_profile_id?: string | null
          bucket?: string
          byte_size?: number | null
          checksum?: string | null
          created_at?: string
          filename?: string
          id?: string
          is_enabled?: boolean | null
          mime_type?: string | null
          org_id?: string
          path?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "files_ai_profile_id_fkey"
            columns: ["ai_profile_id"]
            isOneToOne: false
            referencedRelation: "ai_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "files_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "files_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "v_users"
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
            referencedRelation: "conversation_list_view"
            referencedColumns: ["last_message_id"]
          },
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
            referencedRelation: "conversation_list_view"
            referencedColumns: ["thread_id"]
          },
          {
            foreignKeyName: "messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "thread_header_view"
            referencedColumns: ["thread_id"]
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
      n8n_webhook_routes: {
        Row: {
          enabled: boolean
          key_version: number
          n8n_url: string
          route_key: string
          secret_current: string
          updated_at: string
        }
        Insert: {
          enabled?: boolean
          key_version?: number
          n8n_url: string
          route_key: string
          secret_current: string
          updated_at?: string
        }
        Update: {
          enabled?: boolean
          key_version?: number
          n8n_url?: string
          route_key?: string
          secret_current?: string
          updated_at?: string
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
          ai_paused: boolean
          ai_paused_at: string | null
          ai_paused_by_user_id: string | null
          ai_paused_reason: string | null
          created_at: string
          default_locale: string | null
          org_id: string
          retention_days: number | null
        }
        Insert: {
          ai_default_profile_id?: string | null
          ai_paused?: boolean
          ai_paused_at?: string | null
          ai_paused_by_user_id?: string | null
          ai_paused_reason?: string | null
          created_at?: string
          default_locale?: string | null
          org_id: string
          retention_days?: number | null
        }
        Update: {
          ai_default_profile_id?: string | null
          ai_paused?: boolean
          ai_paused_at?: string | null
          ai_paused_by_user_id?: string | null
          ai_paused_reason?: string | null
          created_at?: string
          default_locale?: string | null
          org_id?: string
          retention_days?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "org_settings_ai_paused_by_user_id_fkey"
            columns: ["ai_paused_by_user_id"]
            isOneToOne: false
            referencedRelation: "users_profile"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "org_settings_ai_paused_by_user_id_fkey"
            columns: ["ai_paused_by_user_id"]
            isOneToOne: false
            referencedRelation: "v_human_agents"
            referencedColumns: ["user_id"]
          },
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
      permission_bundles: {
        Row: {
          created_at: string
          description: string | null
          id: string
          key: string
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          key: string
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          key?: string
          name?: string
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
      rbac_policies: {
        Row: {
          created_at: string
          policy: Json
          role_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          policy?: Json
          role_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          policy?: Json
          role_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rbac_policies_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: true
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rbac_policies_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: true
            referencedRelation: "v_human_agents"
            referencedColumns: ["role_id"]
          },
        ]
      }
      role_bundles: {
        Row: {
          bundle_id: string
          created_at: string
          role_id: string
        }
        Insert: {
          bundle_id: string
          created_at?: string
          role_id: string
        }
        Update: {
          bundle_id?: string
          created_at?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_bundles_bundle_id_fkey"
            columns: ["bundle_id"]
            isOneToOne: false
            referencedRelation: "permission_bundles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_bundles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_bundles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "v_human_agents"
            referencedColumns: ["role_id"]
          },
        ]
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
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "v_human_agents"
            referencedColumns: ["role_id"]
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
      super_agent_members: {
        Row: {
          agent_user_id: string
          created_at: string
          id: string
          org_id: string
          super_agent_id: string
        }
        Insert: {
          agent_user_id: string
          created_at?: string
          id?: string
          org_id: string
          super_agent_id: string
        }
        Update: {
          agent_user_id?: string
          created_at?: string
          id?: string
          org_id?: string
          super_agent_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "super_agent_members_agent_user_id_fkey"
            columns: ["agent_user_id"]
            isOneToOne: false
            referencedRelation: "v_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "super_agent_members_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "super_agent_members_super_agent_id_fkey"
            columns: ["super_agent_id"]
            isOneToOne: false
            referencedRelation: "v_users"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_deletions: {
        Row: {
          created_at: string
          id: number
          payload: Json
          processed_at: string | null
          table_name: string
        }
        Insert: {
          created_at?: string
          id?: number
          payload: Json
          processed_at?: string | null
          table_name: string
        }
        Update: {
          created_at?: string
          id?: number
          payload?: Json
          processed_at?: string | null
          table_name?: string
        }
        Relationships: []
      }
      thread_reads: {
        Row: {
          last_read_at: string | null
          last_read_seq: number
          thread_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          last_read_at?: string | null
          last_read_seq?: number
          thread_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          last_read_at?: string | null
          last_read_seq?: number
          thread_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "thread_reads_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "conversation_list_view"
            referencedColumns: ["thread_id"]
          },
          {
            foreignKeyName: "thread_reads_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "thread_header_view"
            referencedColumns: ["thread_id"]
          },
          {
            foreignKeyName: "thread_reads_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "threads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "thread_reads_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_users"
            referencedColumns: ["id"]
          },
        ]
      }
      threads: {
        Row: {
          account_id: string | null
          additional_data: Json
          ai_access_enabled: boolean
          ai_handoff_at: string | null
          assigned_at: string | null
          assigned_by_user_id: string | null
          assignee_user_id: string | null
          auto_resolve_at: string | null
          blocked_until: string | null
          channel_id: string
          collaborator_user_id: string | null
          contact_id: string | null
          created_at: string
          end_reason: string | null
          followup_at: string | null
          handover_reason: string | null
          id: string
          is_blocked: boolean
          is_followup_sent: boolean | null
          last_message_body: string | null
          last_message_direction:
            | Database["public"]["Enums"]["message_direction"]
            | null
          last_message_role: Database["public"]["Enums"]["message_role"] | null
          last_msg_at: string
          notes: string | null
          org_id: string
          resolution: string | null
          resolved_at: string | null
          resolved_by_user_id: string | null
          status: Database["public"]["Enums"]["thread_status"]
        }
        Insert: {
          account_id?: string | null
          additional_data?: Json
          ai_access_enabled?: boolean
          ai_handoff_at?: string | null
          assigned_at?: string | null
          assigned_by_user_id?: string | null
          assignee_user_id?: string | null
          auto_resolve_at?: string | null
          blocked_until?: string | null
          channel_id: string
          collaborator_user_id?: string | null
          contact_id?: string | null
          created_at?: string
          end_reason?: string | null
          followup_at?: string | null
          handover_reason?: string | null
          id?: string
          is_blocked?: boolean
          is_followup_sent?: boolean | null
          last_message_body?: string | null
          last_message_direction?:
            | Database["public"]["Enums"]["message_direction"]
            | null
          last_message_role?: Database["public"]["Enums"]["message_role"] | null
          last_msg_at?: string
          notes?: string | null
          org_id: string
          resolution?: string | null
          resolved_at?: string | null
          resolved_by_user_id?: string | null
          status?: Database["public"]["Enums"]["thread_status"]
        }
        Update: {
          account_id?: string | null
          additional_data?: Json
          ai_access_enabled?: boolean
          ai_handoff_at?: string | null
          assigned_at?: string | null
          assigned_by_user_id?: string | null
          assignee_user_id?: string | null
          auto_resolve_at?: string | null
          blocked_until?: string | null
          channel_id?: string
          collaborator_user_id?: string | null
          contact_id?: string | null
          created_at?: string
          end_reason?: string | null
          followup_at?: string | null
          handover_reason?: string | null
          id?: string
          is_blocked?: boolean
          is_followup_sent?: boolean | null
          last_message_body?: string | null
          last_message_direction?:
            | Database["public"]["Enums"]["message_direction"]
            | null
          last_message_role?: Database["public"]["Enums"]["message_role"] | null
          last_msg_at?: string
          notes?: string | null
          org_id?: string
          resolution?: string | null
          resolved_at?: string | null
          resolved_by_user_id?: string | null
          status?: Database["public"]["Enums"]["thread_status"]
        }
        Relationships: [
          {
            foreignKeyName: "threads_assigned_by_user_id_fkey"
            columns: ["assigned_by_user_id"]
            isOneToOne: false
            referencedRelation: "v_users"
            referencedColumns: ["id"]
          },
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
            foreignKeyName: "threads_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "v_channels_with_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "threads_collaborator_user_id_fkey"
            columns: ["collaborator_user_id"]
            isOneToOne: false
            referencedRelation: "v_users"
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
          {
            foreignKeyName: "threads_resolved_by_user_id_fkey"
            columns: ["resolved_by_user_id"]
            isOneToOne: false
            referencedRelation: "v_users"
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
          channel_id: string | null
          completion_tokens: number
          cost_usd: number | null
          error_code: string | null
          id: string
          made_at: string
          message_id: string | null
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
          channel_id?: string | null
          completion_tokens: number
          cost_usd?: number | null
          error_code?: string | null
          id?: string
          made_at?: string
          message_id?: string | null
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
          channel_id?: string | null
          completion_tokens?: number
          cost_usd?: number | null
          error_code?: string | null
          id?: string
          made_at?: string
          message_id?: string | null
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
            foreignKeyName: "token_usage_logs_channel_fk"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "token_usage_logs_channel_fk"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "v_channels_with_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "token_usage_logs_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "conversation_list_view"
            referencedColumns: ["last_message_id"]
          },
          {
            foreignKeyName: "token_usage_logs_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
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
            referencedRelation: "conversation_list_view"
            referencedColumns: ["thread_id"]
          },
          {
            foreignKeyName: "token_usage_logs_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "thread_header_view"
            referencedColumns: ["thread_id"]
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
      twofa_challenges: {
        Row: {
          channel: string
          code_hash: string
          consumed_at: string | null
          expires_at: string
          id: string
          sent_at: string
          user_id: string
        }
        Insert: {
          channel: string
          code_hash: string
          consumed_at?: string | null
          expires_at: string
          id?: string
          sent_at?: string
          user_id: string
        }
        Update: {
          channel?: string
          code_hash?: string
          consumed_at?: string | null
          expires_at?: string
          id?: string
          sent_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "twofa_challenges_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_users"
            referencedColumns: ["id"]
          },
        ]
      }
      twofa_sessions: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "twofa_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_invites: {
        Row: {
          accepted_at: string | null
          assigned_super_agent_id: string | null
          created_at: string | null
          email: string | null
          expires_at: string | null
          id: string
          invited_by: string | null
          metadata: Json | null
          org_id: string | null
          phone: string | null
          role_id: string | null
          status: string | null
          token: string
          updated_at: string | null
        }
        Insert: {
          accepted_at?: string | null
          assigned_super_agent_id?: string | null
          created_at?: string | null
          email?: string | null
          expires_at?: string | null
          id?: string
          invited_by?: string | null
          metadata?: Json | null
          org_id?: string | null
          phone?: string | null
          role_id?: string | null
          status?: string | null
          token: string
          updated_at?: string | null
        }
        Update: {
          accepted_at?: string | null
          assigned_super_agent_id?: string | null
          created_at?: string | null
          email?: string | null
          expires_at?: string | null
          id?: string
          invited_by?: string | null
          metadata?: Json | null
          org_id?: string | null
          phone?: string | null
          role_id?: string | null
          status?: string | null
          token?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_invites_assigned_super_agent_id_fkey"
            columns: ["assigned_super_agent_id"]
            isOneToOne: false
            referencedRelation: "v_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_invites_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "users_profile"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "user_invites_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "v_human_agents"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "user_invites_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_invites_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_invites_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "v_human_agents"
            referencedColumns: ["role_id"]
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
            foreignKeyName: "user_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "v_human_agents"
            referencedColumns: ["role_id"]
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
          confirmed_at: string | null
          created_at: string
          daily_reset_at: string | null
          daily_used_tokens: number
          display_name: string | null
          email: string | null
          invited_at: string | null
          is_2fa_email_enabled: boolean | null
          is_active: boolean
          last_seen_at: string | null
          last_sign_in_at: string | null
          max_tokens_per_day: number
          max_tokens_per_month: number
          monthly_reset_at: string | null
          monthly_used_tokens: number
          org_id: string | null
          password_set: boolean | null
          timezone: string | null
          token_limit_enabled: boolean
          used_tokens: number
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          confirmed_at?: string | null
          created_at?: string
          daily_reset_at?: string | null
          daily_used_tokens?: number
          display_name?: string | null
          email?: string | null
          invited_at?: string | null
          is_2fa_email_enabled?: boolean | null
          is_active?: boolean
          last_seen_at?: string | null
          last_sign_in_at?: string | null
          max_tokens_per_day?: number
          max_tokens_per_month?: number
          monthly_reset_at?: string | null
          monthly_used_tokens?: number
          org_id?: string | null
          password_set?: boolean | null
          timezone?: string | null
          token_limit_enabled?: boolean
          used_tokens?: number
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          confirmed_at?: string | null
          created_at?: string
          daily_reset_at?: string | null
          daily_used_tokens?: number
          display_name?: string | null
          email?: string | null
          invited_at?: string | null
          is_2fa_email_enabled?: boolean | null
          is_active?: boolean
          last_seen_at?: string | null
          last_sign_in_at?: string | null
          max_tokens_per_day?: number
          max_tokens_per_month?: number
          monthly_reset_at?: string | null
          monthly_used_tokens?: number
          org_id?: string | null
          password_set?: boolean | null
          timezone?: string | null
          token_limit_enabled?: boolean
          used_tokens?: number
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
      conversation_list_view: {
        Row: {
          assigned_user_avatar_url: string | null
          assigned_user_display_name: string | null
          assigned_user_id: string | null
          channel_display_name: string | null
          channel_id: string | null
          channel_type: string | null
          contact_display_name: string | null
          contact_id: string | null
          last_message_created_at: string | null
          last_message_direction:
            | Database["public"]["Enums"]["message_direction"]
            | null
          last_message_id: string | null
          last_message_sender_type: string | null
          last_message_snippet: string | null
          sort_timestamp: string | null
          thread_id: string | null
          thread_status: Database["public"]["Enums"]["thread_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "threads_assignee_user_id_fkey"
            columns: ["assigned_user_id"]
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
            foreignKeyName: "threads_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "v_channels_with_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "threads_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      thread_header_view: {
        Row: {
          assigned_at: string | null
          assigned_user_avatar_url: string | null
          assigned_user_display_name: string | null
          assigned_user_id: string | null
          channel_display_name: string | null
          channel_id: string | null
          channel_type: string | null
          contact_display_name: string | null
          contact_email: string | null
          contact_id: string | null
          contact_phone: string | null
          resolved_at: string | null
          thread_created_at: string | null
          thread_id: string | null
          thread_last_msg_at: string | null
          thread_status: Database["public"]["Enums"]["thread_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "threads_assignee_user_id_fkey"
            columns: ["assigned_user_id"]
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
            foreignKeyName: "threads_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "v_channels_with_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "threads_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      v_channels_with_agents: {
        Row: {
          ai_profile_id: string | null
          created_at: string | null
          credentials: Json | null
          display_name: string | null
          external_id: string | null
          human_agents: Json | null
          id: string | null
          is_active: boolean | null
          logo_url: string | null
          org_id: string | null
          profile_photo_url: string | null
          provider: Database["public"]["Enums"]["channel_type"] | null
          secret_token: string | null
          super_agent_id: string | null
          type: string | null
        }
        Insert: {
          ai_profile_id?: string | null
          created_at?: string | null
          credentials?: Json | null
          display_name?: string | null
          external_id?: string | null
          human_agents?: never
          id?: string | null
          is_active?: boolean | null
          logo_url?: string | null
          org_id?: string | null
          profile_photo_url?: string | null
          provider?: Database["public"]["Enums"]["channel_type"] | null
          secret_token?: string | null
          super_agent_id?: string | null
          type?: string | null
        }
        Update: {
          ai_profile_id?: string | null
          created_at?: string | null
          credentials?: Json | null
          display_name?: string | null
          external_id?: string | null
          human_agents?: never
          id?: string | null
          is_active?: boolean | null
          logo_url?: string | null
          org_id?: string | null
          profile_photo_url?: string | null
          provider?: Database["public"]["Enums"]["channel_type"] | null
          secret_token?: string | null
          super_agent_id?: string | null
          type?: string | null
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
          {
            foreignKeyName: "channels_super_agent_id_fkey"
            columns: ["super_agent_id"]
            isOneToOne: false
            referencedRelation: "users_profile"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "channels_super_agent_id_fkey"
            columns: ["super_agent_id"]
            isOneToOne: false
            referencedRelation: "v_human_agents"
            referencedColumns: ["user_id"]
          },
        ]
      }
      v_current_user_permissions: {
        Row: {
          action: string | null
          id: string | null
          name: string | null
          resource: string | null
        }
        Relationships: []
      }
      v_human_agents: {
        Row: {
          agent_name: string | null
          avatar_url: string | null
          can_reinvite: boolean | null
          confirmation_status: string | null
          email: string | null
          invitation_expires_at: string | null
          is_active: boolean | null
          is_invited: boolean | null
          last_invited_at: string | null
          last_sign_in_at: string | null
          org_id: string | null
          role_id: string | null
          role_name: string | null
          user_id: string | null
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
      v_super_agent_token_usage: {
        Row: {
          calls_count: number | null
          completion_tokens: number | null
          first_usage_at: string | null
          last_usage_at: string | null
          prompt_tokens: number | null
          super_agent_id: string | null
          total_tokens: number | null
        }
        Relationships: [
          {
            foreignKeyName: "channels_super_agent_id_fkey"
            columns: ["super_agent_id"]
            isOneToOne: false
            referencedRelation: "users_profile"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "channels_super_agent_id_fkey"
            columns: ["super_agent_id"]
            isOneToOne: false
            referencedRelation: "v_human_agents"
            referencedColumns: ["user_id"]
          },
        ]
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
      auto_close_due_threads: { Args: never; Returns: number }
      auto_resolve_threads: { Args: never; Returns: undefined }
      can_access_channel_scope: {
        Args: { p_channel_id: string }
        Returns: boolean
      }
      can_access_contact_via_threads: {
        Args: { p_contact_id: string }
        Returns: boolean
      }
      can_access_message_scope: {
        Args: { p_thread_id: string }
        Returns: boolean
      }
      can_access_super_scope:
        | {
            Args: { p_org_id: string; p_row_super_agent_id: string }
            Returns: boolean
          }
        | { Args: { p_row_super_agent_id: string }; Returns: boolean }
      can_read_thread: { Args: { p_thread_id: string }; Returns: boolean }
      cascade_delete_agent: {
        Args: { target_user_id: string }
        Returns: undefined
      }
      check_and_auto_resolve_threads: {
        Args: never
        Returns: {
          auto_resolve_reason: string
          resolved_thread_id: string
          thread_contact_name: string
        }[]
      }
      cleanup_old_chat_data: { Args: { p_org_id?: string }; Returns: Json }
      cleanup_old_metrics: { Args: never; Returns: undefined }
      contact_name: {
        Args: { t: Database["public"]["Tables"]["threads"]["Row"] }
        Returns: string
      }
      create_email_2fa_challenge: {
        Args: { p_ttl_seconds?: number; p_user: string }
        Returns: {
          challenge_id: string
          code_plain: string
        }[]
      }
      delete_auth_user: { Args: { user_uuid: string }; Returns: undefined }
      gdpr_delete_user_data: {
        Args: { p_contact_id: string; p_org_id?: string }
        Returns: Json
      }
      get_agent_kpis: {
        Args: { p_from: string; p_super_agent_id?: string; p_to: string }
        Returns: {
          agent_name: string
          agent_user_id: string
          avg_resolution_minutes: number
          resolved_count: number
        }[]
      }
      get_audit_logs: {
        Args: {
          p_action?: string
          p_from?: string
          p_limit?: number
          p_offset?: number
          p_to?: string
          p_user_id?: string
        }
        Returns: {
          action: string
          context: Json
          created_at: string
          id: string
          ip: string | null
          org_id: string
          resource: string
          resource_id: string | null
          user_agent: string | null
          user_id: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "audit_logs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_channel_chat_counts: {
        Args: { p_from: string; p_to: string }
        Returns: {
          channel_id: string
          display_name: string
          provider: string
          thread_count: number
        }[]
      }
      get_chats_timeseries: {
        Args: { p_channel?: string; p_from: string; p_to: string }
        Returns: {
          bucket: string
          count: number
          provider: string
        }[]
      }
      get_containment: {
        Args: { p_from: string; p_to: string }
        Returns: {
          ai_resolved_count: number
          prev_ai_resolved_count: number
          prev_rate: number
          prev_total_threads: number
          rate: number
          total_threads: number
        }[]
      }
      get_containment_and_handover: {
        Args: { p_from: string; p_to: string }
        Returns: {
          ai_resolved_count: number
          containment_rate: number
          handover_count: number
          handover_rate: number
          total_threads: number
        }[]
      }
      get_database_activity: {
        Args: never
        Returns: {
          cache_hit_percentage: number
          total_blocks_hit: number
          total_blocks_read: number
          total_deletes: number
          total_index_scans: number
          total_inserts: number
          total_sequential_scans: number
          total_updates: number
        }[]
      }
      get_database_memory_stats: {
        Args: never
        Returns: {
          cache_hit_ratio: number
          heap_hit_ratio: number
          idx_scan_ratio: number
          shared_buffers_hit: number
          shared_buffers_hit_ratio: number
          shared_buffers_read: number
          total_index_scans: number
          total_sequential_scans: number
        }[]
      }
      get_database_overview: {
        Args: never
        Returns: {
          data_size_bytes: number
          data_size_pretty: string
          indexes_size_bytes: number
          indexes_size_pretty: string
          total_indexes: number
          total_rows: number
          total_sequences: number
          total_size_bytes: number
          total_size_pretty: string
          total_tables: number
        }[]
      }
      get_database_stats: {
        Args: never
        Returns: {
          index_scans: number
          indexes_size_bytes: number
          indexes_size_pretty: string
          row_count: number
          sequential_scans: number
          table_size_bytes: number
          table_size_pretty: string
          tablename: string
          total_size_bytes: number
          total_size_pretty: string
        }[]
      }
      get_database_stats_detailed: {
        Args: never
        Returns: {
          dead_rows: number
          deletes: number
          hot_updates: number
          index_scans: number
          indexes_size_bytes: number
          indexes_size_pretty: string
          inserts: number
          last_analyze: string
          last_autoanalyze: string
          last_autovacuum: string
          last_vacuum: string
          row_count: number
          sequential_scans: number
          table_scan_ratio: number
          table_size_bytes: number
          table_size_pretty: string
          tablename: string
          total_size_bytes: number
          total_size_pretty: string
          updates: number
        }[]
      }
      get_database_total_size: {
        Args: never
        Returns: {
          total_size_bytes: number
          total_size_pretty: string
        }[]
      }
      get_filtered_tab_counts: {
        Args: { p_filters?: Json }
        Returns: {
          status_category: string
          total_count: number
        }[]
      }
      get_handover_by_agent: {
        Args: { p_from: string; p_super_agent_id?: string; p_to: string }
        Returns: {
          agent_name: string
          agent_user_id: string
          ai_resolved: number
          handover_rate: number
          human_resolved: number
          super_agent_id: string
        }[]
      }
      get_handover_by_super_agent: {
        Args: { p_from: string; p_to: string }
        Returns: {
          ai_resolved: number
          handover_rate: number
          human_resolved: number
          super_agent_id: string
          super_agent_name: string
        }[]
      }
      get_handover_stats: {
        Args: { p_from: string; p_to: string }
        Returns: {
          count: number
          rate: number
          reason: string
          total: number
        }[]
      }
      get_index_stats: {
        Args: never
        Returns: {
          idx_blks_hit: number
          idx_blks_read: number
          index_scans: number
          index_size_bytes: number
          index_size_pretty: string
          index_tup_fetches: number
          index_tup_reads: number
          indexname: string
          tablename: string
        }[]
      }
      get_non_contained: {
        Args: {
          p_from: string
          p_limit?: number
          p_offset?: number
          p_to: string
        }
        Returns: {
          contact_name: string
          created_at: string
          handover_reason: string
          id: string
          status: string
        }[]
      }
      get_response_time_stats: {
        Args: { p_channel?: string; p_from: string; p_to: string }
        Returns: {
          agent_avg: number
          agent_median: number
          agent_p90: number
          ai_avg: number
          ai_median: number
          ai_p90: number
        }[]
      }
      get_response_times: {
        Args: { p_from: string; p_to: string }
        Returns: {
          agent_avg_seconds: number
          ai_avg_seconds: number
        }[]
      }
      get_tab_counts_final_v2: {
        Args: { p_filters?: Json }
        Returns: {
          status_category: string
          total_count: number
        }[]
      }
      get_tab_counts_v3: {
        Args: { p_filters?: Json }
        Returns: {
          status_category: string
          total_count: number
        }[]
      }
      get_threads_with_details: {
        Args: { p_filters?: Json; p_limit?: number; p_offset?: number }
        Returns: {
          account_id: string
          additional_data: Json
          ai_access_enabled: boolean
          ai_handoff_at: string
          assigned_at: string
          assigned_by_name: string
          assigned_by_user_id: string
          assignee_last_seen_at: string
          assignee_name: string
          assignee_user_id: string
          channel_display_name: string
          channel_external_id: string
          channel_id: string
          channel_logo_url: string
          channel_profile_photo_url: string
          channel_provider: string
          channel_super_agent_id: string
          channel_type: string
          collaborator_user_id: string
          contact_email: string
          contact_id: string
          contact_name: string
          contact_phone: string
          created_at: string
          handover_reason: string
          id: string
          is_assigned: boolean
          is_blocked: boolean
          last_message: Json
          last_msg_at: string
          notes: string
          org_id: string
          resolved_at: string
          resolved_by_name: string
          resolved_by_user_id: string
          status: string
          super_agent_last_seen_at: string
          super_agent_name: string
        }[]
      }
      get_token_usage_stats: {
        Args: { p_from: string; p_to: string }
        Returns: {
          completion_tokens: number
          day: string
          model: string
          prompt_tokens: number
          total_tokens: number
        }[]
      }
      get_unread_counts: {
        Args: { p_thread_ids: string[] }
        Returns: {
          thread_id: string
          unread_count: number
        }[]
      }
      go_offline: { Args: never; Returns: boolean }
      grant_role_bundle: {
        Args: { p_bundle: string; p_role: string }
        Returns: undefined
      }
      grant_role_permission: {
        Args: { p_perm: string; p_role: string }
        Returns: undefined
      }
      has_active_2fa: { Args: never; Returns: boolean }
      has_perm: {
        Args: { p_action: string; p_resource: string }
        Returns: boolean
      }
      invite_ttl_seconds: { Args: never; Returns: number }
      is_auditor: { Args: never; Returns: boolean }
      is_current_user_active: { Args: never; Returns: boolean }
      is_master_agent: { Args: never; Returns: boolean }
      is_master_agent_in_org: { Args: { target_org: string }; Returns: boolean }
      is_regular_agent_for_channel: {
        Args: { target_channel: string; target_org: string }
        Returns: boolean
      }
      is_super_agent: { Args: never; Returns: boolean }
      is_super_agent_for_channel: {
        Args: { target_channel: string; target_org: string }
        Returns: boolean
      }
      jakarta_day_start_utc: { Args: { p_now: string }; Returns: string }
      jakarta_month_start_utc: { Args: { p_now: string }; Returns: string }
      log_action: {
        Args: {
          p_action: string
          p_context?: Json
          p_ip?: string
          p_org_id?: string
          p_resource: string
          p_resource_id?: string
          p_user_agent?: string
          p_user_id?: string
        }
        Returns: undefined
      }
      mark_thread_read: {
        Args: { p_last_read_seq: number; p_thread_id: string }
        Returns: undefined
      }
      match_documents: {
        Args: {
          filter?: Json
          match_count?: number
          match_threshold?: number
          p_file_ids?: string[]
          query_embedding: string
          query_text?: string
        }
        Returns: {
          content: string
          id: number
          metadata: Json
          similarity: number
        }[]
      }
      path_channel_id: { Args: { name: string }; Returns: string }
      path_org_id: { Args: { name: string }; Returns: string }
      preview_cleanup_old_chat_data: {
        Args: { p_org_id: string }
        Returns: Json
      }
      refresh_daily_monthly_tokens: { Args: never; Returns: undefined }
      refresh_used_tokens_for_super_agents: {
        Args: { p_from?: string; p_to?: string }
        Returns: undefined
      }
      revoke_role_bundle: {
        Args: { p_bundle: string; p_role: string }
        Returns: undefined
      }
      revoke_role_permission: {
        Args: { p_perm: string; p_role: string }
        Returns: undefined
      }
      schedule_auto_resolve_for_open_threads: { Args: never; Returns: number }
      search_knowledge: {
        Args: {
          ai_profile_id: string
          match_count?: number
          match_threshold?: number
          query_embedding: string
        }
        Returns: {
          content: string
          id: number
          metadata: Json
          similarity: number
        }[]
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      takeover_thread: {
        Args: { p_thread_id: string }
        Returns: {
          account_id: string | null
          additional_data: Json
          ai_access_enabled: boolean
          ai_handoff_at: string | null
          assigned_at: string | null
          assigned_by_user_id: string | null
          assignee_user_id: string | null
          auto_resolve_at: string | null
          blocked_until: string | null
          channel_id: string
          collaborator_user_id: string | null
          contact_id: string | null
          created_at: string
          end_reason: string | null
          followup_at: string | null
          handover_reason: string | null
          id: string
          is_blocked: boolean
          is_followup_sent: boolean | null
          last_message_body: string | null
          last_message_direction:
            | Database["public"]["Enums"]["message_direction"]
            | null
          last_message_role: Database["public"]["Enums"]["message_role"] | null
          last_msg_at: string
          notes: string | null
          org_id: string
          resolution: string | null
          resolved_at: string | null
          resolved_by_user_id: string | null
          status: Database["public"]["Enums"]["thread_status"]
        }
        SetofOptions: {
          from: "*"
          to: "threads"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      topup_ai_wallet: {
        Args: { p_amount_usd: number; p_org_id: string; p_provider: string }
        Returns: Json
      }
      unassign_thread: {
        Args: { p_thread_id: string }
        Returns: {
          account_id: string | null
          additional_data: Json
          ai_access_enabled: boolean
          ai_handoff_at: string | null
          assigned_at: string | null
          assigned_by_user_id: string | null
          assignee_user_id: string | null
          auto_resolve_at: string | null
          blocked_until: string | null
          channel_id: string
          collaborator_user_id: string | null
          contact_id: string | null
          created_at: string
          end_reason: string | null
          followup_at: string | null
          handover_reason: string | null
          id: string
          is_blocked: boolean
          is_followup_sent: boolean | null
          last_message_body: string | null
          last_message_direction:
            | Database["public"]["Enums"]["message_direction"]
            | null
          last_message_role: Database["public"]["Enums"]["message_role"] | null
          last_msg_at: string
          notes: string | null
          org_id: string
          resolution: string | null
          resolved_at: string | null
          resolved_by_user_id: string | null
          status: Database["public"]["Enums"]["thread_status"]
        }
        SetofOptions: {
          from: "*"
          to: "threads"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      validate_handover_reason: {
        Args: { new_handover: boolean; reason: string }
        Returns: boolean
      }
      verify_email_2fa: {
        Args: { p_code: string; p_session_minutes?: number; p_user: string }
        Returns: string
      }
    }
    Enums: {
      channel_type: "whatsapp" | "web" | "telegram"
      label_scope: "contact" | "thread"
      message_direction: "in" | "out"
      message_role: "user" | "assistant" | "agent" | "system"
      message_type:
        | "text"
        | "image"
        | "file"
        | "voice"
        | "event"
        | "note"
        | "video"
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
      message_type: [
        "text",
        "image",
        "file",
        "voice",
        "event",
        "note",
        "video",
      ],
      thread_status: ["open", "pending", "closed"],
      user_role: ["agent", "supervisor", "super_agent"],
    },
  },
} as const
