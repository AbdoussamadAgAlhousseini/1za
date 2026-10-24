
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "app_settings": {
                  Row: {
                    "default_currency": string,"expiring_soon_days": number,"id": boolean,"long_visit_hours": number,"stadium_name": string,"timezone": string,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "default_currency"?: string,"expiring_soon_days"?: number,"id"?: boolean,"long_visit_hours"?: number,"stadium_name"?: string,"timezone"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "default_currency"?: string,"expiring_soon_days"?: number,"id"?: boolean,"long_visit_hours"?: number,"stadium_name"?: string,"timezone"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "app_settings_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"athletes": {
                  Row: {
                    "created_at": string,"created_by": string | null,"id": string,"matricule": string,"registered_on": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"matricule": string,"registered_on": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"matricule"?: string,"registered_on"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "athletes_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"audit_logs": {
                  Row: {
                    "action": string,"actor_id": string | null,"details": NonNullable<Json>,"entity_id": string | null,"entity_type": string,"id": number,"occurred_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"details"?: NonNullable<Json>,"entity_id"?: string | null,"entity_type": string,"id"?: never,"occurred_at"?: string
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"details"?: NonNullable<Json>,"entity_id"?: string | null,"entity_type"?: string,"id"?: never,"occurred_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "audit_logs_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"payments": {
                  Row: {
                    "amount": number,"athlete_id": string,"cancel_reason": string | null,"cancelled_at": string | null,"cancelled_by": string | null,"created_at": string,"currency": string,"id": string,"method": Database["public"]['Enums']["payment_method"],"paid_on": string,"recorded_by": string,"reference": string | null,"status": Database["public"]['Enums']["payment_status"],"subscription_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"athlete_id": string,"cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"created_at"?: string,"currency": string,"id"?: string,"method": Database["public"]['Enums']["payment_method"],"paid_on": string,"recorded_by": string,"reference"?: string | null,"status"?: Database["public"]['Enums']["payment_status"],"subscription_id"?: string | null
                  }
                  Update: {
                    "amount"?: number,"athlete_id"?: string,"cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"created_at"?: string,"currency"?: string,"id"?: string,"method"?: Database["public"]['Enums']["payment_method"],"paid_on"?: string,"recorded_by"?: string,"reference"?: string | null,"status"?: Database["public"]['Enums']["payment_status"],"subscription_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "payments_athlete_id_fkey"
      columns: ["athlete_id"]
isOneToOne: false
      referencedRelation: "athlete_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payments_athlete_id_fkey"
      columns: ["athlete_id"]
isOneToOne: false
      referencedRelation: "athletes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payments_cancelled_by_fkey"
      columns: ["cancelled_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payments_recorded_by_fkey"
      columns: ["recorded_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payments_subscription_id_fkey"
      columns: ["subscription_id"]
isOneToOne: false
      referencedRelation: "athlete_overview"
      referencedColumns: ["subscription_id"]
    },{
      foreignKeyName: "payments_subscription_id_fkey"
      columns: ["subscription_id"]
isOneToOne: false
      referencedRelation: "subscription_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payments_subscription_id_fkey"
      columns: ["subscription_id"]
isOneToOne: false
      referencedRelation: "subscriptions"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"deactivated_at": string | null,"display_name": string,"id": string,"is_active": boolean,"role": Database["public"]['Enums']["app_role"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"deactivated_at"?: string | null,"display_name": string,"id": string,"is_active"?: boolean,"role"?: Database["public"]['Enums']["app_role"],"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"deactivated_at"?: string | null,"display_name"?: string,"id"?: string,"is_active"?: boolean,"role"?: Database["public"]['Enums']["app_role"],"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"subscription_plans": {
                  Row: {
                    "created_at": string,"created_by": string | null,"currency": string,"duration_days": number,"id": string,"is_active": boolean,"name": string,"price": number | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"currency"?: string,"duration_days": number,"id"?: string,"is_active"?: boolean,"name": string,"price"?: number | null,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"currency"?: string,"duration_days"?: number,"id"?: string,"is_active"?: boolean,"name"?: string,"price"?: number | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "subscription_plans_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"subscriptions": {
                  Row: {
                    "athlete_id": string,"created_at": string,"created_by": string | null,"ends_on": string,"id": string,"plan_id": string | null,"renewed_from_id": string | null,"starts_on": string,"state": Database["public"]['Enums']["subscription_state"],"state_changed_at": string | null,"state_changed_by": string | null,"state_reason": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "athlete_id": string,"created_at"?: string,"created_by"?: string | null,"ends_on": string,"id"?: string,"plan_id"?: string | null,"renewed_from_id"?: string | null,"starts_on": string,"state"?: Database["public"]['Enums']["subscription_state"],"state_changed_at"?: string | null,"state_changed_by"?: string | null,"state_reason"?: string | null
                  }
                  Update: {
                    "athlete_id"?: string,"created_at"?: string,"created_by"?: string | null,"ends_on"?: string,"id"?: string,"plan_id"?: string | null,"renewed_from_id"?: string | null,"starts_on"?: string,"state"?: Database["public"]['Enums']["subscription_state"],"state_changed_at"?: string | null,"state_changed_by"?: string | null,"state_reason"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "subscriptions_athlete_id_fkey"
      columns: ["athlete_id"]
isOneToOne: false
      referencedRelation: "athlete_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "subscriptions_athlete_id_fkey"
      columns: ["athlete_id"]
isOneToOne: false
      referencedRelation: "athletes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "subscriptions_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "subscriptions_plan_id_fkey"
      columns: ["plan_id"]
isOneToOne: false
      referencedRelation: "subscription_plans"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "subscriptions_renewed_from_id_fkey"
      columns: ["renewed_from_id"]
isOneToOne: false
      referencedRelation: "athlete_overview"
      referencedColumns: ["subscription_id"]
    },{
      foreignKeyName: "subscriptions_renewed_from_id_fkey"
      columns: ["renewed_from_id"]
isOneToOne: false
      referencedRelation: "subscription_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "subscriptions_renewed_from_id_fkey"
      columns: ["renewed_from_id"]
isOneToOne: false
      referencedRelation: "subscriptions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "subscriptions_state_changed_by_fkey"
      columns: ["state_changed_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"visits": {
                  Row: {
                    "athlete_id": string,"corrected_at": string | null,"corrected_by": string | null,"correction_reason": string | null,"duration_seconds": number | null,"entered_at": string,"entry_agent_id": string,"exit_agent_id": string | null,"exited_at": string | null,"id": string,"status": Database["public"]['Enums']["visit_status"],"subscription_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "athlete_id": string,"corrected_at"?: string | null,"corrected_by"?: string | null,"correction_reason"?: string | null,"duration_seconds"?: never,"entered_at"?: string,"entry_agent_id": string,"exit_agent_id"?: string | null,"exited_at"?: string | null,"id"?: string,"status"?: Database["public"]['Enums']["visit_status"],"subscription_id": string
                  }
                  Update: {
                    "athlete_id"?: string,"corrected_at"?: string | null,"corrected_by"?: string | null,"correction_reason"?: string | null,"duration_seconds"?: never,"entered_at"?: string,"entry_agent_id"?: string,"exit_agent_id"?: string | null,"exited_at"?: string | null,"id"?: string,"status"?: Database["public"]['Enums']["visit_status"],"subscription_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "visits_athlete_id_fkey"
      columns: ["athlete_id"]
isOneToOne: false
      referencedRelation: "athlete_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "visits_athlete_id_fkey"
      columns: ["athlete_id"]
isOneToOne: false
      referencedRelation: "athletes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "visits_corrected_by_fkey"
      columns: ["corrected_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "visits_entry_agent_id_fkey"
      columns: ["entry_agent_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "visits_exit_agent_id_fkey"
      columns: ["exit_agent_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "visits_subscription_id_fkey"
      columns: ["subscription_id"]
isOneToOne: false
      referencedRelation: "athlete_overview"
      referencedColumns: ["subscription_id"]
    },{
      foreignKeyName: "visits_subscription_id_fkey"
      columns: ["subscription_id"]
isOneToOne: false
      referencedRelation: "subscription_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "visits_subscription_id_fkey"
      columns: ["subscription_id"]
isOneToOne: false
      referencedRelation: "subscriptions"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            "athlete_overview": {
                  Row: {
                    "created_at": string,"days_remaining": number | null,"ends_on": string | null,"expiring_soon": boolean | null,"has_next_subscription": boolean | null,"id": string,"last_visit_at": string | null,"matricule": string,"plan_name": string | null,"registered_on": string,"starts_on": string | null,"status": string | null,"subscription_id": string | null,"subscription_state": Database["public"]['Enums']["subscription_state"] | null,"visit_count": number | null
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                },"audit_log_view": {
                  Row: {
                    "action": string,"actor_id": string | null,"actor_name": string | null,"actor_role": Database["public"]['Enums']["app_role"] | null,"details": NonNullable<Json>,"entity_id": string | null,"entity_type": string,"id": number,"matricule": string | null,"occurred_at": string
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "audit_logs_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"payment_log": {
                  Row: {
                    "amount": number,"athlete_id": string,"cancel_reason": string | null,"cancelled_at": string | null,"created_at": string,"currency": string,"id": string,"matricule": string,"method": Database["public"]['Enums']["payment_method"],"paid_on": string,"plan_name": string | null,"recorded_by": string,"recorded_by_name": string | null,"reference": string | null,"status": Database["public"]['Enums']["payment_status"],"subscription_id": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "payments_athlete_id_fkey"
      columns: ["athlete_id"]
isOneToOne: false
      referencedRelation: "athlete_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payments_athlete_id_fkey"
      columns: ["athlete_id"]
isOneToOne: false
      referencedRelation: "athletes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payments_recorded_by_fkey"
      columns: ["recorded_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payments_subscription_id_fkey"
      columns: ["subscription_id"]
isOneToOne: false
      referencedRelation: "athlete_overview"
      referencedColumns: ["subscription_id"]
    },{
      foreignKeyName: "payments_subscription_id_fkey"
      columns: ["subscription_id"]
isOneToOne: false
      referencedRelation: "subscription_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payments_subscription_id_fkey"
      columns: ["subscription_id"]
isOneToOne: false
      referencedRelation: "subscriptions"
      referencedColumns: ["id"]
    }
                  ]
                },"subscription_overview": {
                  Row: {
                    "athlete_id": string,"created_at": string,"created_by": string | null,"created_by_name": string | null,"days_remaining": number | null,"ends_on": string,"has_successor": boolean | null,"id": string,"length_days": number | null,"matricule": string,"paid_amount": number | null,"plan_id": string | null,"plan_name": string | null,"renewed_from_id": string | null,"starts_on": string,"state": Database["public"]['Enums']["subscription_state"],"state_changed_at": string | null,"state_reason": string | null,"validity": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "subscriptions_athlete_id_fkey"
      columns: ["athlete_id"]
isOneToOne: false
      referencedRelation: "athlete_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "subscriptions_athlete_id_fkey"
      columns: ["athlete_id"]
isOneToOne: false
      referencedRelation: "athletes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "subscriptions_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "subscriptions_plan_id_fkey"
      columns: ["plan_id"]
isOneToOne: false
      referencedRelation: "subscription_plans"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "subscriptions_renewed_from_id_fkey"
      columns: ["renewed_from_id"]
isOneToOne: false
      referencedRelation: "athlete_overview"
      referencedColumns: ["subscription_id"]
    },{
      foreignKeyName: "subscriptions_renewed_from_id_fkey"
      columns: ["renewed_from_id"]
isOneToOne: false
      referencedRelation: "subscription_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "subscriptions_renewed_from_id_fkey"
      columns: ["renewed_from_id"]
isOneToOne: false
      referencedRelation: "subscriptions"
      referencedColumns: ["id"]
    }
                  ]
                },"visit_log": {
                  Row: {
                    "athlete_id": string,"corrected_at": string | null,"corrected_by": string | null,"corrected_by_name": string | null,"correction_reason": string | null,"duration_seconds": number | null,"entered_at": string,"entry_agent_id": string,"entry_agent_name": string | null,"exit_agent_id": string | null,"exit_agent_name": string | null,"exited_at": string | null,"id": string,"matricule": string,"status": Database["public"]['Enums']["visit_status"],"subscription_id": string,"visit_date": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "visits_athlete_id_fkey"
      columns: ["athlete_id"]
isOneToOne: false
      referencedRelation: "athlete_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "visits_athlete_id_fkey"
      columns: ["athlete_id"]
isOneToOne: false
      referencedRelation: "athletes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "visits_corrected_by_fkey"
      columns: ["corrected_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "visits_entry_agent_id_fkey"
      columns: ["entry_agent_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "visits_exit_agent_id_fkey"
      columns: ["exit_agent_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "visits_subscription_id_fkey"
      columns: ["subscription_id"]
isOneToOne: false
      referencedRelation: "athlete_overview"
      referencedColumns: ["subscription_id"]
    },{
      foreignKeyName: "visits_subscription_id_fkey"
      columns: ["subscription_id"]
isOneToOne: false
      referencedRelation: "subscription_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "visits_subscription_id_fkey"
      columns: ["subscription_id"]
isOneToOne: false
      referencedRelation: "subscriptions"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Functions: {
            "admin_cancel_payment":
{ Args: { "p_payment_id": string,"p_reason": string }; Returns: undefined
                           },
"admin_correct_visit":
{ Args: { "p_action": string,"p_exited_at": string,"p_reason": string,"p_visit_id": string }; Returns: undefined
                           },
"admin_create_athlete":
{ Args: { "p_matricule": string,"p_registered_on"?: string }; Returns: string
                           },
"admin_create_subscription":
{ Args: { "p_athlete_id": string,"p_ends_on"?: string,"p_paid_on"?: string,"p_payment_amount"?: number,"p_payment_currency"?: string,"p_payment_method"?: Database["public"]['Enums']["payment_method"],"p_payment_reference"?: string,"p_plan_id": string,"p_renewed_from_id"?: string,"p_starts_on": string }; Returns: string
                           },
"admin_log_export":
{ Args: { "p_kind": string,"p_params": Json }; Returns: undefined
                           },
"admin_record_payment":
{ Args: { "p_amount": number,"p_athlete_id": string,"p_currency": string,"p_method": Database["public"]['Enums']["payment_method"],"p_paid_on": string,"p_reference"?: string,"p_subscription_id": string }; Returns: string
                           },
"admin_register_staff":
{ Args: { "p_display_name": string,"p_role": Database["public"]['Enums']["app_role"],"p_user_id": string }; Returns: undefined
                           },
"admin_save_plan":
{ Args: { "p_currency": string,"p_duration_days": number,"p_id": string,"p_is_active": boolean,"p_name": string,"p_price": number }; Returns: string
                           },
"admin_set_staff_active":
{ Args: { "p_active": boolean,"p_user_id": string }; Returns: undefined
                           },
"admin_set_subscription_state":
{ Args: { "p_reason": string,"p_state": Database["public"]['Enums']["subscription_state"],"p_subscription_id": string }; Returns: undefined
                           },
"admin_update_settings":
{ Args: { "p_default_currency": string,"p_expiring_soon_days": number,"p_long_visit_hours": number,"p_stadium_name": string,"p_timezone": string }; Returns: undefined
                           },
"app_today":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"control_check":
{ Args: { "p_matricule": string }; Returns: Json
                           },
"control_my_activity":
{ Args: { "p_limit"?: number }; Returns: {
              "kind": string,"matricule": string,"occurred_at": string
            }[]
                           },
"control_overview":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"control_present":
{ Args: { "p_limit"?: number }; Returns: {
              "entered_at": string,"matricule": string
            }[]
                           },
"control_record_entry":
{ Args: { "p_matricule": string }; Returns: Json
                           },
"control_record_exit":
{ Args: { "p_matricule": string }; Returns: Json
                           },
"current_app_role":
{ Args: Record<PropertyKey, never>; Returns: Database["public"]['Enums']["app_role"]
                           },
"is_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_staff":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_valid_matricule":
{ Args: { "p_value": string }; Returns: boolean
                           },
"normalize_matricule":
{ Args: { "p_value": string }; Returns: string
                           },
"stats_agents":
{ Args: { "p_from": string,"p_to": string }; Returns: {
              "display_name": string,"entries_recorded": number,"exits_recorded": number,"is_active": boolean,"last_activity_at": string,"profile_id": string,"role": Database["public"]['Enums']["app_role"]
            }[]
                           },
"stats_athlete":
{ Args: { "p_athlete_id": string }; Returns: Json
                           },
"stats_attendance":
{ Args: { "p_athlete_id"?: string,"p_from": string,"p_granularity"?: string,"p_to": string }; Returns: {
              "avg_duration_seconds": number,"bucket": string,"completed": number,"entries": number,"total_duration_seconds": number,"unique_athletes": number
            }[]
                           },
"stats_dashboard":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"stats_peak_hours":
{ Args: { "p_from": string,"p_to": string }; Returns: {
              "entries": number,"hour": number,"iso_dow": number
            }[]
                           },
"stats_revenue":
{ Args: { "p_from": string,"p_to": string }; Returns: {
              "currency": string,"payments": number,"plan_name": string,"total": number
            }[]
                           },
"subscription_validity":
{ Args: { "p_ends_on": string,"p_starts_on": string,"p_state": Database["public"]['Enums']["subscription_state"],"p_today": string }; Returns: string
                           }
          }
          Enums: {
            "app_role": "admin"|"agent","payment_method": "cash"|"mobile_money"|"bank_transfer"|"card"|"other","payment_status": "recorded"|"cancelled","subscription_state": "active"|"suspended"|"cancelled","visit_status": "open"|"closed"|"cancelled"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "app_role": ["admin", "agent"],"payment_method": ["cash", "mobile_money", "bank_transfer", "card", "other"],"payment_status": ["recorded", "cancelled"],"subscription_state": ["active", "suspended", "cancelled"],"visit_status": ["open", "closed", "cancelled"]
          }
        }
} as const
