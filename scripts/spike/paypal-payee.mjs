// Spike: checks the PayPal sandbox behaviours the payment design depends on.
//   S1  Can our app create an order that pays a different sandbox business account (payee)?
//   S2  Do two payees in one order work (vendor + NGO unrestricted share)?
//   S3  Can the platform add shipment tracking to the vendor's capture?
// Two steps, so it works without an interactive terminal:
//   npm run spike:paypal -- create    creates the orders and prints approval links
//   (approve each link in a browser as the sandbox PERSONAL/donor account)
//   npm run spike:paypal -- capture   captures them, reports results, tries tracking (S3)
import { readFileSync, writeFileSync } from "node:fs";
import { need } from "./env.mjs";

const BASE = "https://api-m.sandbox.paypal.com";
const VENDOR = need("SANDBOX_VENDOR_EMAIL");
const NGO = need("SANDBOX_NGO_EMAIL");
const STATE = new URL("../../.spike-orders.json", import.meta.url);

async function token() {
  const auth = Buffer.from(`${need("PAYPAL_CLIENT_ID")}:${need("PAYPAL_CLIENT_SECRET")}`).toString("base64");
  const res = await fetch(`${BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new Error(`OAuth failed: ${res.status} ${await res.text()}`);
  return (await res.json()).access_token;
}

async function api(tok, method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json", Prefer: "return=representation" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { ok: res.ok, status: res.status, data: text ? JSON.parse(text) : null };
}

const unit = (ref, payeeEmail, value, description) => ({
  reference_id: ref,
  custom_id: ref,
  description,
  amount: { currency_code: "USD", value },
  payee: { email_address: payeeEmail },
});

const order = (units) => ({
  intent: "CAPTURE",
  purchase_units: units,
  payment_source: {
    paypal: {
      experience_context: {
        return_url: "https://example.com/return",
        cancel_url: "https://example.com/cancel",
        user_action: "PAY_NOW",
      },
    },
  },
});

async function create(tok, label, body) {
  const created = await api(tok, "POST", "/v2/checkout/orders", body);
  if (!created.ok) {
    console.log(`\n❌ ${label}: create failed (${created.status}):`, JSON.stringify(created.data, null, 2));
    return null;
  }
  const link = created.data.links.find((l) => l.rel === "payer-action" || l.rel === "approve")?.href;
  console.log(`\n${label}\n  order ${created.data.id}\n  approve: ${link}`);
  return { label, id: created.data.id };
}

async function capture(tok, { label, id }) {
  console.log(`\n=== ${label} ===`);
  const captured = await api(tok, "POST", `/v2/checkout/orders/${id}/capture`, {});
  if (!captured.ok) {
    console.log(`❌ capture failed (${captured.status}):`, JSON.stringify(captured.data, null, 2));
    return null;
  }
  for (const pu of captured.data.purchase_units) {
    const cap = pu.payments.captures[0];
    const fees = cap.seller_receivable_breakdown;
    console.log(
      `✅ ${pu.reference_id}: ${cap.status} ${cap.amount.value} USD → payee ${pu.payee.email_address}` +
        (fees ? ` (PayPal fee ${fees.paypal_fee?.value}, net ${fees.net_amount?.value})` : ""),
    );
  }
  return captured.data;
}

async function addTracking(tok, captureId) {
  console.log("\n=== S3: platform adds tracking to the vendor's capture ===");
  const res = await api(tok, "POST", "/v1/shipping/trackers-batch", {
    trackers: [
      {
        transaction_id: captureId,
        tracking_number: "DEMO123456",
        status: "SHIPPED",
        carrier: "OTHER",
        carrier_name_other: "Local courier",
      },
    ],
  });
  const errors = res.data?.errors ?? [];
  if (res.ok && errors.length === 0) console.log("✅ tracking added by the platform");
  else console.log(`⚠️  not allowed from the platform side (${res.status}):`, JSON.stringify(res.data, null, 2));
}

const tok = await token();
const step = process.argv[2];

if (step === "create") {
  const orders = [
    await create(tok, "S1: single order, payee = vendor", order([unit("need_42", VENDOR, "18.00", "1 fleece blanket for Hope Shelter (Need #42)")])),
    await create(
      tok,
      "S2: two payees in one order (vendor + NGO share)",
      order([
        unit("need_42", VENDOR, "18.00", "1 fleece blanket for Hope Shelter (Need #42)"),
        unit("ngo_share", NGO, "2.00", "Unrestricted support for Hope Shelter"),
      ]),
    ),
  ].filter(Boolean);
  writeFileSync(STATE, JSON.stringify(orders, null, 2));
  console.log("\nOpen each link, log in as the sandbox PERSONAL (donor) account, and approve.");
  console.log("You'll land on example.com — that's expected. Then run: npm run spike:paypal -- capture");
} else if (step === "capture") {
  const orders = JSON.parse(readFileSync(STATE, "utf8"));
  const results = [];
  for (const o of orders) results.push(await capture(tok, o));
  const s1 = results[0];
  if (s1) await addTracking(tok, s1.purchase_units[0].payments.captures[0].id);
  console.log("\nDone. Check balances by logging into sandbox.paypal.com as the vendor/NGO.");
} else {
  console.log("Usage: npm run spike:paypal -- create | capture");
}
