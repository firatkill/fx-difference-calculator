Türkçe: [README.tr.md](README.tr.md)

# Döviz Kuru Farkı (exchange-rate difference)

A multi-user web app for accountants. It imports Turkish e-invoice (e-Fatura,
UBL-TR) ZIP archives in the browser, builds each customer's ledger, applies
payments to the oldest open invoice first (FIFO), tracks the debt per invoice
in USD, and computes the exchange-rate difference (kur farkı) in TRY. Each
customer's ledger can be exported as a two-sheet Excel report.

There is no public sign-up: accounts come from the seed migrations or an admin invite.

## The problem

An invoice of 10,000 TRY is issued when the rate is 5 (2,000 USD). The customer
later pays 10,000 TRY when the rate is 10, which is only 1,000 USD. The debt is
tracked in USD, so 1,000 USD stays open, and the exchange-rate difference for
the paid part is `1,000 × (10 − 5) = 5,000 TRY`, the basis for an
exchange-rate difference invoice. This exact case is a test in `tests/fifo.test.ts`.

## Features

- Upload one ZIP as downloaded from GİB or an integrator. Year/month folders
  and nested ZIPs (up to 5 levels) are opened automatically; `__MACOSX`,
  `.DS_Store` and `._*` files are skipped.
- Invoices are grouped by customer tax ID (VKN/TCKN); an import report lists
  ZIP/XML counts, duplicates and errors before you confirm.
- Only USD invoices count. TRY, `IADE` (return) invoices, invoices without a
  rate, and unreadable XML are listed separately as excluded.
- Duplicate invoices (same UUID) are counted once.
- Opening balance (in USD, or TRY plus rate) and payments (TRY plus rate, or
  USD plus rate). Payment numbers (`ÖD-0001`, ...) are assigned by a Postgres
  function, so concurrent entries do not collide.
- Ledger table with paid/remaining USD per invoice, exchange-rate difference
  per payment, running balance, and an allocation breakdown per row.
- Excel export with two sheets: `Cari Hesap` (ledger) and `Mahsup Detayı`
  (each allocation slice with invoice rate, payment rate and difference).
- Dashboard charts (recharts) for the user, and a read-only admin view per user.

## How it works

ZIP extraction (`lib/zip/extract.ts`, fflate) and XML parsing
(`lib/parser/ubl.ts`, fast-xml-parser) run in the browser. Only the parsed
invoice fields are stored in Supabase; the XML files are not uploaded.

Parsed fields: the debt is `LegalMonetaryTotal/PayableAmount` (after
withholding); the rate is `PricingExchangeRate/CalculationRate`, or the
`Döviz Kuru:` value in the invoice notes if that is missing. The due date is
read from a `Vade Tarihi` note. Amounts stay strings and are computed with
big.js to avoid float errors.

Allocation (`lib/engine/fifo.ts`, a pure function): the opening balance,
invoices and payments are sorted by date; on the same day, invoices come
before payments, invoices are ordered by document number and payments by entry
order. Each payment closes the oldest open invoice first and carries over to
the next one. For every slice:
`difference (TRY) = closed USD × (payment rate − invoice rate)`.
A payment larger than the open debt becomes an advance and closes later
invoices automatically. If the opening balance has no rate, the difference for
its slices is not computed and the total is flagged as incomplete. If the rate
falls, the difference is negative.

Example (from `tests/fifo.test.ts`): invoices of 90,000 USD at 40 and
20,000 USD at 41, then a payment of 100,000 USD at 42. The payment closes the
first invoice and 10,000 USD of the second, leaving 10,000 USD open. The
difference is `90,000 × 2 + 10,000 × 1 = 190,000 TRY`.

The Excel file is built in the browser with exceljs (loaded on demand).

## Security

- Supabase Auth with email and password; sessions are checked in
  `middleware.ts` with `getUser()`, which validates the JWT with Supabase.
- Row-level security on `customers`, `invoices` and `payments`: each user can
  read and write only rows where `user_id = auth.uid()`.
- Admins have the `super-admin` role in `app_metadata` (writable only with the
  service-role key). An extra `for select` policy lets them read all rows;
  writes stay owner-only. Admin server actions re-check the role
  (`lib/supabase/require-admin.ts`).
- TOTP MFA through Supabase, with multiple named factors. Optional for normal
  users, but once enrolled, pages stay locked until the session reaches
  `aal2`. Required for admins: `/admin` stays closed until `aal2`. MFA is
  enforced in the middleware, not in RLS.
- Admins can invite users by email (link to `/set-password`), ban/unban and
  delete users. Users can reset their password by email.
- Sign-in throttling in the browser: after 5 failed attempts, sign-in is locked
  for 30 seconds (localStorage). This is friction only; Supabase's own auth
  rate limits are the real protection. Resending an OTP has a 60-second cooldown.
- The service-role key (`SUPABASE_SECRET_KEY`) is used only on the server.

## Stack

Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS v4, Supabase
(Auth, Postgres, RLS, `@supabase/ssr`), fflate, fast-xml-parser, big.js,
exceljs, recharts, vitest.

## Tests

`npm test` runs vitest on `tests/*.test.ts`:

- `fifo.test.ts`: the 5-to-10 rate example above, payments spanning several
  invoices, advances, opening balance with and without a rate, same-day
  ordering, rounding with cents, excluded and zero/negative amounts, and
  negative differences.
- `parser.test.ts`: field mapping on a synthetic sample invoice, exclusion of TRY,
  `IADE` and rate-less invoices, rate fallback from notes (comma decimals),
  broken XML turned into a `PARSE_ERROR` record, due date from notes, and
  duplicate UUIDs.
- `extract.test.ts`: nested ZIPs, junk files, the depth limit and broken ZIPs.
- `e2e-fixture.test.ts`: a synthetic archive (nested ZIPs, a loose duplicate
  XML and `.DS_Store` noise) yields 6 unique USD invoices totalling 7,786.88 USD.

All sample invoices are synthetic and generated by `scripts/synthetic-invoices.mjs`;
the repository contains no real invoices.
- `smoke.test.ts`: checks that vitest runs.

## Run locally

1. `npm install`
2. Create `.env` from `.env.example` with:
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`,
   `SUPABASE_SECRET_KEY` (server only) and `NEXT_PUBLIC_SITE_URL`
   (used in invite and password-reset links, e.g. `http://localhost:3000`).
3. Run `supabase/migrations/0001_init.sql` and then `0002_admin.sql` in the
   Supabase SQL Editor. They create the tables, RLS policies, the
   `add_payment` function, placeholder users and a seed admin with temporary
   passwords. Both are safe to re-run. Change the seed passwords after the
   first sign-in.
4. `npm run dev` and open http://localhost:3000.

Other commands: `npm test`, `npm run build`, and `npm run make-fixture`
(packs the samples in `docs/` into one test ZIP).

## Project structure

```
app/                 pages: sign-in, mfa-challenge, set-password, customers, hesabim, admin
components/          UI (upload, ledger table, payment form, MFA, admin screens)
lib/zip/extract.ts   nested ZIP extraction
lib/parser/ubl.ts    UBL-TR invoice parser
lib/engine/fifo.ts   FIFO allocation and exchange-rate difference
lib/excel/export.ts  two-sheet Excel export
lib/supabase/        clients, data access, admin checks
middleware.ts        session, role and MFA checks
supabase/migrations/ schema, RLS, seed users
tests/               vitest suites
docs/                plans and sample invoices
```

More detail (in Turkish): [docs/plan.md](docs/plan.md),
[docs/plan-platform.md](docs/plan-platform.md).
