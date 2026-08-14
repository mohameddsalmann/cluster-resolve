import { getSupabaseServerClient } from '../../supabase/server';
import type { SupplierOfferRow } from '../row-types';
import { requireData } from './result';

export interface CreateSupplierOfferParams {
  dataset_id: string;
  external_offer_id: string;
  order_id: string;
  supplier_id: string;
  product_id: string;
  available_qty: number;
  unit_price_minor: bigint;
  discount_bps?: number;
  promised_delivery_at?: string | null;
  offered_at: string;
  source_ingestion_job_id?: string | null;
}

type SupplierOfferApiRow = Omit<SupplierOfferRow, 'unit_price_minor'> & {
  unit_price_minor: string;
};

const SUPPLIER_OFFER_SELECT = `
  id,
  dataset_id,
  external_offer_id,
  order_id,
  supplier_id,
  product_id,
  available_qty,
  unit_price_minor::text,
  discount_bps,
  promised_delivery_at,
  offered_at,
  source_ingestion_job_id,
  created_at
`;

function toSupplierOfferRow(row: SupplierOfferApiRow): SupplierOfferRow {
  if (!/^-?\d+$/.test(row.unit_price_minor)) {
    throw new Error('Supplier offer money boundary returned a non-integer decimal string.');
  }

  return {
    ...row,
    unit_price_minor: BigInt(row.unit_price_minor),
  };
}

export async function createSupplierOffer(
  params: CreateSupplierOfferParams
): Promise<SupplierOfferRow> {
  const { data, error } = await getSupabaseServerClient()
    .from('supplier_offers')
    .insert({
      dataset_id: params.dataset_id,
      external_offer_id: params.external_offer_id,
      order_id: params.order_id,
      supplier_id: params.supplier_id,
      product_id: params.product_id,
      available_qty: params.available_qty,
      unit_price_minor: params.unit_price_minor.toString(),
      discount_bps: params.discount_bps ?? 0,
      promised_delivery_at: params.promised_delivery_at ?? null,
      offered_at: params.offered_at,
      source_ingestion_job_id: params.source_ingestion_job_id ?? null,
    } as never)
    .select(SUPPLIER_OFFER_SELECT)
    .single();

  const row = requireData(data, error, 'Create supplier offer') as SupplierOfferApiRow;
  return toSupplierOfferRow(row);
}

export async function getSupplierOfferById(
  datasetId: string,
  id: string
): Promise<SupplierOfferRow | null> {
  const { data, error } = await getSupabaseServerClient()
    .from('supplier_offers')
    .select(SUPPLIER_OFFER_SELECT)
    .eq('dataset_id', datasetId)
    .eq('id', id)
    .maybeSingle();

  if (error) {
    requireData(data, error, 'Get supplier offer');
  }
  return data ? toSupplierOfferRow(data as SupplierOfferApiRow) : null;
}

export async function getSupplierOfferByExternalId(
  datasetId: string,
  externalId: string
): Promise<SupplierOfferRow | null> {
  const { data, error } = await getSupabaseServerClient()
    .from('supplier_offers')
    .select(SUPPLIER_OFFER_SELECT)
    .eq('dataset_id', datasetId)
    .eq('external_offer_id', externalId)
    .maybeSingle();
  if (error) requireData(data, error, 'Get supplier offer by external ID');
  return data ? toSupplierOfferRow(data as SupplierOfferApiRow) : null;
}
