"use client";

import { useMemo, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

type Msg = { role: "user" | "assistant"; content: string; trace?: unknown };

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export default function Page() {
  const supabase = useMemo(
    () => createBrowserClient(supabaseUrl, supabaseKey),
    [],
  );

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [input, setInput] = useState("Cuantos documents puedo ver y cuales son sus titulos?");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [busy, setBusy] = useState(false);
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [demoHint, setDemoHint] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!supabaseUrl || !supabaseKey) {
      setErr("Falta NEXT_PUBLIC_SUPABASE_URL o ANON_KEY. Revisa .env.local y reinicia npm run dev.");
      return;
    }
    const { error: inErr } = await supabase.auth.signInWithPassword({ email, password });
    if (!inErr) {
      const { data } = await supabase.auth.getUser();
      setSessionEmail(data.user?.email ?? null);
      return;
    }
    const { error: sErr } = await supabase.auth.signUp({ email, password });
    if (sErr) {
      setErr(`${sErr.message} (signin: ${inErr.message})`);
      return;
    }
    const { data } = await supabase.auth.getUser();
    setSessionEmail(data.user?.email ?? email);
  }

  async function loadDemo() {
    const { data, error } = await supabase.rpc("forge_bootstrap_demo");
    if (error) return setErr(error.message);
    setDemoHint(JSON.stringify(data, null, 2));
  }

  async function send() {
    setBusy(true);
    setErr(null);
    const next = [...msgs, { role: "user" as const, content: input }];
    setMsgs(next);
    setInput("");
    const { data: session } = await supabase.auth.getSession();
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.session?.access_token}`,
          apikey: supabaseKey,
        },
        body: JSON.stringify({ messages: next }),
      });
      const json = await res.json();
      setMsgs([
        ...next,
        { role: "assistant", content: json.content ?? JSON.stringify(json), trace: json.trace },
      ]);
    } catch (e) {
      setErr(`chat fetch: ${(e as Error).message}`);
    }
    setBusy(false);
  }

  return (
    <main style={{ maxWidth: 860, margin: "0 auto", padding: 24 }}>
      <h1 style={{ fontSize: 28, letterSpacing: -0.4 }}>Forge</h1>
      <p style={{ color: "#9bb0c4" }}>
        Assistant de debugging sobre MCP + RLS. URL: {supabaseUrl || "(vacía)"} · key:{" "}
        {supabaseKey ? `${supabaseKey.slice(0, 18)}…` : "(vacía)"}
      </p>

      {err ? (
        <p style={{ color: "#ff8b8b", whiteSpace: "pre-wrap" }}>{err}</p>
      ) : null}

      {!sessionEmail ? (
        <form onSubmit={signIn} style={{ display: "grid", gap: 8, maxWidth: 360 }}>
          <input
            id="email"
            name="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email"
          />
          <input
            id="password"
            name="password"
            autoComplete="current-password"
            value={password}
            type="password"
            onChange={(e) => setPassword(e.target.value)}
            placeholder="password"
          />
          <button type="submit">Entrar / registrar</button>
        </form>
      ) : (
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <p style={{ color: "#7ddea0" }}>sesion: {sessionEmail}</p>
          <button type="button" onClick={loadDemo}>
            Cargar demo RLS
          </button>
        </div>
      )}

      {demoHint ? (
        <pre style={{ background: "#12181f", padding: 12, borderRadius: 8, color: "#9bb0c4" }}>
          {demoHint}
        </pre>
      ) : null}

      <section style={{ marginTop: 24, display: "grid", gap: 12 }}>
        {msgs.map((m, i) => (
          <article
            key={i}
            style={{
              background: m.role === "user" ? "#15202b" : "#12181f",
              border: "1px solid #243140",
              borderRadius: 12,
              padding: 14,
              whiteSpace: "pre-wrap",
            }}
          >
            <strong>{m.role}</strong>
            <div>{m.content}</div>
          </article>
        ))}
      </section>

      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          style={{ flex: 1 }}
          placeholder="Pregunta al assistant"
        />
        <button disabled={busy || !sessionEmail} onClick={send}>
          {busy ? "..." : "Enviar"}
        </button>
      </div>
    </main>
  );
}
