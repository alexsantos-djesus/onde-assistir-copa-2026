import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase, type Jogo } from "../lib/supabase";
import { countdown, formatData, formatHora } from "../lib/format";
import { Bandeira } from "../components/Bandeira";

export const Route = createFileRoute("/jogo/$id")({
  component: JogoPage,
  notFoundComponent: () => (
    <div className="min-h-screen flex items-center justify-center text-foreground">
      Jogo não encontrado.
    </div>
  ),
  errorComponent: ({ error }) => (
    <div className="min-h-screen flex items-center justify-center text-foreground p-6">
      {error.message}
    </div>
  ),
});

function JogoPage() {
  const { id } = Route.useParams();
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  const { data, isLoading, error } = useQuery({
    queryKey: ["jogo", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("jogos")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw notFound();
      return data as Jogo;
    },
  });

  if (isLoading)
    return (
      <div
        className="min-h-screen p-6"
        style={{ background: "var(--gradient-pitch)" }}
      >
        <div className="h-64 rounded-2xl animate-pulse bg-card/60" />
      </div>
    );
  if (error || !data)
    return (
      <div className="min-h-screen flex items-center justify-center text-foreground p-6">
        {(error as Error)?.message ?? "Erro"}
      </div>
    );

  const j = data;
  const shareText = `Veja onde assistir ${j.time_mandante} x ${j.time_visitante} ${formatData(
    j.data_hora,
  )} às ${formatHora(j.data_hora)}: ${typeof window !== "undefined" ? window.location.href : ""}`;
  const waUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;

  return (
    <div
      className="min-h-screen text-foreground"
      style={{ background: "var(--gradient-pitch)" }}
    >
      <header className="px-4 pt-6 max-w-2xl mx-auto">
        <Link
          to="/"
          className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
        >
          ← Voltar
        </Link>
      </header>

      <main className="px-4 py-6 max-w-2xl mx-auto space-y-5">
        <section
          className="rounded-3xl p-6 text-center"
          style={{
            background: "var(--glass-bg)",
            border: "1px solid var(--glass-border)",
            backdropFilter: "blur(12px)",
          }}
        >
          {j.fase && (
            <div className="text-xs uppercase tracking-wider text-accent mb-1">
              {j.fase}
            </div>
          )}
          <div className="text-sm text-muted-foreground">
            {formatData(j.data_hora)} · {formatHora(j.data_hora)}
          </div>
          {j.status === "agendado" && (
            <div className="text-primary font-semibold mt-1">
              {countdown(j.data_hora)}
            </div>
          )}
          {j.status === "ao_vivo" && (
            <div className="inline-flex items-center gap-2 mt-2 px-3 py-1 rounded-full bg-destructive text-destructive-foreground text-sm font-bold">
              <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
              AO VIVO
            </div>
          )}

          <div className="mt-6 flex items-center justify-around gap-3">
            <TimeBig nome={j.time_mandante} logo={j.bandeira_mandante} />
            <div className="text-center">
              {j.placar_mandante != null && j.placar_visitante != null ? (
                <div className="text-4xl font-bold">
                  {j.placar_mandante}
                  <span className="text-muted-foreground mx-2">×</span>
                  {j.placar_visitante}
                </div>
              ) : (
                <div className="text-3xl text-muted-foreground">×</div>
              )}
            </div>
            <TimeBig nome={j.time_visitante} logo={j.bandeira_visitante} />
          </div>
        </section>

        <section className="grid grid-cols-2 gap-3">
          <Info label="📺 TV" valor={j.canal_tv} />
          <InfoStreaming valor={j.streaming} />
          <Info label="🏟 Estádio" valor={j.estadio} />
          <Info label="📍 Cidade" valor={j.cidade} />
        </section>

        <BotaoTransmissao url={j.streaming} status={j.status} />





        <a
          href={waUrl}
          target="_blank"
          rel="noreferrer"
          className="block w-full text-center rounded-2xl py-4 font-bold text-primary-foreground"
          style={{ background: "var(--primary)" }}
        >
          Compartilhar no WhatsApp
        </a>
      </main>
    </div>
  );
}

function isHttpUrl(s: string | null): s is string {
  if (!s) return false;
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch { return false; }
}

// Formato salvo: "Label|URL"  (ex.: "GloboPlay, CazéTV|https://...")
// Compat: "Nome, URL" ou só URL ou só texto.
function parseStreaming(valor: string | null): { label: string; url: string | null } | null {
  if (!valor) return null;
  const txt = valor.trim();
  if (!txt) return null;
  const idx = txt.indexOf("|");
  if (idx >= 0) {
    const label = txt.slice(0, idx).trim();
    const url = txt.slice(idx + 1).trim();
    return { label: label || (url ? "Streaming" : ""), url: url || null };
  }
  const m = txt.match(/https?:\/\/\S+/i);
  if (m) {
    const url = m[0];
    const label = txt.replace(url, "").replace(/^[,\-–—()\s]+|[,\-–—()\s]+$/g, "").trim();
    return { label: label || "Streaming", url };
  }
  return { label: txt, url: null };
}

function InfoStreaming({ valor }: { valor: string | null }) {
  const p = parseStreaming(valor);
  if (!p) return <Info label="▶ Streaming" valor={null} />;
  // Divide o label por vírgula. Se houver URL, o último item vira clicável.
  const partes = p.label.split(",").map((s) => s.trim()).filter(Boolean);
  return (
    <div
      className="rounded-2xl p-4"
      style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}
    >
      <div className="text-xs text-muted-foreground">▶ Streaming</div>
      <div className="mt-1 font-semibold break-words">
        {partes.length === 0 && p.url ? (
          <a href={p.url} target="_blank" rel="noreferrer" className="text-primary hover:underline">
            Assistir
          </a>
        ) : (
          partes.map((parte, i) => {
            const isUltimo = i === partes.length - 1;
            const sep = i > 0 ? ", " : "";
            if (isUltimo && p.url) {
              return (
                <span key={i}>
                  {sep}
                  <a
                    href={p.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary hover:underline"
                  >
                    {parte}
                  </a>
                </span>
              );
            }
            return <span key={i}>{sep}{parte}</span>;
          })
        )}
      </div>
    </div>
  );
}

function BotaoTransmissao({ url, status }: { url: string | null; status: string | null }) {
  const p = parseStreaming(url);
  if (!p?.url) return null;
  const partes = p.label.split(",").map((s) => s.trim()).filter(Boolean);
  const nome = partes[partes.length - 1] || "transmissão";
  const ativo = status === "ao_vivo" || status === "intervalo";
  return (
    <a
      href={p.url}
      target="_blank"
      rel="noreferrer"
      className="block w-full text-center rounded-2xl py-4 font-bold border border-white/10 hover:bg-white/5"
    >
      {ativo ? `🔴 Assistir ao vivo · ${nome}` : `▶ Abrir ${nome}`}
    </a>
  );
}


function TimeBig({ nome, logo }: { nome: string; logo: string | null }) {
  return (
    <div className="flex-1 flex flex-col items-center gap-2">
      <Bandeira code={logo} size={72} />
      <div className="mt-1 font-bold">{nome}</div>
    </div>
  );
}


function Info({ label, valor }: { label: string; valor: string | null }) {
  return (
    <div
      className="rounded-2xl p-4"
      style={{
        background: "var(--glass-bg)",
        border: "1px solid var(--glass-border)",
      }}
    >
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 font-semibold">{valor ?? "—"}</div>
    </div>
  );
}
