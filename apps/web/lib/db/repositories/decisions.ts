import type { Json } from '../generated-types';
import { getSupabaseServerClient } from '../../supabase/server';
import type { AiDecisionCandidateRow, AiDecisionRow } from '../row-types';
import { requireData } from './result';

export interface CreateAiDecisionParams {
  dataset_id: string;
  external_decision_id: string;
  order_id: string;
  selected_supplier_id: string;
  decided_at: string;
  agent_name?: string | null;
  agent_version?: string | null;
  confidence?: number | string | null;
  selection_reason?: string | null;
  input_snapshot_json?: Record<string, unknown> | null;
  source_ingestion_job_id?: string | null;
}

export interface CreateAiDecisionCandidateParams {
  dataset_id: string;
  decision_id: string;
  supplier_id: string;
  rank?: number | null;
  score?: number | null;
  feasible?: boolean;
  infeasible_reason?: string | null;
  feature_values?: Record<string, unknown> | null;
}

export async function createAiDecision(
  params: CreateAiDecisionParams
): Promise<AiDecisionRow> {
  const { data, error } = await getSupabaseServerClient()
    .from('ai_decisions')
    .insert({
      dataset_id: params.dataset_id,
      external_decision_id: params.external_decision_id,
      order_id: params.order_id,
      selected_supplier_id: params.selected_supplier_id,
      decided_at: params.decided_at,
      agent_name: params.agent_name ?? null,
      agent_version: params.agent_version ?? null,
      confidence: params.confidence ?? null,
      selection_reason: params.selection_reason ?? null,
      input_snapshot_json: (params.input_snapshot_json as Json | null | undefined) ?? null,
      source_ingestion_job_id: params.source_ingestion_job_id ?? null,
    } as never)
    .select('*')
    .single();

  return requireData(data, error, 'Create AI decision');
}

export async function getAiDecisionByExternalId(
  datasetId: string,
  externalId: string
): Promise<AiDecisionRow | null> {
  const { data, error } = await getSupabaseServerClient()
    .from('ai_decisions')
    .select('*')
    .eq('dataset_id', datasetId)
    .eq('external_decision_id', externalId)
    .maybeSingle();
  if (error) requireData(data, error, 'Get AI decision by external ID');
  return data;
}

export async function createAiDecisionCandidate(
  params: CreateAiDecisionCandidateParams
): Promise<AiDecisionCandidateRow> {
  const { data, error } = await getSupabaseServerClient()
    .from('ai_decision_candidates')
    .insert({
      dataset_id: params.dataset_id,
      decision_id: params.decision_id,
      supplier_id: params.supplier_id,
      rank: params.rank ?? null,
      score: params.score ?? null,
      feasible: params.feasible ?? true,
      infeasible_reason: params.infeasible_reason ?? null,
      feature_values: (params.feature_values as Json | null | undefined) ?? null,
    })
    .select('*')
    .single();

  return requireData(data, error, 'Create AI decision candidate');
}

export async function getAiDecisionById(
  datasetId: string,
  id: string
): Promise<AiDecisionRow | null> {
  const { data, error } = await getSupabaseServerClient()
    .from('ai_decisions')
    .select('*')
    .eq('dataset_id', datasetId)
    .eq('id', id)
    .maybeSingle();

  if (error) {
    requireData(data, error, 'Get AI decision');
  }
  return data;
}
