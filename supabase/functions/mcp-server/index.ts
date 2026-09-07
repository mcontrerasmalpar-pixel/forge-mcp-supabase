// Forge MCP server — Deno Edge Function.
// Tools are allowlisted. Destructive SQL never runs.

import { createClient } from "npm:@supabase/supabase-js@2";

const ALLOWED_TOOLS = [
  "list_tables",
  "list_policies",
  "list_functions",
  "explain_query",
  "propose_rls",
  "run_readonly_sql",
] as const;

type ToolName = (typeof ALLOWED_TOOLS)[number];

const WRITE_RE = /\b(insert|update|delete|drop|alter|truncate|grant|revoke|copy|create|comment|vacuum|refresh|call|do)\b/i;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "authorization, apikey, content-type",
    },
  });
}

function userClient(req: Request) {
  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const auth = req.headers.get("Authorization") ?? "";
  return createClient(url, anon, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function serviceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

function assertReadonlySql(sql: string) {
  const stripped = sql.replace(/--.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "").trim();
  if (!stripped) throw new Error("empty sql");
  if (stripped.includes(";")) throw new Error("multiple statements are not allowed");
  if (WRITE_RE.test(stripped)) throw new Error("refused: statement is not read-only");
  if (!/^\s*(select|with|explain)\b/i.test(stripped)) {
    throw new Error("only SELECT / WITH / EXPLAIN are allowed");
  }
  return stripped;
}

const TOOLS = [
  { name: "list_tables", description: "List public tables and columns.", inputSchema: { type: "object", properties: {}, additionalProperties: false } },
  { name: "list_policies", description: "List RLS policies on public tables.", inputSchema: { type: "object", properties: {}, additionalProperties: false } },
  { name: "list_functions", description: "List public SQL functions.", inputSchema: { type: "object", properties: {}, additionalProperties: false } },
  { name: "explain_query", description: "Run EXPLAIN (FORMAT JSON) on a read-only query.", inputSchema: { type: "object", properties: { sql: { type: "string" } }, required: ["sql"] } },
  { name: "propose_rls", description: "Draft an RLS policy. Does NOT apply it.", inputSchema: { type: "object", properties: { table: { type: "string" }, intent: { type: "string" } }, required: ["table", "intent"] } },
  { name: "run_readonly_sql", description: "Execute a single SELECT/WITH/EXPLAIN as the signed-in user (RLS applies).", inputSchema: { type: "object", properties: { sql: { type: "string" } }, required: ["sql"] } },
];

async function rateLimit(userId: string, tool: string) {
  const admin = serviceClient();
  const since = new Date(Date.now() - 60_000).toISOString();
  const { count } = await admin.from("usage_events").select("*", { count: "exact", head: true }).eq("user_id", userId).gte("created_at", since);
  if ((count ?? 0) >= 40) throw new Error("rate limit: 40 tools/min");
  await admin.from("usage_events").insert({ user_id: userId, tool });
}

async function callTool(name: ToolName, args: Record<string, unknown>, req: Request) {
  const supabase = userClient(req);
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) throw new Error("unauthorized");
  await rateLimit(userData.user.id, name);
  const admin = serviceClient();

  if (name === "list_tables") {
    const { data, error } = await admin.rpc("forge_list_tables");
    if (error) throw error;
    return data;
  }
  if (name === "list_policies") {
    const { data, error } = await admin.rpc("forge_list_policies");
    if (error) throw error;
    return data;
  }
  if (name === "list_functions") {
    const { data, error } = await admin.rpc("forge_list_functions");
    if (error) throw error;
    return data;
  }
  if (name === "explain_query") {
    const sql = assertReadonlySql(String(args.sql ?? ""));
    const { data, error } = await supabase.rpc("forge_explain", { q: sql });
    if (error) throw error;
    return data;
  }
  if (name === "run_readonly_sql") {
    const sql = assertReadonlySql(String(args.sql ?? ""));
    const { data, error } = await supabase.rpc("forge_readonly", { q: sql });
    if (error) throw error;
    return data;
  }
  if (name === "propose_rls") {
    const table = String(args.table ?? "").replace(/[^a-z0-9_]/gi, "");
    const intent = String(args.intent ?? "").slice(0, 500);
    const migration = `-- REVIEW BEFORE APPLYING\n-- intent: ${intent}\n\ncreate policy "${table}: member of org can select"\n  on public.${table} for select\n  using (org_id in (select public.my_org_ids()));\n`;
    return { applied: false, warning: "Draft only. Review tenant key and WITH CHECK.", table, intent, migration };
  }
  throw new Error(`unknown tool ${name}`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return json({ ok: true });
  let body: { jsonrpc?: string; id?: string | number; method?: string; params?: { name?: string; arguments?: Record<string, unknown> } };
  try { body = await req.json(); } catch { return json({ error: "invalid json" }, 400); }

  if (body.method === "tools/list") {
    return json({ jsonrpc: "2.0", id: body.id, result: { tools: TOOLS } });
  }
  if (body.method === "tools/call") {
    const name = body.params?.name as ToolName;
    if (!ALLOWED_TOOLS.includes(name)) {
      return json({ jsonrpc: "2.0", id: body.id, error: { code: -32601, message: `tool not allowed: ${name}` } });
    }
    try {
      const result = await callTool(name, body.params?.arguments ?? {}, req);
      return json({ jsonrpc: "2.0", id: body.id, result: { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] } });
    } catch (e) {
      return json({ jsonrpc: "2.0", id: body.id, error: { code: -32000, message: (e as Error).message } });
    }
  }
  return json({ jsonrpc: "2.0", id: body.id, error: { code: -32601, message: `unknown method ${body.method}` } });
});
