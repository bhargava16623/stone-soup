// PayPal Orders v2: donations are paid straight to the vendor (`payee`), with an
// optional unrestricted share paid to the NGO in the same checkout. The platform
// never holds donor money. Server-side only.
import "server-only";

const BASE = process.env.PAYPAL_ENV === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";

let cachedToken: { value: string; expiresAt: number } | undefined;

async function accessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;
  const id = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;
  if (!id || !secret) throw new Error("PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET are not set");

  const res = await fetch(`${BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new PayPalError("OAuth failed", res.status, await res.text());
  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { value: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return data.access_token;
}

export class PayPalError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(message: string, status: number, body: unknown) {
    super(`${message} (${status})`);
    this.status = status;
    this.body = body;
  }
}

async function api<T>(method: string, path: string, body?: unknown, requestId?: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${await accessToken()}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      // Makes retries of the same create/capture idempotent on PayPal's side.
      ...(requestId ? { "PayPal-Request-Id": requestId } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new PayPalError(`PayPal ${method} ${path} failed`, res.status, data);
  return data as T;
}

const usd = (cents: number) => ({ currency_code: "USD", value: (cents / 100).toFixed(2) });

/** PayPal allows at most 10 purchase units per order. */
export const MAX_PURCHASE_UNITS = 10;

export interface PurchaseUnit {
  referenceId: string; // unique within the order, e.g. "need_12" or "ngo_gift"
  description: string; // shown to the donor in PayPal
  amountCents: number;
  payeeEmail: string; // who receives this part of the payment
}

/** Create one order that pays each purchase unit to its own payee. Returns the PayPal order ID. */
export async function createOrder(units: PurchaseUnit[], requestId: string): Promise<string> {
  if (units.length === 0 || units.length > MAX_PURCHASE_UNITS) {
    throw new Error(`An order needs 1–${MAX_PURCHASE_UNITS} purchase units`);
  }
  const order = await api<{ id: string }>(
    "POST",
    "/v2/checkout/orders",
    {
      intent: "CAPTURE",
      purchase_units: units.map((u) => ({
        reference_id: u.referenceId,
        description: u.description.slice(0, 127),
        amount: usd(u.amountCents),
        payee: { email_address: u.payeeEmail },
      })),
      payment_source: {
        paypal: { experience_context: { shipping_preference: "NO_SHIPPING", user_action: "PAY_NOW" } },
      },
    },
    requestId,
  );
  return order.id;
}

export interface CapturedUnit {
  referenceId: string;
  captureId: string;
  status: string;
  amountCents: number;
  payeeEmail?: string;
}

export interface CaptureResult {
  orderId: string;
  status: string;
  payerName?: string;
  payerEmail?: string;
  units: CapturedUnit[];
}

interface OrderResponse {
  id: string;
  status: string;
  payer?: { name?: { given_name?: string; surname?: string }; email_address?: string };
  purchase_units: {
    reference_id: string;
    payee?: { email_address?: string };
    payments?: { captures?: { id: string; status: string; amount: { value: string } }[] };
  }[];
}

/** Capture an approved order. */
export async function captureOrder(orderId: string): Promise<CaptureResult> {
  const order = await api<OrderResponse>("POST", `/v2/checkout/orders/${orderId}/capture`, {}, `capture-${orderId}`);
  return {
    orderId: order.id,
    status: order.status,
    payerName: [order.payer?.name?.given_name, order.payer?.name?.surname].filter(Boolean).join(" ") || undefined,
    payerEmail: order.payer?.email_address,
    units: order.purchase_units.flatMap((pu) =>
      (pu.payments?.captures ?? []).map((c) => ({
        referenceId: pu.reference_id,
        captureId: c.id,
        status: c.status,
        amountCents: Math.round(Number(c.amount.value) * 100),
        payeeEmail: pu.payee?.email_address,
      })),
    ),
  };
}
