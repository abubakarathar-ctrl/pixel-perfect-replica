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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      activities: {
        Row: {
          body: string | null
          company_id: string
          contact_id: string | null
          created_at: string
          id: string
          type: Database["public"]["Enums"]["activity_type"]
          user_id: string | null
        }
        Insert: {
          body?: string | null
          company_id: string
          contact_id?: string | null
          created_at?: string
          id?: string
          type?: Database["public"]["Enums"]["activity_type"]
          user_id?: string | null
        }
        Update: {
          body?: string | null
          company_id?: string
          contact_id?: string | null
          created_at?: string
          id?: string
          type?: Database["public"]["Enums"]["activity_type"]
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activities_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      api_keys: {
        Row: {
          last4: string
          provider: string
          secret_value: string
          updated_at: string
        }
        Insert: {
          last4: string
          provider: string
          secret_value: string
          updated_at?: string
        }
        Update: {
          last4?: string
          provider?: string
          secret_value?: string
          updated_at?: string
        }
        Relationships: []
      }
      companies: {
        Row: {
          created_at: string
          follow_up_date: string | null
          funding_stage: string | null
          id: string
          linkedin_url: string | null
          location: string | null
          name: string
          owner_id: string | null
          score: number
          size: string | null
          stage: Database["public"]["Enums"]["pipeline_stage"]
          tier: Database["public"]["Enums"]["lead_tier"]
          website: string | null
        }
        Insert: {
          created_at?: string
          follow_up_date?: string | null
          funding_stage?: string | null
          id?: string
          linkedin_url?: string | null
          location?: string | null
          name: string
          owner_id?: string | null
          score?: number
          size?: string | null
          stage?: Database["public"]["Enums"]["pipeline_stage"]
          tier?: Database["public"]["Enums"]["lead_tier"]
          website?: string | null
        }
        Update: {
          created_at?: string
          follow_up_date?: string | null
          funding_stage?: string | null
          id?: string
          linkedin_url?: string | null
          location?: string | null
          name?: string
          owner_id?: string | null
          score?: number
          size?: string | null
          stage?: Database["public"]["Enums"]["pipeline_stage"]
          tier?: Database["public"]["Enums"]["lead_tier"]
          website?: string | null
        }
        Relationships: []
      }
      contacts: {
        Row: {
          company_id: string
          contact_type: Database["public"]["Enums"]["contact_type"]
          email: string | null
          email_status: Database["public"]["Enums"]["email_status"]
          full_name: string
          id: string
          linkedin_url: string | null
          source: string | null
          title: string | null
        }
        Insert: {
          company_id: string
          contact_type?: Database["public"]["Enums"]["contact_type"]
          email?: string | null
          email_status?: Database["public"]["Enums"]["email_status"]
          full_name: string
          id?: string
          linkedin_url?: string | null
          source?: string | null
          title?: string | null
        }
        Update: {
          company_id?: string
          contact_type?: Database["public"]["Enums"]["contact_type"]
          email?: string | null
          email_status?: Database["public"]["Enums"]["email_status"]
          full_name?: string
          id?: string
          linkedin_url?: string | null
          source?: string | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          company_id: string
          employment_type: Database["public"]["Enums"]["employment_type"]
          found_date: string
          id: string
          is_live: boolean
          job_url: string | null
          remote_us: boolean
          role_family: string | null
          source: string | null
          title: string
        }
        Insert: {
          company_id: string
          employment_type?: Database["public"]["Enums"]["employment_type"]
          found_date?: string
          id?: string
          is_live?: boolean
          job_url?: string | null
          remote_us?: boolean
          role_family?: string | null
          source?: string | null
          title: string
        }
        Update: {
          company_id?: string
          employment_type?: Database["public"]["Enums"]["employment_type"]
          found_date?: string
          id?: string
          is_live?: boolean
          job_url?: string | null
          remote_us?: boolean
          role_family?: string | null
          source?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "jobs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
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
      can_see_company: { Args: { _cid: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      activity_type: "note" | "email" | "call" | "meeting" | "status_change"
      app_role: "admin" | "member" | "owner" | "manager" | "bd"
      contact_type: "recruiter_hr" | "decision_maker"
      email_status: "valid" | "risky" | "invalid" | "unknown"
      employment_type: "contract" | "contract_friendly" | "full_time"
      lead_tier: "hot" | "warm" | "cold"
      pipeline_stage:
        | "new"
        | "verified"
        | "contacted"
        | "replied"
        | "meeting"
        | "won"
        | "lost"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      activity_type: ["note", "email", "call", "meeting", "status_change"],
      app_role: ["admin", "member", "owner", "manager", "bd"],
      contact_type: ["recruiter_hr", "decision_maker"],
      email_status: ["valid", "risky", "invalid", "unknown"],
      employment_type: ["contract", "contract_friendly", "full_time"],
      lead_tier: ["hot", "warm", "cold"],
      pipeline_stage: [
        "new",
        "verified",
        "contacted",
        "replied",
        "meeting",
        "won",
        "lost",
      ],
    },
  },
} as const
