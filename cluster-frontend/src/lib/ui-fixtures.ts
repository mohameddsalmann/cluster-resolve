/**
 * UI-ONLY preview fixtures.
 *
 * These synthetic records exist solely so the frontend can be reviewed before
 * the real backend is wired in. Nothing here talks to a database, an API, or
 * any production system, and no value here is presented as a real measurement.
 */

export type Severity = "HIGH" | "MEDIUM" | "LOW";

export type AttentionItem = {
  id: string;
  severity: Severity;
  type: "order" | "supplier" | "regulatory" | "decision" | "import";
  title: string;
  reason: string;
  entity: string;
  time: string;
  impact: string;
  href: string;
};

export const attentionItems: AttentionItem[] = [
  {
    id: "att-1",
    severity: "HIGH",
    type: "order",
    title: "Order ORD-DEMO-1002",
    reason: "Partial fulfillment from SUP-DEMO-02",
    entity: "Nile Pharmacy · Cairo",
    time: "2h ago",
    impact: "Requested 120 · Filled 72",
    href: "/orders/ORD-DEMO-1002",
  },
  {
    id: "att-2",
    severity: "HIGH",
    type: "regulatory",
    title: "EDA notice 2026/114 exact match",
    reason: "Batch B-2291 matched an active recall notice",
    entity: "Paracetamol 500mg · Delta Pharma",
    time: "5h ago",
    impact: "3 orders hold candidate units",
    href: "/regulatory",
  },
  {
    id: "att-3",
    severity: "MEDIUM",
    type: "supplier",
    title: "SUP-DEMO-02 moved to WATCH",
    reason: "Fill rate degraded against its own baseline",
    entity: "Horus Distribution",
    time: "Yesterday",
    impact: "Fill rate 96% → 78% across 41 evaluated orders",
    href: "/suppliers/SUP-DEMO-02",
  },
  {
    id: "att-4",
    severity: "MEDIUM",
    type: "decision",
    title: "Decision DEC-DEMO-4410 has a better alternative",
    reason: "Selected supplier priced above a feasible offer",
    entity: "ORD-DEMO-1008",
    time: "Yesterday",
    impact: "Price difference 1,840 EGP · Estimate",
    href: "/decisions/DEC-DEMO-4410",
  },
  {
    id: "att-5",
    severity: "LOW",
    type: "import",
    title: "Outcome coverage incomplete",
    reason: "Some evaluated orders have no recorded outcome",
    entity: "Dataset demo-eg-01",
    time: "2d ago",
    impact: "Reliability metrics stay partial until imported",
    href: "/imports",
  },
];

export type OrderRow = {
  id: string;
  pharmacy: string;
  placed: string;
  supplier: string;
  requested: number;
  filled: number;
  delivery: "On time" | "Late" | "Not delivered";
  exception: "None" | "Partial" | "Late" | "Cancelled";
  decisionQuality: "Aligned" | "Regret" | "Not evaluable";
  regulatory: "Clear" | "Exposure" | "Possible";
};

export const orders: OrderRow[] = [
  {
    id: "ORD-DEMO-1001",
    pharmacy: "Nile Pharmacy",
    placed: "12 Aug 09:14",
    supplier: "SUP-DEMO-01",
    requested: 80,
    filled: 80,
    delivery: "On time",
    exception: "None",
    decisionQuality: "Aligned",
    regulatory: "Clear",
  },
  {
    id: "ORD-DEMO-1002",
    pharmacy: "Nile Pharmacy",
    placed: "12 Aug 11:02",
    supplier: "SUP-DEMO-02",
    requested: 120,
    filled: 72,
    delivery: "Late",
    exception: "Partial",
    decisionQuality: "Regret",
    regulatory: "Possible",
  },
  {
    id: "ORD-DEMO-1003",
    pharmacy: "Zamalek Care",
    placed: "12 Aug 13:40",
    supplier: "SUP-DEMO-03",
    requested: 45,
    filled: 45,
    delivery: "On time",
    exception: "None",
    decisionQuality: "Aligned",
    regulatory: "Clear",
  },
  {
    id: "ORD-DEMO-1004",
    pharmacy: "Maadi Health",
    placed: "13 Aug 08:20",
    supplier: "SUP-DEMO-02",
    requested: 60,
    filled: 0,
    delivery: "Not delivered",
    exception: "Cancelled",
    decisionQuality: "Regret",
    regulatory: "Clear",
  },
  {
    id: "ORD-DEMO-1005",
    pharmacy: "Alexandria Pharma",
    placed: "13 Aug 10:05",
    supplier: "SUP-DEMO-01",
    requested: 200,
    filled: 188,
    delivery: "Late",
    exception: "Late",
    decisionQuality: "Aligned",
    regulatory: "Clear",
  },
  {
    id: "ORD-DEMO-1006",
    pharmacy: "Tanta Pharmacy",
    placed: "13 Aug 15:33",
    supplier: "SUP-DEMO-04",
    requested: 35,
    filled: 35,
    delivery: "On time",
    exception: "None",
    decisionQuality: "Not evaluable",
    regulatory: "Exposure",
  },
  {
    id: "ORD-DEMO-1008",
    pharmacy: "Giza Medic",
    placed: "14 Aug 09:47",
    supplier: "SUP-DEMO-03",
    requested: 150,
    filled: 150,
    delivery: "On time",
    exception: "None",
    decisionQuality: "Regret",
    regulatory: "Clear",
  },
];

export const orderFilters = [
  "All",
  "Healthy",
  "Exceptions",
  "Late",
  "Partial",
  "Cancelled",
  "High Regret",
  "Regulatory",
] as const;

export function filterOrders(rows: OrderRow[], filter: string): OrderRow[] {
  switch (filter) {
    case "Healthy":
      return rows.filter((r) => r.exception === "None" && r.regulatory === "Clear");
    case "Exceptions":
      return rows.filter((r) => r.exception !== "None");
    case "Late":
      return rows.filter((r) => r.exception === "Late" || r.delivery === "Late");
    case "Partial":
      return rows.filter((r) => r.exception === "Partial");
    case "Cancelled":
      return rows.filter((r) => r.exception === "Cancelled");
    case "High Regret":
      return rows.filter((r) => r.decisionQuality === "Regret");
    case "Regulatory":
      return rows.filter((r) => r.regulatory !== "Clear");
    default:
      return rows;
  }
}

export type SupplierRow = {
  id: string;
  name: string;
  status: "HEALTHY" | "WATCH" | "HIGH" | "INSUFFICIENT DATA";
  evaluated: number;
  fillRate: string;
  otif: string;
  cancellation: string;
  partialFill: string;
  p95Lead: string;
  recentChange: string;
};

export const suppliers: SupplierRow[] = [
  {
    id: "SUP-DEMO-01",
    name: "Cairo Medical Supply",
    status: "HEALTHY",
    evaluated: 96,
    fillRate: "97%",
    otif: "94%",
    cancellation: "1%",
    partialFill: "3%",
    p95Lead: "38h",
    recentChange: "Stable",
  },
  {
    id: "SUP-DEMO-02",
    name: "Horus Distribution",
    status: "WATCH",
    evaluated: 41,
    fillRate: "78%",
    otif: "76%",
    cancellation: "9%",
    partialFill: "17%",
    p95Lead: "72h",
    recentChange: "Fill rate down 18 pts",
  },
  {
    id: "SUP-DEMO-03",
    name: "Delta Wholesale",
    status: "HEALTHY",
    evaluated: 63,
    fillRate: "95%",
    otif: "90%",
    cancellation: "2%",
    partialFill: "5%",
    p95Lead: "44h",
    recentChange: "Stable",
  },
  {
    id: "SUP-DEMO-04",
    name: "Upper Egypt Pharma",
    status: "INSUFFICIENT DATA",
    evaluated: 4,
    fillRate: "—",
    otif: "—",
    cancellation: "—",
    partialFill: "—",
    p95Lead: "—",
    recentChange: "Not measurable yet",
  },
  {
    id: "SUP-DEMO-05",
    name: "Sinai Distributors",
    status: "HIGH",
    evaluated: 28,
    fillRate: "64%",
    otif: "58%",
    cancellation: "14%",
    partialFill: "22%",
    p95Lead: "96h",
    recentChange: "Cancellations up 12 pts",
  },
];

export const offerComparison = [
  {
    supplier: "SUP-DEMO-02 · Horus Distribution",
    price: "18.40 EGP",
    discount: "4%",
    available: 90,
    promised: "24h",
    feasible: true,
    selected: true,
  },
  {
    supplier: "SUP-DEMO-01 · Cairo Medical Supply",
    price: "17.05 EGP",
    discount: "6%",
    available: 120,
    promised: "36h",
    feasible: true,
    selected: false,
  },
  {
    supplier: "SUP-DEMO-03 · Delta Wholesale",
    price: "16.80 EGP",
    discount: "2%",
    available: 60,
    promised: "48h",
    feasible: false,
    selected: false,
  },
];

export const edaAlerts = [
  {
    notice: "2026/114",
    type: "Recall",
    published: "11 Aug 2026",
    product: "Paracetamol 500mg tablets",
    manufacturer: "Delta Pharma",
    batch: "B-2291",
    source: "Egyptian Drug Authority",
  },
  {
    notice: "2026/109",
    type: "Suspension",
    published: "04 Aug 2026",
    product: "Amoxicillin 250mg suspension",
    manufacturer: "Nile Labs",
    batch: "A-8842",
    source: "Egyptian Drug Authority",
  },
  {
    notice: "2026/101",
    type: "Quality defect",
    published: "27 Jul 2026",
    product: "Metformin 850mg tablets",
    manufacturer: "Horus Pharma",
    batch: "M-1150",
    source: "Egyptian Drug Authority",
  },
];

export const exactMatches = [
  { order: "ORD-DEMO-1002", product: "Paracetamol 500mg", batch: "B-2291", units: 72, notice: "2026/114" },
  { order: "ORD-DEMO-1006", product: "Paracetamol 500mg", batch: "B-2291", units: 35, notice: "2026/114" },
];

export const possibleMatches = [
  {
    order: "ORD-DEMO-1005",
    product: "Paracetamol 500mg",
    batch: "not recorded",
    units: 188,
    notice: "2026/114",
    basis: "Product and manufacturer match, batch missing",
  },
];

export const expiryRows = [
  {
    supplier: "SUP-DEMO-02",
    product: "Amoxicillin 250mg",
    batch: "A-8842",
    expiry: "22 Aug 2026",
    quantity: 140,
    value: "2,380 EGP",
    order: "ORD-DEMO-1004",
  },
  {
    supplier: "SUP-DEMO-03",
    product: "Metformin 850mg",
    batch: "M-1150",
    expiry: "18 Sep 2026",
    quantity: 60,
    value: "1,110 EGP",
    order: "ORD-DEMO-1003",
  },
  {
    supplier: "SUP-DEMO-01",
    product: "Omeprazole 20mg",
    batch: "O-4410",
    expiry: "02 Nov 2026",
    quantity: 220,
    value: "4,620 EGP",
    order: "ORD-DEMO-1001",
  },
];

export const preflightFindings = [
  {
    kind: "BLOCKING" as const,
    row: 14,
    rule: "GTIN-01",
    field: "gtin",
    actual: "0629104150",
    expected: "14 digits",
    message: "GTIN length does not match the verified rule set.",
    verification: "Rule verified against published specification",
  },
  {
    kind: "BLOCKING" as const,
    row: 27,
    rule: "EXP-03",
    field: "expiry_date",
    actual: "2026-13-02",
    expected: "YYYY-MM-DD calendar date",
    message: "Expiry date is not a valid calendar date.",
    verification: "Rule verified against published specification",
  },
  {
    kind: "ADVISORY" as const,
    row: 31,
    rule: "SER-07",
    field: "serial",
    actual: "sn 0091",
    expected: "No whitespace",
    message: "Serial contains whitespace which some readers reject.",
    verification: "Rule verified against published specification",
  },
  {
    kind: "NEEDS VERIFICATION" as const,
    row: 44,
    rule: "PACK-02",
    field: "pack_level",
    actual: "BUNDLE",
    expected: "Unconfirmed vocabulary",
    message: "Value is outside the rules this prototype can verify.",
    verification: "Not verified — requires human review",
  },
];

export const importRowErrors = [
  { row: 12, field: "placed_at", code: "INVALID_TIMESTAMP", message: "Timestamp could not be parsed.", raw: "14/08/2026 9:47 am" },
  { row: 19, field: "supplier_id", code: "UNKNOWN_REFERENCE", message: "Supplier is not present in this dataset.", raw: "SUP-DEMO-99" },
  { row: 33, field: "requested_qty", code: "NOT_A_NUMBER", message: "Quantity must be a whole number.", raw: "twelve" },
];

export const reliabilityTrend = [
  { label: "Wk 1", fill: 96, otif: 93 },
  { label: "Wk 2", fill: 94, otif: 91 },
  { label: "Wk 3", fill: 88, otif: 84 },
  { label: "Wk 4", fill: 81, otif: 79 },
  { label: "Wk 5", fill: 78, otif: 76 },
];
