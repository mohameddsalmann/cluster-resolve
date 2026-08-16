<div align="center">

  <img src="apps/web/public/logo.png" alt="Cluster Resolve Logo" width="320" />

  <br/><br/>

  # Cluster Resolve
  ### Autonomous Pharmaceutical Supply Chain Control Tower & AI Decision Observability
  
  [![Next.js 16](https://img.shields.io/badge/Next.js-16.3-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
  [![TypeScript](https://img.shields.io/badge/TypeScript-Strict-3178C6?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
  [![Supabase](https://img.shields.io/badge/Supabase-Postgres%20RLS-3ECF8E?style=for-the-badge&logo=supabase)](https://supabase.com/)
  [![Vercel](https://img.shields.io/badge/Vercel-Deployed-000000?style=for-the-badge&logo=vercel)](https://vercel.com/)

  <p align="center">
    <strong>Eliminating AI procurement regret, quantifying supplier drift, and shielding pharmaceutical supply chains with real-time Egyptian Drug Authority (EDA) regulatory enforcement.</strong>
  </p>

</div>

---

## ⚡ Executive Summary

In high-velocity pharmaceutical procurement, autonomous AI buying agents make thousands of real-time purchasing decisions across fragmented distributor catalogs. Without dedicated observability, **unreliable supplier fill rates, silent price drift, and unregistered drug lots** result in catastrophic stockouts, margin erosion, and regulatory penalties.

**Cluster Resolve** is the enterprise-grade reliability and evidence layer built for executive decision-makers. It operates above the transaction stream to audit, replay, and verify every AI decision against counterfactual market offers, supplier performance metrics, and regulatory mandates.

---

## 💎 What Makes This Mission-Critical for Founders

```
 ┌──────────────────────┐     ┌──────────────────────┐     ┌──────────────────────┐
 │   10,000+ DECISIONS  │ ──► │  AI DECISION REPLAY  │ ──► │    PROVEN SAVINGS    │
 │  Real-time telemetry │     │ Regret & Drift Math  │     │   & Zero Fines Risk  │
 └──────────────────────┘     └──────────────────────┘     └──────────────────────┘
```

### 1. 🎯 AI Procurement Regret & Decision Replay
* **Audit Every Autonomous Order**: Instantly replay any historical procurement decision against the complete counterfactual state of distributor catalogs at that exact second.
* **Quantify Regret in Minor Units**: Measure exact dollar-for-dollar overspend when an autonomous agent selects suboptimal suppliers or fails to bundle discounts.

### 2. 🛡️ Live Regulatory Shield (Official EDA Integration)
* **Real-time Circular Synchronization**: Ingests and monitors official Egyptian Drug Authority (EDA) recall notices, batch blacklists, and regulatory suspensions.
* **Proactive Exposure Mapping**: Instantly flags matching batches and supplier inventory *before* orders are fulfilled, preventing non-compliant shipments and steep license penalties.

### 3. 📈 Supplier Drift & Reliability Radar
* **True Supplier Scorecards**: Quantify real-world fulfillment reliability (on-time delivery, fill rate accuracy, invoice discrepancies) vs advertised distributor SLAs.
* **Early Defection Warning**: Identify distributor margin creeping and degradation trends before they impact pharmacy order lead times.

### 4. 🏥 Pharmacy Solvency & Risk Health Engine
* **Deterministic Risk Tiering**: Segment retail pharmacies into real-time health tiers (`STABLE`, `AT_RISK`, `HIGH_RISK`) based on order velocity, credit utilization, and fulfillment stability.
* **Preserve Working Capital**: Prevent default and bad debt exposure through proactive credit and supply throttling.

### 5. 🔬 EPTTS Phase-1 GS1 Traceability Preflight
* **Serialization Verification**: Validates 2D Matrix Barcode structures, GTINs, Batch/Lot IDs, and Expiry Dates against Egyptian Pharmaceutical Track & Trace System standards prior to warehouse dispatch.

---

## 📊 Live Pre-Loaded Founder Dataset

Cluster Resolve ships with a high-fidelity, production-scale **Founder Demo Scenario** persisted directly in hosted Supabase:

| Metric | Pre-Loaded Founder Volume |
| :--- | :--- |
| 📦 **Customer Orders** | `10,000` real procurement orders |
| 🏷️ **Distributor Offers** | `40,468` live market quotes |
| 🤖 **AI Buying Decisions** | `10,000` replayed decisions |
| 🚚 **Fulfillment Outcomes** | `10,000` tracked deliveries |
| 💊 **Verified Products** | `200` essential SKUs |
| 🏢 **Distributor Network** | `10` active suppliers |
| 🏥 **Monitored Pharmacies** | `50` regional pharmacies |
| 📜 **Official EDA Notices** | `182` live regulatory circulars |

> [!TIP]
> **Bring Your Own Data (`/imports`)**: Founders can also drop their own operational CSV files directly into the platform to see their supply chain audited live in seconds.

---

## 🏗️ Architecture & Technology Stack

Designed for sub-millisecond audit speed, strict type safety, and zero-compromise reliability:

```
cluster-resolve/
├── apps/
│   └── web/                   # Next.js 16 (App Router, Turbopack, Tailwind CSS v4)
├── packages/
│   ├── core/                  # Pure deterministic domain math (Zero I/O, 100% unit-tested)
│   ├── schemas/               # Zod contracts & domain validation schemas
│   └── design-tokens/         # Enterprise semantic status colors & design tokens
└── supabase/                  # PostgreSQL migrations with strict Row-Level Security (RLS)
```

* **Frontend & API**: Next.js 16.3 + React 19 (Server Components & Server Actions)
* **Domain Engine**: `@cluster/core` with isolated, deterministic regret and risk calculation math
* **Database & Storage**: Hosted Supabase PostgreSQL with RLS and signed URL file ingestion
* **Deployment**: Zero-configuration Vercel production edge deployment

---

## 🚀 Quickstart for Local Demonstration

```bash
# 1. Clone the repository
git clone https://github.com/mohameddsalmann/cluster-resolve.git
cd cluster-resolve

# 2. Install dependencies
pnpm install

# 3. Configure environment
# Copy .env.example to apps/web/.env.local and add your Supabase credentials

# 4. Launch the Control Tower
pnpm dev
```

Open **`http://localhost:3000`** in your browser to explore the live control tower.

---

<div align="center">
  <sub>Cluster Resolve · Built with precision for autonomous pharmaceutical supply chain excellence.</sub>
</div>
