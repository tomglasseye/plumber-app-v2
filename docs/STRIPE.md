# Stripe Billing

> **Status:** Entirely future work. The app currently has no billing layer — clients are onboarded manually by the super admin and there's no subscription gate. The plans are already advertised on [AboutPage.tsx](../src/pages/AboutPage.tsx) (Starter £120/mo, Pro £159/mo) but nothing collects money yet.

This doc covers wiring Stripe up so businesses pay a recurring subscription to use HiveQ. It's a layer above everything else — engineers and customers never see it; only the **master** of a business interacts with billing.

See [LAUNCH.md](LAUNCH.md) for where Stripe fits in the rollout sequence (Phase 5) and the high-level checklist.

---

## How it works end to end

```
Master signs up / is invited
        ↓
Business created with subscription_status = null
        ↓
Master lands in app → sees "Subscribe" gate (no full app access yet)
        ↓
Master picks a plan (Starter or Pro, monthly or annual)
        ↓
App calls stripe-create-checkout-session
        ↓
Master redirected to Stripe Checkout
        ↓
Card captured → Stripe creates Customer + Subscription
        ↓
Stripe fires checkout.session.completed webhook
        ↓
stripe-webhook function writes stripe_customer_id, stripe_subscription_id,
plan, subscription_status, current_period_end to businesses row
        ↓
Master redirected back to /account?session_id=...
        ↓
App polls/refetches business row → subscription_status='active' → full access unlocked
```

Ongoing:
- Stripe charges the card on each renewal date and fires `invoice.payment_succeeded` → webhook bumps `current_period_end`
- If a payment fails, Stripe retries on its dunning schedule and fires `invoice.payment_failed` → webhook flips status to `past_due`
- Master can open the **Stripe Customer Portal** from the Account page to change card, switch plans, download invoices, or cancel
- Cancellation fires `customer.subscription.deleted` → webhook flips status to `canceled` and keeps `current_period_end` intact so they retain access until the period actually ends

---

## 1. Stripe account setup

1. Create a Stripe account at [stripe.com](https://stripe.com), complete business verification (a few days for live-mode approval — you can build everything in test mode while waiting)
2. Stripe Dashboard → Developers → API keys: copy the **Publishable key** (browser-safe) and **Secret key** (server-only). Use **test keys** until ready to go live.
3. Stripe Dashboard → Products → create two products:
   - **HiveQ Starter** with two recurring Prices: £120/month and the chosen annual price (e.g. £1,200/year if doing 2-months-free)
   - **HiveQ Pro** with two recurring Prices: £159/month and the chosen annual price
4. Copy all four Price IDs (`price_...`) — these become env vars below
5. Stripe Dashboard → Settings → Billing → Customer Portal: enable plan switching between HiveQ Starter ↔ Pro, allow payment method updates, allow cancellations (Stripe's portal handles all this UI)
6. Stripe Dashboard → Settings → Tax: enable Stripe Tax with UK VAT registration if you're charging VAT. The About page lists prices VAT-exclusive — Stripe Tax will gross them up at checkout.

### Env vars

Add to Netlify (and `.env.local` for the dev workflow):

```
STRIPE_SECRET_KEY=sk_test_...           # server-only
STRIPE_WEBHOOK_SECRET=whsec_...         # server-only, set after step 4 below
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_... # browser-safe

STRIPE_PRICE_STARTER_MONTHLY=price_...
STRIPE_PRICE_STARTER_ANNUAL=price_...
STRIPE_PRICE_PRO_MONTHLY=price_...
STRIPE_PRICE_PRO_ANNUAL=price_...
```

Never commit live-mode keys. Use a separate Stripe account or restricted-key for any shared / staging environment.

---

## 2. Database schema (migration 25)

Add to the `businesses` table:

```sql
ALTER TABLE businesses
  ADD COLUMN stripe_customer_id text,
  ADD COLUMN stripe_subscription_id text,
  ADD COLUMN stripe_price_id text,
  ADD COLUMN plan text CHECK (plan IN ('starter', 'pro')),
  ADD COLUMN subscription_status text CHECK (subscription_status IN (
    'trialing', 'active', 'past_due', 'canceled', 'unpaid', 'incomplete', 'incomplete_expired'
  )),
  ADD COLUMN current_period_end timestamptz,
  ADD COLUMN trial_ends_at timestamptz;

CREATE UNIQUE INDEX businesses_stripe_customer_id_uniq
  ON businesses (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;
```

Add a webhook idempotency table — Stripe retries webhooks aggressively, so without this you'll process duplicates:

```sql
CREATE TABLE billing_events (
  stripe_event_id text PRIMARY KEY,
  type text NOT NULL,
  business_id uuid REFERENCES businesses(id) ON DELETE SET NULL,
  payload jsonb NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX billing_events_business_id_idx ON billing_events (business_id);
CREATE INDEX billing_events_type_idx ON billing_events (type);
```

RLS for `billing_events`: no client-side access. Only the service role (used by Netlify Functions) reads or writes it. Add an explicit policy denying all if RLS is enabled, or leave RLS off and revoke `anon` and `authenticated` access.

The `plan` column is denormalised from `stripe_price_id` for speed — gating the SMS feature shouldn't require a Stripe round-trip on every page load. The webhook handler computes it from the price ID and writes both columns.

---

## 3. Netlify Functions

Three functions, all in `netlify/functions/`. All use the official `stripe` Node SDK (`npm install stripe`).

### `stripe-create-checkout-session.ts`

Called from the app when a master clicks "Subscribe". Creates a Stripe Checkout session and returns the URL.

```ts
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const PRICE_LOOKUP = {
  starter_monthly: process.env.STRIPE_PRICE_STARTER_MONTHLY!,
  starter_annual: process.env.STRIPE_PRICE_STARTER_ANNUAL!,
  pro_monthly: process.env.STRIPE_PRICE_PRO_MONTHLY!,
  pro_annual: process.env.STRIPE_PRICE_PRO_ANNUAL!,
} as const;

export default async (req: Request) => {
  // 1. Verify caller is the master of the business they're subscribing for
  //    (use Supabase JWT from Authorization header, look up role + business_id)
  // 2. Look up business — if it already has stripe_customer_id, reuse it,
  //    otherwise let Checkout create one (we'll save it from the webhook)
  // 3. Create the session

  const { plan } = await req.json(); // e.g. "pro_monthly"
  const priceId = PRICE_LOOKUP[plan as keyof typeof PRICE_LOOKUP];
  if (!priceId) return new Response("invalid plan", { status: 400 });

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    customer: business.stripe_customer_id || undefined,
    customer_email: business.stripe_customer_id ? undefined : master.email,
    client_reference_id: business.id, // CRITICAL: webhook uses this to find the business
    subscription_data: {
      trial_period_days: 14, // adjust per pricing decision
      metadata: { business_id: business.id },
    },
    success_url: `${process.env.APP_URL}/account?stripe=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.APP_URL}/account?stripe=cancelled`,
    automatic_tax: { enabled: true }, // requires Stripe Tax setup
  });

  return new Response(JSON.stringify({ url: session.url }), {
    headers: { "Content-Type": "application/json" },
  });
};
```

### `stripe-create-portal-session.ts`

Called when a master clicks "Manage subscription" on the Account page. Returns a Customer Portal URL.

```ts
const session = await stripe.billingPortal.sessions.create({
  customer: business.stripe_customer_id,
  return_url: `${process.env.APP_URL}/account`,
});
return new Response(JSON.stringify({ url: session.url }), { ... });
```

Reject the call if `stripe_customer_id` is null — that means they've never subscribed and there's no portal to show.

### `stripe-webhook.ts`

The most important function. Stripe POSTs every billing event here; we mutate the `businesses` row to match.

```ts
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const PRICE_TO_PLAN: Record<string, "starter" | "pro"> = {
  [process.env.STRIPE_PRICE_STARTER_MONTHLY!]: "starter",
  [process.env.STRIPE_PRICE_STARTER_ANNUAL!]: "starter",
  [process.env.STRIPE_PRICE_PRO_MONTHLY!]: "pro",
  [process.env.STRIPE_PRICE_PRO_ANNUAL!]: "pro",
};

export default async (req: Request) => {
  const sig = req.headers.get("stripe-signature");
  const body = await req.text(); // raw text, not JSON — signature is computed over the raw body

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig!,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch {
    return new Response("invalid signature", { status: 400 });
  }

  // Idempotency: bail if we've seen this event already
  const { error: insertErr } = await supabase
    .from("billing_events")
    .insert({ stripe_event_id: event.id, type: event.type, payload: event });
  if (insertErr?.code === "23505") {
    return new Response("already processed", { status: 200 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const s = event.data.object as Stripe.Checkout.Session;
      const businessId = s.client_reference_id!;
      const sub = await stripe.subscriptions.retrieve(s.subscription as string);
      await applySubscription(businessId, s.customer as string, sub);
      break;
    }
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const businessId = sub.metadata.business_id;
      if (businessId) await applySubscription(businessId, sub.customer as string, sub);
      break;
    }
    case "invoice.payment_succeeded":
    case "invoice.payment_failed": {
      const inv = event.data.object as Stripe.Invoice;
      if (inv.subscription) {
        const sub = await stripe.subscriptions.retrieve(inv.subscription as string);
        const businessId = sub.metadata.business_id;
        if (businessId) await applySubscription(businessId, sub.customer as string, sub);
      }
      break;
    }
    // ignore everything else
  }

  return new Response("ok", { status: 200 });
};

async function applySubscription(
  businessId: string,
  customerId: string,
  sub: Stripe.Subscription
) {
  const priceId = sub.items.data[0]?.price.id;
  await supabase
    .from("businesses")
    .update({
      stripe_customer_id: customerId,
      stripe_subscription_id: sub.id,
      stripe_price_id: priceId,
      plan: priceId ? PRICE_TO_PLAN[priceId] ?? null : null,
      subscription_status: sub.status,
      current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
      trial_ends_at: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
    })
    .eq("id", businessId);
}
```

Register the endpoint in Stripe Dashboard → Developers → Webhooks pointing at `https://yourdomain.com/.netlify/functions/stripe-webhook`. Subscribe to:

- `checkout.session.completed`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_succeeded`
- `invoice.payment_failed`

Copy the signing secret Stripe shows after creating the endpoint — that's `STRIPE_WEBHOOK_SECRET`.

> **Raw body matters.** Webhook signature verification fails if anything (including JSON parsing middleware) mutates the body before `constructEvent` sees it. With Netlify Functions on the modern runtime, `await req.text()` gives you the raw bytes — don't `req.json()` first.

---

## 4. Frontend

### Pricing / Subscribe page

Shown to masters whose business has no active subscription (`subscription_status` is `null`, `canceled`, `incomplete_expired`, or `unpaid`). Reuse the plan cards from [AboutPage.tsx](../src/pages/AboutPage.tsx) but with monthly/annual toggle and a "Subscribe" button that calls `stripe-create-checkout-session` and redirects to the returned URL.

### Account → Billing tab

For masters with an active or trialing subscription:
- Current plan name and price
- Renewal date (`current_period_end`)
- Trial countdown if `trial_ends_at` is in the future
- "Manage subscription" button → calls `stripe-create-portal-session` and redirects
- Past invoices link (the Customer Portal handles this)

Engineers don't see this tab at all.

### Trial banner

Shown app-wide when `trial_ends_at` is within 7 days. Click-through goes to the Billing tab.

### Access gate

When `subscription_status` is `past_due`, `canceled`, `unpaid`, or `incomplete_expired` **and** `current_period_end` is in the past:

- Masters see a full-screen "Your subscription needs attention" page with a "Reactivate" button (opens Customer Portal)
- Engineers see "Your business needs to renew — please contact your administrator"
- The data is read-only, not deleted. Recovery on reactivation should be instant.

`trialing` and `active` get full access. `past_due` with `current_period_end` still in the future also keeps access — Stripe is mid-retry, don't lock them out yet.

### Pro feature gating

The SMS features (see [SMS.md](SMS.md)) check `business.plan === 'pro'` before showing the "Send SMS" UI or letting the SMS Netlify Function fire. Starter clients see an upsell card on the SMS settings page.

---

## 5. Testing

### Local dev with the Stripe CLI

```sh
# install once
brew install stripe/stripe-cli/stripe   # or scoop install stripe (Windows)
stripe login

# forward webhooks to your local Netlify dev server
stripe listen --forward-to localhost:8888/.netlify/functions/stripe-webhook
```

The CLI prints a webhook signing secret (different from the production one) — put it in `.env.local` as `STRIPE_WEBHOOK_SECRET` for the dev session.

Trigger specific events from a second terminal:

```sh
stripe trigger checkout.session.completed
stripe trigger invoice.payment_failed
```

### Test cards

| Card                  | Behaviour                              |
| --------------------- | -------------------------------------- |
| `4242 4242 4242 4242` | Success                                |
| `4000 0000 0000 0002` | Generic decline                        |
| `4000 0000 0000 9995` | Insufficient funds                     |
| `4000 0027 6000 3184` | 3D Secure challenge                    |
| `4000 0000 0000 0341` | Initial payment succeeds, future renewals fail (good for dunning testing) |

Any future date for expiry, any 3-digit CVC, any UK postcode.

### Lifecycle smoke test

Run through this end-to-end before live launch:

- [ ] Subscribe with the success card → land back in app → `subscription_status='trialing'`, `plan` set, full access unlocked
- [ ] Force-end the trial (Stripe Dashboard → subscription → "End trial now") → webhook fires → `subscription_status='active'`
- [ ] Switch from Starter to Pro via the Customer Portal → webhook fires → `plan='pro'`, SMS features unlock
- [ ] Force a payment failure (use card `4000 0000 0000 0341`, advance the clock or trigger `invoice.payment_failed` via CLI) → `subscription_status='past_due'`. Confirm trial-period customers don't get gated mid-retry; expired ones do.
- [ ] Cancel from the Customer Portal → `subscription_status='canceled'`, but access continues until `current_period_end`. Advance Stripe's test clock past it → access gate appears.
- [ ] Re-subscribe after cancellation → existing `stripe_customer_id` reused, history preserved on the Stripe side.

### Webhook idempotency

Replay the same event twice using `stripe events resend <event_id>`. Confirm `billing_events` has one row, business row mutated only once.

---

## 6. Going live

When ready to take real money:

1. Complete Stripe live-mode activation (business verification, bank account)
2. Recreate the Products and Prices in **live mode** (test-mode IDs don't carry over) — copy the new `price_...` IDs
3. Recreate the webhook endpoint in live mode and copy the new signing secret
4. Swap all six Stripe env vars in Netlify from `..._test` / `pk_test_` / `sk_test_` to live values
5. Trigger a redeploy
6. Subscribe yourself with a real card on a small test plan (then refund + cancel) to verify end-to-end production wiring

Do not delete test-mode data — keep it as a regression sandbox.

---

## When something breaks

- **Webhook 400s with "invalid signature"** — almost always a `STRIPE_WEBHOOK_SECRET` mismatch (e.g. test secret in live env, or live secret was rotated and Netlify wasn't redeployed). Stripe Dashboard → Webhooks → endpoint → "Reveal signing secret" to confirm.
- **Webhook 200s but the business row never updates** — check `billing_events` to see if the event was recorded; if yes, the function ran but the SQL update failed silently. Check Netlify function logs for the Supabase response. Often `client_reference_id` was null (Checkout session created without it) and the handler didn't know which business to update.
- **Subscription stuck in `incomplete`** — the first payment failed at checkout. Stripe leaves the subscription in `incomplete` for 23 hours waiting for the customer to fix the card; after that it transitions to `incomplete_expired`. Treat both as "no access" in the gate.
- **Subscription stuck in `past_due`** — Stripe is dunning the customer on its own retry schedule (Smart Retries by default). Don't force a retry manually; the customer fixes the card via the Customer Portal and Stripe transitions back to `active` automatically.
- **Plan switch doesn't change `plan` column** — webhook is firing but the price ID isn't in `PRICE_TO_PLAN`. Happens when you create a new price in Stripe and forget to add it to the Netlify env vars. Add the env var, redeploy, and resend the most recent `customer.subscription.updated` event.
- **Customer says "I cancelled but I still have access"** — that's correct: Stripe cancels at period end by default, and the gate respects `current_period_end`. If they want immediate cancellation, do it from Stripe Dashboard with "Cancel immediately" — that fires `customer.subscription.deleted` with `current_period_end` in the past.

---

## What's deliberately out of scope

- **Per-seat / usage billing** — both plans are flat-rate for 6–8 users. If a client crosses 8 we handle it manually for now (warn or upsell case-by-case); revisit if it becomes common.
- **Proration on plan switch** — Stripe's default proration is fine; we don't need custom logic.
- **In-app invoice viewing** — the Customer Portal handles this, no need to rebuild it.
- **Dunning emails** — Stripe's built-in Smart Retries + email notifications cover this. Custom emails only if a client requests something specific.
- **Coupons / discounts** — can be applied in the Stripe Dashboard ad-hoc; no in-app UI needed.
