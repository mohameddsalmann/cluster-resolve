# Product Reference Provenance — Egyptian Drug Reference Dataset

## 1. Provenance and Source

- **Public Reference Source**: Egyptian Drug Database (`karem505/egyptian-drug-database`)
- **Source Repository URL**: https://github.com/karem505/egyptian-drug-database
- **Source Data File**: [`data/egyptian-drugs.csv`](https://github.com/karem505/egyptian-drug-database/blob/82809ebb972adf976d5301689cdab68b00346f71/data/egyptian-drugs.csv)
- **Source Revision / Commit**: `82809ebb972adf976d5301689cdab68b00346f71`
- **Retrieval Date**: 2026-08-15
- **License**: **CC0-1.0 (Creative Commons Zero / Public Domain)**
  - CC0 dedication explicitly permits copying, modification, distribution, and commercial/non-commercial operational use without restriction or attribution requirements.
- **Upstream record count**: 25,070 rows at the pinned revision.
- **Selected local snapshot**: 200 records in `data/reference/egyptian-drugs-200.json`.
- **Selected snapshot SHA-256**: `93827a4f4b8faffc2102401e9efb16172fe71dc2ec1e1a868eedbe6ca7c33829`.

---

## 2. Distinction Between Reference Data and Procurement History

| Category | Real Public Data vs Synthetic Procurement History |
|---|---|
| **Product Metadata** | **Public Medicine Reference**: Source-provided trade names (English + Arabic alias), scientific composition, manufacturers, drug classes, routes, and EGP prices. It is not customer procurement or an official EDA registry. |
| **Procurement History** | **Synthetic**: All order transactions, buyer pharmacies, distributor entities, quoted offers, AI decision logs, delivery timestamps, and fulfillment outcomes are deterministically generated for operational intelligence and demonstration purposes. |
| **Entity Names** | Neutral synthetic identifiers (`SUP-001` .. `SUP-030`, `PHARM-001` .. `PHARM-050`). No real pharmacy or commercial distributor operational performance is claimed. |

---

## 3. Product Selection Methodology

- Deterministically filtered from 25,070 upstream rows to select **200 reference records**.
- Criteria applied:
  1. Complete, non-corrupted Latin scientific composition (`scientific_name`).
  2. Complete commercial name (`commercial_name_en`) and Arabic alias (`commercial_name_ar`).
  3. Non-empty source-provided manufacturer name (`manufacturer`).
  4. Validated retail price between 5 EGP and 3,000 EGP.
  5. Stable sorting by scientific and commercial name, deduplication by commercial name, then evenly spaced selection across the result.
- Mapped into stable Resolve Product IDs: `PROD-0001` through `PROD-0200`.

---

## 4. Public Price to Quoted Procurement Price Assumption

- The source dataset records published retail prices in Egyptian Pounds (`price_egp`).
- **Minor unit conversion**: `1 EGP = 100 piasters` (stored as integer minor units).
- **Wholesale baseline transformation**:
  $$\text{Estimated Wholesale Baseline} = \text{round}(\text{Retail Price} \times 0.85)$$
- **Synthetic Offer Pricing**:
  - In the procurement generator, competing suppliers quote prices centered around the estimated wholesale baseline, modified by supplier profile discounts (0–15% discount) and order volume brackets.
  - Quoted supplier prices are synthetic simulation artifacts and must never be interpreted as actual commercial distributor quotes.

---

## 5. Storage and Offline Availability

The selected 200 product reference records are stored locally at:
```text
data/reference/egyptian-drugs-200.json
```
This ensures normal `build`, `test`, `typecheck`, and `runtime` execution are **100% offline and deterministic**, requiring no internet access.
