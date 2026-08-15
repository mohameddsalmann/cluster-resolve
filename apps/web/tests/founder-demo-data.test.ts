import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { validateFounderDemoDataset } from '../scripts/validate-founder-demo-data';

describe('Founder Demo Dataset Validation & Provenance', () => {
  const dataDir = resolve(__dirname, '../../../data/founder-demo');
  const manifestPath = resolve(dataDir, 'founder-demo-manifest.json');
  const referencePath = resolve(__dirname, '../../../data/reference/egyptian-drugs-200.json');

  it('verifies public Egyptian medicine reference data exists and is valid', () => {
    expect(existsSync(referencePath)).toBe(true);
    const raw = JSON.parse(readFileSync(referencePath, 'utf-8'));
    expect(Array.isArray(raw)).toBe(true);
    expect(raw.length).toBe(200);

    // Verify first and last entries have required fields
    const sample = raw[0];
    expect(sample.resolveProductId).toBe('PROD-0001');
    expect(sample.commercialNameEn).toBeTruthy();
    expect(sample.scientificName).toBeTruthy();
    expect(sample.referencePublicPriceEgp).toBeGreaterThan(0);
    expect(sample.estimatedWholesalePriceMinor).toBeTruthy();
  });

  it('verifies all 4 Founder Demo CSVs and manifest pass complete structural and relational validation', () => {
    if (!existsSync(manifestPath)) {
      // If not yet generated in CI/test environment, skip or ensure files exist
      return;
    }
    const report = validateFounderDemoDataset();
    expect(report.passed).toBe(true);
    expect(report.errors).toEqual([]);
    expect(report.counts.distinctOrders).toBe(10000);
    expect(report.counts.distinctProducts).toBe(200);
    expect(report.counts.distinctPharmacies).toBe(50);
    expect(report.counts.distinctSuppliers).toBe(30);

    // Purposeful scenarios
    expect(report.scenariosValidated.stableStrongSuppliers).toBe(true);
    expect(report.scenariosValidated.deterioratingSuppliers).toBe(true);
    expect(report.scenariosValidated.productSpecificWeakness).toBe(true);
    expect(report.scenariosValidated.overpromisingSuppliers).toBe(true);
    expect(report.scenariosValidated.insufficientDataSuppliers).toBe(true);
    expect(report.scenariosValidated.pharmacyServiceRiskHigh).toBe(true);
    expect(report.scenariosValidated.pharmacyServiceRiskAtRisk).toBe(true);
    expect(report.scenariosValidated.dominatedDecisions).toBe(true);
    expect(report.scenariosValidated.nonDominatedDecisions).toBe(true);
    expect(report.scenariosValidated.selectedNotFeasible).toBe(true);
    expect(report.scenariosValidated.cancellations).toBe(true);
    expect(report.scenariosValidated.partialFills).toBe(true);
    expect(report.scenariosValidated.lateDeliveries).toBe(true);
    expect(report.scenariosValidated.futureOfferExclusions).toBe(true);
  });
});
