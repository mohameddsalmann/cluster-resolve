import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getSupabaseServerClient } from '../../lib/supabase/server';
import { createDataset } from '../../lib/db/repositories/datasets';
import {
  createAiDecision,
  createAiDecisionCandidate,
} from '../../lib/db/repositories/decisions';
import {
  createSupplierOffer,
  getSupplierOfferById,
} from '../../lib/db/repositories/offers';
import { createOrder, createOrderItem } from '../../lib/db/repositories/orders';
import { createOrderOutcome } from '../../lib/db/repositories/outcomes';
import { createPharmacy } from '../../lib/db/repositories/pharmacies';
import { createProduct } from '../../lib/db/repositories/products';
import { createSupplier } from '../../lib/db/repositories/suppliers';

interface DatasetFixtures {
  datasetId: string;
  dataSourceId: string;
  ingestionJobId: string;
  pharmacyId: string;
  productId: string;
  supplierId: string;
  orderId: string;
  decisionId: string;
}

const externalId = (prefix: string) => `${prefix}-${randomUUID()}`;

describe('Database Integration — Constraints & Dataset Isolation', () => {
  let sample: DatasetFixtures;
  let importedReal: DatasetFixtures;

  async function createFixtures(mode: 'SAMPLE' | 'IMPORTED_REAL'): Promise<DatasetFixtures> {
    const supabase = getSupabaseServerClient();
    const dataset = await createDataset({
      name: externalId(`Constraint Test ${mode}`),
      mode,
    });

    const { data: dataSource, error: dataSourceError } = await supabase
      .from('data_sources')
      .insert({
        dataset_id: dataset.id,
        kind: 'CSV',
        acquisition_mode: 'FILE_IMPORT',
        name: externalId('Source'),
      })
      .select('id')
      .single();
    if (dataSourceError) throw dataSourceError;

    const { data: ingestionJob, error: ingestionJobError } = await supabase
      .from('ingestion_jobs')
      .insert({ dataset_id: dataset.id, source_id: dataSource.id, kind: 'TEST' })
      .select('id')
      .single();
    if (ingestionJobError) throw ingestionJobError;
    const pharmacy = await createPharmacy({
      dataset_id: dataset.id,
      external_pharmacy_id: externalId('PHARM'),
      name: `${mode} Pharmacy`,
    });
    const product = await createProduct({
      dataset_id: dataset.id,
      external_product_id: externalId('PROD'),
      name: `${mode} Product`,
    });
    const supplier = await createSupplier({
      dataset_id: dataset.id,
      external_supplier_id: externalId('SUP'),
      name: `${mode} Supplier`,
    });
    const order = await createOrder({
      dataset_id: dataset.id,
      external_order_id: externalId('ORDER'),
      pharmacy_id: pharmacy.id,
      status: 'PLACED',
      placed_at: new Date().toISOString(),
      source_ingestion_job_id: ingestionJob.id,
    });
    const decision = await createAiDecision({
      dataset_id: dataset.id,
      external_decision_id: externalId('DECISION'),
      order_id: order.id,
      selected_supplier_id: supplier.id,
      decided_at: new Date().toISOString(),
      source_ingestion_job_id: ingestionJob.id,
    });

    return {
      datasetId: dataset.id,
      dataSourceId: dataSource.id,
      ingestionJobId: ingestionJob.id,
      pharmacyId: pharmacy.id,
      productId: product.id,
      supplierId: supplier.id,
      orderId: order.id,
      decisionId: decision.id,
    };
  }

  beforeAll(async () => {
    if (!process.env.SUPABASE_URL) {
      throw new Error(
        'SUPABASE_URL environment variable is missing. DB integration tests MUST NOT be skipped silently.'
      );
    }
    if (!process.env.SUPABASE_SECRET_KEY && !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error(
        'SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY is missing. DB integration tests MUST NOT be skipped silently.'
      );
    }

    sample = await createFixtures('SAMPLE');
    importedReal = await createFixtures('IMPORTED_REAL');
  }, 30_000);

  afterAll(async () => {
    const supabase = getSupabaseServerClient();
    const datasetIds = [sample?.datasetId, importedReal?.datasetId].filter(
      (id): id is string => Boolean(id)
    );
    const childTables = [
      'ai_decision_candidates',
      'ai_decisions',
      'order_outcomes',
      'supplier_offers',
      'order_items',
      'orders',
      'ingestion_jobs',
      'data_sources',
      'products',
      'pharmacies',
      'suppliers',
    ] as const;

    for (const datasetId of datasetIds) {
      for (const table of childTables) {
        const { error } = await supabase.from(table).delete().eq('dataset_id', datasetId);
        if (error) throw error;
      }
      const { error } = await supabase.from('datasets').delete().eq('id', datasetId);
      if (error) throw error;
    }
  }, 30_000);

  describe('Dataset Cross-Link Prevention', () => {
    it('prevents an ingestion job from referencing another dataset data source', async () => {
      const { error } = await getSupabaseServerClient().from('ingestion_jobs').insert({
        dataset_id: sample.datasetId,
        source_id: importedReal.dataSourceId,
        kind: 'TEST',
      });
      expect(error).not.toBeNull();
    });

    it('prevents an order from referencing another dataset pharmacy', async () => {
      await expect(
        createOrder({
          dataset_id: sample.datasetId,
          external_order_id: externalId('ORDER-CROSS-PHARMACY'),
          pharmacy_id: importedReal.pharmacyId,
          status: 'PLACED',
          placed_at: new Date().toISOString(),
        })
      ).rejects.toThrow();
    });

    it('prevents an order from referencing another dataset ingestion job', async () => {
      await expect(
        createOrder({
          dataset_id: sample.datasetId,
          external_order_id: externalId('ORDER-CROSS-JOB'),
          pharmacy_id: sample.pharmacyId,
          status: 'PLACED',
          placed_at: new Date().toISOString(),
          source_ingestion_job_id: importedReal.ingestionJobId,
        })
      ).rejects.toThrow();
    });

    it('prevents an order item from referencing another dataset order', async () => {
      await expect(
        createOrderItem({
          dataset_id: sample.datasetId,
          order_id: importedReal.orderId,
          product_id: sample.productId,
          requested_qty: 1,
        })
      ).rejects.toThrow();
    });

    it('prevents an order item from referencing another dataset product', async () => {
      await expect(
        createOrderItem({
          dataset_id: sample.datasetId,
          order_id: sample.orderId,
          product_id: importedReal.productId,
          requested_qty: 1,
        })
      ).rejects.toThrow();
    });

    it('prevents a supplier offer from referencing another dataset order', async () => {
      await expect(
        createSupplierOffer({
          dataset_id: sample.datasetId,
          external_offer_id: externalId('OFFER-CROSS-ORDER'),
          order_id: importedReal.orderId,
          supplier_id: sample.supplierId,
          product_id: sample.productId,
          available_qty: 1,
          unit_price_minor: 1n,
          offered_at: new Date().toISOString(),
        })
      ).rejects.toThrow();
    });

    it('prevents a supplier offer from referencing another dataset supplier', async () => {
      await expect(
        createSupplierOffer({
          dataset_id: sample.datasetId,
          external_offer_id: externalId('OFFER-CROSS-SUPPLIER'),
          order_id: sample.orderId,
          supplier_id: importedReal.supplierId,
          product_id: sample.productId,
          available_qty: 1,
          unit_price_minor: 1n,
          offered_at: new Date().toISOString(),
        })
      ).rejects.toThrow();
    });

    it('prevents a supplier offer from referencing another dataset product', async () => {
      await expect(
        createSupplierOffer({
          dataset_id: sample.datasetId,
          external_offer_id: externalId('OFFER-CROSS-PRODUCT'),
          order_id: sample.orderId,
          supplier_id: sample.supplierId,
          product_id: importedReal.productId,
          available_qty: 1,
          unit_price_minor: 1n,
          offered_at: new Date().toISOString(),
        })
      ).rejects.toThrow();
    });

    it('prevents a supplier offer from referencing another dataset ingestion job', async () => {
      await expect(
        createSupplierOffer({
          dataset_id: sample.datasetId,
          external_offer_id: externalId('OFFER-CROSS-JOB'),
          order_id: sample.orderId,
          supplier_id: sample.supplierId,
          product_id: sample.productId,
          available_qty: 1,
          unit_price_minor: 1n,
          offered_at: new Date().toISOString(),
          source_ingestion_job_id: importedReal.ingestionJobId,
        })
      ).rejects.toThrow();
    });

    it('prevents an outcome from referencing another dataset order', async () => {
      await expect(
        createOrderOutcome({
          dataset_id: sample.datasetId,
          order_id: importedReal.orderId,
          supplier_id: sample.supplierId,
          product_id: sample.productId,
          filled_qty: 1,
        })
      ).rejects.toThrow();
    });

    it('prevents an outcome from referencing another dataset supplier', async () => {
      await expect(
        createOrderOutcome({
          dataset_id: sample.datasetId,
          order_id: sample.orderId,
          supplier_id: importedReal.supplierId,
          product_id: sample.productId,
          filled_qty: 1,
        })
      ).rejects.toThrow();
    });

    it('prevents an outcome from referencing another dataset product', async () => {
      await expect(
        createOrderOutcome({
          dataset_id: sample.datasetId,
          order_id: sample.orderId,
          supplier_id: sample.supplierId,
          product_id: importedReal.productId,
          filled_qty: 1,
        })
      ).rejects.toThrow();
    });

    it('prevents an outcome from referencing another dataset ingestion job', async () => {
      await expect(
        createOrderOutcome({
          dataset_id: sample.datasetId,
          order_id: sample.orderId,
          supplier_id: sample.supplierId,
          product_id: sample.productId,
          filled_qty: 1,
          source_ingestion_job_id: importedReal.ingestionJobId,
        })
      ).rejects.toThrow();
    });

    it('prevents an AI decision from referencing another dataset order', async () => {
      await expect(
        createAiDecision({
          dataset_id: sample.datasetId,
          external_decision_id: externalId('DECISION-CROSS-ORDER'),
          order_id: importedReal.orderId,
          selected_supplier_id: sample.supplierId,
          decided_at: new Date().toISOString(),
        })
      ).rejects.toThrow();
    });

    it('prevents an AI decision from referencing another dataset selected supplier', async () => {
      await expect(
        createAiDecision({
          dataset_id: sample.datasetId,
          external_decision_id: externalId('DECISION-CROSS-SUPPLIER'),
          order_id: sample.orderId,
          selected_supplier_id: importedReal.supplierId,
          decided_at: new Date().toISOString(),
        })
      ).rejects.toThrow();
    });

    it('prevents an AI decision from referencing another dataset ingestion job', async () => {
      await expect(
        createAiDecision({
          dataset_id: sample.datasetId,
          external_decision_id: externalId('DECISION-CROSS-JOB'),
          order_id: sample.orderId,
          selected_supplier_id: sample.supplierId,
          decided_at: new Date().toISOString(),
          source_ingestion_job_id: importedReal.ingestionJobId,
        })
      ).rejects.toThrow();
    });

    it('prevents a candidate from referencing another dataset decision', async () => {
      await expect(
        createAiDecisionCandidate({
          dataset_id: sample.datasetId,
          decision_id: importedReal.decisionId,
          supplier_id: sample.supplierId,
        })
      ).rejects.toThrow();
    });

    it('prevents a candidate from referencing another dataset supplier', async () => {
      await expect(
        createAiDecisionCandidate({
          dataset_id: sample.datasetId,
          decision_id: sample.decisionId,
          supplier_id: importedReal.supplierId,
        })
      ).rejects.toThrow();
    });
  });

  describe('Check, Required, and Uniqueness Constraints', () => {
    it('requires external_offer_id', async () => {
      const { error } = await getSupabaseServerClient()
        .from('supplier_offers')
        .insert({
          dataset_id: sample.datasetId,
          order_id: sample.orderId,
          supplier_id: sample.supplierId,
          product_id: sample.productId,
          available_qty: 1,
          unit_price_minor: '1',
          offered_at: new Date().toISOString(),
        } as never);
      expect(error).not.toBeNull();
    });

    it('rejects duplicate external_offer_id per dataset', async () => {
      const offerId = externalId('OFFER-DUPLICATE');
      const params = {
        dataset_id: sample.datasetId,
        external_offer_id: offerId,
        order_id: sample.orderId,
        supplier_id: sample.supplierId,
        product_id: sample.productId,
        available_qty: 1,
        unit_price_minor: 1n,
        offered_at: new Date().toISOString(),
      };

      await createSupplierOffer(params);
      await expect(createSupplierOffer(params)).rejects.toThrow();
    });

    it('rejects discount_bps below zero', async () => {
      await expect(
        createSupplierOffer({
          dataset_id: sample.datasetId,
          external_offer_id: externalId('OFFER-DISCOUNT-LOW'),
          order_id: sample.orderId,
          supplier_id: sample.supplierId,
          product_id: sample.productId,
          available_qty: 1,
          unit_price_minor: 1n,
          discount_bps: -1,
          offered_at: new Date().toISOString(),
        })
      ).rejects.toThrow();
    });

    it('rejects discount_bps above 10000', async () => {
      await expect(
        createSupplierOffer({
          dataset_id: sample.datasetId,
          external_offer_id: externalId('OFFER-DISCOUNT-HIGH'),
          order_id: sample.orderId,
          supplier_id: sample.supplierId,
          product_id: sample.productId,
          available_qty: 1,
          unit_price_minor: 1n,
          discount_bps: 10_001,
          offered_at: new Date().toISOString(),
        })
      ).rejects.toThrow();
    });

    it('rejects confidence below zero', async () => {
      await expect(
        createAiDecision({
          dataset_id: sample.datasetId,
          external_decision_id: externalId('DECISION-CONFIDENCE-LOW'),
          order_id: sample.orderId,
          selected_supplier_id: sample.supplierId,
          decided_at: new Date().toISOString(),
          confidence: -0.0001,
        })
      ).rejects.toThrow();
    });

    it('rejects confidence above one', async () => {
      await expect(
        createAiDecision({
          dataset_id: sample.datasetId,
          external_decision_id: externalId('DECISION-CONFIDENCE-HIGH'),
          order_id: sample.orderId,
          selected_supplier_id: sample.supplierId,
          decided_at: new Date().toISOString(),
          confidence: 1.0001,
        })
      ).rejects.toThrow();
    });

    it('rejects negative requested quantities', async () => {
      await expect(
        createOrderItem({
          dataset_id: sample.datasetId,
          order_id: sample.orderId,
          product_id: sample.productId,
          requested_qty: -1,
        })
      ).rejects.toThrow();
    });

    it('rejects negative available quantities', async () => {
      await expect(
        createSupplierOffer({
          dataset_id: sample.datasetId,
          external_offer_id: externalId('OFFER-NEGATIVE-QUANTITY'),
          order_id: sample.orderId,
          supplier_id: sample.supplierId,
          product_id: sample.productId,
          available_qty: -1,
          unit_price_minor: 1n,
          offered_at: new Date().toISOString(),
        })
      ).rejects.toThrow();
    });

    it('rejects negative prices', async () => {
      await expect(
        createSupplierOffer({
          dataset_id: sample.datasetId,
          external_offer_id: externalId('OFFER-NEGATIVE-PRICE'),
          order_id: sample.orderId,
          supplier_id: sample.supplierId,
          product_id: sample.productId,
          available_qty: 1,
          unit_price_minor: -1n,
          offered_at: new Date().toISOString(),
        })
      ).rejects.toThrow();
    });

    it('rejects negative filled quantities', async () => {
      await expect(
        createOrderOutcome({
          dataset_id: sample.datasetId,
          order_id: sample.orderId,
          supplier_id: sample.supplierId,
          product_id: sample.productId,
          filled_qty: -1,
        })
      ).rejects.toThrow();
    });

    it('round-trips BIGINT money beyond Number.MAX_SAFE_INTEGER as bigint', async () => {
      const exactPrice = 9_007_199_254_740_993n;
      const created = await createSupplierOffer({
        dataset_id: sample.datasetId,
        external_offer_id: externalId('OFFER-BIGINT'),
        order_id: sample.orderId,
        supplier_id: sample.supplierId,
        product_id: sample.productId,
        available_qty: 1,
        unit_price_minor: exactPrice,
        offered_at: new Date().toISOString(),
      });
      const fetched = await getSupplierOfferById(sample.datasetId, created.id);

      expect(fetched?.unit_price_minor).toBe(exactPrice);
      expect(typeof fetched?.unit_price_minor).toBe('bigint');
    });

    it('enforces the dataset mode enum', async () => {
      const { error } = await getSupabaseServerClient()
        .from('datasets')
        .insert({ name: externalId('INVALID-DATASET'), mode: 'INVALID' });
      expect(error).not.toBeNull();
    });
  });
});
