import { getSupabaseServerClient } from '../../supabase/server';
import type { OrderOutcomeRow } from '../row-types';
import { requireData } from './result';

export interface CreateOrderOutcomeParams {
  dataset_id: string;
  order_id: string;
  supplier_id: string;
  product_id: string;
  filled_qty: number;
  delivered_at?: string | null;
  cancelled?: boolean;
  cancellation_reason?: string | null;
  outcome_final?: boolean;
  source_ingestion_job_id?: string | null;
}

export async function createOrderOutcome(
  params: CreateOrderOutcomeParams
): Promise<OrderOutcomeRow> {
  const { data, error } = await getSupabaseServerClient()
    .from('order_outcomes')
    .insert({
      dataset_id: params.dataset_id,
      order_id: params.order_id,
      supplier_id: params.supplier_id,
      product_id: params.product_id,
      filled_qty: params.filled_qty,
      delivered_at: params.delivered_at ?? null,
      cancelled: params.cancelled ?? false,
      cancellation_reason: params.cancellation_reason ?? null,
      outcome_final: params.outcome_final ?? false,
      source_ingestion_job_id: params.source_ingestion_job_id ?? null,
    })
    .select('*')
    .single();

  return requireData(data, error, 'Create order outcome');
}

export async function getOrderOutcomeById(
  datasetId: string,
  id: string
): Promise<OrderOutcomeRow | null> {
  const { data, error } = await getSupabaseServerClient()
    .from('order_outcomes')
    .select('*')
    .eq('dataset_id', datasetId)
    .eq('id', id)
    .maybeSingle();

  if (error) {
    requireData(data, error, 'Get order outcome');
  }
  return data;
}

export async function getOrderOutcomeByReferences(
  datasetId: string,
  orderId: string,
  supplierId: string,
  productId: string
): Promise<OrderOutcomeRow | null> {
  const { data, error } = await getSupabaseServerClient()
    .from('order_outcomes')
    .select('*')
    .eq('dataset_id', datasetId)
    .eq('order_id', orderId)
    .eq('supplier_id', supplierId)
    .eq('product_id', productId)
    .maybeSingle();
  if (error) requireData(data, error, 'Get order outcome by references');
  return data;
}

export async function advanceOrderOutcome(
  id: string,
  params: Omit<CreateOrderOutcomeParams, 'dataset_id' | 'order_id' | 'supplier_id' | 'product_id'>
): Promise<OrderOutcomeRow> {
  const { data, error } = await getSupabaseServerClient()
    .from('order_outcomes')
    .update({
      filled_qty: params.filled_qty,
      delivered_at: params.delivered_at ?? null,
      cancelled: params.cancelled ?? false,
      cancellation_reason: params.cancellation_reason ?? null,
      outcome_final: params.outcome_final ?? false,
      source_ingestion_job_id: params.source_ingestion_job_id ?? null,
    })
    .eq('id', id)
    .eq('outcome_final', false)
    .select('*')
    .single();
  return requireData(data, error, 'Advance order outcome');
}

export async function listOrderOutcomesByOrder(
  datasetId: string,
  orderId: string
): Promise<OrderOutcomeRow[]> {
  const { data, error } = await getSupabaseServerClient()
    .from('order_outcomes')
    .select('*')
    .eq('dataset_id', datasetId)
    .eq('order_id', orderId);
  return requireData(data, error, 'List order outcomes by order');
}
