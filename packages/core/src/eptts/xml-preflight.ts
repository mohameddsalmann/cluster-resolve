import { XMLParser } from 'fast-xml-parser';
import { isValidGln, isValidGtin14, isValidSscc } from './gs1-checksum';
import type {
  CanonicalTraceabilityEventRecord,
  PreflightFinding,
  PreflightResult,
  TraceabilityFormat,
} from './types';

export const RULES_VERSION_XML = 'EDREX:NP.CIP.011/2026 v1.0 (July 2026)';

export function extractGlnFromUrn(urn: unknown): string {
  if (urn === undefined || urn === null) return '';
  const str = (typeof urn === 'object' ? (urn as Record<string, unknown>)['#text'] || (urn as Record<string, unknown>)['@_id'] || '' : urn).toString();
  const clean = str.trim();
  if (/^\d{13}$/.test(clean)) return clean;
  // urn:epc:id:sgln:6221234.00001.0 -> 622123400001 + check digit
  const match = /urn:epc:id:sgln:(\d+)\.(\d+)/i.exec(clean);
  if (match) {
    const raw = `${match[1]}${match[2]}`;
    if (raw.length === 12) {
      return `${raw}${calculateCheckDigit(raw)}`;
    }
    if (raw.length === 13) return raw;
  }
  return clean;
}

export function extractGtinFromUrn(urn: unknown): { gtin: string | null; serial: string | null } {
  if (urn === undefined || urn === null) return { gtin: null, serial: null };
  const str = (typeof urn === 'object' ? (urn as Record<string, unknown>)['#text'] || (urn as Record<string, unknown>)['@_id'] || '' : urn).toString();
  const clean = str.trim();
  if (clean.startsWith('(01)')) {
    const m = /^\(01\)(\d{14})\(21\)([\w\-\.\/]+)$/.exec(clean);
    if (m) return { gtin: m[1], serial: m[2] };
  }
  // urn:epc:id:sgtin:0622123.456789.ABC12345
  const m = /urn:epc:id:sgtin:(\d+)\.(\d+)\.([\w\-\.\/]+)/i.exec(clean);
  if (m) {
    const prefix = m[1];
    const item = m[2];
    const serial = m[3];
    const combined = `${prefix}${item}`;
    if (combined.length <= 13) {
      const padded = combined.padStart(13, '0');
      const gtin14 = `${padded}${calculateCheckDigit(padded)}`;
      return { gtin: gtin14, serial };
    }
    return { gtin: combined, serial };
  }
  return { gtin: null, serial: null };
}

export function extractSsccFromUrn(urn: unknown): string | null {
  if (urn === undefined || urn === null) return null;
  const str = (typeof urn === 'object' ? (urn as Record<string, unknown>)['#text'] || (urn as Record<string, unknown>)['@_id'] || '' : urn).toString();
  const clean = str.trim();
  if (clean.startsWith('(00)')) {
    const m = /^\(00\)(\d{18})$/.exec(clean);
    return m ? m[1] : null;
  }
  // urn:epc:id:sscc:6221234.0000000001
  const m = /urn:epc:id:sscc:(\d+)\.(\d+)/i.exec(clean);
  if (m) {
    const combined = `${m[1]}${m[2]}`;
    if (combined.length === 17) {
      return `${combined}${calculateCheckDigit(combined)}`;
    }
    return combined;
  }
  return null;
}

function calculateCheckDigit(digits: string): number {
  let sum = 0;
  let multiplier = 3;
  for (let i = digits.length - 1; i >= 0; i--) {
    const digit = parseInt(digits[i], 10);
    if (!Number.isNaN(digit)) {
      sum += digit * multiplier;
      multiplier = multiplier === 3 ? 1 : 3;
    }
  }
  return (10 - (sum % 10)) % 10;
}

export function validateEpttsXml(xmlContent: string): {
  result: PreflightResult;
  canonicalEvents: CanonicalTraceabilityEventRecord[];
} {
  const findings: PreflightFinding[] = [];
  const canonicalEvents: CanonicalTraceabilityEventRecord[] = [];

  // 1. Security Check: Detect XXE and external entity declarations
  if (/<!ENTITY/i.test(xmlContent) || /<!DOCTYPE[^>]*\[/i.test(xmlContent) || /SYSTEM\s+["']/i.test(xmlContent)) {
    findings.push({
      code: 'XXE_DETECTED',
      severity: 'ERROR',
      rowOrEventIndex: 0,
      field: 'DOCTYPE',
      message: 'XML contains DTD/Entity expansion declarations. XXE features are disabled for security.',
      evidence: 'DOCTYPE / ENTITY detected in raw payload',
      officialRuleReference: 'EDREX:NP.CIP.011/2026 Security Constraints',
    });

    return {
      result: {
        status: 'FAIL',
        format: 'XML_BARE',
        rulesVersion: RULES_VERSION_XML,
        totalRows: 0,
        eventCount: 0,
        serialCount: 0,
        batchCount: 0,
        findings,
        errorCount: 1,
        warningCount: 0,
        wording: `EPTTS PREFLIGHT FAIL Validated against implemented official-source rules (${RULES_VERSION_XML})`,
      },
      canonicalEvents: [],
    };
  }

  // 2. Parse XML safely with fast-xml-parser
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    processEntities: false,
    allowBooleanAttributes: true,
    parseTagValue: false,
  });

  let parsed: Record<string, unknown>;
  try {
    parsed = parser.parse(xmlContent) as Record<string, unknown>;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Malformed XML structure';
    findings.push({
      code: 'XML_MALFORMED',
      severity: 'ERROR',
      rowOrEventIndex: 0,
      field: null,
      message: `XML syntax error: ${msg}`,
      evidence: xmlContent.slice(0, 200),
      officialRuleReference: 'EDREX:NP.CIP.011/2026 Section 2.1',
    });

    return {
      result: {
        status: 'FAIL',
        format: 'XML_BARE',
        rulesVersion: RULES_VERSION_XML,
        totalRows: 0,
        eventCount: 0,
        serialCount: 0,
        batchCount: 0,
        findings,
        errorCount: 1,
        warningCount: 0,
        wording: `EPTTS PREFLIGHT FAIL Validated against implemented official-source rules (${RULES_VERSION_XML})`,
      },
      canonicalEvents: [],
    };
  }

  // 3. Format Detection & SBDH Extraction
  let format: TraceabilityFormat = 'XML_BARE';
  let epcisDoc: Record<string, unknown> | null = null;
  let sbdh: Record<string, unknown> | null = null;

  const soapEnvelope = (parsed['soapenv:Envelope'] || parsed['soap:Envelope'] || parsed['Envelope']) as Record<string, unknown> | undefined;
  if (soapEnvelope) {
    format = 'XML_SOAP';
    const soapBody = (soapEnvelope['soapenv:Body'] || soapEnvelope['soap:Body'] || soapEnvelope['Body']) as Record<string, unknown> | undefined;
    if (soapBody) {
      epcisDoc = (soapBody['epcis:EPCISDocument'] || soapBody['EPCISDocument']) as Record<string, unknown> | null;
      const soapHeader = soapEnvelope['soapenv:Header'] as Record<string, unknown> | undefined;
      sbdh = (soapHeader?.['sh:StandardBusinessDocumentHeader'] ||
        soapHeader?.['StandardBusinessDocumentHeader'] ||
        soapBody['sh:StandardBusinessDocumentHeader']) as Record<string, unknown> | null;
    }
  } else {
    const sbd = (parsed['sh:StandardBusinessDocument'] || parsed['StandardBusinessDocument']) as Record<string, unknown> | undefined;
    if (sbd) {
      sbdh = (sbd['sh:StandardBusinessDocumentHeader'] || sbd['StandardBusinessDocumentHeader']) as Record<string, unknown> | null;
      epcisDoc = (sbd['epcis:EPCISDocument'] || sbd['EPCISDocument']) as Record<string, unknown> | null;
    } else {
      epcisDoc = (parsed['epcis:EPCISDocument'] || parsed['EPCISDocument']) as Record<string, unknown> | null;
    }
  }

  if (!epcisDoc) {
    findings.push({
      code: 'XML_MALFORMED',
      severity: 'ERROR',
      rowOrEventIndex: 0,
      field: 'EPCISDocument',
      message: 'Could not locate EPCISDocument element in XML payload.',
      evidence: Object.keys(parsed).join(', '),
      officialRuleReference: 'EDREX:NP.CIP.011/2026 Section 2.1',
    });
  }

  // SBDH Validation
  let senderGln: string | null = null;
  let receiverGln: string | null = null;
  let instanceIdentifier: string | null = null;

  if (sbdh) {
    const sender = (sbdh['sh:Sender'] || sbdh['Sender']) as Record<string, unknown> | undefined;
    const receiver = (sbdh['sh:Receiver'] || sbdh['Receiver']) as Record<string, unknown> | undefined;
    const docId = (sbdh['sh:DocumentIdentification'] || sbdh['DocumentIdentification']) as Record<string, unknown> | undefined;

    const senderIdent = sender?.['sh:Identifier'] || sender?.['Identifier'];
    const receiverIdent = receiver?.['sh:Identifier'] || receiver?.['Identifier'];
    const instId = docId?.['sh:InstanceIdentifier'] || docId?.['InstanceIdentifier'];

    senderGln = typeof senderIdent === 'object' ? (senderIdent as Record<string, unknown>)?.['#text'] as string : senderIdent as string || null;
    receiverGln = typeof receiverIdent === 'object' ? (receiverIdent as Record<string, unknown>)?.['#text'] as string : receiverIdent as string || null;
    instanceIdentifier = typeof instId === 'object' ? (instId as Record<string, unknown>)?.['#text'] as string : instId as string || null;

    if (senderGln && !isValidGln(senderGln)) {
      findings.push({
        code: 'INVALID_GLN',
        severity: 'WARNING',
        rowOrEventIndex: 0,
        field: 'Sender',
        message: `SBDH Sender GLN '${senderGln}' is not a valid 13-digit GLN.`,
        evidence: senderGln,
        officialRuleReference: 'EDREX:NP.CIP.011/2026 Section 2.2',
      });
    }
    if (receiverGln && !isValidGln(receiverGln)) {
      findings.push({
        code: 'INVALID_GLN',
        severity: 'WARNING',
        rowOrEventIndex: 0,
        field: 'Receiver',
        message: `SBDH Receiver GLN '${receiverGln}' is not a valid 13-digit GLN.`,
        evidence: receiverGln,
        officialRuleReference: 'EDREX:NP.CIP.011/2026 Section 2.2',
      });
    }
  }

  // 4. EPCIS Body & Event Parsing
  const epcisBody = (epcisDoc?.['EPCISBody'] || epcisDoc?.['epcis:EPCISBody']) as Record<string, unknown> | undefined;
  const eventList = (epcisBody?.['EventList'] || epcisBody?.['epcis:EventList'] || {}) as Record<string, unknown>;

  const objectEvents = normalizeArray(eventList['ObjectEvent'] || eventList['epcis:ObjectEvent']) as Array<Record<string, unknown>>;
  const aggregationEvents = normalizeArray(
    eventList['AggregationEvent'] || eventList['epcis:AggregationEvent']
  ) as Array<Record<string, unknown>>;

  const seenSerials = new Set<string>();
  const seenBatches = new Set<string>();
  let eventIndex = 0;

  // Process Commissioning ObjectEvents
  for (const event of objectEvents) {
    const rawBizStep = (event['bizStep'] || '').toString().trim();
    if (!rawBizStep.includes('commissioning') && rawBizStep !== 'commissioning') {
      continue;
    }
    eventIndex++;
    const action = (event['action'] || '').toString().trim().toUpperCase();
    const eventTime = (event['eventTime'] || '').toString().trim();
    const timeOffset = (event['eventTimeZoneOffset'] || '').toString().trim();

    const readPointObj = event['readPoint'] as Record<string, unknown> | undefined;
    const bizLocationObj = event['bizLocation'] as Record<string, unknown> | undefined;

    const readPointId = readPointObj?.['id'] || readPointObj?.['@_id'] || event['readPoint'] || '';
    const bizLocationId = bizLocationObj?.['id'] || bizLocationObj?.['@_id'] || event['bizLocation'] || '';

    const readGln = extractGlnFromUrn(readPointId);
    const bizGln = extractGlnFromUrn(bizLocationId);

    if (action !== 'ADD') {
      findings.push({
        code: 'INVALID_EPCIS_ACTION',
        severity: 'ERROR',
        rowOrEventIndex: eventIndex,
        field: 'action',
        message: `Commissioning ObjectEvent action must be 'ADD', found '${action}'`,
        evidence: action,
        officialRuleReference: 'EDREX:NP.CIP.011/2026 Section 3.1',
      });
    }

    const ilmd = (event['ilmd'] || event['epcis:ilmd'] || {}) as Record<string, unknown>;
    const batch =
      ilmd['lotNumber'] || ilmd['batchNumber'] || ilmd['cbvmda:lotNumber'] || null;
    const expiry =
      ilmd['itemExpirationDate'] || ilmd['expirationDate'] || ilmd['cbvmda:itemExpirationDate'] || null;

    if (batch) seenBatches.add(batch.toString());

    const epcListObj = event['epcList'] as Record<string, unknown> | undefined;
    const epcs = normalizeArray(epcListObj?.['epc'] || event['epc']);
    for (const rawEpc of epcs) {
      const epcStr = (typeof rawEpc === 'object' && rawEpc !== null ? (rawEpc as Record<string, unknown>)['#text'] || '' : rawEpc || '').toString().trim();
      const { gtin, serial } = extractGtinFromUrn(epcStr);

      if (gtin && !isValidGtin14(gtin)) {
        findings.push({
          code: 'INVALID_GTIN_CHECK_DIGIT',
          severity: 'ERROR',
          rowOrEventIndex: eventIndex,
          field: 'epc',
          message: `GTIN '${gtin}' in EPC '${epcStr}' fails GS1 check digit validation.`,
          evidence: gtin,
          officialRuleReference: 'EDREX:NP.CIP.011/2026 Section 3.1',
        });
      }

      if (epcStr) {
        seenSerials.add(epcStr);
        canonicalEvents.push({
          eventType: 'COMMISSIONING',
          eventTime,
          timezoneOffset: timeOffset || null,
          epc: epcStr,
          gtin: gtin || null,
          serial: serial || null,
          batch: batch ? batch.toString() : null,
          expiryDate: expiry ? expiry.toString().slice(0, 10) : null,
          readPointGln: readGln,
          bizLocationGln: bizGln,
          sourceFormat: format,
          sourceIndex: eventIndex,
        });
      }
    }
  }

  // Process Packing AggregationEvents
  for (const event of aggregationEvents) {
    eventIndex++;
    const action = (event['action'] || '').toString().trim().toUpperCase();
    const eventTime = (event['eventTime'] || '').toString().trim();
    const timeOffset = (event['eventTimeZoneOffset'] || '').toString().trim();

    const readPointObj = event['readPoint'] as Record<string, unknown> | undefined;
    const bizLocationObj = event['bizLocation'] as Record<string, unknown> | undefined;

    const readPointId = readPointObj?.['id'] || readPointObj?.['@_id'] || event['readPoint'] || '';
    const bizLocationId = bizLocationObj?.['id'] || bizLocationObj?.['@_id'] || event['bizLocation'] || '';

    const readGln = extractGlnFromUrn(readPointId);
    const bizGln = extractGlnFromUrn(bizLocationId);

    if (action !== 'ADD') {
      findings.push({
        code: 'INVALID_EPCIS_ACTION',
        severity: 'ERROR',
        rowOrEventIndex: eventIndex,
        field: 'action',
        message: `Packing AggregationEvent action must be 'ADD', found '${action}'`,
        evidence: action,
        officialRuleReference: 'EDREX:NP.CIP.011/2026 Section 3.2',
      });
    }

    const parentIdObj = event['parentID'] as Record<string, unknown> | string | undefined;
    const parentIdRaw = (typeof parentIdObj === 'object' && parentIdObj !== null ? parentIdObj['#text'] || '' : parentIdObj || '').toString().trim();
    const parentSscc = extractSsccFromUrn(parentIdRaw);

    if (parentSscc && !isValidSscc(parentSscc)) {
      findings.push({
        code: 'INVALID_SSCC_CHECK_DIGIT',
        severity: 'ERROR',
        rowOrEventIndex: eventIndex,
        field: 'parentID',
        message: `Parent SSCC '${parentSscc}' in '${parentIdRaw}' fails GS1 check digit validation.`,
        evidence: parentSscc,
        officialRuleReference: 'EDREX:NP.CIP.011/2026 Section 3.2',
      });
    }

    const childEpcsObj = event['childEPCs'] as Record<string, unknown> | undefined;
    const childEpcs = normalizeArray(childEpcsObj?.['epc'] || event['childEPCs']);
    for (const rawChild of childEpcs) {
      const childStr = (typeof rawChild === 'object' && rawChild !== null ? (rawChild as Record<string, unknown>)['#text'] || '' : rawChild || '').toString().trim();
      const { gtin, serial } = extractGtinFromUrn(childStr);

      canonicalEvents.push({
        eventType: 'PACKING',
        eventTime,
        timezoneOffset: timeOffset || null,
        epc: childStr,
        gtin: gtin || null,
        serial: serial || null,
        parentEpc: parentIdRaw || null,
        readPointGln: readGln,
        bizLocationGln: bizGln,
        sourceFormat: format,
        sourceIndex: eventIndex,
      });
    }
  }

  // Process Shipping ObjectEvents
  for (const event of objectEvents) {
    const rawBizStep = (event['bizStep'] || '').toString().trim();
    if (!rawBizStep.includes('shipping') && rawBizStep !== 'shipping') {
      continue;
    }
    eventIndex++;
    const action = (event['action'] || '').toString().trim().toUpperCase();
    const eventTime = (event['eventTime'] || '').toString().trim();
    const timeOffset = (event['eventTimeZoneOffset'] || '').toString().trim();

    const readPointObj = event['readPoint'] as Record<string, unknown> | undefined;
    const bizLocationObj = event['bizLocation'] as Record<string, unknown> | undefined;

    const readPointId = readPointObj?.['id'] || readPointObj?.['@_id'] || event['readPoint'] || '';
    const bizLocationId = bizLocationObj?.['id'] || bizLocationObj?.['@_id'] || event['bizLocation'] || '';

    const readGln = extractGlnFromUrn(readPointId);
    const bizGln = extractGlnFromUrn(bizLocationId);

    if (action !== 'OBSERVE') {
      findings.push({
        code: 'INVALID_EPCIS_ACTION',
        severity: 'ERROR',
        rowOrEventIndex: eventIndex,
        field: 'action',
        message: `Shipping ObjectEvent action must be 'OBSERVE', found '${action}'`,
        evidence: action,
        officialRuleReference: 'EDREX:NP.CIP.011/2026 Section 3.3',
      });
    }

    const sourceListObj = event['sourceList'] as Record<string, unknown> | undefined;
    const destListObj = event['destinationList'] as Record<string, unknown> | undefined;

    const sourceList = normalizeArray(sourceListObj?.['source']);
    const destinationList = normalizeArray(destListObj?.['destination']);

    const sourceItem = sourceList[0] as Record<string, unknown> | string | undefined;
    const destItem = destinationList[0] as Record<string, unknown> | string | undefined;

    const sourceGlnRaw = typeof sourceItem === 'object' && sourceItem !== null ? sourceItem['#text'] || sourceItem['@_id'] : sourceItem || null;
    const destGlnRaw = typeof destItem === 'object' && destItem !== null ? destItem['#text'] || destItem['@_id'] : destItem || null;

    const sourceGln = sourceGlnRaw ? extractGlnFromUrn(sourceGlnRaw) : null;
    const destinationGln = destGlnRaw ? extractGlnFromUrn(destGlnRaw) : null;

    if (!sourceGln) {
      findings.push({
        code: 'XML_SHIPPING_SOURCE_MISSING',
        severity: 'ERROR',
        rowOrEventIndex: eventIndex,
        field: 'sourceList',
        message: 'Shipping event must declare source owning party GLN.',
        evidence: 'sourceList is missing or empty',
        officialRuleReference: 'EDREX:NP.CIP.011/2026 Section 3.3 Rule 1',
      });
    }
    if (!destinationGln) {
      findings.push({
        code: 'XML_SHIPPING_DESTINATION_MISSING',
        severity: 'ERROR',
        rowOrEventIndex: eventIndex,
        field: 'destinationList',
        message: 'Shipping event must declare destination owning party GLN.',
        evidence: 'destinationList is missing or empty',
        officialRuleReference: 'EDREX:NP.CIP.011/2026 Section 3.3 Rule 2',
      });
    }

    const bizTxListObj = event['bizTransactionList'] as Record<string, unknown> | undefined;
    const bizTxList = normalizeArray(bizTxListObj?.['bizTransaction']);
    const firstTx = bizTxList[0] as Record<string, unknown> | string | undefined;
    const bizTxRef = typeof firstTx === 'object' && firstTx !== null ? firstTx['#text'] || firstTx['@_id'] : (typeof firstTx === 'string' ? firstTx : null);

    const epcListObj = event['epcList'] as Record<string, unknown> | undefined;
    const epcs = normalizeArray(epcListObj?.['epc'] || event['epc']);
    for (const rawEpc of epcs) {
      const epcStr = (typeof rawEpc === 'object' && rawEpc !== null ? (rawEpc as Record<string, unknown>)['#text'] || '' : rawEpc || '').toString().trim();
      const { gtin, serial } = extractGtinFromUrn(epcStr);

      canonicalEvents.push({
        eventType: 'SHIPPING',
        eventTime,
        timezoneOffset: timeOffset || null,
        epc: epcStr,
        gtin: gtin || null,
        serial: serial || null,
        readPointGln: readGln,
        bizLocationGln: bizGln,
        sourceGln,
        destinationGln,
        bizTransactionRef: bizTxRef ? bizTxRef.toString() : null,
        sourceFormat: format,
        sourceIndex: eventIndex,
      });
    }
  }

  // Sort canonical events chronologically
  canonicalEvents.sort((a, b) => Date.parse(a.eventTime) - Date.parse(b.eventTime));

  const errors = findings.filter((f) => f.severity === 'ERROR');
  const warnings = findings.filter((f) => f.severity === 'WARNING');
  const isPass = errors.length === 0;

  const wording = isPass
    ? `EPTTS PREFLIGHT PASS Validated against implemented official-source rules (${RULES_VERSION_XML})`
    : `EPTTS PREFLIGHT FAIL Validated against implemented official-source rules (${RULES_VERSION_XML})`;

  return {
    result: {
      status: isPass ? 'PASS' : 'FAIL',
      format,
      rulesVersion: RULES_VERSION_XML,
      totalRows: eventIndex,
      eventCount: canonicalEvents.length,
      serialCount: seenSerials.size,
      batchCount: seenBatches.size,
      findings,
      errorCount: errors.length,
      warningCount: warnings.length,
      wording,
      senderGln,
      receiverGln,
      instanceIdentifier,
    },
    canonicalEvents: isPass ? canonicalEvents : [],
  };
}

function normalizeArray<T>(val: T | T[] | undefined | null): T[] {
  if (val === undefined || val === null) return [];
  return Array.isArray(val) ? val : [val];
}
