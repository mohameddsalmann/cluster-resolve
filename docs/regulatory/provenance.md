# Egyptian Drug Authority (EDA) Notice Ingestion & Provenance

## 1. Overview
The Regulatory Intelligence engine in **Cluster Control Tower** provides automated, deterministic tracking of official drug recall notices, quality defect warnings, commercial fraud alerts, and awareness advisories issued by the **Egyptian Drug Authority (EDA)** (`edaegypt.gov.eg`).

---

## 2. Ingestion & Provenance Architecture

### 2.1 Official Data Source
- **Authority**: Egyptian Drug Authority (EDA) / Central Administration for Pharmaceutical Operations (CAPO) / Directorate of Inspection & Pharmacovigilance.
- **Index Pages**:
  - `https://www.edaegypt.gov.eg/en/media-center/periodic-reports/`
  - `https://www.edaegypt.gov.eg/ar/media-center/periodic-reports/`
- **Years Covered**: 2026 (Reports 1 to 24+) and 2025 (Reports 1 to 148+).

### 2.2 Provenance Record Schema
Each ingested notice is recorded in the global database repository (`regulatory_notices`) with verifiable provenance fields:
- `notice_number`: Official Arabic/English report title (e.g. `Periodic report no.(1) For 2026`).
- `year`: Publication year (integer).
- `notice_type`: Canonical classification (`RECALL`, `ALERT`, `COMMERCIAL_FRAUD`, `AWARENESS`).
- `recall_class`: Official Egyptian/FDA recall severity (`CLASS_I`, `CLASS_II`, `CLASS_III`, or `null`).
- `product_name`: Trade name and pharmaceutical strength.
- `manufacturer`: Targeted pharmaceutical manufacturer.
- `batch_numbers`: Array of specific defective or counterfeit batch identifiers.
- `source_url`: Direct public URL on `edaegypt.gov.eg` (PDF or periodic notice letter).
- `source_authority`: `"Egyptian Drug Authority"`.
- `source_checksum`: SHA256 digest of original PDF or HTML table entry.
- `retrieved_at`: ISO 8601 timestamp of live scraping or offline cache synchronization.

---

## 3. Deterministic Matching Engine

No machine learning or heuristic approximations are used. Matching is purely deterministic based on:
1. **EXACT Match**:
   - Product GTIN matches notice registration number / GTIN, OR
   - Exact normalized trade name match AND batch number present in procurement line.
2. **POSSIBLE Match**:
   - Normalized product name overlap or manufacturer match, but batch is unstated or not found in current procurement records.
3. **UNMATCHED**:
   - Zero overlap in GTIN, trade name tokens, or manufacturer.

---

## 4. Financial Exposure Computation
All monetary calculations use native `bigint` minor currency units (piastres):
$$\text{Historical Value Minor} = \sum_{\text{exposed lines}} (\text{filled\_qty} \times \text{unit\_price\_minor})$$
This prevents float rounding drift and preserves strict accounting fidelity.
