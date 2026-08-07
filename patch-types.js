import fs from 'fs';

let content = fs.readFileSync('src/integrations/supabase/types.ts', 'utf-8');

// Patch credit_wallets
content = content.replace(
  /plan_credits: number\n          plan_credits_reset_at: string \| null/g,
  "account_credit_balance: number\n          plan_credits: number\n          plan_credits_reset_at: string | null"
);
content = content.replace(
  /plan_credits\?: number\n          plan_credits_reset_at\?: string \| null/g,
  "account_credit_balance?: number\n          plan_credits?: number\n          plan_credits_reset_at?: string | null"
);

// Patch projects
content = content.replace(
  /duration_seconds: number \| null\n          error_message: string \| null/g,
  "duration_seconds: number | null\n          error_message: string | null\n          expires_at: string | null"
);
content = content.replace(
  /duration_seconds\?: number \| null\n          error_message\?: string \| null/g,
  "duration_seconds?: number | null\n          error_message?: string | null\n          expires_at?: string | null"
);
content = content.replace(
  /updated_at: string \| null\n          user_id: string/g,
  "updated_at: string | null\n          uploaded_at: string | null\n          user_id: string"
);
content = content.replace(
  /updated_at\?: string \| null\n          user_id\?: string/g,
  "updated_at?: string | null\n          uploaded_at?: string | null\n          user_id?: string"
);

// Patch profiles
content = content.replace(
  /avatar_url: string \| null\n          created_at: string/g,
  "admin_locked_until: string | null\n          avatar_url: string | null\n          created_at: string"
);
content = content.replace(
  /avatar_url\?: string \| null\n          created_at\?: string/g,
  "admin_locked_until?: string | null\n          avatar_url?: string | null\n          created_at?: string"
);
content = content.replace(
  /plan: string \| null\n          preferences: Json \| null/g,
  "plan: string | null\n          preferences: Json | null\n          secret_attempts: number"
);
content = content.replace(
  /plan\?: string \| null\n          preferences\?: Json \| null/g,
  "plan?: string | null\n          preferences?: Json | null\n          secret_attempts?: number"
);

// Add missing tables
const NEW_TABLES = `
      admin_trusted_devices: {
        Row: {
          created_at: string
          device_hash: string
          expires_at: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          device_hash: string
          expires_at: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          device_hash?: string
          expires_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_trusted_devices_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      audit_logs: {
        Row: {
          action: string
          admin_id: string
          created_at: string
          details: Json | null
          id: string
          target_user_id: string | null
        }
        Insert: {
          action: string
          admin_id: string
          created_at?: string
          details?: Json | null
          id?: string
          target_user_id?: string | null
        }
        Update: {
          action?: string
          admin_id?: string
          created_at?: string
          details?: Json | null
          id?: string
          target_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_target_user_id_fkey"
            columns: ["target_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      brand_kits: {
        Row: {
          animations: Json | null
          created_at: string
          custom_text: string | null
          id: string
          logo_url: string | null
          name: string | null
          opacity: number
          placement: string
          size_percent: number
          updated_at: string
          user_id: string
        }
        Insert: {
          animations?: Json | null
          created_at?: string
          custom_text?: string | null
          id?: string
          logo_url?: string | null
          name?: string | null
          opacity?: number
          placement?: string
          size_percent?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          animations?: Json | null
          created_at?: string
          custom_text?: string | null
          id?: string
          logo_url?: string | null
          name?: string | null
          opacity?: number
          placement?: string
          size_percent?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_kits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      speaker_presets: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
          position: string
          user_id: string
        }
        Insert: {
          color: string
          created_at?: string
          id?: string
          name: string
          position: string
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
          position?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "speaker_presets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
`;

content = content.replace("public: {\n    Tables: {\n", "public: {\n    Tables: {\n" + NEW_TABLES);

fs.writeFileSync('src/integrations/supabase/types.ts', content);
console.log("Patched types.ts!");
