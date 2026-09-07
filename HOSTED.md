# Enganchar Forge a un proyecto hosted de Supabase

1. Crea un proyecto en https://supabase.com/dashboard (region cerca de Lima: `sa-east-1` si esta disponible, si no `us-east-1`).
2. En el repo:

```bash
npx supabase link --project-ref YOUR_REF
npx supabase db push
npx supabase functions deploy mcp-server
npx supabase functions deploy chat
```

3. Secrets (chat / Azure, opcional):

```bash
npx supabase secrets set AZURE_OPENAI_ENDPOINT=https://YOUR.openai.azure.com
npx supabase secrets set AZURE_OPENAI_API_KEY=...
npx supabase secrets set AZURE_OPENAI_DEPLOYMENT=gpt-4o-mini
```

4. `apps/web/.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

5. En la UI: registrate y pulsa **Cargar demo RLS**.
   Eso te mete en `acme-alpha` y crea docs en `beta-shadow` que no debes ver.

6. Prueba en el assistant:

- `Lista las politicas RLS`
- `Cuantos documents puedo ver?`
- `SELECT title FROM documents` via tool
- `DROP TABLE documents` — debe rechazarse

Auth: Authentication > Providers > Email enabled. Desactiva "Confirm email" mientras demos.
