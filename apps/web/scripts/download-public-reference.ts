import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { parse } from 'csv-parse/sync';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
// Save to workspace root data/reference/egyptian-drugs-200.json
const REFERENCE_DIR = resolve(__dirname, '../../../data/reference');
const OUTPUT_FILE = resolve(REFERENCE_DIR, 'egyptian-drugs-200.json');
const SOURCE_URL =
  'https://raw.githubusercontent.com/karem505/egyptian-drug-database/main/data/egyptian-drugs.csv';

export interface PublicDrugReferenceRecord {
  resolveProductId: string; // e.g. PROD-0001
  commercialNameEn: string;
  commercialNameAr: string;
  scientificName: string;
  manufacturer: string;
  drugClass: string;
  route: string;
  referencePublicPriceEgp: number; // Retail price in EGP
  referencePublicPriceMinor: string; // Retail price in piasters (1 EGP = 100 piasters)
  estimatedWholesalePriceMinor: string; // ~85% of retail price for procurement baseline
}

export async function downloadAndSelect200Drugs(): Promise<PublicDrugReferenceRecord[]> {
  console.log(`[reference] Fetching Egyptian Drug Database from ${SOURCE_URL}...`);
  const res = await fetch(SOURCE_URL);
  if (!res.ok) {
    throw new Error(`Failed to fetch source dataset: ${res.status} ${res.statusText}`);
  }

  const csvText = await res.text();
  const rawRecords: Array<{
    commercial_name_en: string;
    commercial_name_ar: string;
    scientific_name: string;
    manufacturer: string;
    drug_class: string;
    route: string;
    price_egp: string;
  }> = parse(csvText, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  console.log(`[reference] Parsed ${rawRecords.length} raw medicine records.`);

  // Filter valid, complete records with clean Latin scientific names and prices
  const validRecords = rawRecords.filter((r) => {
    const price = parseFloat(r.price_egp);
    const hasValidScientificName =
      r.scientific_name &&
      r.scientific_name.length > 2 &&
      !r.scientific_name.includes('?') &&
      /^[A-Za-z0-9\s\+\-\/\(\)\,\.\%\:\;]+$/.test(r.scientific_name);

    const hasValidCommercialName =
      r.commercial_name_en &&
      r.commercial_name_en.length > 2 &&
      !r.commercial_name_en.includes('?');

    const hasValidManufacturer =
      r.manufacturer &&
      r.manufacturer.length > 2 &&
      !r.manufacturer.includes('?');

    return (
      hasValidCommercialName &&
      hasValidScientificName &&
      hasValidManufacturer &&
      r.drug_class &&
      !r.drug_class.includes('?') &&
      !isNaN(price) &&
      price >= 5 &&
      price <= 3000 // reasonable price range in EGP
    );
  });

  console.log(`[reference] Found ${validRecords.length} pristine Latin-clean records.`);

  // Deterministically sort and deduplicate by commercial name
  const sorted = [...validRecords].sort((a, b) => {
    const sc = a.scientific_name.localeCompare(b.scientific_name);
    if (sc !== 0) return sc;
    return a.commercial_name_en.localeCompare(b.commercial_name_en);
  });

  const seen = new Set<string>();
  const deduped: typeof validRecords = [];
  for (const rec of sorted) {
    const key = rec.commercial_name_en.trim().toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(rec);
    }
  }

  // Sample exactly 200 records distributed across the dataset
  const targetCount = 200;
  const step = deduped.length / targetCount;
  const selectedRaw: typeof validRecords = [];

  for (let i = 0; i < targetCount; i++) {
    const index = Math.min(Math.floor(i * step), deduped.length - 1);
    selectedRaw.push(deduped[index]);
  }

  // Format into PublicDrugReferenceRecord with stable IDs PROD-0001 .. PROD-0200
  const selected: PublicDrugReferenceRecord[] = selectedRaw.map((r, i) => {
    const idNum = String(i + 1).padStart(4, '0');
    const retailEgp = parseFloat(r.price_egp);
    const retailMinor = Math.round(retailEgp * 100); // 100 piasters per EGP
    const wholesaleMinor = Math.round(retailMinor * 0.85); // 85% wholesale baseline assumption

    return {
      resolveProductId: `PROD-${idNum}`,
      commercialNameEn: r.commercial_name_en.trim(),
      commercialNameAr: r.commercial_name_ar ? r.commercial_name_ar.trim() : r.commercial_name_en.trim(),
      scientificName: r.scientific_name.trim(),
      manufacturer: r.manufacturer.trim(),
      drugClass: r.drug_class ? r.drug_class.trim() : 'GENERAL PHARMACEUTICAL',
      route: r.route ? r.route.trim() : 'ORAL.SOLID',
      referencePublicPriceEgp: retailEgp,
      referencePublicPriceMinor: String(retailMinor),
      estimatedWholesalePriceMinor: String(wholesaleMinor),
    };
  });

  if (!existsSync(REFERENCE_DIR)) {
    mkdirSync(REFERENCE_DIR, { recursive: true });
  }

  writeFileSync(OUTPUT_FILE, JSON.stringify(selected, null, 2), 'utf-8');
  console.log(`[reference] Successfully saved ${selected.length} products to ${OUTPUT_FILE}`);
  return selected;
}

if (process.argv[1]?.includes('download-public-reference')) {
  downloadAndSelect200Drugs()
    .then((drugs) => {
      console.log(`[reference] Done. 1st product:`, drugs[0]);
      console.log(`[reference] 100th product:`, drugs[99]);
      console.log(`[reference] 200th product:`, drugs[199]);
      process.exit(0);
    })
    .catch((err) => {
      console.error('[reference] Failed:', err);
      process.exit(1);
    });
}
