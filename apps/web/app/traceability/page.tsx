'use client';

import { useState, useEffect } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  FileCheck,
  FileCode,
  FileSpreadsheet,
  FileUp,
  Layers,
  Link as LinkIcon,
  ShieldAlert,
  Upload,
} from 'lucide-react';
import { AppShell, PageBody, TopContextBar } from '@/components/cluster/AppShell';
import {
  EmptyState,
  PageHeader,
  Panel,
  StatusChip,
  type ChipTone,
} from '@/components/cluster/primitives';
import { useDataset } from '@/lib/context/dataset-context';

interface PreflightFinding {
  code: string;
  severity: 'ERROR' | 'WARNING' | 'INFO';
  row_or_event_index: number | null;
  field: string | null;
  message: string;
  evidence: string | null;
  official_rule_reference: string;
}

interface PreflightResultState {
  status: 'PASS' | 'FAIL';
  format: string;
  rulesVersion: string;
  totalRows: number;
  eventCount: number;
  serialCount: number;
  batchCount: number;
  findings: PreflightFinding[];
  errorCount: number;
  warningCount: number;
  wording: string;
  senderGln?: string | null;
  receiverGln?: string | null;
}

interface TraceabilityImportSummary {
  id: string;
  filename: string;
  format: string;
  preflight_status: 'PASS' | 'FAIL';
  event_count: number;
  finding_count: number;
  created_at: string;
  source_type: 'CUSTOMER' | 'OFFICIAL_REFERENCE_TEST' | 'TEST';
}

interface CanonicalEvent {
  id: string;
  event_type: string;
  event_time: string;
  epc: string;
  gtin: string | null;
  serial: string | null;
  sscc: string | null;
  batch: string | null;
  expiry_date: string | null;
  manufacturing_date: string | null;
  parent_epc: string | null;
  read_point_gln: string;
  biz_location_gln: string;
  source_gln: string | null;
  destination_gln: string | null;
  biz_transaction_ref: string | null;
  source_format: string;
}

interface ProductLink {
  id: string;
  product_id: string;
  gtin: string;
  status: 'CONFIRMED' | 'SUGGESTED';
  confidence_reason: string;
  product?: { name: string };
}

interface ReconciliationItem {
  id: string;
  order_id: string;
  product_id: string;
  reconciliation_status: 'MATCH' | 'MISMATCH' | 'INSUFFICIENT_LINKAGE' | 'INSUFFICIENT_TRACEABILITY_DATA';
  operational_qty: number;
  traceability_qty: number;
  difference_qty: number;
  business_ref: string | null;
  evidence_json: Record<string, unknown>;
  reconciled_at: string;
  order?: { external_order_id: string };
  product?: { name: string };
}

interface ExpirySummary {
  totalSerializedUnits: number;
  expiredCount: number;
  expiring90DaysCount: number;
  expiring180DaysCount: number;
  laterCount: number;
  unknownExpiryCount: number;
}

interface ExpiryItem {
  epc: string;
  gtin: string | null;
  serial: string | null;
  batch: string | null;
  expiryDate: string | null;
  bucket: 'EXPIRED' | 'EXPIRING_90' | 'EXPIRING_180' | 'LATER' | 'UNKNOWN';
  daysToExpiry: number | null;
  productName?: string | null;
}

// Explicit official-reference/test examples. They are never presented as customer data.
const REFERENCE_FIXTURES = {
  VALID_CSV: {
    name: 'EPTTS Reference/Test: Valid CSV',
    format: 'CSV',
    content: `seqNo,Bizstep,eventTime,timeOffset,readPointGLN,bizLocationGLN,epc,Parent,import,expiryDate,manufDate
1,commissioning,2026-08-01T08:00:00Z,+02:00,6221234567891,6221234567891,(01)06221234567891(21)SN0001,(10)BATCH-A,0,2028-12-31,2026-07-01
2,commissioning,2026-08-01T08:05:00Z,+02:00,6221234567891,6221234567891,(01)06221234567891(21)SN0002,(10)BATCH-A,0,2028-12-31,2026-07-01
3,commissioning,2026-08-01T08:10:00Z,+02:00,6221234567891,6221234567891,(00)062212340000000015,,,,
4,packing,2026-08-01T09:00:00Z,+02:00,6221234567891,6221234567891,(01)06221234567891(21)SN0001,(00)062212340000000015,,,
5,packing,2026-08-01T09:00:00Z,+02:00,6221234567891,6221234567891,(01)06221234567891(21)SN0002,(00)062212340000000015,,,`,
  },
  ERROR_CSV: {
    name: 'EPTTS Reference/Test: Invalid CSV',
    format: 'CSV',
    content: `seqNo,Bizstep,eventTime,readPointGLN,epc
2,commissioning,2026-08-01T08:00:00Z,6221234567891,(01)06221234567899(21)SN0001
4,commissioning,2026-08-01T07:00:00Z,6221234567891,(01)06221234567891(21)SN0002`,
  },
  VALID_XML_BARE: {
    name: 'EPTTS Reference/Test: Valid EPCIS XML',
    format: 'XML_BARE',
    content: `<?xml version="1.0" encoding="UTF-8"?>
<epcis:EPCISDocument xmlns:epcis="urn:epcglobal:epcis:xsd:1" schemaVersion="1.2" creationDate="2026-08-01T08:00:00Z">
  <EPCISBody>
    <EventList>
      <ObjectEvent>
        <eventTime>2026-08-01T08:00:00Z</eventTime>
        <eventTimeZoneOffset>+02:00</eventTimeZoneOffset>
        <epcList>
          <epc>(01)06221234567891(21)EPC001</epc>
        </epcList>
        <action>ADD</action>
        <bizStep>urn:epcglobal:cbv:bizstep:commissioning</bizStep>
        <readPoint><id>6221234567891</id></readPoint>
        <bizLocation><id>6221234567891</id></bizLocation>
        <ilmd>
          <lotNumber>BATCH-2026-X</lotNumber>
          <itemExpirationDate>2028-12-31</itemExpirationDate>
        </ilmd>
      </ObjectEvent>
      <ObjectEvent>
        <eventTime>2026-08-01T09:00:00Z</eventTime>
        <eventTimeZoneOffset>+02:00</eventTimeZoneOffset>
        <epcList>
          <epc>(01)06221234567891(21)EPC001</epc>
        </epcList>
        <action>OBSERVE</action>
        <bizStep>urn:epcglobal:cbv:bizstep:shipping</bizStep>
        <readPoint><id>6221234567891</id></readPoint>
        <bizLocation><id>6221234567891</id></bizLocation>
        <sourceList><source>6221234567891</source></sourceList>
        <destinationList><destination>6229876543210</destination></destinationList>
        <bizTransactionList><bizTransaction>ORD-101</bizTransaction></bizTransactionList>
      </ObjectEvent>
    </EventList>
  </EPCISBody>
</epcis:EPCISDocument>`,
  },
};

export default function TraceabilityPage() {
  const { activeDatasetId } = useDataset();
  const [activeTab, setActiveTab] = useState<'PREFLIGHT' | 'EVENTS' | 'EXPIRY' | 'CROSSWALK' | 'RECONCILIATION'>('PREFLIGHT');

  const [processing, setProcessing] = useState(false);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [persistenceStatus, setPersistenceStatus] = useState<'AVAILABLE' | 'UNAVAILABLE' | null>(null);
  const [persistenceMessage, setPersistenceMessage] = useState<string>('');

  // Upload state
  const [pasteText, setPasteText] = useState('');
  const [latestPreflight, setLatestPreflight] = useState<PreflightResultState | null>(null);

  // Persisted dataset state
  const [events, setEvents] = useState<CanonicalEvent[]>([]);
  const [imports, setImports] = useState<TraceabilityImportSummary[]>([]);
  const [totalEvents, setTotalEvents] = useState(0);
  const [links, setLinks] = useState<ProductLink[]>([]);
  const [reconciliations, setReconciliations] = useState<ReconciliationItem[]>([]);
  const [expirySummary, setExpirySummary] = useState<ExpirySummary | null>(null);
  const [expiryItems, setExpiryItems] = useState<ExpiryItem[]>([]);

  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let isCancelled = false;

    async function loadData() {
      if (!activeDatasetId) {
        return;
      }

      try {
        const res = await fetch(`/api/traceability?datasetId=${activeDatasetId}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
        const data = await res.json();

        if (!isCancelled) {
          setImports(data.imports || []);
          setEvents(data.events || []);
          setTotalEvents(data.totalEventsCount || 0);
          setLinks(data.links || []);
          setReconciliations(data.reconciliations || []);
          setExpirySummary(data.expirySummary || null);
          setExpiryItems(data.expiryItems || []);
          setPersistenceStatus(data.persistenceStatus || 'AVAILABLE');
          setPersistenceMessage(data.statusMessage || '');
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('Failed to load traceability data:', msg);
      }
    }

    void loadData();

    return () => {
      isCancelled = true;
    };
  }, [activeDatasetId, refreshKey]);

  async function handleExecutePreflight(
    content: string,
    filename: string,
    sourceType: 'CUSTOMER' | 'OFFICIAL_REFERENCE_TEST' = 'CUSTOMER'
  ) {
    if (!activeDatasetId) {
      alert('Please select or create an active dataset first.');
      return;
    }

    try {
      setProcessing(true);
      setOperationError(null);

      const file = new File(
        [content],
        filename,
        { type: filename.toLowerCase().endsWith('.xml') ? 'application/xml' : 'text/csv' }
      );
      const uploadResponse = await fetch('/api/traceability/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ datasetId: activeDatasetId, filename, sourceType }),
      });
      const upload = await uploadResponse.json();
      if (!uploadResponse.ok) throw new Error(upload.error ?? 'Private upload initialization failed.');

      const uploadBody = new FormData();
      uploadBody.append('cacheControl', '3600');
      uploadBody.append('', file);
      const storedResponse = await fetch(upload.signedUrl, {
        method: 'PUT',
        headers: { 'x-upsert': 'false' },
        body: uploadBody,
      });
      if (!storedResponse.ok) {
        throw new Error(`Private Storage upload failed with status ${storedResponse.status}.`);
      }

      const res = await fetch('/api/traceability/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          datasetId: activeDatasetId,
          filename,
          storagePath: upload.storagePath,
          fileSizeBytes: file.size,
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText);
      }

      const data = await res.json();
      setLatestPreflight(data.preflight);
      setRefreshKey((k) => k + 1);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setOperationError(`EPTTS preflight could not be persisted: ${msg}`);
    } finally {
      setProcessing(false);
    }
  }

  async function handleReferenceFile(path: string, filename: string) {
    try {
      const response = await fetch(path);
      if (!response.ok) throw new Error(`Could not load ${filename}.`);
      const content = await response.text();
      setPasteText(content);
      await handleExecutePreflight(content, filename, 'OFFICIAL_REFERENCE_TEST');
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Reference file could not be loaded.');
    }
  }

  async function handleConfirmLink(productId: string, gtin: string) {
    if (!activeDatasetId) return;
    try {
      const res = await fetch('/api/traceability/links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          datasetId: activeDatasetId,
          productId,
          gtin,
          status: 'CONFIRMED',
          reason: 'Manually verified and confirmed by user',
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      setRefreshKey((k) => k + 1);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(`Link update failed: ${msg}`);
    }
  }

  const getReconcileTone = (status: string): ChipTone => {
    if (status === 'MATCH') return 'success';
    if (status === 'MISMATCH') return 'danger';
    if (status === 'INSUFFICIENT_LINKAGE') return 'caution';
    return 'neutral';
  };

  const getExpiryTone = (bucket: string): ChipTone => {
    if (bucket === 'EXPIRED') return 'danger';
    if (bucket === 'EXPIRING_90') return 'caution';
    if (bucket === 'EXPIRING_180') return 'brand';
    if (bucket === 'LATER') return 'success';
    return 'neutral';
  };

  return (
    <AppShell>
      <TopContextBar
        title="EPTTS Traceability & Preflight"
        subtitle="Egyptian Pharmaceutical Track & Trace System (EDREX:NP.CIP.004/011 Specification Compliance)"
      />
      <PageBody wide>
        <PageHeader
          title="EPTTS Preflight & Traceability Reconciliation"
          subtitle="Upload EPTTS CSV or XML to run preflight validation and derive traceability intelligence from privately stored files."
          actions={
            <div className="flex max-w-full flex-wrap items-center gap-2">
              <StatusChip label="EDREX:NP.CIP.004/2026 CSV v2.0" tone="neutral" />
              <StatusChip label="EDREX:NP.CIP.011/2026 XML v1.0" tone="neutral" />
            </div>
          }
        />

        {persistenceStatus === 'UNAVAILABLE' && (
          <div className="mb-6 rounded-lg border border-danger/30 bg-danger/5 p-4 text-sm text-danger">
            Traceability persistence is unavailable: {persistenceMessage}
          </div>
        )}

        {operationError && (
          <div className="mb-6 rounded-lg border border-danger/30 bg-danger/5 p-4 text-sm text-danger">
            {operationError}
          </div>
        )}

        {/* Mandatory Preflight Notice Banner */}
        <div className="mb-6 rounded-lg border border-primary/30 bg-primary/5 p-4 flex items-start gap-3 text-xs text-body">
          <ShieldAlert className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <div>
            <span className="font-bold text-heading">Preflight Compliance Disclaimer: </span>
            This engine executes deterministic checks derived from the cited EPTTS rule sets. A PASS means the implemented checks passed; it is not submission approval or an official EDA certification.
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="mb-6 flex gap-2 overflow-x-auto whitespace-nowrap border-b border-border">
          <button
            onClick={() => setActiveTab('PREFLIGHT')}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === 'PREFLIGHT'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted hover:text-heading'
            }`}
          >
            <FileCheck className="w-4 h-4" />
            EPTTS Preflight Engine
          </button>

          <button
            onClick={() => setActiveTab('EVENTS')}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === 'EVENTS'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted hover:text-heading'
            }`}
          >
            <Layers className="w-4 h-4" />
            Canonical Events ({totalEvents})
          </button>

          <button
            onClick={() => setActiveTab('EXPIRY')}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === 'EXPIRY'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted hover:text-heading'
            }`}
          >
            <Clock className="w-4 h-4" />
            Shelf-Life Expiry
          </button>

          <button
            onClick={() => setActiveTab('CROSSWALK')}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === 'CROSSWALK'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted hover:text-heading'
            }`}
          >
            <LinkIcon className="w-4 h-4" />
            GTIN Crosswalk ({links.length})
          </button>

          <button
            onClick={() => setActiveTab('RECONCILIATION')}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === 'RECONCILIATION'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted hover:text-heading'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            Order Reconciliation ({reconciliations.length})
          </button>
        </div>

        {/* TAB 1: PREFLIGHT ENGINE */}
        {activeTab === 'PREFLIGHT' && (
          <div className="space-y-6">
            {/* Quick Fixture Selector */}
            <Panel className="p-4 bg-surface-sunken/40">
              <div className="text-xs font-semibold uppercase text-muted tracking-wider mb-2">
                OFFICIAL REFERENCE / TEST FILES · NOT CUSTOMER DATA
              </div>
              <p className="mb-3 text-xs text-body">
                Each try action uses the same signed private upload, backend validator, and persistence path as a customer file.
              </p>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => {
                    setPasteText(REFERENCE_FIXTURES.VALID_CSV.content);
                    handleExecutePreflight(REFERENCE_FIXTURES.VALID_CSV.content, 'valid.csv', 'OFFICIAL_REFERENCE_TEST');
                  }}
                  className="rounded-lg bg-surface-raised border border-border px-3 py-1.5 text-xs font-medium text-heading hover:bg-surface-sunken flex items-center gap-1.5"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-success" />
                  {REFERENCE_FIXTURES.VALID_CSV.name}
                </button>

                <button
                  onClick={() => {
                    setPasteText(REFERENCE_FIXTURES.ERROR_CSV.content);
                    handleExecutePreflight(REFERENCE_FIXTURES.ERROR_CSV.content, 'invalid.csv', 'OFFICIAL_REFERENCE_TEST');
                  }}
                  className="rounded-lg bg-surface-raised border border-border px-3 py-1.5 text-xs font-medium text-heading hover:bg-surface-sunken flex items-center gap-1.5"
                >
                  <AlertCircle className="w-3.5 h-3.5 text-danger" />
                  {REFERENCE_FIXTURES.ERROR_CSV.name}
                </button>

                <button
                  onClick={() => {
                    setPasteText(REFERENCE_FIXTURES.VALID_XML_BARE.content);
                    handleExecutePreflight(REFERENCE_FIXTURES.VALID_XML_BARE.content, 'valid.xml', 'OFFICIAL_REFERENCE_TEST');
                  }}
                  className="rounded-lg bg-surface-raised border border-border px-3 py-1.5 text-xs font-medium text-heading hover:bg-surface-sunken flex items-center gap-1.5"
                >
                  <FileCode className="w-3.5 h-3.5 text-primary" />
                  {REFERENCE_FIXTURES.VALID_XML_BARE.name}
                </button>

                <button
                  onClick={() => void handleReferenceFile('/reference/eptts/invalid.xml', 'invalid.xml')}
                  className="rounded-lg bg-surface-raised border border-border px-3 py-1.5 text-xs font-medium text-heading hover:bg-surface-sunken flex items-center gap-1.5"
                >
                  <AlertCircle className="w-3.5 h-3.5 text-danger" />
                  Invalid EPCIS XML → FAIL
                </button>
              </div>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs">
                {[
                  ['Valid CSV', '/reference/eptts/valid.csv'],
                  ['Invalid CSV', '/reference/eptts/invalid.csv'],
                  ['Valid XML', '/reference/eptts/valid.xml'],
                  ['Invalid XML', '/reference/eptts/invalid.xml'],
                ].map(([label, href]) => (
                  <a key={href} href={href} download className="font-semibold text-primary hover:underline">
                    Download {label}
                  </a>
                ))}
              </div>
            </Panel>

            <Panel
              title={`Persisted traceability imports (${imports.length})`}
              description="Backend records for the active dataset, with honest source classification."
            >
              {imports.length === 0 ? (
                <p className="text-sm text-body">No EPTTS imports have been persisted for this dataset yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[680px] text-left text-xs">
                    <thead className="border-b border-border bg-surface-sunken text-muted">
                      <tr>
                        <th className="p-3">File</th>
                        <th className="p-3">Source</th>
                        <th className="p-3">Preflight</th>
                        <th className="p-3">Events / Findings</th>
                        <th className="p-3">Imported</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {imports.map((item) => (
                        <tr key={item.id}>
                          <td className="p-3 font-mono text-heading">{item.filename}</td>
                          <td className="p-3">
                            <StatusChip
                              label={item.source_type === 'OFFICIAL_REFERENCE_TEST' ? 'OFFICIAL REFERENCE / TEST' : item.source_type}
                              tone={item.source_type === 'CUSTOMER' ? 'brand' : 'neutral'}
                            />
                          </td>
                          <td className="p-3"><StatusChip label={item.preflight_status} tone={item.preflight_status === 'PASS' ? 'success' : 'danger'} /></td>
                          <td className="p-3 text-body">{item.event_count} / {item.finding_count}</td>
                          <td className="p-3 text-body">{new Date(item.created_at).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>

            {/* Upload / Paste Area */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* File Dropzone */}
              <Panel className="p-6 border-dashed border-2 border-border flex flex-col items-center justify-center text-center">
                <FileUp className="w-10 h-10 text-muted mb-2" />
                <div className="text-sm font-semibold text-heading">Upload EPTTS Traceability File</div>
                <div className="text-xs text-muted mt-1">Supports CSV (EDREX v2.0) and EPCIS 1.2 XML files up to 20MB</div>
                <input
                  type="file"
                  accept=".csv,.xml,.txt"
                  id="traceability-file-input"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const text = await file.text();
                      setPasteText(text);
                      handleExecutePreflight(text, file.name);
                    }
                  }}
                />
                <label
                  htmlFor="traceability-file-input"
                  className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-medium text-white hover:bg-primary-hover cursor-pointer"
                >
                  <Upload className="w-4 h-4" />
                  Select File
                </label>
              </Panel>

              {/* Direct Paste */}
              <Panel className="p-4 flex flex-col">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-muted uppercase">Or Paste File Contents:</span>
                  <button
                    onClick={() => handleExecutePreflight(pasteText, 'pasted_traceability.txt')}
                    disabled={processing || !pasteText.trim()}
                    className="rounded-lg bg-primary px-3 py-1 text-xs font-medium text-white hover:bg-primary-hover disabled:opacity-50"
                  >
                    {processing ? 'Validating...' : 'Run Preflight'}
                  </button>
                </div>
                <textarea
                  rows={6}
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  placeholder="Paste CSV rows or XML EPCISDocument payload here..."
                  className="w-full flex-1 rounded-lg border border-border bg-surface-sunken p-2 font-mono text-xs text-heading focus:outline-none"
                />
              </Panel>
            </div>

            {/* Preflight Result Display */}
            {latestPreflight && (
              <Panel className={`p-6 border-l-4 ${latestPreflight.status === 'PASS' ? 'border-l-success' : 'border-l-danger'}`}>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-3">
                      <StatusChip
                        label={latestPreflight.status === 'PASS' ? 'EPTTS PREFLIGHT PASS' : 'EPTTS PREFLIGHT FAIL'}
                        tone={latestPreflight.status === 'PASS' ? 'success' : 'danger'}
                      />
                      <span className="text-xs font-mono text-muted">{latestPreflight.rulesVersion}</span>
                    </div>
                    <p className="mt-2 text-sm text-heading font-medium">{latestPreflight.wording}</p>
                  </div>
                  <div className="text-right text-xs font-mono text-muted space-y-1">
                    <div>Format: <span className="text-heading font-bold">{latestPreflight.format}</span></div>
                    <div>Serials Count: <span className="text-heading font-bold">{latestPreflight.serialCount}</span></div>
                    <div>Batches Count: <span className="text-heading font-bold">{latestPreflight.batchCount}</span></div>
                  </div>
                </div>

                {/* Findings List */}
                <div className="mt-6">
                  <div className="text-xs font-semibold uppercase text-muted mb-2">
                    Preflight Rule Checks ({latestPreflight.findings.length} findings, {latestPreflight.errorCount} blocking errors)
                  </div>

                  {latestPreflight.findings.length === 0 ? (
                    <div className="rounded-lg bg-success/10 p-3 text-xs text-success flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4" />
                      All implemented EPTTS specification rules passed cleanly. 0 violations found.
                    </div>
                  ) : (
                    <div className="rounded-lg border border-border overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-surface-sunken text-muted">
                          <tr>
                            <th className="p-2.5">Severity / Code</th>
                            <th className="p-2.5">Row / Event #</th>
                            <th className="p-2.5">Field</th>
                            <th className="p-2.5">Message & Evidence</th>
                            <th className="p-2.5">Official Rule Reference</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border font-mono">
                          {latestPreflight.findings.map((f, idx) => (
                            <tr key={idx} className={f.severity === 'ERROR' ? 'bg-danger/5' : ''}>
                              <td className="p-2.5">
                                <StatusChip
                                  label={f.severity}
                                  tone={f.severity === 'ERROR' ? 'danger' : 'caution'}
                                />
                                <div className="text-[10px] text-muted mt-0.5">{f.code}</div>
                              </td>
                              <td className="p-2.5">{f.row_or_event_index ?? 'File'}</td>
                              <td className="p-2.5 text-muted">{f.field || '—'}</td>
                              <td className="p-2.5 font-sans">
                                <div className="font-medium text-heading">{f.message}</div>
                                {f.evidence && <div className="text-xs text-muted font-mono mt-0.5">Evidence: {f.evidence}</div>}
                              </td>
                              <td className="p-2.5 text-primary text-[11px] font-sans">{f.official_rule_reference}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </Panel>
            )}
          </div>
        )}

        {/* TAB 2: CANONICAL TRACEABILITY EVENTS */}
        {activeTab === 'EVENTS' && (
          <Panel className="overflow-hidden">
            {events.length === 0 ? (
              <EmptyState
                icon={Layers}
                title="No canonical traceability events"
                description="Upload and validate an EPTTS CSV or XML file in the Preflight tab to populate canonical traceability records."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-surface-sunken text-muted uppercase font-semibold">
                    <tr>
                      <th className="p-3">Event Type</th>
                      <th className="p-3">Event Time</th>
                      <th className="p-3">EPC / Serial</th>
                      <th className="p-3">GTIN / Batch</th>
                      <th className="p-3">Parent SSCC</th>
                      <th className="p-3">Read / Biz GLN</th>
                      <th className="p-3">Business Reference</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border font-mono">
                    {events.map((e) => (
                      <tr key={e.id} className="hover:bg-surface-raised/50">
                        <td className="p-3">
                          <StatusChip
                            label={e.event_type}
                            tone={e.event_type === 'COMMISSIONING' ? 'brand' : e.event_type === 'PACKING' ? 'caution' : 'success'}
                          />
                        </td>
                        <td className="p-3 text-muted">{e.event_time}</td>
                        <td className="p-3">
                          <div className="text-heading font-semibold">{e.serial || e.epc}</div>
                          <div className="text-[10px] text-muted">{e.epc}</div>
                        </td>
                        <td className="p-3">
                          <div>GTIN: {e.gtin || '—'}</div>
                          {e.batch && <div className="text-muted">Batch: {e.batch}</div>}
                        </td>
                        <td className="p-3 text-muted">{e.parent_epc || '—'}</td>
                        <td className="p-3 text-muted">{e.read_point_gln}</td>
                        <td className="p-3 text-heading">{e.biz_transaction_ref || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        )}

        {/* TAB 3: SHELF-LIFE EXPIRY INTELLIGENCE */}
        {activeTab === 'EXPIRY' && (
          <div className="space-y-6">
            {expirySummary && (
              <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                <Panel className="p-3 text-center">
                  <div className="text-[11px] font-semibold text-muted uppercase">Total Serialized</div>
                  <div className="text-xl font-bold text-heading mt-1">{expirySummary.totalSerializedUnits}</div>
                </Panel>
                <Panel className="p-3 text-center border-l-4 border-l-danger">
                  <div className="text-[11px] font-semibold text-danger uppercase">Expired</div>
                  <div className="text-xl font-bold text-danger mt-1">{expirySummary.expiredCount}</div>
                </Panel>
                <Panel className="p-3 text-center border-l-4 border-l-caution">
                  <div className="text-[11px] font-semibold text-caution uppercase">Expiring ≤ 90d</div>
                  <div className="text-xl font-bold text-caution mt-1">{expirySummary.expiring90DaysCount}</div>
                </Panel>
                <Panel className="p-3 text-center border-l-4 border-l-brand">
                  <div className="text-[11px] font-semibold text-muted uppercase">Expiring ≤ 180d</div>
                  <div className="text-xl font-bold text-heading mt-1">{expirySummary.expiring180DaysCount}</div>
                </Panel>
                <Panel className="p-3 text-center border-l-4 border-l-success">
                  <div className="text-[11px] font-semibold text-success uppercase">Later (&gt; 180d)</div>
                  <div className="text-xl font-bold text-success mt-1">{expirySummary.laterCount}</div>
                </Panel>
                <Panel className="p-3 text-center">
                  <div className="text-[11px] font-semibold text-muted uppercase">Unknown Expiry</div>
                  <div className="text-xl font-bold text-heading mt-1">{expirySummary.unknownExpiryCount}</div>
                </Panel>
              </div>
            )}

            <Panel className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-surface-sunken text-muted uppercase font-semibold">
                    <tr>
                      <th className="p-3">Product / EPC</th>
                      <th className="p-3">GTIN</th>
                      <th className="p-3">Batch</th>
                      <th className="p-3">Expiry Date</th>
                      <th className="p-3">Shelf-Life Status</th>
                      <th className="p-3 text-right">Days Remaining</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border font-mono">
                    {expiryItems.map((item, idx) => (
                      <tr key={idx} className="hover:bg-surface-raised/50">
                        <td className="p-3">
                          <div className="font-sans font-semibold text-heading">{item.productName || 'Unlinked Product'}</div>
                          <div className="text-[10px] text-muted">{item.epc}</div>
                        </td>
                        <td className="p-3">{item.gtin || '—'}</td>
                        <td className="p-3">{item.batch || '—'}</td>
                        <td className="p-3 text-heading">{item.expiryDate || 'Unspecified'}</td>
                        <td className="p-3">
                          <StatusChip
                            label={item.bucket.replace('_', ' ')}
                            tone={getExpiryTone(item.bucket)}
                          />
                        </td>
                        <td className="p-3 text-right font-bold">
                          {item.daysToExpiry !== null ? (
                            <span className={item.daysToExpiry < 0 ? 'text-danger' : item.daysToExpiry <= 90 ? 'text-caution' : 'text-heading'}>
                              {item.daysToExpiry} days
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          </div>
        )}

        {/* TAB 4: GTIN CROSSWALK */}
        {activeTab === 'CROSSWALK' && (
          <Panel className="overflow-hidden">
            {links.length === 0 ? (
              <EmptyState
                icon={LinkIcon}
                title="No GTIN Crosswalk links found"
                description="Import traceability data with valid GTIN identifiers to build linkage with procurement catalog products."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-surface-sunken text-muted uppercase font-semibold">
                    <tr>
                      <th className="p-3">GTIN (14-Digit)</th>
                      <th className="p-3">Linked Catalog Product</th>
                      <th className="p-3">Linkage Status</th>
                      <th className="p-3">Match Reason</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {links.map((link) => (
                      <tr key={link.id} className="hover:bg-surface-raised/50">
                        <td className="p-3 font-mono font-bold text-heading">{link.gtin}</td>
                        <td className="p-3 font-medium text-heading">{link.product?.name || link.product_id}</td>
                        <td className="p-3">
                          <StatusChip
                            label={link.status}
                            tone={link.status === 'CONFIRMED' ? 'success' : 'caution'}
                          />
                        </td>
                        <td className="p-3 text-muted text-xs">{link.confidence_reason}</td>
                        <td className="p-3 text-right">
                          {link.status === 'SUGGESTED' && (
                            <button
                              onClick={() => handleConfirmLink(link.product_id, link.gtin)}
                              className="rounded-lg bg-primary px-2.5 py-1 text-xs font-medium text-white hover:bg-primary-hover"
                            >
                              Confirm Link
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        )}

        {/* TAB 5: ORDER RECONCILIATION */}
        {activeTab === 'RECONCILIATION' && (
          <div className="space-y-6">
            <Panel className="overflow-hidden">
              {reconciliations.length === 0 ? (
                <EmptyState
                  icon={CheckCircle2}
                  title="No reconciliation records"
                  description="Traceability records will be reconciled against operational orders upon preflight completion."
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-surface-sunken text-muted uppercase font-semibold">
                      <tr>
                        <th className="p-3">Order Ref / Product</th>
                        <th className="p-3">Reconciliation Status</th>
                        <th className="p-3">Operational Filled Qty</th>
                        <th className="p-3">Serialized Traceability Qty</th>
                        <th className="p-3">Difference</th>
                        <th className="p-3">Evidence Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {reconciliations.map((rec) => (
                        <tr key={rec.id} className="hover:bg-surface-raised/50">
                          <td className="p-3">
                            <div className="font-mono font-bold text-heading">
                              {rec.order?.external_order_id || rec.business_ref || rec.order_id}
                            </div>
                            <div className="text-muted text-xs">{rec.product?.name || rec.product_id}</div>
                          </td>
                          <td className="p-3">
                            <StatusChip
                              label={rec.reconciliation_status.replace(/_/g, ' ')}
                              tone={getReconcileTone(rec.reconciliation_status)}
                            />
                          </td>
                          <td className="p-3 font-mono text-heading font-semibold">{rec.operational_qty} units</td>
                          <td className="p-3 font-mono text-heading font-semibold">{rec.traceability_qty} units</td>
                          <td className="p-3 font-mono font-bold">
                            <span className={rec.difference_qty === 0 ? 'text-success' : 'text-danger'}>
                              {rec.difference_qty > 0 ? `+${rec.difference_qty}` : rec.difference_qty}
                            </span>
                          </td>
                          <td className="p-3 text-xs text-muted">
                            {((rec.evidence_json as Record<string, unknown>)?.reason as string) ||
                              ((rec.evidence_json as Record<string, unknown>)?.matchType as string) ||
                              'Evidence recorded'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>
          </div>
        )}
      </PageBody>
    </AppShell>
  );
}
