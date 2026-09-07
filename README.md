# Forge

MCP server + assistant de debugging sobre **Supabase Edge Functions**.

El agente lista schema, explica planes SQL, propone politicas RLS y corre queries de **solo lectura** respetando el JWT del usuario. Nada de `service_role` en el cliente.

Proyecto hosted: [HOSTED.md](./HOSTED.md)  
Repo: https://github.com/mcontrerasmalpar-pixel/forge-mcp-supabase

## Que demuestra (senal para Supabase / AI tooling)

- MCP hospedado en Edge Functions (Deno)
- Tools con allowlist (sin DDL destructivo)
- **RLS como autorizacion** (no checks en el frontend)
- Demo multi-tenant: org visible `acme-alpha` vs oculta `beta-shadow`
- Assistant UI con sesion JWT y boton **Cargar demo RLS**
- LLM del chat **opcional** (Azure OpenAI u otro); el MCP funciona sin el

## Arquitectura

```
Cursor / Assistant UI
        |  MCP JSON-RPC  (user JWT)
        v
Edge Function  mcp-server
        |  Postgres + RLS
        v
Postgres
```

La function `chat` solo orquesta un LLM + tool calls. Si no hay API de modelo configurada, responde que uses el MCP directo (Cursor).

## Demo hosted (sin Azure)

1. Crea proyecto Supabase y linkea este repo (o `supabase db push` + `functions deploy`).
2. `apps/web/.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...   # legacy anon o publishable
```

3. `cd apps/web && npm install && npm run dev`
4. Desactiva **Confirm email** en Auth → Providers → Email.
5. **Solo entrar** → debe decir `JWT: si`.
6. **Cargar demo RLS** → JSON con `your_org: acme-alpha` y `hidden_org: beta-shadow`.

Con eso ya demuestras multi-tenant + RLS + bootstrap. El chat en la UI es extra.

## MCP desde Cursor (sin Azure)

Copia `.cursor/mcp.json.example` a `.cursor/mcp.json` y apunta a tu function:

```json
{
  "mcpServers": {
    "forge": {
      "url": "https://YOUR_REF.supabase.co/functions/v1/mcp-server",
      "headers": {
        "Authorization": "Bearer USER_JWT",
        "apikey": "SUPABASE_ANON_KEY"
      }
    }
  }
}
```

El `USER_JWT` es el `access_token` de una sesion iniciada (mismo usuario de la demo). Las tools heredan RLS de ese JWT.

## Tools

| Tool | Guardrail |
|---|---|
| list_tables | catalog only |
| list_policies | read only |
| list_functions | read only |
| explain_query | blocks writes |
| propose_rls | draft, does not apply |
| run_readonly_sql | SELECT/WITH/EXPLAIN + read-only txn |

## LLM opcional (Azure u otro)

Azure for Students a menudo tiene **cuota 0** en modelos OpenAI; no es bloqueante.

Si mas adelante tienes endpoint + key:

```bash
npx supabase secrets set AZURE_OPENAI_ENDPOINT=https://YOUR.openai.azure.com
npx supabase secrets set AZURE_OPENAI_API_KEY=...
npx supabase secrets set AZURE_OPENAI_DEPLOYMENT=gpt-4o-mini
npx supabase functions deploy chat --project-ref YOUR_REF
```

Sin secrets, `chat` responde que uses MCP desde Cursor.

## Seguridad

1. Cliente: anon/publishable key + user JWT.
2. `run_readonly_sql` rechaza INSERT/UPDATE/DELETE/DROP/ALTER.
3. `propose_rls` no aplica migraciones.
4. Rate limit por `auth.uid()` en el servidor MCP.

```bash
npm run evals
```

MIT
