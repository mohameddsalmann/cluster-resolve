# EPTTS specification verification

## Source

- EPTTS Phase 1 CSV FAQ: https://edaegypt.gov.eg/media/paif1cpf/egyptian-track-trace-for-pharmaceutical-eptts-technical-faq-phase-1-_2026.pdf
- GS1 Egypt LinkedIn posts on EPTTS CSV: https://www.linkedin.com/posts/gs1-egypt_eda-guideline-provides-the-technical-implementation-activity-7437951527371145217-4FF3
- TraceHub EPTTS FAQ: https://tracehub.1dts.com/RegulationHub/News/153

## Verified EPTTS Phase 1 CSV facts

- **Format**: CSV is the mandatory Phase 1 submission format. XML and API integration will follow later.
- **Header (fixed order)**: `seqNo,bizstep,eventTime,timeOffset,readPointGLN,bizLocationGLN,epc,parent,import,expiryDate,manufDate`
- **Encoding**: implied UTF-8 (official guide not yet inspected byte-for-byte).
- **Atomic processing**: any error rejects the entire file.
- **Chronological ordering**: rows must be sorted by `eventTime` ascending.
- **Volume limit**: max 50,000 unique serial numbers per file.
- **Batch limit**: max 5 distinct batches per commissioning file (STIN only).
- **Dependency**: an EIC must be commissioned before it can be packed.
- **Data Matrix ECC 200** is mandatory; encoded AIs: `(01)` GTIN, `(21)` Serial Number, `(17)` Expiry Date, `(10)` Batch/Lot.
- **Expiry date format**: `YYYY-MM-DDT` (deviates from GS1 `YYMMDD`).
- **FNC1/GS (ASCII 29) separators** mandatory after variable-length AIs.
- **HRI** mandatory, GS1 General Specifications Release 26.
- **EPCIS alignment**: current CSV deviates from EPCIS 1.2/2.0; EDA plans future alignment while keeping backward compatibility.

## Not verified / Phase 0 gaps

- Exact CSV delimiter (assumed comma; to be confirmed from official sample file).
- Line ending convention (assumed CRLF from Windows ecosystem; to be confirmed).
- Official sample file link and SHA256 to be archived.
- Event state machine for `bizstep` values and `parent` usage in aggregation.

## Classification

| Rule / field | Status | Notes |
|---|---|---|
| CSV mandatory | VERIFIED | official docs |
| Fixed header | VERIFIED | LinkedIn + TraceHub |
| 50,000 serial limit | VERIFIED | official docs |
| 5 batch limit | VERIFIED | official docs |
| Atomic processing | VERIFIED | official docs |
| Expiry `YYYY-MM-DDT` | VERIFIED | official docs |
| Delimiter/encoding | UNVERIFIED | needs sample file |
| Full event state machine | UNVERIFIED | needs official spec |

## Implications

- `packages/schemas/eptts` must model the CSV row as a Zod contract.
- Import pipeline must enforce file-size and row-count guards before parsing.
- Atomicity is handled by staging to an unlogged table and promoting on full success.
- Expiry date parsing must accept `YYYY-MM-DDT` in addition to standard ISO formats.
- No verdict claim can say the CSV is officially EDA-approved; it is a prototype preflight.
