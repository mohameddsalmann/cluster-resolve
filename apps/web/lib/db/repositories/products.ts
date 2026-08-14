import { normalizeName } from '@cluster/core/util/normalize';
import { getSupabaseServerClient } from '../../supabase/server';
import type { ProductRow } from '../row-types';
import { requireData } from './result';

export interface CreateProductParams {
  dataset_id: string;
  external_product_id: string;
  name: string;
  sku?: string | null;
  manufacturer?: string | null;
  gtin?: string | null;
  source_ingestion_job_id?: string | null;
}

export async function createProduct(params: CreateProductParams): Promise<ProductRow> {
  const { data, error } = await getSupabaseServerClient()
    .from('products')
    .insert({
      dataset_id: params.dataset_id,
      external_product_id: params.external_product_id,
      sku: params.sku ?? null,
      name: params.name,
      name_normalized: normalizeName(params.name),
      manufacturer: params.manufacturer ?? null,
      manufacturer_normalized: params.manufacturer
        ? normalizeName(params.manufacturer)
        : null,
      gtin: params.gtin ?? null,
      source_ingestion_job_id: params.source_ingestion_job_id ?? null,
    })
    .select('*')
    .single();

  return requireData(data, error, 'Create product');
}

export async function getProductByExternalId(
  datasetId: string,
  externalId: string
): Promise<ProductRow | null> {
  const { data, error } = await getSupabaseServerClient()
    .from('products')
    .select('*')
    .eq('dataset_id', datasetId)
    .eq('external_product_id', externalId)
    .maybeSingle();
  if (error) requireData(data, error, 'Get product by external ID');
  return data;
}

export async function getProductById(
  datasetId: string,
  id: string
): Promise<ProductRow | null> {
  const { data, error } = await getSupabaseServerClient()
    .from('products')
    .select('*')
    .eq('dataset_id', datasetId)
    .eq('id', id)
    .maybeSingle();

  if (error) {
    requireData(data, error, 'Get product');
  }
  return data;
}
