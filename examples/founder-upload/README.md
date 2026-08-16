# Founder upload kit

These four files are deterministic **SAMPLE / DEMO INPUTS**. They prove that Resolve derives new backend records and intelligence after upload. They are not production or customer transactions.

Create an isolated dataset on `/imports`, then upload the files in this order:

1. `orders-noncanonical.csv` — use Flexible Mapping to review the intentionally noncanonical headers. Creates orders, pharmacies, and products.
2. `offers.csv` — adds supplier offer evidence.
3. `decisions.csv` — enables Decision Replay for the sample decisions.
4. `outcomes.csv` — adds fill, delivery, exception, supplier reliability, and pharmacy service-risk evidence.

Every file follows the normal private signed Supabase Storage → importer → canonical persistence path. Refresh or switch datasets after each step to confirm the derived state persists.
