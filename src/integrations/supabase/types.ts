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
      ai_events: {
        Row: {
          ai_profile_id: string | null
          created_at: string
          event_type: string
          id: string
          latency_ms: number | null
          message_id: string | null
          org_id: string
          payload: Json | null
          thread_id: string | null
          tokens_input: number | null
          tokens_output: number | null
        }
        Insert: {
          ai_profile_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          latency_ms?: number | null
          message_id?: string | null
          org_id: string
          payload?: Json | null
          thread_id?: string | null
          tokens_input?: number | null
          tokens_output?: number | null
        }
        Update: {
          ai_profile_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          latency_ms?: number | null
          message_id?: string | null
          org_id?: string
          payload?: Json | null
          thread_id?: string | null
          tokens_input?: number | null
          tokens_output?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_events_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_events_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_events_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "threads"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_profile_sources: {
        Row: {
          ai_profile_id: string
          source_id: string
        }
        Insert: {
          ai_profile_id: string
          source_id: string
        }
        Update: {
          ai_profile_id?: string
          source_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_profile_sources_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "kb_sources"
            referencedColumns: ["id"]
          },
        ]
      }
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
          created_at?: string
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
        Relationships: [
          {
            foreignKeyName: "ai_sessions_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "threads"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_runs: {
        Row: {
          automation_id: string
          created_at: string
          id: string
          input: Json | null
          org_id: string
          output: Json | null
          status: string | null
        }
        Insert: {
          automation_id: string
          created_at?: string
          id?: string
          input?: Json | null
          org_id: string
          output?: Json | null
          status?: string | null
        }
        Update: {
          automation_id?: string
          created_at?: string
          id?: string
          input?: Json | null
          org_id?: string
          output?: Json | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "automation_runs_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "automations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_runs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      automations: {
        Row: {
          action: Json
          condition: Json | null
          created_at: string
          id: string
          name: string
          org_id: string
          status: string
          trigger: string
        }
        Insert: {
          action: Json
          condition?: Json | null
          created_at?: string
          id?: string
          name: string
          org_id: string
          status?: string
          trigger: string
        }
        Update: {
          action?: Json
          condition?: Json | null
          created_at?: string
          id?: string
          name?: string
          org_id?: string
          status?: string
          trigger?: string
        }
        Relationships: [
          {
            foreignKeyName: "automations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      channels: {
        Row: {
          created_at: string
          credentials: Json | null
          display_name: string | null
          id: string
          is_active: boolean | null
          org_id: string
          provider: string | null
          type: Database["public"]["Enums"]["channel_type"]
        }
        Insert: {
          created_at?: string
          credentials?: Json | null
          display_name?: string | null
          id?: string
          is_active?: boolean | null
          org_id: string
          provider?: string | null
          type: Database["public"]["Enums"]["channel_type"]
        }
        Update: {
          created_at?: string
          credentials?: Json | null
          display_name?: string | null
          id?: string
          is_active?: boolean | null
          org_id?: string
          provider?: string | null
          type?: Database["public"]["Enums"]["channel_type"]
        }
        Relationships: [
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
          {
            foreignKeyName: "contacts_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "crm_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_stages: {
        Row: {
          id: string
          name: string
          org_id: string
          sort_order: number
        }
        Insert: {
          id?: string
          name: string
          org_id: string
          sort_order?: number
        }
        Update: {
          id?: string
          name?: string
          org_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "crm_stages_org_id_fkey"
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
            foreignKeyName: "csat_responses_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "csat_responses_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "csat_responses_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "threads"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          created_at: string
          id: string
          meta: Json | null
          org_id: string
          ref_id: string | null
          type: string
        }
        Insert: {
          created_at?: string
          id?: string
          meta?: Json | null
          org_id: string
          ref_id?: string | null
          type: string
        }
        Update: {
          created_at?: string
          id?: string
          meta?: Json | null
          org_id?: string
          ref_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      flow_edges: {
        Row: {
          condition: Json | null
          created_at: string
          flow_id: string
          id: string
          source_node_id: string
          target_node_id: string
        }
        Insert: {
          condition?: Json | null
          created_at?: string
          flow_id: string
          id?: string
          source_node_id: string
          target_node_id: string
        }
        Update: {
          condition?: Json | null
          created_at?: string
          flow_id?: string
          id?: string
          source_node_id?: string
          target_node_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "flow_edges_flow_id_fkey"
            columns: ["flow_id"]
            isOneToOne: false
            referencedRelation: "flows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flow_edges_source_node_id_fkey"
            columns: ["source_node_id"]
            isOneToOne: false
            referencedRelation: "flow_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flow_edges_target_node_id_fkey"
            columns: ["target_node_id"]
            isOneToOne: false
            referencedRelation: "flow_nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      flow_nodes: {
        Row: {
          config: Json
          created_at: string
          flow_id: string
          id: string
          kind: string
          position: Json | null
        }
        Insert: {
          config: Json
          created_at?: string
          flow_id: string
          id?: string
          kind: string
          position?: Json | null
        }
        Update: {
          config?: Json
          created_at?: string
          flow_id?: string
          id?: string
          kind?: string
          position?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "flow_nodes_flow_id_fkey"
            columns: ["flow_id"]
            isOneToOne: false
            referencedRelation: "flows"
            referencedColumns: ["id"]
          },
        ]
      }
      flow_run_steps: {
        Row: {
          created_at: string
          id: string
          node_id: string | null
          outcome: Json | null
          run_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          node_id?: string | null
          outcome?: Json | null
          run_id: string
        }
        Update: {
          created_at?: string
          id?: string
          node_id?: string | null
          outcome?: Json | null
          run_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "flow_run_steps_node_id_fkey"
            columns: ["node_id"]
            isOneToOne: false
            referencedRelation: "flow_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flow_run_steps_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "flow_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      flow_runs: {
        Row: {
          finished_at: string | null
          flow_id: string
          id: string
          org_id: string
          started_at: string
          status: string
          thread_id: string | null
        }
        Insert: {
          finished_at?: string | null
          flow_id: string
          id?: string
          org_id: string
          started_at?: string
          status?: string
          thread_id?: string | null
        }
        Update: {
          finished_at?: string | null
          flow_id?: string
          id?: string
          org_id?: string
          started_at?: string
          status?: string
          thread_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "flow_runs_flow_id_fkey"
            columns: ["flow_id"]
            isOneToOne: false
            referencedRelation: "flows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flow_runs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flow_runs_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "threads"
            referencedColumns: ["id"]
          },
        ]
      }
      flows: {
        Row: {
          created_at: string
          id: string
          name: string
          org_id: string
          status: string
          version: number
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          org_id: string
          status?: string
          version?: number
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          org_id?: string
          status?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "flows_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      integrations: {
        Row: {
          config: Json | null
          created_at: string
          credentials: Json | null
          id: string
          org_id: string
          provider: string
          status: string | null
        }
        Insert: {
          config?: Json | null
          created_at?: string
          credentials?: Json | null
          id?: string
          org_id: string
          provider: string
          status?: string | null
        }
        Update: {
          config?: Json | null
          created_at?: string
          credentials?: Json | null
          id?: string
          org_id?: string
          provider?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "integrations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      kb_chunks: {
        Row: {
          content: string
          created_at: string
          embedding: string | null
          id: string
          org_id: string
          source_id: string | null
        }
        Insert: {
          content: string
          created_at?: string
          embedding?: string | null
          id?: string
          org_id: string
          source_id?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          embedding?: string | null
          id?: string
          org_id?: string
          source_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kb_chunks_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kb_chunks_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "kb_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      kb_sources: {
        Row: {
          created_at: string
          id: string
          location: string | null
          org_id: string
          status: string | null
          title: string | null
          type: string
        }
        Insert: {
          created_at?: string
          id?: string
          location?: string | null
          org_id: string
          status?: string | null
          title?: string | null
          type: string
        }
        Update: {
          created_at?: string
          id?: string
          location?: string | null
          org_id?: string
          status?: string | null
          title?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "kb_sources_org_id_fkey"
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
      message_attachments: {
        Row: {
          duration_ms: number | null
          height: number | null
          id: string
          message_id: string
          mime_type: string | null
          size_bytes: number | null
          url: string
          width: number | null
        }
        Insert: {
          duration_ms?: number | null
          height?: number | null
          id?: string
          message_id: string
          mime_type?: string | null
          size_bytes?: number | null
          url: string
          width?: number | null
        }
        Update: {
          duration_ms?: number | null
          height?: number | null
          id?: string
          message_id?: string
          mime_type?: string | null
          size_bytes?: number | null
          url?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "message_attachments_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      message_delivery: {
        Row: {
          attempts: number
          channel_id: string
          created_at: string
          id: string
          last_error: string | null
          message_id: string
          provider: string | null
          provider_msg_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          channel_id: string
          created_at?: string
          id?: string
          last_error?: string | null
          message_id: string
          provider?: string | null
          provider_msg_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          channel_id?: string
          created_at?: string
          id?: string
          last_error?: string | null
          message_id?: string
          provider?: string | null
          provider_msg_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_delivery_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_delivery_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string | null
          created_at: string
          direction: Database["public"]["Enums"]["message_direction"]
          id: string
          payload: Json | null
          role: Database["public"]["Enums"]["message_role"]
          thread_id: string
          type: Database["public"]["Enums"]["message_type"]
        }
        Insert: {
          body?: string | null
          created_at?: string
          direction: Database["public"]["Enums"]["message_direction"]
          id?: string
          payload?: Json | null
          role?: Database["public"]["Enums"]["message_role"]
          thread_id: string
          type?: Database["public"]["Enums"]["message_type"]
        }
        Update: {
          body?: string | null
          created_at?: string
          direction?: Database["public"]["Enums"]["message_direction"]
          id?: string
          payload?: Json | null
          role?: Database["public"]["Enums"]["message_role"]
          thread_id?: string
          type?: Database["public"]["Enums"]["message_type"]
        }
        Relationships: [
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
      notifications: {
        Row: {
          created_at: string
          id: string
          org_id: string
          payload: Json | null
          read_at: string | null
          type: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          org_id: string
          payload?: Json | null
          read_at?: string | null
          type?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          org_id?: string
          payload?: Json | null
          read_at?: string | null
          type?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
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
      quick_replies: {
        Row: {
          channel: Database["public"]["Enums"]["channel_type"] | null
          content: string
          created_at: string
          created_by: string | null
          id: string
          org_id: string
          title: string
        }
        Insert: {
          channel?: Database["public"]["Enums"]["channel_type"] | null
          content: string
          created_at?: string
          created_by?: string | null
          id?: string
          org_id: string
          title: string
        }
        Update: {
          channel?: Database["public"]["Enums"]["channel_type"] | null
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          org_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "quick_replies_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      reminders: {
        Row: {
          created_at: string
          done: boolean | null
          due_at: string
          id: string
          note: string | null
          org_id: string
          thread_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          done?: boolean | null
          due_at: string
          id?: string
          note?: string | null
          org_id: string
          thread_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          done?: boolean | null
          due_at?: string
          id?: string
          note?: string | null
          org_id?: string
          thread_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reminders_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminders_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "threads"
            referencedColumns: ["id"]
          },
        ]
      }
      thread_labels: {
        Row: {
          label_id: string
          thread_id: string
        }
        Insert: {
          label_id: string
          thread_id: string
        }
        Update: {
          label_id?: string
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "thread_labels_label_id_fkey"
            columns: ["label_id"]
            isOneToOne: false
            referencedRelation: "labels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "thread_labels_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "threads"
            referencedColumns: ["id"]
          },
        ]
      }
      thread_participants: {
        Row: {
          thread_id: string
          user_id: string
        }
        Insert: {
          thread_id: string
          user_id: string
        }
        Update: {
          thread_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "thread_participants_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "threads"
            referencedColumns: ["id"]
          },
        ]
      }
      threads: {
        Row: {
          assignee_user_id: string | null
          channel_id: string
          contact_id: string
          created_at: string
          id: string
          last_msg_at: string
          org_id: string
          status: Database["public"]["Enums"]["thread_status"]
        }
        Insert: {
          assignee_user_id?: string | null
          channel_id: string
          contact_id: string
          created_at?: string
          id?: string
          last_msg_at?: string
          org_id: string
          status?: Database["public"]["Enums"]["thread_status"]
        }
        Update: {
          assignee_user_id?: string | null
          channel_id?: string
          contact_id?: string
          created_at?: string
          id?: string
          last_msg_at?: string
          org_id?: string
          status?: Database["public"]["Enums"]["thread_status"]
        }
        Relationships: [
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
      users_profile: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          timezone: string | null
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          timezone?: string | null
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          timezone?: string | null
          user_id?: string
        }
        Relationships: []
      }
      vision_analysis: {
        Row: {
          attachment_id: string
          created_at: string
          id: string
          model: string | null
          result: Json
        }
        Insert: {
          attachment_id: string
          created_at?: string
          id?: string
          model?: string | null
          result: Json
        }
        Update: {
          attachment_id?: string
          created_at?: string
          id?: string
          model?: string | null
          result?: Json
        }
        Relationships: [
          {
            foreignKeyName: "vision_analysis_attachment_id_fkey"
            columns: ["attachment_id"]
            isOneToOne: false
            referencedRelation: "message_attachments"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_endpoints: {
        Row: {
          created_at: string
          id: string
          is_active: boolean | null
          org_id: string
          secret: string | null
          url: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          org_id: string
          secret?: string | null
          url: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          org_id?: string
          secret?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_endpoints_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_events_inbound: {
        Row: {
          channel_id: string | null
          event_type: string | null
          id: string
          org_id: string
          payload: Json
          provider: string | null
          received_at: string
        }
        Insert: {
          channel_id?: string | null
          event_type?: string | null
          id?: string
          org_id: string
          payload: Json
          provider?: string | null
          received_at?: string
        }
        Update: {
          channel_id?: string | null
          event_type?: string | null
          id?: string
          org_id?: string
          payload?: Json
          provider?: string | null
          received_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_events_inbound_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webhook_events_inbound_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_events_outbound: {
        Row: {
          attempts: number
          created_at: string
          endpoint_id: string
          event_type: string
          id: string
          last_error: string | null
          org_id: string
          payload: Json
          status: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          endpoint_id: string
          event_type: string
          id?: string
          last_error?: string | null
          org_id: string
          payload: Json
          status?: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          endpoint_id?: string
          event_type?: string
          id?: string
          last_error?: string | null
          org_id?: string
          payload?: Json
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_events_outbound_endpoint_id_fkey"
            columns: ["endpoint_id"]
            isOneToOne: false
            referencedRelation: "webhook_endpoints"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webhook_events_outbound_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      working_hours: {
        Row: {
          close_time: string
          dow: number
          id: string
          open_time: string
          org_id: string
          timezone: string
        }
        Insert: {
          close_time: string
          dow: number
          id?: string
          open_time: string
          org_id: string
          timezone?: string
        }
        Update: {
          close_time?: string
          dow?: number
          id?: string
          open_time?: string
          org_id?: string
          timezone?: string
        }
        Relationships: [
          {
            foreignKeyName: "working_hours_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      binary_quantize: {
        Args: { "": string } | { "": unknown }
        Returns: unknown
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
      channel_type: "whatsapp" | "web"
      label_scope: "contact" | "thread"
      message_direction: "in" | "out"
      message_role: "user" | "assistant" | "agent" | "system"
      message_type:
        | "text"
        | "image"
        | "video"
        | "audio"
        | "file"
        | "sticker"
        | "location"
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
      channel_type: ["whatsapp", "web"],
      label_scope: ["contact", "thread"],
      message_direction: ["in", "out"],
      message_role: ["user", "assistant", "agent", "system"],
      message_type: [
        "text",
        "image",
        "video",
        "audio",
        "file",
        "sticker",
        "location",
      ],
      thread_status: ["open", "pending", "closed"],
      user_role: ["agent", "supervisor", "super_agent"],
    },
  },
} as const
