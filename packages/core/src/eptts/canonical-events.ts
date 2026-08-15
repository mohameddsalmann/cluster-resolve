import { validateEpttsCsv } from './csv-preflight';
import { validateEpttsXml } from './xml-preflight';
import type {
  CanonicalTraceabilityEventRecord,
  PreflightResult,
  TraceabilityFormat,
} from './types';

export function detectFileFormat(content: string, filename?: string): TraceabilityFormat {
  const trimmed = content.trim();
  const lowerName = (filename || '').toLowerCase();

  if (lowerName.endsWith('.xml') || trimmed.startsWith('<')) {
    if (trimmed.includes('soapenv:Envelope') || trimmed.includes('soap:Envelope') || trimmed.includes('<Envelope')) {
      return 'XML_SOAP';
    }
    return 'XML_BARE';
  }

  return 'CSV';
}

export function runEpttsPreflight(
  content: string,
  declaredFormat?: TraceabilityFormat,
  filename?: string
): {
  format: TraceabilityFormat;
  result: PreflightResult;
  canonicalEvents: CanonicalTraceabilityEventRecord[];
} {
  const format = declaredFormat || detectFileFormat(content, filename);

  if (format === 'CSV') {
    const { result, canonicalEvents } = validateEpttsCsv(content);
    return { format: 'CSV', result, canonicalEvents };
  }

  const { result, canonicalEvents } = validateEpttsXml(content);
  return { format: result.format, result, canonicalEvents };
}
