import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { publicOrigin } from "@/lib/api.ts";
import { createStoneSoupServer } from "@/lib/mcp.ts";
import { clientIp, limit, RateLimitError } from "@/lib/rate-limit.ts";

/** MCP endpoint (Streamable HTTP, stateless): a fresh server per request, JSON responses. */
async function handle(request: Request) {
  if (request.method === "POST") {
    try {
      limit(`mcp:${clientIp(request.headers)}`, 30);
    } catch (e) {
      if (!(e instanceof RateLimitError)) throw e;
      return Response.json({ jsonrpc: "2.0", error: { code: -32000, message: e.message }, id: null }, { status: 429, headers: { "Retry-After": "60" } });
    }
  }
  const server = createStoneSoupServer(publicOrigin(request));
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  await server.connect(transport);
  return transport.handleRequest(request);
}

export const GET = handle;
export const POST = handle;
export const DELETE = handle;
