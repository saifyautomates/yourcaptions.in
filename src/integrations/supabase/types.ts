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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      activity_log: {
        Row: {
          action_type: string
          created_at: string
          id: string
          metadata: Json
          user_id: string | null
        }
        Insert: {
          action_type: string
          created_at?: string
          id?: string
          metadata?: Json
          user_id?: string | null
        }
        Update: {
          action_type?: string
          created_at?: string
          id?: string
          metadata?: Json
          user_id?: string | null
        }
        Relationships: []
      }
      captions: {
        Row: {
          created_at: string
          id: string
          language: string
          project_id: string
          provider: string | null
          segments: Json
          srt_text: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          language: string
          project_id: string
          provider?: string | null
          segments?: Json
          srt_text?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          language?: string
          project_id?: string
          provider?: string | null
          segments?: Json
          srt_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "captions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_rates: {
        Row: {
          credits_per_unit: number
          feature: string
          unit: string
          updated_at: string
        }
        Insert: {
          credits_per_unit: number
          feature: string
          unit?: string
          updated_at?: string
        }
        Update: {
          credits_per_unit?: number
          feature?: string
          unit?: string
          updated_at?: string
        }
        Relationships: []
      }
      credit_transactions: {
        Row: {
          amount: number
          balance_after: number
          created_at: string
          id: string
          metadata: Json | null
          reference_id: string | null
          reference_type: string | null
          status: string
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          balance_after: number
          created_at?: string
          id?: string
          metadata?: Json | null
          reference_id?: string | null
          reference_type?: string | null
          status?: string
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          balance_after?: number
          created_at?: string
          id?: string
          metadata?: Json | null
          reference_id?: string | null
          reference_type?: string | null
          status?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      credit_wallets: {
        Row: {
          plan_credits: number
          plan_credits_reset_at: string | null
          topup_credits: number
          updated_at: string
          user_id: string
        }
        Insert: {
          plan_credits?: number
          plan_credits_reset_at?: string | null
          topup_credits?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          plan_credits?: number
          plan_credits_reset_at?: string | null
          topup_credits?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      error_logs: {
        Row: {
          alerted_at: string | null
          context: Json
          created_at: string
          fingerprint: string
          first_seen_at: string
          function_name: string | null
          id: string
          last_seen_at: string
          message: string
          occurrence_count: number
          release: string | null
          resolved: boolean
          resolved_at: string | null
          resolved_by: string | null
          severity: Database["public"]["Enums"]["error_severity"]
          source: Database["public"]["Enums"]["error_source"]
          stack: string | null
          url: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          alerted_at?: string | null
          context?: Json
          created_at?: string
          fingerprint: string
          first_seen_at?: string
          function_name?: string | null
          id?: string
          last_seen_at?: string
          message: string
          occurrence_count?: number
          release?: string | null
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: Database["public"]["Enums"]["error_severity"]
          source?: Database["public"]["Enums"]["error_source"]
          stack?: string | null
          url?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          alerted_at?: string | null
          context?: Json
          created_at?: string
          fingerprint?: string
          first_seen_at?: string
          function_name?: string | null
          id?: string
          last_seen_at?: string
          message?: string
          occurrence_count?: number
          release?: string | null
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: Database["public"]["Enums"]["error_severity"]
          source?: Database["public"]["Enums"]["error_source"]
          stack?: string | null
          url?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      export_metrics: {
        Row: {
          bitrate: number
          browser: string | null
          codec: string
          created_at: string
          effective_fps: number | null
          encode_time_ms: number
          error_category: string | null
          error_message: string | null
          fps_target: number
          frames_encoded: number | null
          id: string
          level: string | null
          outcome: string
          output_bytes: number | null
          path: string | null
          profile: string | null
          realtime_multiplier: number | null
          resolution: string
          source_duration_sec: number | null
          source_height: number | null
          source_width: number | null
          user_id: string | null
        }
        Insert: {
          bitrate: number
          browser?: string | null
          codec: string
          created_at?: string
          effective_fps?: number | null
          encode_time_ms: number
          error_category?: string | null
          error_message?: string | null
          fps_target: number
          frames_encoded?: number | null
          id?: string
          level?: string | null
          outcome: string
          output_bytes?: number | null
          path?: string | null
          profile?: string | null
          realtime_multiplier?: number | null
          resolution: string
          source_duration_sec?: number | null
          source_height?: number | null
          source_width?: number | null
          user_id?: string | null
        }
        Update: {
          bitrate?: number
          browser?: string | null
          codec?: string
          created_at?: string
          effective_fps?: number | null
          encode_time_ms?: number
          error_category?: string | null
          error_message?: string | null
          fps_target?: number
          frames_encoded?: number | null
          id?: string
          level?: string | null
          outcome?: string
          output_bytes?: number | null
          path?: string | null
          profile?: string | null
          realtime_multiplier?: number | null
          resolution?: string
          source_duration_sec?: number | null
          source_height?: number | null
          source_width?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      feedback_submissions: {
        Row: {
          created_at: string
          email: string | null
          id: string
          message: string
          name: string | null
          status: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          message: string
          name?: string | null
          status?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          message?: string
          name?: string | null
          status?: string
          user_id?: string | null
        }
        Relationships: []
      }
      hero_media: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          label: string | null
          orientation: string
          storage_path: string | null
          uploaded_by: string | null
          video_url: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string | null
          orientation?: string
          storage_path?: string | null
          uploaded_by?: string | null
          video_url: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string | null
          orientation?: string
          storage_path?: string | null
          uploaded_by?: string | null
          video_url?: string
        }
        Relationships: []
      }
      hero_transcript_translations: {
        Row: {
          created_at: string
          id: string
          lang: string
          text: string
          video_url: string
        }
        Insert: {
          created_at?: string
          id?: string
          lang: string
          text: string
          video_url: string
        }
        Update: {
          created_at?: string
          id?: string
          lang?: string
          text?: string
          video_url?: string
        }
        Relationships: []
      }
      hero_transcripts: {
        Row: {
          created_at: string
          duration: number | null
          id: string
          source_lang: string | null
          source_text: string
          video_url: string
          words: Json
        }
        Insert: {
          created_at?: string
          duration?: number | null
          id?: string
          source_lang?: string | null
          source_text: string
          video_url: string
          words: Json
        }
        Update: {
          created_at?: string
          duration?: number | null
          id?: string
          source_lang?: string | null
          source_text?: string
          video_url?: string
          words?: Json
        }
        Relationships: []
      }
      jobs: {
        Row: {
          created_at: string
          error: string | null
          finished_at: string | null
          id: string
          input: Json
          kind: Database["public"]["Enums"]["job_kind"]
          message: string | null
          progress: number
          project_id: string | null
          result: Json | null
          started_at: string | null
          status: Database["public"]["Enums"]["job_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          finished_at?: string | null
          id?: string
          input?: Json
          kind: Database["public"]["Enums"]["job_kind"]
          message?: string | null
          progress?: number
          project_id?: string | null
          result?: Json | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          error?: string | null
          finished_at?: string | null
          id?: string
          input?: Json
          kind?: Database["public"]["Enums"]["job_kind"]
          message?: string | null
          progress?: number
          project_id?: string | null
          result?: Json | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "jobs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      library_items: {
        Row: {
          category: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          name: string
          payload: Json
          preview_url: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name: string
          payload?: Json
          preview_url?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name?: string
          payload?: Json
          preview_url?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount_paise: number
          created_at: string
          currency: string
          id: string
          plan: Database["public"]["Enums"]["plan_tier"] | null
          razorpay_order_id: string | null
          razorpay_payment_id: string | null
          status: string
          user_id: string
        }
        Insert: {
          amount_paise: number
          created_at?: string
          currency?: string
          id?: string
          plan?: Database["public"]["Enums"]["plan_tier"] | null
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          status?: string
          user_id: string
        }
        Update: {
          amount_paise?: number
          created_at?: string
          currency?: string
          id?: string
          plan?: Database["public"]["Enums"]["plan_tier"] | null
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      plan_limits: {
        Row: {
          can_burn_captions: boolean
          can_dub: boolean
          can_export_srt: boolean
          max_projects: number
          max_team_members: number
          max_video_minutes: number
          monthly_credits: number
          plan: Database["public"]["Enums"]["plan_tier"]
          updated_at: string
        }
        Insert: {
          can_burn_captions?: boolean
          can_dub?: boolean
          can_export_srt?: boolean
          max_projects: number
          max_team_members: number
          max_video_minutes: number
          monthly_credits: number
          plan: Database["public"]["Enums"]["plan_tier"]
          updated_at?: string
        }
        Update: {
          can_burn_captions?: boolean
          can_dub?: boolean
          can_export_srt?: boolean
          max_projects?: number
          max_team_members?: number
          max_video_minutes?: number
          monthly_credits?: number
          plan?: Database["public"]["Enums"]["plan_tier"]
          updated_at?: string
        }
        Relationships: []
      }
      platform_settings: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          credits_seconds: number
          full_name: string | null
          id: string
          onboarding_dismissed_at: string | null
          onboarding_use_case: string | null
          phone: string | null
          plan: Database["public"]["Enums"]["plan_tier"]
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          credits_seconds?: number
          full_name?: string | null
          id: string
          onboarding_dismissed_at?: string | null
          onboarding_use_case?: string | null
          phone?: string | null
          plan?: Database["public"]["Enums"]["plan_tier"]
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          credits_seconds?: number
          full_name?: string | null
          id?: string
          onboarding_dismissed_at?: string | null
          onboarding_use_case?: string | null
          phone?: string | null
          plan?: Database["public"]["Enums"]["plan_tier"]
          updated_at?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          chosen_provider: string | null
          compare_mode: boolean
          created_at: string
          duration_seconds: number | null
          error_message: string | null
          id: string
          media_path: string | null
          provider: string
          source_language: string
          status: Database["public"]["Enums"]["project_status"]
          team_id: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          chosen_provider?: string | null
          compare_mode?: boolean
          created_at?: string
          duration_seconds?: number | null
          error_message?: string | null
          id?: string
          media_path?: string | null
          provider?: string
          source_language?: string
          status?: Database["public"]["Enums"]["project_status"]
          team_id?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          chosen_provider?: string | null
          compare_mode?: boolean
          created_at?: string
          duration_seconds?: number | null
          error_message?: string | null
          id?: string
          media_path?: string | null
          provider?: string
          source_language?: string
          status?: Database["public"]["Enums"]["project_status"]
          team_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      security_audit_log: {
        Row: {
          actor_id: string | null
          context: Json
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["security_audit_kind"]
          path: string | null
          reason: string | null
          role: Database["public"]["Enums"]["app_role"] | null
          subject_id: string | null
          suspicious: boolean
          user_agent: string | null
        }
        Insert: {
          actor_id?: string | null
          context?: Json
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["security_audit_kind"]
          path?: string | null
          reason?: string | null
          role?: Database["public"]["Enums"]["app_role"] | null
          subject_id?: string | null
          suspicious?: boolean
          user_agent?: string | null
        }
        Update: {
          actor_id?: string | null
          context?: Json
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["security_audit_kind"]
          path?: string | null
          reason?: string | null
          role?: Database["public"]["Enums"]["app_role"] | null
          subject_id?: string | null
          suspicious?: boolean
          user_agent?: string | null
        }
        Relationships: []
      }
      security_findings: {
        Row: {
          created_at: string
          decided_at: string | null
          decided_by: string | null
          external_id: string | null
          first_seen_at: string
          id: string
          last_seen_at: string
          notes: string | null
          resource: string | null
          scanner_name: string
          severity: Database["public"]["Enums"]["security_finding_severity"]
          status: Database["public"]["Enums"]["security_finding_status"]
          summary: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          external_id?: string | null
          first_seen_at?: string
          id?: string
          last_seen_at?: string
          notes?: string | null
          resource?: string | null
          scanner_name: string
          severity?: Database["public"]["Enums"]["security_finding_severity"]
          status?: Database["public"]["Enums"]["security_finding_status"]
          summary: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          external_id?: string | null
          first_seen_at?: string
          id?: string
          last_seen_at?: string
          notes?: string | null
          resource?: string | null
          scanner_name?: string
          severity?: Database["public"]["Enums"]["security_finding_severity"]
          status?: Database["public"]["Enums"]["security_finding_status"]
          summary?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          created_at: string
          current_period_end: string | null
          id: string
          plan: Database["public"]["Enums"]["plan_tier"]
          razorpay_subscription_id: string | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          plan: Database["public"]["Enums"]["plan_tier"]
          razorpay_subscription_id?: string | null
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          plan?: Database["public"]["Enums"]["plan_tier"]
          razorpay_subscription_id?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      team_invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          role: Database["public"]["Enums"]["team_role"]
          team_id: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          role?: Database["public"]["Enums"]["team_role"]
          team_id: string
          token?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          role?: Database["public"]["Enums"]["team_role"]
          team_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_invitations_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["team_role"]
          team_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["team_role"]
          team_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["team_role"]
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_id: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_id: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      templates: {
        Row: {
          category: string | null
          created_at: string
          id: string
          is_public: boolean
          is_system: boolean
          name: string
          owner_id: string | null
          preview_url: string | null
          style: Json
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          id?: string
          is_public?: boolean
          is_system?: boolean
          name: string
          owner_id?: string | null
          preview_url?: string | null
          style: Json
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          id?: string
          is_public?: boolean
          is_system?: boolean
          name?: string
          owner_id?: string | null
          preview_url?: string | null
          style?: Json
          updated_at?: string
        }
        Relationships: []
      }
      usage_alerts: {
        Row: {
          created_at: string
          email_on: boolean
          enabled: boolean
          id: string
          in_app_on: boolean
          kind: Database["public"]["Enums"]["meter_kind"]
          last_triggered_period: string | null
          threshold_pct: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email_on?: boolean
          enabled?: boolean
          id?: string
          in_app_on?: boolean
          kind: Database["public"]["Enums"]["meter_kind"]
          last_triggered_period?: string | null
          threshold_pct?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email_on?: boolean
          enabled?: boolean
          id?: string
          in_app_on?: boolean
          kind?: Database["public"]["Enums"]["meter_kind"]
          last_triggered_period?: string | null
          threshold_pct?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      usage_events: {
        Row: {
          cost_units: number
          created_at: string
          function_name: string
          id: string
          user_id: string
        }
        Insert: {
          cost_units?: number
          created_at?: string
          function_name: string
          id?: string
          user_id: string
        }
        Update: {
          cost_units?: number
          created_at?: string
          function_name?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      usage_meters: {
        Row: {
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["meter_kind"]
          period_start: string
          updated_at: string
          used: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["meter_kind"]
          period_start: string
          updated_at?: string
          used?: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["meter_kind"]
          period_start?: string
          updated_at?: string
          used?: number
          user_id?: string
        }
        Relationships: []
      }
      user_assets: {
        Row: {
          category: Database["public"]["Enums"]["asset_category"]
          created_at: string
          id: string
          metadata: Json
          mime_type: string | null
          name: string
          size_bytes: number | null
          storage_path: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          category: Database["public"]["Enums"]["asset_category"]
          created_at?: string
          id?: string
          metadata?: Json
          mime_type?: string | null
          name: string
          size_bytes?: number | null
          storage_path?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: Database["public"]["Enums"]["asset_category"]
          created_at?: string
          id?: string
          metadata?: Json
          mime_type?: string | null
          name?: string
          size_bytes?: number | null
          storage_path?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_team_invitation: { Args: { _token: string }; Returns: string }
      add_credits: {
        Args: {
          _amount: number
          _bucket: string
          _metadata?: Json
          _reference_id?: string
          _reference_type?: string
          _type: string
          _user_id: string
        }
        Returns: {
          balance: number
          plan_credits: number
          topup_credits: number
          tx_id: string
        }[]
      }
      admin_delete_user: { Args: { _user_id: string }; Returns: undefined }
      admin_grant_access: {
        Args: {
          _credits_seconds?: number
          _mode?: string
          _plan?: Database["public"]["Enums"]["plan_tier"]
          _user_id: string
        }
        Returns: {
          credits_seconds: number
          plan: Database["public"]["Enums"]["plan_tier"]
          user_id: string
        }[]
      }
      admin_list_projects: {
        Args: {
          _limit?: number
          _offset?: number
          _search?: string
          _status?: string
        }
        Returns: {
          created_at: string
          duration_seconds: number
          id: string
          owner_email: string
          status: Database["public"]["Enums"]["project_status"]
          title: string
          user_id: string
        }[]
      }
      admin_list_users: {
        Args: never
        Returns: {
          created_at: string
          credits_seconds: number
          email: string
          full_name: string
          is_admin: boolean
          plan: Database["public"]["Enums"]["plan_tier"]
          user_id: string
        }[]
      }
      admin_overview_stats: { Args: never; Returns: Json }
      admin_recent_activity: {
        Args: { _limit?: number }
        Returns: {
          action_type: string
          created_at: string
          email: string
          id: string
          metadata: Json
          user_id: string
        }[]
      }
      admin_security_alerts: {
        Args: { _limit?: number }
        Returns: {
          actor_email: string
          actor_id: string
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["security_audit_kind"]
          path: string
          reason: string
          role: Database["public"]["Enums"]["app_role"]
          subject_email: string
          subject_id: string
          suspicious: boolean
        }[]
      }
      admin_set_role: {
        Args: {
          _email?: string
          _grant?: boolean
          _role?: Database["public"]["Enums"]["app_role"]
          _user_id?: string
        }
        Returns: {
          granted: boolean
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }[]
      }
      admin_subscriptions_summary: { Args: never; Returns: Json }
      admin_update_setting: {
        Args: { _key: string; _value: Json }
        Returns: Json
      }
      admin_usage_summary: {
        Args: { _since?: string }
        Returns: {
          caption_seconds_used: number
          credits_seconds: number
          dub_count: number
          dub_seconds_used: number
          export_count_used: number
          full_name: string
          plan: Database["public"]["Enums"]["plan_tier"]
          total_events: number
          transcribe_count: number
          translate_count: number
          user_id: string
        }[]
      }
      can_manage_team: {
        Args: { _team_id: string; _user_id: string }
        Returns: boolean
      }
      check_and_record_usage: {
        Args: {
          _function: string
          _per_day: number
          _per_hour: number
          _per_minute: number
          _user_id: string
        }
        Returns: undefined
      }
      cleanup_stale_processing: { Args: never; Returns: number }
      consume_quota: {
        Args: {
          _amount: number
          _kind: Database["public"]["Enums"]["meter_kind"]
          _user_id: string
        }
        Returns: {
          quota: number
          remaining: number
          used: number
        }[]
      }
      current_user_email: { Args: never; Returns: string }
      deduct_credits: {
        Args: {
          _amount: number
          _metadata?: Json
          _reference_id?: string
          _reference_type?: string
          _user_id: string
        }
        Returns: {
          balance: number
          plan_credits: number
          topup_credits: number
          tx_id: string
        }[]
      }
      finalize_reservation: {
        Args: { p_actual_amount?: number; p_txn_id: string }
        Returns: {
          balance: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_credits_seconds: {
        Args: { add_seconds: number; target_user: string }
        Returns: number
      }
      is_team_member: {
        Args: { _team_id: string; _user_id: string }
        Returns: boolean
      }
      log_admin_access_attempt: {
        Args: { _allowed: boolean; _path: string; _user_agent?: string }
        Returns: string
      }
      mark_error_alerted: { Args: { _id: string }; Returns: undefined }
      my_pending_invitations: {
        Args: never
        Returns: {
          expires_at: string
          id: string
          invited_by: string
          invited_by_name: string
          role: Database["public"]["Enums"]["team_role"]
          team_id: string
          team_name: string
          token: string
        }[]
      }
      my_usage: {
        Args: never
        Returns: {
          kind: Database["public"]["Enums"]["meter_kind"]
          period_start: string
          quota: number
          remaining: number
          used: number
        }[]
      }
      plan_quota: {
        Args: {
          _kind: Database["public"]["Enums"]["meter_kind"]
          _plan: Database["public"]["Enums"]["plan_tier"]
        }
        Returns: number
      }
      record_error_log: {
        Args: {
          _context: Json
          _fingerprint: string
          _function_name: string
          _message: string
          _release: string
          _severity: Database["public"]["Enums"]["error_severity"]
          _source: Database["public"]["Enums"]["error_source"]
          _stack: string
          _url: string
          _user_agent: string
          _user_id: string
        }
        Returns: {
          alerted_at: string
          id: string
          is_new: boolean
          occurrence_count: number
          severity: Database["public"]["Enums"]["error_severity"]
        }[]
      }
      refund_reservation: {
        Args: { p_reason?: string; p_txn_id: string }
        Returns: {
          balance: number
        }[]
      }
      reserve_credits: {
        Args: {
          p_amount: number
          p_metadata?: Json
          p_reference_id?: string
          p_reference_type?: string
          p_user_id: string
        }
        Returns: string
      }
      reset_plan_credits_for_all: { Args: never; Returns: number }
      team_role_of: {
        Args: { _team_id: string; _user_id: string }
        Returns: Database["public"]["Enums"]["team_role"]
      }
    }
    Enums: {
      app_role: "admin" | "user"
      asset_category: "font" | "image" | "audio" | "video" | "logo" | "preset"
      error_severity: "info" | "warning" | "error" | "critical"
      error_source: "frontend" | "edge_function" | "database" | "external"
      job_kind: "transcribe" | "dub" | "translate"
      job_status: "queued" | "running" | "succeeded" | "failed" | "canceled"
      meter_kind: "caption_seconds" | "dub_seconds" | "export_count"
      plan_tier: "starter" | "creator" | "studio"
      project_status: "uploading" | "processing" | "ready" | "failed"
      security_audit_kind:
        | "role_granted"
        | "role_revoked"
        | "admin_access_denied"
        | "admin_access_ok"
      security_finding_severity: "info" | "low" | "medium" | "high" | "critical"
      security_finding_status: "open" | "accepted" | "fixed"
      team_role: "owner" | "admin" | "editor" | "viewer"
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
      app_role: ["admin", "user"],
      asset_category: ["font", "image", "audio", "video", "logo", "preset"],
      error_severity: ["info", "warning", "error", "critical"],
      error_source: ["frontend", "edge_function", "database", "external"],
      job_kind: ["transcribe", "dub", "translate"],
      job_status: ["queued", "running", "succeeded", "failed", "canceled"],
      meter_kind: ["caption_seconds", "dub_seconds", "export_count"],
      plan_tier: ["starter", "creator", "studio"],
      project_status: ["uploading", "processing", "ready", "failed"],
      security_audit_kind: [
        "role_granted",
        "role_revoked",
        "admin_access_denied",
        "admin_access_ok",
      ],
      security_finding_severity: ["info", "low", "medium", "high", "critical"],
      security_finding_status: ["open", "accepted", "fixed"],
      team_role: ["owner", "admin", "editor", "viewer"],
    },
  },
} as const
