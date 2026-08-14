import { normalizeName } from '@cluster/core';
import { getSupabaseServerClient } from '../../supabase/server';
import type { SupplierRow } from '../row-types';
import { requireData } from './result';

export interface CreateSupplierParams {
  dataset_id: string;
  external_supplier_id: string;
  name: string;
  governorate?: string | null;
  city?: string | null;
}

export async function createSupplier(params: CreateSupplierParams): Promise<SupplierRow> {
  const { data, error } = await getSupabaseServerClient()
    .from('suppliers')
    .insert({
      dataset_id: params.dataset_id,
      external_supplier_id: params.external_supplier_id,
      name: params.name,
      name_normalized: normalizeName(params.name),
      governorate: params.governorate ?? null,
      city: params.city ?? null,
    })
    .select('*')
    .single();

  return requireData(data, error, 'Create supplier');
}

export async function getSupplierById(
  datasetId: string,
  id: string
): Promise<SupplierRow | null> {
  const { data, error } = await getSupabaseServerClient()
    .from('suppliers')
    .select('*')
    .eq('dataset_id', datasetId)
    .eq('id', id)
    .maybeSingle();

  if (error) {
    requireData(data, error, 'Get supplier');
  }
  return data;
}
