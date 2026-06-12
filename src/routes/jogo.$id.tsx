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

// Aceita: "URL", "Nome", "Nome, URL", "Nome - URL", "Nome (URL)"
function parseStreaming(valor: string | null): { nome: string; url: string | null } | null {
  if (!valor) return null;
  const txt = valor.trim();
  if (!txt) return null;
  const urlMatch = txt.match(/https?:\/\/[^\s,()]+/i);
  const url = urlMatch ? urlMatch[0] : null;
  let nome = url
    ? txt.replace(url, "").replace(/^[,\-–—()\s]+|[,\-–—()\s]+$/g, "").trim()
    : txt;
  if (!nome && url) {
    try {
      const host = new URL(url).hostname.replace(/^www\./, "");
      nome = host.endsWith("youtube.com") || host === "youtu.be" ? "CazéTV (YouTube)" : host;
    } catch { nome = "Streaming"; }
  }
  return { nome: nome || "Streaming", url };
}

function InfoStreaming({ valor }: { valor: string | null }) {
  const p = parseStreaming(valor);
  if (!p) return <Info label="▶ Streaming" valor={null} />;
  return (
    <div
      className="rounded-2xl p-4"
      style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}
    >
      <div className="text-xs text-muted-foreground">▶ Streaming</div>
      {p.url ? (
        <a
          href={p.url}
          target="_blank"
          rel="noreferrer"
          className="mt-1 font-semibold text-primary underline-offset-2 hover:underline break-words inline-block"
        >
          {p.nome}
        </a>
      ) : (
        <div className="mt-1 font-semibold break-words">{p.nome}</div>
      )}
    </div>
  );
}

function BotaoTransmissao({ url, status }: { url: string | null; status: string | null }) {
  const p = parseStreaming(url);
  if (!p?.url) return null;
  const ativo = status === "ao_vivo" || status === "intervalo";
  return (
    <a
      href={p.url}
      target="_blank"
      rel="noreferrer"
      className="block w-full text-center rounded-2xl py-4 font-bold border border-white/10 hover:bg-white/5"
    >
      {ativo ? `🔴 Assistir ao vivo · ${p.nome}` : `▶ Abrir ${p.nome}`}
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
