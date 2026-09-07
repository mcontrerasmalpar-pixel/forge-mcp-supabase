import { createClient } from "npm:@supabase/supabase-js@2";

const SYSTEM = `You are Forge, a Supabase debugging assistant.
Use tools. Never invent columns or tables.
Never ask to run INSERT/UPDATE/DELETE/DROP.
When proposing RLS, remind the user it is a draft and must be reviewed.`;

type ChatMsg = { role: "system" | "user" | "assistant" | "tool"; content: string };

async function mcpCall(req: Request, name: string, args: Record<string, unknown>) {
  const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/mcp-server`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: req.headers.get("Authorization") ?? "",
      apikey: Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: crypto.randomUUID(),
      method: "tools/call",
      params: { name, arguments: args },
    }),
  });
  return await res.json();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, apikey, content-type",
      },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } },
  );
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return new Response("unauthorized", { status: 401 });

  const { messages } = (await req.json()) as { messages: ChatMsg[] };
  const endpoint = Deno.env.get("AZURE_OPENAI_ENDPOINT");
  const key = Deno.env.get("AZURE_OPENAI_API_KEY");
  const deployment = Deno.env.get("AZURE_OPENAI_DEPLOYMENT") ?? "gpt-4o-mini";

  if (!endpoint || !key) {
    return Response.json({
      role: "assistant",
      content: "Azure OpenAI no esta configurado. Usa el MCP directo desde Cursor.",
    });
  }

  const tools = [
    { type: "function", function: { name: "list_tables", description: "List public tables", parameters: { type: "object", properties: {} } } },
    { type: "function", function: { name: "list_policies", description: "List RLS policies", parameters: { type: "object", properties: {} } } },
    { type: "function", function: { name: "explain_query", description: "EXPLAIN a read-only query", parameters: { type: "object", properties: { sql: { type: "string" } }, required: ["sql"] } } },
    { type: "function", function: { name: "propose_rls", description: "Draft an RLS policy. Does not apply it.", parameters: { type: "object", properties: { table: { type: "string" }, intent: { type: "string" } }, required: ["table", "intent"] } } },
    { type: "function", function: { name: "run_readonly_sql", description: "Run SELECT as the current user", parameters: { type: "object", properties: { sql: { type: "string" } }, required: ["sql"] } } },
  ];

  const payloadMessages: unknown[] = [{ role: "system", content: SYSTEM }, ...messages.map((m) => ({ role: m.role, content: m.content }))];
  const url = `${endpoint.replace(/\/$/, "")}/openai/deployments/${deployment}/chat/completions?api-version=2024-08-01-preview`;

  async function complete(msgs: unknown[]) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "api-key": key! },
      body: JSON.stringify({ messages: msgs, tools, temperature: 0.2 }),
    });
    if (!res.ok) throw new Error(await res.text());
    return await res.json();
  }

  let completion = await complete(payloadMessages);
  let choice = completion.choices[0];
  const trace: unknown[] = [];

  for (let i = 0; i < 4 && choice?.message?.tool_calls; i++) {
    payloadMessages.push(choice.message);
    for (const call of choice.message.tool_calls) {
      const args = JSON.parse(call.function.arguments || "{}");
      const result = await mcpCall(req, call.function.name, args);
      trace.push({ tool: call.function.name, args, result });
      payloadMessages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result) });
    }
    completion = await complete(payloadMessages);
    choice = completion.choices[0];
  }

  return Response.json({ role: "assistant", content: choice?.message?.content ?? "", trace });
});
