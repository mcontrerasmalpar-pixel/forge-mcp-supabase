"use client";

import { useMemo, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

type Msg = { role: "user" | "assistant"; content: string; trace?: unknown };

export default function Page() {
  const supabase = useMemo(
    () =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      ),
    [],
  );

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [input, setInput] = useState("Lista las tablas y las politicas RLS.");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [busy, setBusy] = useState(false);
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      const { error: sErr } = await supabase.auth.signUp({ email, password });
      if (sErr) return alert(sErr.message);
    }
    const { data } = await supabase.auth.getUser();
    setSessionEmail(data.user?.email ?? null);
  }

  async function send() {
    setBusy(true);
    const next = [...msgs, { role: "user" as const, content: input }];
    setMsgs(next);
    setInput("");
    const { data: session } = await supabase.auth.getSession();
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/chat`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.session?.access_token}`,
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        },
        body: JSON.stringify({ messages: next }),
      },
    );
    const json = await res.json();
    setMsgs([
      ...next,
      {
        role: "assistant",
        content: json.content ?? JSON.stringify(json),
        trace: json.trace,
      },
    ]);
    setBusy(false);
  }

  return (
    <main style={{ maxWidth: 860, margin: "0 auto", padding: 24 }}>
      <h1 style={{ fontSize: 28, letterSpacing: -0.4 }}>Forge</h1>
      <p style={{ color: "#9bb0c4" }}>
        Assistant de debugging sobre MCP + RLS. Las tools no aplican migraciones solas.
      </p>

      {!sessionEmail ? (
        <form onSubmit={signIn} style={{ display: "grid", gap: 8, maxWidth: 360 }}>
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email" />
          <input
            value={password}
            type="password"
            onChange={(e) => setPassword(e.target.value)}
            placeholder="password"
          />
          <button type="submit">Entrar / registrar</button>
        </form>
      ) : (
        <p style={{ color: "#7ddea0" }}>sesion: {sessionEmail}</p>
      )}

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
            {m.trace ? (
              <details style={{ marginTop: 8, color: "#9bb0c4" }}>
                <summary>tool trace</summary>
                <pre>{JSON.stringify(m.trace, null, 2)}</pre>
              </details>
            ) : null}
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
