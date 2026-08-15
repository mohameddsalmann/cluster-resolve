# Egyptian Pharmaceutical Track & Trace System (EPTTS) — Implemented Preflight Rules Matrix

## 1. Specification References
- **CSV Specification**: `EDREX:NP.CIP.004/2026 CSV User Guide v2.0 (July 2026)`
- **XML / EPCIS Specification**: `EDREX:NP.CIP.011/2026 XML Masar B2B EPCIS Guide v1.0 (July 2026)`
- **Standard FAQ**: `EDREX:NP.CIP.009 Questions & Answers`
- **GS1 General Specifications**: GS1 EPCIS 1.2, CBV 1.2, Modulo 10 Check Digit Standard.

---

## 2. Implemented CSV Validation Rules (EDREX:NP.CIP.004/2026)

| Finding Code | Severity | Official Rule Description | EDREX Section |
| :--- | :--- | :--- | :--- |
| `CSV_HEADER_MISMATCH` | **ERROR** | Header must strictly match: `seqNo,Bizstep,eventTime,timeOffset,readPointGLN,bizLocationGLN,epc,Parent,import,expiryDate,manufDate` | Section 3.1 |
| `SEQ_START_INVALID` | **ERROR** | First data row must start with `seqNo = 1`. | Section 3.2 |
| `SEQ_GAP` | **ERROR** | `seqNo` must increment monotonically without gaps. | Section 3.2 |
| `INVALID_BIZ_STEP` | **ERROR** | Business step must be either `commissioning` or `packing`. | Section 3.3 |
| `INVALID_TIMESTAMP` | **ERROR** | `eventTime` must be a valid ISO 8601 timestamp. | Section 3.4 |
| `EVENT_TIME_NOT_ASCENDING` | **ERROR** | Event rows must be strictly ordered chronologically by `eventTime`. | Section 3.4 |
| `INVALID_GLN` | **ERROR** | GLN must be 13 numeric digits passing GS1 Modulo 10 check digit. | Section 3.5 |
| `READ_BIZ_GLN_MISMATCH` | **ERROR** | In Phase 1 CSV uploads, `readPointGLN` must match `bizLocationGLN`. | Section 3.5 |
| `INVALID_SGTIN_SYNTAX` | **ERROR** | Unit EPC in commissioning must match `(01){GTIN-14}(21){Serial}`. | Section 4.1 |
| `INVALID_GTIN_CHECK_DIGIT`| **ERROR** | 14-digit GTIN payload must pass GS1 Modulo 10 check digit. | Section 4.1 |
| `INVALID_SSCC_SYNTAX` | **ERROR** | Pallet/Case EPC must match `(00){SSCC-18}`. | Section 4.2 |
| `INVALID_SSCC_CHECK_DIGIT`| **ERROR** | 18-digit SSCC payload must pass GS1 Modulo 10 check digit. | Section 4.2 |
| `INVALID_PARENT_BATCH` | **ERROR** | In commissioning, `Parent` must match `(10){Batch}` or be empty. | Section 4.3 |
| `EXPIRED_AT_COMMISSION` | **ERROR** | Product `expiryDate` cannot precede the commissioning `eventTime`. | Section 4.4 |
| `MANUFACTURING_AFTER_EVENT`| **ERROR** | `manufDate` cannot occur in the future relative to `eventTime`. | Section 4.4 |
| `CHILD_NOT_COMMISSIONED` | **ERROR** | Packing child item EPC must be commissioned prior to packing. | Section 5.1 |
| `PACKING_BEFORE_COMMISSION`| **ERROR** | Packing event time cannot precede commissioning event time. | Section 5.1 |
| `CIRCULAR_PACKING` | **ERROR** | Child item cannot be parent to itself or create hierarchy loops. | Section 5.2 |
| `MAX_SERIALS_EXCEEDED` | **ERROR** | Single CSV file cannot exceed 50,000 serialized item rows. | Section 2.3 |
| `MAX_BATCHES_EXCEEDED` | **ERROR** | Single SGTIN commissioning file cannot contain more than 5 batches. | Section 2.3 |
| `DUPLICATE_SERIAL` | **ERROR** | Duplicate EPC commissioning events within the same submission file are prohibited. | Section 4.1 |

---

## 3. Implemented XML / EPCIS 1.2 Rules (EDREX:NP.CIP.011/2026)

| Finding Code | Severity | Official Rule Description | EDREX Section |
| :--- | :--- | :--- | :--- |
| `XXE_DETECTED` | **ERROR** | DTD / Entity expansion elements are blocked for security. | Security Constraints |
| `XML_MALFORMED` | **ERROR** | Malformed XML syntax or missing `EPCISDocument` element. | Section 2.1 |
| `INVALID_EPCIS_ACTION` | **ERROR** | Commissioning & Packing action must be `ADD`; Shipping must be `OBSERVE`. | Section 3.1–3.3 |
| `XML_SHIPPING_SOURCE_MISSING` | **ERROR** | Shipping events must declare source owning party GLN in `sourceList`. | Section 3.3 Rule 1 |
| `XML_SHIPPING_DESTINATION_MISSING` | **ERROR** | Shipping events must declare destination owning party GLN in `destinationList`. | Section 3.3 Rule 2 |

---

## 4. Preflight Terminology Standard
Per regulatory compliance requirements, preflight engines output:
- `EPTTS PREFLIGHT PASS Validated against implemented official-source rules`
- `EPTTS PREFLIGHT FAIL Validated against implemented official-source rules`

Terms such as *"EDA Certified"* or *"EDA Approved"* are strictly prohibited for client-side preflight tools.
