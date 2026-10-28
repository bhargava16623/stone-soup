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
  constructor(
    message: string,
    readonly status: number,
    readonly body: unknown,
  ) {
    super(`${message} (${status})`);
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

export interface DonationOrderInput {
  needId: number;
  description: string; // shown to the donor in PayPal, e.g. "2 × fleece blanket for Hope Shelter"
  vendorEmail: string;
  vendorAmountCents: number; // includes fee cover, if any
  ngoEmail: string;
  ngoShareCents: number; // 0 for none
  requestId: string;
}

/** Create an order paying the vendor (and optionally the NGO). Returns the PayPal order ID. */
export async function createDonationOrder(input: DonationOrderInput): Promise<string> {
  const units = [
    {
      reference_id: "vendor",
      custom_id: `need_${input.needId}`,
      description: input.description.slice(0, 127),
      amount: usd(input.vendorAmountCents),
      payee: { email_address: input.vendorEmail },
    },
  ];
  if (input.ngoShareCents > 0) {
    units.push({
      reference_id: "ngo",
      custom_id: `need_${input.needId}`,
      description: "Unrestricted support for the organisation",
      amount: usd(input.ngoShareCents),
      payee: { email_address: input.ngoEmail },
    });
  }
  const order = await api<{ id: string }>(
    "POST",
    "/v2/checkout/orders",
    {
      intent: "CAPTURE",
      purchase_units: units,
      payment_source: {
        paypal: { experience_context: { shipping_preference: "NO_SHIPPING", user_action: "PAY_NOW" } },
      },
    },
    input.requestId,
  );
  return order.id;
}

export interface CapturedUnit {
  referenceId: "vendor" | "ngo";
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
        referenceId: pu.reference_id as "vendor" | "ngo",
        captureId: c.id,
        status: c.status,
        amountCents: Math.round(Number(c.amount.value) * 100),
        payeeEmail: pu.payee?.email_address,
      })),
    ),
  };
}
