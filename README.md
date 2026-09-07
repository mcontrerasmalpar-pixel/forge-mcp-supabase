# Forge

MCP server + assistant de debugging sobre **Supabase Edge Functions**.

El agente lista schema, explica planes SQL, propone politicas RLS y corre queries de **solo lectura** respetando el JWT del usuario. Nada de `service_role` en el cliente.

## Que demuestra

- MCP hospedado en Edge Functions (Deno)
- Tools con allowlist (sin DDL destructivo)
- RLS como autorizacion, no checks en el frontend
- Assistant UI con tool trace
- Harness de evals en `evals/`
- Skill para agentes en `skills/supabase-rls.md`

## Arquitectura

```
Cursor / Assistant UI
        |  MCP JSON-RPC
        v
Edge Function  mcp-server
        |  user JWT -> Postgres + RLS
        v
Postgres
```

El LLM (Azure OpenAI mini u otro) solo vive en `chat`. El MCP no habla con el modelo: expone tools.

## Setup

```bash
git clone https://github.com/mcontrerasmalpar-pixel/forge-mcp-supabase.git
cd forge-mcp-supabase

npx supabase start
npx supabase db reset

npx supabase secrets set AZURE_OPENAI_ENDPOINT=https://YOUR.openai.azure.com
npx supabase secrets set AZURE_OPENAI_API_KEY=...
npx supabase secrets set AZURE_OPENAI_DEPLOYMENT=gpt-4o-mini

cd apps/web
cp .env.example .env.local
npm install
npm run dev
```

Cursor: copia `.cursor/mcp.json.example` a `.cursor/mcp.json`.

## Tools

| Tool | Guardrail |
|---|---|
| list_tables | catalog only |
| list_policies | read only |
| list_functions | read only |
| explain_query | blocks writes |
| propose_rls | draft, does not apply |
| run_readonly_sql | SELECT/WITH/EXPLAIN + read-only txn |

## Seguridad

1. Cliente: anon key + user JWT.
2. `run_readonly_sql` rechaza INSERT/UPDATE/DELETE/DROP/ALTER.
3. `propose_rls` no aplica migraciones.
4. Rate limit 40 tools/min por `auth.uid()`.

```bash
npm run evals
```

MIT
