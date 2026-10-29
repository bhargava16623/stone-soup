import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { publicOrigin } from "@/lib/api.ts";
import { createStoneSoupServer } from "@/lib/mcp.ts";

/** MCP endpoint (Streamable HTTP, stateless): a fresh server per request, JSON responses. */
async function handle(request: Request) {
  const server = createStoneSoupServer(publicOrigin(request));
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  await server.connect(transport);
  return transport.handleRequest(request);
}

export const GET = handle;
export const POST = handle;
export const DELETE = handle;
