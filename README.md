# VINtage — Used-Car Inventory Profit Tracker

A React + Vite web app for independent dealers to track true profit on every
used unit: scan a VIN, enter cost + recon, and see real margin and days in
inventory across the whole lot. Backed by Supabase (auth, database, storage,
edge functions) and Stripe (subscriptions + one-time digital-product sales).

A product of **Torque Advisory Group**.

## Stack
- Frontend: React 18, Vite 6
- Backend: Supabase (Postgres, Auth, Storage, Edge Functions)
- Payments: Stripe (live)
- Hosting: Netlify

## Local development
```bash
npm install
npm run dev
```
Requires a `.env.local` with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
(never committed — see `.gitignore`).
