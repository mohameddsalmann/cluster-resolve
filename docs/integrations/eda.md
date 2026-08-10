# EDA integration discovery

## Source

- Egyptian Drug Authority (EDA): https://www.edaegypt.gov.eg/
- EDDB (Egyptian Drug Database) searching tool: https://www.edaegypt.gov.eg/media/ajqiccqc/np-ppma-18-mechanism-of-egyptian-drug-database-eddb-searching-tool.pdf
- Recall & Rapid Alert System guidelines: https://www.edaegypt.gov.eg/media/wjjfzot0/guidelines-on-recall-rapid-alert-system-for-medicinal-products_1.pdf
- Active pharmaceutical ingredient listing: https://www.edaegypt.gov.eg/media/zneif3c1/guidelines-on-the-rules-and-procedures-of-listing-active-pharmaceutical-ingredients-apis-for-medicinal-products-version-1-07-2023.pdf

## Verified public sources

1. **EDDB search page** — https://www.edaegypt.gov.eg/ — public, requires CAPTCHA.
2. **Published PDF guidelines** — public, no API.
3. **E-services data portal** — https://eservicesdata.edaegypt.gov.eg/CompanyTrades — requires company login.

## Data available

From public pages and PDFs:
- Trade name, generic name, dosage form, strength, pack unit.
- Registration number, registration expiry, license status.
- Manufacturer, applicant, market type.
- Recall and rapid alert guidelines (voluntary/statutory recall process).

## Not available

- No public machine-readable API for recalls, fraud alerts, or product notices.
- No public bulk download.
- No documented OpenAPI/RSS/JSON feed.

## Integration strategy

- EDA source is treated as a **scraper/importer** with explicit `robots.txt` respect and rate limiting.
- Archived PDFs will be stored in `fixtures/eda/` (manually downloaded, text-layer confirmed before storage).
- Recall notices are matched by product name/registrant using fuzzy text matching (`pg_trgm`), never auto-confirmed.
- A `POSSIBLE` match is always displayed for human review.

## Status

- **VERIFIED**: EDA public site, EDDB search, and recall guidelines exist.
- **UNVERIFIED**: live DOM structure, pagination, and `robots.txt` terms need manual inspection in a browser before scraper implementation.
