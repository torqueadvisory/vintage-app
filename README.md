# VINtage — Used-Car Inventory Profit Tracker

Know your true profit on every used unit. Scan the VIN, log what you paid and
what recon actually cost, and see real margin and days-in-inventory across the
whole lot — on your phone, from the lot.

A product of **Torque Advisory Group** · [torqueadvisorygroup.com](https://torqueadvisorygroup.com)

**[▶ Watch the 60-second demo](https://torqueadvisorygroup.com/demo)** — a
self-running tour of the app (sample data).

Designed, built, and operated by **Jeff LoVette** — a solo-founder production
app with real paying-customer infrastructure: live Stripe billing with
automatic tax, row-level security throughout, AI-assisted data entry with
human review, and an installable PWA frontend.

## Features

- **VIN scanning & decode** — point the camera at the barcode; year/make/model/
  trim/engine fill themselves (NHTSA vPIC).
- **AI receipt scanning** — snap a repair invoice; line items are extracted
  server-side (Claude vision), reviewed by the user, then added to recon costs.
  The receipt image archives to the vehicle for a permanent paper trail.
- **Live profit math** — recon totals, total investment, gross profit, margin %,
  and days in inventory, computed as you type.
- **Inventory search** — one box matches stock #, VIN, year, make, model, trim.
- **Photos & branding** — per-vehicle photos and a per-dealer logo upload.
- **CSV export** — filtered inventory (active + sold) with stock # first.
- **Installable PWA** — add to home screen, real app icon, standalone display.
- **Subscriptions** — Stripe-billed access; automatic tax where registered.

## Stack

| Layer | Tech |
|---|---|
| Frontend | React 18 + Vite 6 (no framework beyond that, on purpose) |
| Auth / DB / Storage | Supabase (Postgres with RLS everywhere) |
| Server logic | Supabase Edge Functions (Deno) |
| Payments | Stripe (live mode, automatic tax) |
| AI extraction | Anthropic API (server-side only) |
| Hosting | Netlify (`dist/` is the deploy root) |

## Project layout

```
src/
  api/            one module per backend concern (vehicles, photos, receipts,
                  billing, subscription, nhtsa, logo)
  components/     Auth, Billing, InventoryList, VehicleForm, VinScanner, Settings
  utils/          profit calculations, CSV export
supabase/
  migrations/     schema + storage buckets + RLS policies (applied via CLI)
  functions/      create-checkout-session, stripe-webhook,
                  get-download-link, scan-receipt
scripts/
  backup-db.sh    local Postgres dump to a private folder
```

Conventions worth knowing before editing:

- **Storage paths are the database.** Photos, logos, and receipts live at
  deterministic paths keyed by user/vehicle ids — no tracking columns. Receipt
  file names are capture timestamps; labels derive from the path.
- **Edge functions call APIs with plain `fetch`, never SDKs.** SDK HTTP clients
  have broken on the edge runtime; the REST APIs are single JSON POSTs anyway.
- **AI output is never auto-committed.** Receipt extraction always lands in a
  review panel; the user confirms before anything is saved.
- **Uploads are non-fatal.** The vehicle row saves first; a failed photo or
  receipt upload costs the attachment, never the data.
- **`receipts` bucket is private** (financial documents, signed URLs);
  `vehicle-photos` and `dealer-logos` are public.

## Local development

```bash
npm install
npm run dev
```

Requires `.env.local` (never committed):

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

## Backend configuration

Edge-function secrets live in the Supabase vault (`supabase secrets set`),
never in this repo: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
`STRIPE_TAX_ENABLED`, `ANTHROPIC_API_KEY`.

After changing a secret, **redeploy the function** — running instances read
the vault only at boot.

Migrations apply to the linked project via:

```bash
npx supabase db query --linked -f supabase/migrations/<file>.sql
```

## Deploy

```bash
npm run build
```

Then publish `dist/` to the Netlify site (`vintage-tracker`). Only `dist/`
deploys — everything else in this repo stays private.
