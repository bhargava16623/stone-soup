// Fetch a public web page that a visitor pasted, without letting the server be used to reach
// internal addresses (SSRF): http(s) only, standard ports, every hop's DNS checked against private
// ranges, redirects followed manually, size and time capped.
import "server-only";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export class FetchRefused extends Error {}

const MAX_BYTES = 1_500_000;
const TIMEOUT_MS = 8_000;
const MAX_REDIRECTS = 3;

function isPrivateIPv4(ip: string): boolean {
  const [a, b] = ip.split(".").map(Number);
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

function isPrivateIP(ip: string): boolean {
  if (isIP(ip) === 4) return isPrivateIPv4(ip);
  const v6 = ip.toLowerCase();
  if (v6.startsWith("::ffff:")) return isPrivateIPv4(v6.slice(7));
  return v6 === "::" || v6 === "::1" || v6.startsWith("fc") || v6.startsWith("fd") || v6.startsWith("fe8") || v6.startsWith("fe9") || v6.startsWith("fea") || v6.startsWith("feb");
}

async function assertPublic(url: URL) {
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new FetchRefused("Only http(s) links can be checked");
  if (url.port && url.port !== "80" && url.port !== "443") throw new FetchRefused("That link uses an unusual port");
  if (url.username || url.password) throw new FetchRefused("Links with credentials can't be checked");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const addresses = isIP(host) ? [{ address: host }] : await lookup(host, { all: true }).catch(() => []);
  if (addresses.length === 0) throw new FetchRefused("That website could not be found");
  if (addresses.some((a) => isPrivateIP(a.address))) throw new FetchRefused("That link points to a private network");
}

function decodeEntities(s: string) {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
}

function meta(html: string, name: string) {
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${name}["'][^>]+content=["']([^"']*)["']`, "i");
  return decodeEntities(html.match(re)?.[1] ?? "").trim();
}

export interface FetchedPage {
  url: string;
  title: string;
  description: string;
  text: string; // visible text, truncated
}

export async function fetchPublicPage(raw: string): Promise<FetchedPage> {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new FetchRefused("That doesn't look like a valid link");
  }

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublic(url);
    const res = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { "User-Agent": "Mozilla/5.0 (compatible; StoneSoupScamCheck/1.0)", Accept: "text/html,text/plain" },
    }).catch(() => {
      throw new FetchRefused("The website didn't respond");
    });

    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      url = new URL(res.headers.get("location")!, url);
      continue;
    }
    if (!res.ok) throw new FetchRefused(`The website answered with an error (${res.status})`);
    const type = res.headers.get("content-type") ?? "";
    if (!/text\/html|text\/plain/i.test(type)) throw new FetchRefused("That link isn't a web page");

    // Read at most MAX_BYTES.
    const reader = res.body!.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (size < MAX_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      size += value.length;
    }
    await reader.cancel().catch(() => {});
    const html = new TextDecoder().decode(Buffer.concat(chunks));

    const text = decodeEntities(
      html
        .replace(/<(script|style|noscript|svg)[\s\S]*?<\/\1>/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " "),
    ).trim();

    return {
      url: url.toString(),
      title: meta(html, "og:title") || decodeEntities(html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] ?? "").trim(),
      description: meta(html, "og:description") || meta(html, "description"),
      text: text.slice(0, 12_000),
    };
  }
  throw new FetchRefused("Too many redirects");
}
