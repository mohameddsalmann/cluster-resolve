import { getSupabaseServerClient } from '../../supabase/server';
import type { PharmacyRow } from '../row-types';
import { requireData } from './result';

export interface CreatePharmacyParams {
  dataset_id: string;
  external_pharmacy_id: string;
  name?: string | null;
  governorate?: string | null;
  city?: string | null;
  source_ingestion_job_id?: string | null;
}

export async function createPharmacy(params: CreatePharmacyParams): Promise<PharmacyRow> {
  const { data, error } = await getSupabaseServerClient()
    .from('pharmacies')
    .insert({
      dataset_id: params.dataset_id,
      external_pharmacy_id: params.external_pharmacy_id,
      name: params.name ?? null,
      governorate: params.governorate ?? null,
      city: params.city ?? null,
      source_ingestion_job_id: params.source_ingestion_job_id ?? null,
    })
    .select('*')
    .single();

  return requireData(data, error, 'Create pharmacy');
}

export async function getPharmacyByExternalId(
  datasetId: string,
  externalId: string
): Promise<PharmacyRow | null> {
  const { data, error } = await getSupabaseServerClient()
    .from('pharmacies')
    .select('*')
    .eq('dataset_id', datasetId)
    .eq('external_pharmacy_id', externalId)
    .maybeSingle();
  if (error) requireData(data, error, 'Get pharmacy by external ID');
  return data;
}

export async function getPharmacyById(
  datasetId: string,
  id: string
): Promise<PharmacyRow | null> {
  const { data, error } = await getSupabaseServerClient()
    .from('pharmacies')
    .select('*')
    .eq('dataset_id', datasetId)
    .eq('id', id)
    .maybeSingle();

  if (error) {
    requireData(data, error, 'Get pharmacy');
  }
  return data;
}
