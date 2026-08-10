# EPTTS specification verification

## Primary source

- Egyptian Drug Authority, **Implementation Guide for Commissioning and Packing**, Code EDREX:NP.CIP.004/2026, Version 2/2026 (July 2026).
- Supplementary technical FAQ: https://edaegypt.gov.eg/media/paif1cpf/egyptian-track-trace-for-pharmaceutical-eptts-technical-faq-phase-1-_2026.pdf

## Verified EPTTS Phase 1 CSV facts

- **Format**: CSV is the mandatory Phase 1 submission format. XML and API integration will follow later.
- **Exact header (fixed order, capitalization matters)**:

```text
seqNo,Bizstep,eventTime,timeOffset,readPointGLN,bizLocationGLN,epc,Parent,import,expiryDate,manufDate
```

- Do **not** use lowercase `bizstep` or lowercase `parent`.
- **Delimiter**: comma (`,`). Verified by official complete example files in the guide.
- **Phase 1 supported operations**: `commissioning` and `packing` only for this implementation guide.
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

## Out of Phase 1 scope

The following EPCIS-style events are **not** modeled in the Phase 1 CSV preflight engine unless a later official source requires them:

- shipping
- receiving
- returns
- dispensing
- destruction

## Not verified / Phase 0 gaps

- **File encoding**: needs verification against the official source (commonly UTF-8 or Windows-1256 in Egypt government documents). Marked as NEEDS_VERIFICATION until explicitly defined.
- Line ending convention (CRLF vs LF) needs verification from the official sample file.
- Full event state machine for `Bizstep` values and `Parent` usage in aggregation needs verification against the official guide.

## Classification

| Rule / field | Status | Notes |
|---|---|---|
| CSV mandatory | VERIFIED | official guide |
| Exact header with capitalization | VERIFIED | official guide |
| Comma delimiter | VERIFIED | official complete examples |
| commissioning / packing only | VERIFIED | official guide scope |
| 50,000 serial limit | VERIFIED | official guide |
| 5 batch limit | VERIFIED | official guide |
| Atomic processing | VERIFIED | official guide |
| Expiry `YYYY-MM-DDT` | VERIFIED | official guide |
| Encoding | NEEDS_VERIFICATION | not explicitly defined in reviewed source |
| Full event state machine | NEEDS_VERIFICATION | needs official sample/spec |

## Implications

- `packages/schemas/eptts` must model the CSV row as a Zod contract using the exact header.
- Import pipeline must enforce file-size and row-count guards before parsing.
- Atomicity is handled by staging to an unlogged table and promoting on full success.
- Expiry date parsing must accept `YYYY-MM-DDT` in addition to standard ISO formats.
- No verdict claim can say the CSV is officially EDA-approved; it is a prototype preflight.
- Do not build shipping/receiving/returns/dispensing/destruction into the preflight engine until a later official guide requires them.
