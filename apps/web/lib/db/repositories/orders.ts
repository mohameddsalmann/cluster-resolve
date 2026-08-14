import { getSupabaseServerClient } from '../../supabase/server';
import type { OrderItemRow, OrderRow } from '../row-types';
import { requireData } from './result';

export interface CreateOrderParams {
  dataset_id: string;
  external_order_id: string;
  pharmacy_id: string;
  status: string;
  placed_at: string;
  source_ingestion_job_id?: string | null;
}

export interface CreateOrderItemParams {
  dataset_id: string;
  order_id: string;
  product_id: string;
  requested_qty: number;
  unit?: string;
  source_ingestion_job_id?: string | null;
}

export async function createOrder(params: CreateOrderParams): Promise<OrderRow> {
  const { data, error } = await getSupabaseServerClient()
    .from('orders')
    .insert({
      dataset_id: params.dataset_id,
      external_order_id: params.external_order_id,
      pharmacy_id: params.pharmacy_id,
      status: params.status,
      placed_at: params.placed_at,
      source_ingestion_job_id: params.source_ingestion_job_id ?? null,
    })
    .select('*')
    .single();

  return requireData(data, error, 'Create order');
}

export async function createOrderItem(params: CreateOrderItemParams): Promise<OrderItemRow> {
  const { data, error } = await getSupabaseServerClient()
    .from('order_items')
    .insert({
      dataset_id: params.dataset_id,
      order_id: params.order_id,
      product_id: params.product_id,
      requested_qty: params.requested_qty,
      unit: params.unit ?? 'pack',
      source_ingestion_job_id: params.source_ingestion_job_id ?? null,
    })
    .select('*')
    .single();

  return requireData(data, error, 'Create order item');
}

export async function getOrderByExternalId(
  datasetId: string,
  externalId: string
): Promise<OrderRow | null> {
  const { data, error } = await getSupabaseServerClient()
    .from('orders')
    .select('*')
    .eq('dataset_id', datasetId)
    .eq('external_order_id', externalId)
    .maybeSingle();
  if (error) requireData(data, error, 'Get order by external ID');
  return data;
}

export async function getOrderItem(
  datasetId: string,
  orderId: string,
  productId: string
): Promise<OrderItemRow | null> {
  const { data, error } = await getSupabaseServerClient()
    .from('order_items')
    .select('*')
    .eq('dataset_id', datasetId)
    .eq('order_id', orderId)
    .eq('product_id', productId)
    .maybeSingle();
  if (error) requireData(data, error, 'Get order item');
  return data;
}

export async function getOrderById(
  datasetId: string,
  id: string
): Promise<OrderRow | null> {
  const { data, error } = await getSupabaseServerClient()
    .from('orders')
    .select('*')
    .eq('dataset_id', datasetId)
    .eq('id', id)
    .maybeSingle();

  if (error) {
    requireData(data, error, 'Get order');
  }
  return data;
}
