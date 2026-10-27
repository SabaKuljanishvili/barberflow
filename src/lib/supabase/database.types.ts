// Mirrors supabase/migrations. Regenerate with:
//   npx supabase gen types typescript --project-id <id> > src/lib/supabase/database.types.ts

export type StaffRole = "manager" | "barber";
export type AppointmentStatus = "pending" | "confirmed" | "cancelled" | "completed";
export type SubscriptionStatus = "trialing" | "active" | "past_due" | "cancelled";
export type CallOutcome = "booked" | "abandoned" | "no_availability" | "error";
export type LocaleCode = "ka" | "en";

export type Database = {
  __InternalSupabase: { PostgrestVersion: "12" };
  public: {
    Tables: {
      salons: {
        Row: {
          id: string;
          name: string;
          subscription_status: SubscriptionStatus;
          phone_number: string | null;
          timezone: string;
          opens_at: string;
          closes_at: string;
          working_days: number[];
          voice_agent_enabled: boolean;
          locale: LocaleCode;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          subscription_status?: SubscriptionStatus;
          phone_number?: string | null;
          timezone?: string;
          opens_at?: string;
          closes_at?: string;
          working_days?: number[];
          voice_agent_enabled?: boolean;
          locale?: LocaleCode;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["salons"]["Insert"]>;
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          salon_id: string;
          full_name: string;
          role: StaffRole;
          email: string;
          phone: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          salon_id: string;
          full_name: string;
          role?: StaffRole;
          email: string;
          phone?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "profiles_salon_id_fkey";
            columns: ["salon_id"];
            isOneToOne: false;
            referencedRelation: "salons";
            referencedColumns: ["id"];
          },
        ];
      };
      services: {
        Row: {
          id: string;
          salon_id: string;
          name: string;
          price: number;
          duration_minutes: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          salon_id: string;
          name: string;
          price: number;
          duration_minutes: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["services"]["Insert"]>;
        Relationships: [];
      };
      clients: {
        Row: {
          id: string;
          salon_id: string;
          first_name: string;
          last_name: string;
          phone_number: string;
          locale: LocaleCode | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          salon_id: string;
          first_name?: string;
          last_name?: string;
          phone_number: string;
          locale?: LocaleCode | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["clients"]["Insert"]>;
        Relationships: [];
      };
      appointments: {
        Row: {
          id: string;
          salon_id: string;
          client_id: string;
          staff_id: string;
          service_id: string;
          appointment_time: string;
          ends_at: string;
          status: AppointmentStatus;
          reminder_sent_at: string | null;
          source: "dashboard" | "voice";
          created_at: string;
        };
        Insert: {
          id?: string;
          salon_id: string;
          client_id: string;
          staff_id: string;
          service_id: string;
          appointment_time: string;
          // Set by trigger; any value supplied is overwritten.
          ends_at?: string;
          status?: AppointmentStatus;
          reminder_sent_at?: string | null;
          source?: "dashboard" | "voice";
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["appointments"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "appointments_salon_id_fkey";
            columns: ["salon_id"];
            isOneToOne: false;
            referencedRelation: "salons";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "appointments_client_id_salon_id_fkey";
            columns: ["client_id", "salon_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id", "salon_id"];
          },
          {
            foreignKeyName: "appointments_staff_id_salon_id_fkey";
            columns: ["staff_id", "salon_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id", "salon_id"];
          },
          {
            foreignKeyName: "appointments_service_id_salon_id_fkey";
            columns: ["service_id", "salon_id"];
            isOneToOne: false;
            referencedRelation: "services";
            referencedColumns: ["id", "salon_id"];
          },
        ];
      };
      appointments_archive: {
        Row: {
          id: string;
          salon_id: string;
          client_id: string | null;
          staff_id: string | null;
          service_id: string | null;
          appointment_time: string;
          ends_at: string;
          status: AppointmentStatus;
          source: string;
          price: number | null;
          created_at: string;
          archived_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      call_logs: {
        Row: {
          id: string;
          salon_id: string;
          call_sid: string;
          from_number: string;
          client_id: string | null;
          appointment_id: string | null;
          outcome: CallOutcome;
          call_status: string | null;
          duration_seconds: number | null;
          ended_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          salon_id: string;
          call_sid: string;
          from_number: string;
          client_id?: string | null;
          appointment_id?: string | null;
          outcome?: CallOutcome;
          call_status?: string | null;
          duration_seconds?: number | null;
          ended_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["call_logs"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<never, never>;
    Functions: {
      current_salon_id: { Args: Record<string, never>; Returns: string };
      is_manager: { Args: Record<string, never>; Returns: boolean };
      archive_old_appointments: { Args: Record<string, never>; Returns: number };
    };
    Enums: {
      staff_role: StaffRole;
      appointment_status: AppointmentStatus;
      subscription_status: SubscriptionStatus;
      call_outcome: CallOutcome;
    };
    CompositeTypes: Record<never, never>;
  };
};

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
