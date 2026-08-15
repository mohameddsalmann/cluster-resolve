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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      ai_decision_candidates: {
        Row: {
          created_at: string
          dataset_id: string
          decision_id: string
          feasible: boolean
          feature_values: Json | null
          id: string
          infeasible_reason: string | null
          rank: number | null
          score: number | null
          supplier_id: string
        }
        Insert: {
          created_at?: string
          dataset_id: string
          decision_id: string
          feasible?: boolean
          feature_values?: Json | null
          id?: string
          infeasible_reason?: string | null
          rank?: number | null
          score?: number | null
          supplier_id: string
        }
        Update: {
          created_at?: string
          dataset_id?: string
          decision_id?: string
          feasible?: boolean
          feature_values?: Json | null
          id?: string
          infeasible_reason?: string | null
          rank?: number | null
          score?: number | null
          supplier_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_decision_candidates_dataset_id_decision_id_fkey"
            columns: ["dataset_id", "decision_id"]
            isOneToOne: false
            referencedRelation: "ai_decisions"
            referencedColumns: ["dataset_id", "id"]
          },
          {
            foreignKeyName: "ai_decision_candidates_dataset_id_fkey"
            columns: ["dataset_id"]
            isOneToOne: false
            referencedRelation: "datasets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_decision_candidates_dataset_id_supplier_id_fkey"
            columns: ["dataset_id", "supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["dataset_id", "id"]
          },
        ]
      }
      ai_decisions: {
        Row: {
          agent_name: string | null
          agent_version: string | null
          confidence: number | null
          created_at: string
          dataset_id: string
          decided_at: string
          external_decision_id: string
          id: string
          input_snapshot_json: Json | null
          order_id: string
          selected_supplier_id: string
          selection_reason: string | null
          source_ingestion_job_id: string | null
        }
        Insert: {
          agent_name?: string | null
          agent_version?: string | null
          confidence?: number | null
          created_at?: string
          dataset_id: string
          decided_at: string
          external_decision_id: string
          id?: string
          input_snapshot_json?: Json | null
          order_id: string
          selected_supplier_id: string
          selection_reason?: string | null
          source_ingestion_job_id?: string | null
        }
        Update: {
          agent_name?: string | null
          agent_version?: string | null
          confidence?: number | null
          created_at?: string
          dataset_id?: string
          decided_at?: string
          external_decision_id?: string
          id?: string
          input_snapshot_json?: Json | null
          order_id?: string
          selected_supplier_id?: string
          selection_reason?: string | null
          source_ingestion_job_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_decisions_dataset_id_fkey"
            columns: ["dataset_id"]
            isOneToOne: false
            referencedRelation: "datasets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_decisions_dataset_id_order_id_fkey"
            columns: ["dataset_id", "order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["dataset_id", "id"]
          },
          {
            foreignKeyName: "ai_decisions_dataset_id_selected_supplier_id_fkey"
            columns: ["dataset_id", "selected_supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["dataset_id", "id"]
          },
          {
            foreignKeyName: "ai_decisions_dataset_id_source_ingestion_job_id_fkey"
            columns: ["dataset_id", "source_ingestion_job_id"]
            isOneToOne: false
            referencedRelation: "ingestion_jobs"
            referencedColumns: ["dataset_id", "id"]
          },
        ]
      }
      data_sources: {
        Row: {
          acquisition_mode: string
          created_at: string
          dataset_id: string
          id: string
          kind: string
          last_ingested_at: string | null
          name: string
          source_url: string | null
          status: string
        }
        Insert: {
          acquisition_mode: string
          created_at?: string
          dataset_id: string
          id?: string
          kind: string
          last_ingested_at?: string | null
          name: string
          source_url?: string | null
          status?: string
        }
        Update: {
          acquisition_mode?: string
          created_at?: string
          dataset_id?: string
          id?: string
          kind?: string
          last_ingested_at?: string | null
          name?: string
          source_url?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "data_sources_dataset_id_fkey"
            columns: ["dataset_id"]
            isOneToOne: false
            referencedRelation: "datasets"
            referencedColumns: ["id"]
          },
        ]
      }
      datasets: {
        Row: {
          created_at: string
          description: string | null
          id: string
          mode: string
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          mode: string
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          mode?: string
          name?: string
        }
        Relationships: []
      }
      ingestion_errors: {
        Row: {
          code: string
          created_at: string
          field: string | null
          id: string
          job_id: string
          message: string
          raw_value: string | null
          row_number: number
        }
        Insert: {
          code: string
          created_at?: string
          field?: string | null
          id?: string
          job_id: string
          message: string
          raw_value?: string | null
          row_number: number
        }
        Update: {
          code?: string
          created_at?: string
          field?: string | null
          id?: string
          job_id?: string
          message?: string
          raw_value?: string | null
          row_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "ingestion_errors_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "ingestion_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      ingestion_jobs: {
        Row: {
          created_at: string
          dataset_id: string
          error_message: string | null
          error_rows: number
          file_sha256: string | null
          finished_at: string | null
          id: string
          kind: string
          original_filename: string | null
          processed_rows: number
          source_id: string | null
          started_at: string | null
          status: string
          storage_path: string | null
          total_rows: number | null
          valid_rows: number
        }
        Insert: {
          created_at?: string
          dataset_id: string
          error_message?: string | null
          error_rows?: number
          file_sha256?: string | null
          finished_at?: string | null
          id?: string
          kind: string
          original_filename?: string | null
          processed_rows?: number
          source_id?: string | null
          started_at?: string | null
          status?: string
          storage_path?: string | null
          total_rows?: number | null
          valid_rows?: number
        }
        Update: {
          created_at?: string
          dataset_id?: string
          error_message?: string | null
          error_rows?: number
          file_sha256?: string | null
          finished_at?: string | null
          id?: string
          kind?: string
          original_filename?: string | null
          processed_rows?: number
          source_id?: string | null
          started_at?: string | null
          status?: string
          storage_path?: string | null
          total_rows?: number | null
          valid_rows?: number
        }
        Relationships: [
          {
            foreignKeyName: "ingestion_jobs_dataset_id_fkey"
            columns: ["dataset_id"]
            isOneToOne: false
            referencedRelation: "datasets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ingestion_jobs_dataset_id_source_id_fkey"
            columns: ["dataset_id", "source_id"]
            isOneToOne: false
            referencedRelation: "data_sources"
            referencedColumns: ["dataset_id", "id"]
          },
        ]
      }
      order_exceptions: {
        Row: {
          created_at: string
          dataset_id: string
          detected_at: string
          engine_version: string
          evidence_json: Json
          id: string
          order_id: string
          product_id: string | null
          severity: string
          supplier_id: string | null
          type: string
        }
        Insert: {
          created_at?: string
          dataset_id: string
          detected_at: string
          engine_version: string
          evidence_json: Json
          id?: string
          order_id: string
          product_id?: string | null
          severity: string
          supplier_id?: string | null
          type: string
        }
        Update: {
          created_at?: string
          dataset_id?: string
          detected_at?: string
          engine_version?: string
          evidence_json?: Json
          id?: string
          order_id?: string
          product_id?: string | null
          severity?: string
          supplier_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_exceptions_dataset_id_fkey"
            columns: ["dataset_id"]
            isOneToOne: false
            referencedRelation: "datasets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_exceptions_dataset_id_order_id_fkey"
            columns: ["dataset_id", "order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["dataset_id", "id"]
          },
          {
            foreignKeyName: "order_exceptions_dataset_id_product_id_fkey"
            columns: ["dataset_id", "product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["dataset_id", "id"]
          },
          {
            foreignKeyName: "order_exceptions_dataset_id_supplier_id_fkey"
            columns: ["dataset_id", "supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["dataset_id", "id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          dataset_id: string
          id: string
          order_id: string
          product_id: string
          requested_qty: number
          source_ingestion_job_id: string | null
          unit: string
        }
        Insert: {
          created_at?: string
          dataset_id: string
          id?: string
          order_id: string
          product_id: string
          requested_qty: number
          source_ingestion_job_id?: string | null
          unit?: string
        }
        Update: {
          created_at?: string
          dataset_id?: string
          id?: string
          order_id?: string
          product_id?: string
          requested_qty?: number
          source_ingestion_job_id?: string | null
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_items_dataset_id_fkey"
            columns: ["dataset_id"]
            isOneToOne: false
            referencedRelation: "datasets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_dataset_id_order_id_fkey"
            columns: ["dataset_id", "order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["dataset_id", "id"]
          },
          {
            foreignKeyName: "order_items_dataset_id_product_id_fkey"
            columns: ["dataset_id", "product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["dataset_id", "id"]
          },
          {
            foreignKeyName: "order_items_dataset_source_job_fkey"
            columns: ["dataset_id", "source_ingestion_job_id"]
            isOneToOne: false
            referencedRelation: "ingestion_jobs"
            referencedColumns: ["dataset_id", "id"]
          },
        ]
      }
      order_outcomes: {
        Row: {
          cancellation_reason: string | null
          cancelled: boolean
          created_at: string
          dataset_id: string
          delivered_at: string | null
          filled_qty: number
          id: string
          order_id: string
          outcome_final: boolean
          product_id: string
          source_ingestion_job_id: string | null
          supplier_id: string
        }
        Insert: {
          cancellation_reason?: string | null
          cancelled?: boolean
          created_at?: string
          dataset_id: string
          delivered_at?: string | null
          filled_qty: number
          id?: string
          order_id: string
          outcome_final?: boolean
          product_id: string
          source_ingestion_job_id?: string | null
          supplier_id: string
        }
        Update: {
          cancellation_reason?: string | null
          cancelled?: boolean
          created_at?: string
          dataset_id?: string
          delivered_at?: string | null
          filled_qty?: number
          id?: string
          order_id?: string
          outcome_final?: boolean
          product_id?: string
          source_ingestion_job_id?: string | null
          supplier_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_outcomes_dataset_id_fkey"
            columns: ["dataset_id"]
            isOneToOne: false
            referencedRelation: "datasets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_outcomes_dataset_id_order_id_fkey"
            columns: ["dataset_id", "order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["dataset_id", "id"]
          },
          {
            foreignKeyName: "order_outcomes_dataset_id_product_id_fkey"
            columns: ["dataset_id", "product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["dataset_id", "id"]
          },
          {
            foreignKeyName: "order_outcomes_dataset_id_source_ingestion_job_id_fkey"
            columns: ["dataset_id", "source_ingestion_job_id"]
            isOneToOne: false
            referencedRelation: "ingestion_jobs"
            referencedColumns: ["dataset_id", "id"]
          },
          {
            foreignKeyName: "order_outcomes_dataset_id_supplier_id_fkey"
            columns: ["dataset_id", "supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["dataset_id", "id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string
          dataset_id: string
          external_order_id: string
          id: string
          pharmacy_id: string
          placed_at: string
          source_ingestion_job_id: string | null
          status: string
        }
        Insert: {
          created_at?: string
          dataset_id: string
          external_order_id: string
          id?: string
          pharmacy_id: string
          placed_at: string
          source_ingestion_job_id?: string | null
          status: string
        }
        Update: {
          created_at?: string
          dataset_id?: string
          external_order_id?: string
          id?: string
          pharmacy_id?: string
          placed_at?: string
          source_ingestion_job_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_dataset_id_fkey"
            columns: ["dataset_id"]
            isOneToOne: false
            referencedRelation: "datasets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_dataset_id_pharmacy_id_fkey"
            columns: ["dataset_id", "pharmacy_id"]
            isOneToOne: false
            referencedRelation: "pharmacies"
            referencedColumns: ["dataset_id", "id"]
          },
          {
            foreignKeyName: "orders_dataset_id_source_ingestion_job_id_fkey"
            columns: ["dataset_id", "source_ingestion_job_id"]
            isOneToOne: false
            referencedRelation: "ingestion_jobs"
            referencedColumns: ["dataset_id", "id"]
          },
        ]
      }
      pharmacies: {
        Row: {
          city: string | null
          created_at: string
          dataset_id: string
          external_pharmacy_id: string
          governorate: string | null
          id: string
          name: string | null
          source_ingestion_job_id: string | null
        }
        Insert: {
          city?: string | null
          created_at?: string
          dataset_id: string
          external_pharmacy_id: string
          governorate?: string | null
          id?: string
          name?: string | null
          source_ingestion_job_id?: string | null
        }
        Update: {
          city?: string | null
          created_at?: string
          dataset_id?: string
          external_pharmacy_id?: string
          governorate?: string | null
          id?: string
          name?: string | null
          source_ingestion_job_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pharmacies_dataset_id_fkey"
            columns: ["dataset_id"]
            isOneToOne: false
            referencedRelation: "datasets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pharmacies_dataset_source_job_fkey"
            columns: ["dataset_id", "source_ingestion_job_id"]
            isOneToOne: false
            referencedRelation: "ingestion_jobs"
            referencedColumns: ["dataset_id", "id"]
          },
        ]
      }
      products: {
        Row: {
          created_at: string
          dataset_id: string
          external_product_id: string
          gtin: string | null
          id: string
          manufacturer: string | null
          manufacturer_normalized: string | null
          name: string
          name_normalized: string
          sku: string | null
          source_ingestion_job_id: string | null
        }
        Insert: {
          created_at?: string
          dataset_id: string
          external_product_id: string
          gtin?: string | null
          id?: string
          manufacturer?: string | null
          manufacturer_normalized?: string | null
          name: string
          name_normalized: string
          sku?: string | null
          source_ingestion_job_id?: string | null
        }
        Update: {
          created_at?: string
          dataset_id?: string
          external_product_id?: string
          gtin?: string | null
          id?: string
          manufacturer?: string | null
          manufacturer_normalized?: string | null
          name?: string
          name_normalized?: string
          sku?: string | null
          source_ingestion_job_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_dataset_id_fkey"
            columns: ["dataset_id"]
            isOneToOne: false
            referencedRelation: "datasets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_dataset_source_job_fkey"
            columns: ["dataset_id", "source_ingestion_job_id"]
            isOneToOne: false
            referencedRelation: "ingestion_jobs"
            referencedColumns: ["dataset_id", "id"]
          },
        ]
      }
      supplier_offers: {
        Row: {
          available_qty: number
          created_at: string
          dataset_id: string
          discount_bps: number
          external_offer_id: string
          id: string
          offered_at: string
          order_id: string
          product_id: string
          promised_delivery_at: string | null
          source_ingestion_job_id: string | null
          supplier_id: string
          unit_price_minor: number
        }
        Insert: {
          available_qty: number
          created_at?: string
          dataset_id: string
          discount_bps?: number
          external_offer_id: string
          id?: string
          offered_at: string
          order_id: string
          product_id: string
          promised_delivery_at?: string | null
          source_ingestion_job_id?: string | null
          supplier_id: string
          unit_price_minor: number
        }
        Update: {
          available_qty?: number
          created_at?: string
          dataset_id?: string
          discount_bps?: number
          external_offer_id?: string
          id?: string
          offered_at?: string
          order_id?: string
          product_id?: string
          promised_delivery_at?: string | null
          source_ingestion_job_id?: string | null
          supplier_id?: string
          unit_price_minor?: number
        }
        Relationships: [
          {
            foreignKeyName: "supplier_offers_dataset_id_fkey"
            columns: ["dataset_id"]
            isOneToOne: false
            referencedRelation: "datasets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_offers_dataset_id_order_id_fkey"
            columns: ["dataset_id", "order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["dataset_id", "id"]
          },
          {
            foreignKeyName: "supplier_offers_dataset_id_product_id_fkey"
            columns: ["dataset_id", "product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["dataset_id", "id"]
          },
          {
            foreignKeyName: "supplier_offers_dataset_id_source_ingestion_job_id_fkey"
            columns: ["dataset_id", "source_ingestion_job_id"]
            isOneToOne: false
            referencedRelation: "ingestion_jobs"
            referencedColumns: ["dataset_id", "id"]
          },
          {
            foreignKeyName: "supplier_offers_dataset_id_supplier_id_fkey"
            columns: ["dataset_id", "supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["dataset_id", "id"]
          },
        ]
      }
      supplier_product_reliability_snapshots: {
        Row: {
          as_of_date: string
          baseline_cancellation_rate_bps: number | null
          baseline_evaluated_orders: number
          baseline_fill_rate_bps: number | null
          baseline_lead_time_p95_minutes: number | null
          baseline_otif_rate_bps: number | null
          baseline_partial_fill_rate_bps: number | null
          baseline_window_days: number
          computed_at: string
          created_at: string
          dataset_id: string
          engine_version: string
          id: string
          product_id: string
          recent_cancellation_rate_bps: number | null
          recent_evaluated_orders: number
          recent_fill_rate_bps: number | null
          recent_lead_time_p50_minutes: number | null
          recent_lead_time_p95_minutes: number | null
          recent_otif_rate_bps: number | null
          recent_partial_fill_rate_bps: number | null
          recent_window_days: number
          status: string
          supplier_id: string
          triggers_json: Json
        }
        Insert: {
          as_of_date: string
          baseline_cancellation_rate_bps?: number | null
          baseline_evaluated_orders: number
          baseline_fill_rate_bps?: number | null
          baseline_lead_time_p95_minutes?: number | null
          baseline_otif_rate_bps?: number | null
          baseline_partial_fill_rate_bps?: number | null
          baseline_window_days: number
          computed_at: string
          created_at?: string
          dataset_id: string
          engine_version: string
          id?: string
          product_id: string
          recent_cancellation_rate_bps?: number | null
          recent_evaluated_orders: number
          recent_fill_rate_bps?: number | null
          recent_lead_time_p50_minutes?: number | null
          recent_lead_time_p95_minutes?: number | null
          recent_otif_rate_bps?: number | null
          recent_partial_fill_rate_bps?: number | null
          recent_window_days: number
          status: string
          supplier_id: string
          triggers_json?: Json
        }
        Update: {
          as_of_date?: string
          baseline_cancellation_rate_bps?: number | null
          baseline_evaluated_orders?: number
          baseline_fill_rate_bps?: number | null
          baseline_lead_time_p95_minutes?: number | null
          baseline_otif_rate_bps?: number | null
          baseline_partial_fill_rate_bps?: number | null
          baseline_window_days?: number
          computed_at?: string
          created_at?: string
          dataset_id?: string
          engine_version?: string
          id?: string
          product_id?: string
          recent_cancellation_rate_bps?: number | null
          recent_evaluated_orders?: number
          recent_fill_rate_bps?: number | null
          recent_lead_time_p50_minutes?: number | null
          recent_lead_time_p95_minutes?: number | null
          recent_otif_rate_bps?: number | null
          recent_partial_fill_rate_bps?: number | null
          recent_window_days?: number
          status?: string
          supplier_id?: string
          triggers_json?: Json
        }
        Relationships: [
          {
            foreignKeyName: "supplier_product_reliability_snapsh_dataset_id_supplier_id_fkey"
            columns: ["dataset_id", "supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["dataset_id", "id"]
          },
          {
            foreignKeyName: "supplier_product_reliability_snapsho_dataset_id_product_id_fkey"
            columns: ["dataset_id", "product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["dataset_id", "id"]
          },
          {
            foreignKeyName: "supplier_product_reliability_snapshots_dataset_id_fkey"
            columns: ["dataset_id"]
            isOneToOne: false
            referencedRelation: "datasets"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_reliability_snapshots: {
        Row: {
          as_of_date: string
          baseline_cancellation_rate_bps: number | null
          baseline_evaluated_orders: number
          baseline_fill_rate_bps: number | null
          baseline_lead_time_p95_minutes: number | null
          baseline_otif_rate_bps: number | null
          baseline_partial_fill_rate_bps: number | null
          baseline_window_days: number
          computed_at: string
          created_at: string
          dataset_id: string
          engine_version: string
          id: string
          promise_risk_json: Json
          recent_cancellation_rate_bps: number | null
          recent_evaluated_orders: number
          recent_fill_rate_bps: number | null
          recent_lead_time_p50_minutes: number | null
          recent_lead_time_p95_minutes: number | null
          recent_otif_rate_bps: number | null
          recent_partial_fill_rate_bps: number | null
          recent_window_days: number
          status: string
          supplier_id: string
          triggers_json: Json
        }
        Insert: {
          as_of_date: string
          baseline_cancellation_rate_bps?: number | null
          baseline_evaluated_orders: number
          baseline_fill_rate_bps?: number | null
          baseline_lead_time_p95_minutes?: number | null
          baseline_otif_rate_bps?: number | null
          baseline_partial_fill_rate_bps?: number | null
          baseline_window_days: number
          computed_at: string
          created_at?: string
          dataset_id: string
          engine_version: string
          id?: string
          promise_risk_json?: Json
          recent_cancellation_rate_bps?: number | null
          recent_evaluated_orders: number
          recent_fill_rate_bps?: number | null
          recent_lead_time_p50_minutes?: number | null
          recent_lead_time_p95_minutes?: number | null
          recent_otif_rate_bps?: number | null
          recent_partial_fill_rate_bps?: number | null
          recent_window_days: number
          status: string
          supplier_id: string
          triggers_json?: Json
        }
        Update: {
          as_of_date?: string
          baseline_cancellation_rate_bps?: number | null
          baseline_evaluated_orders?: number
          baseline_fill_rate_bps?: number | null
          baseline_lead_time_p95_minutes?: number | null
          baseline_otif_rate_bps?: number | null
          baseline_partial_fill_rate_bps?: number | null
          baseline_window_days?: number
          computed_at?: string
          created_at?: string
          dataset_id?: string
          engine_version?: string
          id?: string
          promise_risk_json?: Json
          recent_cancellation_rate_bps?: number | null
          recent_evaluated_orders?: number
          recent_fill_rate_bps?: number | null
          recent_lead_time_p50_minutes?: number | null
          recent_lead_time_p95_minutes?: number | null
          recent_otif_rate_bps?: number | null
          recent_partial_fill_rate_bps?: number | null
          recent_window_days?: number
          status?: string
          supplier_id?: string
          triggers_json?: Json
        }
        Relationships: [
          {
            foreignKeyName: "supplier_reliability_snapshots_dataset_id_fkey"
            columns: ["dataset_id"]
            isOneToOne: false
            referencedRelation: "datasets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_reliability_snapshots_dataset_id_supplier_id_fkey"
            columns: ["dataset_id", "supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["dataset_id", "id"]
          },
        ]
      }
      suppliers: {
        Row: {
          city: string | null
          created_at: string
          dataset_id: string
          external_supplier_id: string
          governorate: string | null
          id: string
          name: string
          name_normalized: string
          source_ingestion_job_id: string | null
        }
        Insert: {
          city?: string | null
          created_at?: string
          dataset_id: string
          external_supplier_id: string
          governorate?: string | null
          id?: string
          name: string
          name_normalized: string
          source_ingestion_job_id?: string | null
        }
        Update: {
          city?: string | null
          created_at?: string
          dataset_id?: string
          external_supplier_id?: string
          governorate?: string | null
          id?: string
          name?: string
          name_normalized?: string
          source_ingestion_job_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_dataset_id_fkey"
            columns: ["dataset_id"]
            isOneToOne: false
            referencedRelation: "datasets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suppliers_dataset_source_job_fkey"
            columns: ["dataset_id", "source_ingestion_job_id"]
            isOneToOne: false
            referencedRelation: "ingestion_jobs"
            referencedColumns: ["dataset_id", "id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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