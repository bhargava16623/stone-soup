# Stone Soup

> *In the old folk tale, hungry travellers set a pot of water and a stone over a fire in a village
> that wouldn't share. Curious villagers each added one thing — a carrot, an onion, a pinch of salt —
> until the "stone soup" fed everyone.*

**Stone Soup turns donations into verified purchases.** Instead of sending cash and hoping, a donor funds
a specific item a small charity needs — a blanket, a backpack, a bag of rice. PayPal pays the supplier
directly, the price is checked against the market, and the donor sees a photo when it's delivered.

Built for the PayPal **Build What's Next with PayPal and AI** hackathon.

## The problem

- Individual donors are leaving: donor counts have fallen every year since 2021, and roughly 4 in 5
  first-time donors never give again (Fundraising Effectiveness Project, 2025).
- The top reason is not knowing what the money did: 24% of lapsed donors cite lack of transparency
  (Bloomerang, 2025); 68% say trust is essential but only 18% highly trust charities (BBB Give.org, 2026).
- Small charities — 73% of US nonprofits take in under $500K a year — have no staff to prove spending or
  report back, and AI-generated fake charities make photos and reports easy to fake.

Every platform answers with "give cash, then try to prove where it went". Stone Soup removes the cash.

## How it works

```mermaid
flowchart LR
  NGO["Charity types its need<br/>in plain language"] -->|Gemini| Cards["Need Cards<br/>matched to supplier catalogs"]
  Cards -->|Channel3 + Gemini| Check["Market price check"]
  Check --> Feed["Public needs feed"]
  Donor["Donor or Giving Agent"] -->|PayPal Orders v2<br/>payee = supplier| Supplier["Supplier paid directly"]
  Feed --> Donor
  Supplier --> Delivery["Charity photographs the delivery"]
  Delivery -->|Gemini vision + photo hash| Verify["Verified or flagged for review"]
  Verify -->|Gemini| Update["Personal update to each donor"]
  Verify --> Ledger["Open ledger (AG Grid)"]
```

1. **A charity describes what it needs** ("rice for 30 people for two weeks"). Gemini turns it into
   specific needs with quantities — showing its arithmetic — and matches each to supplier catalogs.
2. **Prices are checked.** Each catalog item is compared with ~10 real products found through Channel3,
   with a Gemini pass that drops irrelevant results. The comparison products are saved, so the check is
   reproducible and visible to donors. Above-market prices need a written reason.
3. **Donors fund units, not causes.** One PayPal checkout pays each supplier directly (`payee`), with an
   optional unrestricted gift to the charity and an option to cover PayPal's fee. Stone Soup never holds
   the money.
4. **Or the Giving Agent does it.** "I have $50, I care about kids and winter relief" → Gemini searches
   open needs and proposes a basket through function calls; the server prices and validates every
   proposal and reports the remaining budget so the agent can improve it. The donor approves once.
5. **Delivery is confirmed with a photo.** Gemini vision checks the item, rough quantity and whether the
   photo looks genuine; a SHA-256 hash catches reused photos. Doubtful deliveries go to a human review
   queue — nothing is rejected automatically.
6. **Donors hear back.** Delivered units are allocated to gifts in order, and each donor whose units
   arrived gets a short personal update with the photo.
7. **Everything is public** in the open ledger: gift, supplier paid, amount, PayPal capture ID, price check
   and delivery status.

## PayPal integration

| Capability | Where it's used |
|---|---|
| **Orders v2 with `payee`** | Every purchase unit is paid to that need's supplier, not to the platform ([`src/lib/paypal.ts`](src/lib/paypal.ts)) |
| **Multiple purchase units** | One checkout funds up to 9 needs across suppliers plus an NGO gift ([`src/lib/donations.ts`](src/lib/donations.ts)) |
| **JS SDK v6** (`@paypal/react-paypal-js/sdk-v6`) | Donate button on need pages and the Giving Agent basket |
| **`PayPal-Request-Id` idempotency** | Safe retries of order creation and capture |
| **Webhooks** with signature verification | `CHECKOUT.ORDER.APPROVED` completes captures if the donor closes the page ([`src/app/api/paypal/webhook`](src/app/api/paypal/webhook/route.ts)) |
| **Capture IDs** | Shown per gift in the open ledger |

Fee cover is calculated so the supplier receives the exact price after PayPal's fee (e.g. 2 blankets:
donor pays $37.81, supplier nets $36.00).

## AI: what Gemini does

All AI runs on Google Gemini through `@google/genai` ([`src/lib/gemini.ts`](src/lib/gemini.ts)), with a
model fallback chain (`gemini-3.8-flash` → `gemini-3.5-flash-lite` → `gemini-2.5-flash`), per-call
timeouts, and a cooldown for overloaded models.

| Feature | Technique | Code |
|---|---|---|
| Need intake | Structured output (JSON schema), quantity reasoning | [`src/lib/intake.ts`](src/lib/intake.ts) |
| Price-list photo → catalog | Vision + structured output | [`src/lib/catalog.ts`](src/lib/catalog.ts) |
| Market price relevance filter | Classification over Channel3 results | [`src/lib/relevance.ts`](src/lib/relevance.ts) |
| Giving Agent | Function calling loop (`search_needs`, `propose_basket`) with server-side validation | [`src/lib/agent.ts`](src/lib/agent.ts) |
| Delivery check | Vision + structured output, plus photo hashing | [`src/lib/delivery.ts`](src/lib/delivery.ts) |
| Donor impact updates | Grounded generation from delivery facts | [`src/lib/delivery.ts`](src/lib/delivery.ts) |

Guardrails: the model never sets amounts (prices come from the database); charity-written text is
passed to the agent as data, not instructions; flagged deliveries always go to a person.

## Sponsor tools

- **Channel3** — product search (agentic mode) for market-price benchmarks and product images; benchmark
  baskets are re-priced by product ID ([`src/lib/channel3.ts`](src/lib/channel3.ts), [`src/lib/benchmark.ts`](src/lib/benchmark.ts)).
- **AG Grid** — the open ledger: sorting, column and quick filters, totals row, pagination, themed to the
  site ([`src/components/ledger-grid.tsx`](src/components/ledger-grid.tsx)).
- **Render** — web service + Postgres via [`render.yaml`](render.yaml).

## Run it locally

**Requirements:** Node.js 22+, Docker, a PayPal developer account, a Gemini API key, a Channel3 API key.

1. **PayPal sandbox** (developer.paypal.com):
   - Create a REST app (sandbox) and copy its client ID and secret.
   - Under *Testing Tools → Sandbox Accounts*, create two **business** accounts (supplier and charity).
     The default **personal** account is the donor.
2. **Configure:**
   ```bash
   git clone https://github.com/bhargava16623/stone-soup.git && cd stone-soup
   cp .env.example .env   # fill in the values
   npm install
   ```
3. **Database:**
   ```bash
   npm run db:up        # Postgres 16 in Docker on port 5433
   npm run db:migrate
   npm run db:seed      # demo charities, suppliers and needs; fetches live price checks (~2 min)
                        # or: npm run db:seed -- --no-benchmark  (fast, no price checks)
   ```
4. **Start:**
   ```bash
   npm run dev          # http://localhost:3000
   ```
5. **Try it:** fund a need with the sandbox personal account, ask the Giving Agent for a basket, post a
   need as Hope Shelter (*For organisations*), confirm a delivery with a photo, and check the ledger.

## Deploy to Render

New → **Blueprint** → select this repo. Render creates the web service and Postgres from `render.yaml`
and asks for the secrets. After the first deploy, run `npm run db:seed` from the service's Shell, then
add `https://<your-app>.onrender.com/api/paypal/webhook` as a webhook in the PayPal developer dashboard
(event: *Checkout order approved*) and set `PAYPAL_WEBHOOK_ID`.

## Project structure

```
src/app/               pages and API routes (Next.js App Router)
  give/                Giving Agent
  needs/[id]/          need page with market check and donate panel
  ngo/[slug]/          charity dashboard: intake and delivery confirmation
  vendor/[slug]/       supplier dashboard: catalog and orders to deliver
  ledger/              open ledger (AG Grid)
  gifts/[orderId]/     donor's gift tracking
  review/              review queue for flagged deliveries
  api/checkout/        create and capture PayPal orders
  api/paypal/webhook/  verified PayPal webhooks
src/lib/               PayPal, Gemini, Channel3, checkout, intake, agent and delivery logic
src/db/                Drizzle schema and client
scripts/               seed script and spikes
```

## Limitations (honest list)

- **Sandbox only.** Suppliers are sandbox business accounts; the market check uses real retail prices
  from Channel3, but purchases go to the demo suppliers.
- **No logins.** Charity and supplier dashboards are open for the demo ("acting as").
- **Tax receipts.** In production, a fiscal sponsor or donor-advised fund would be the legal recipient
  so gifts are deductible; the demo doesn't claim deductibility.
- **Market data.** Channel3 covers retail goods well and groceries poorly; items without reliable data
  show "No market data" and need a written reason.
- **Photo checks are a signal, not proof.** They're combined with the PayPal payment record and
  supplier fulfilment, and doubtful cases go to a person.

## License

[MIT](LICENSE)
