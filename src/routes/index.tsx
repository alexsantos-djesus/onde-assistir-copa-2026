import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase, type Jogo } from "../lib/supabase";
import { countdown, flagEmoji, formatData, formatHora } from "../lib/format";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Onde Assistir a Copa do Mundo 2026" },
      {
        name: "description",
        content: "Horários, canais, estádios e placar ao vivo da Copa do Mundo 2026.",
      },
    ],
  }),
  component: HomePage,
});

type Filtro = "todos" | "hoje" | "amanha" | "semana";
type Aba = "jogos" | "grupos";

function filtrar(jogos: Jogo[], f: Filtro): Jogo[] {
  if (f === "todos") return jogos;
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  let end = new Date(start);
  if (f === "hoje") end.setDate(end.getDate() + 1);
  else if (f === "amanha") {
    start.setDate(start.getDate() + 1);
    end = new Date(start);
    end.setDate(end.getDate() + 1);
  } else if (f === "semana") end.setDate(end.getDate() + 7);
  return jogos.filter((j) => {
    const t = new Date(j.data_hora).getTime();
    return t >= start.getTime() && t < end.getTime();
  });
}

type LinhaTabela = {
  time: string;
  bandeira: string | null;
  pj: number;
  v: number;
  e: number;
  d: number;
  gp: number;
  gc: number;
  sg: number;
  pts: number;
};

function extrairGrupo(fase: string | null): string | null {
  if (!fase) return null;
  const m = fase.match(/grupo\s*([a-l])/i);
  return m ? m[1].toUpperCase() : null;
}

function montarGrupos(
  jogos: Jogo[],
): Record<string, { jogos: Jogo[]; tabela: LinhaTabela[] }> {
  const grupos: Record<string, Jogo[]> = {};
  for (const j of jogos) {
    const g = extrairGrupo(j.fase);
    if (!g) continue;
    (grupos[g] ??= []).push(j);
  }
  const resultado: Record<string, { jogos: Jogo[]; tabela: LinhaTabela[] }> = {};
  for (const [g, lista] of Object.entries(grupos)) {
    const mapa = new Map<string, LinhaTabela>();
    const ensure = (nome: string, bandeira: string | null) => {
      let l = mapa.get(nome);
      if (!l) {
        l = { time: nome, bandeira, pj: 0, v: 0, e: 0, d: 0, gp: 0, gc: 0, sg: 0, pts: 0 };
        mapa.set(nome, l);
      } else if (!l.bandeira && bandeira) l.bandeira = bandeira;
      return l;
    };
    for (const j of lista) {
      const a = ensure(j.time_mandante, j.bandeira_mandante);
      const b = ensure(j.time_visitante, j.bandeira_visitante);
      if (
        j.status === "encerrado" &&
        j.placar_mandante != null &&
        j.placar_visitante != null
      ) {
        a.pj++; b.pj++;
        a.gp += j.placar_mandante; a.gc += j.placar_visitante;
        b.gp += j.placar_visitante; b.gc += j.placar_mandante;
        if (j.placar_mandante > j.placar_visitante) { a.v++; a.pts += 3; b.d++; }
        else if (j.placar_mandante < j.placar_visitante) { b.v++; b.pts += 3; a.d++; }
        else { a.e++; b.e++; a.pts++; b.pts++; }
      }
    }
    const tabela = [...mapa.values()].map((l) => ({ ...l, sg: l.gp - l.gc }));
    tabela.sort(
      (x, y) =>
        y.pts - x.pts ||
        y.sg - x.sg ||
        y.gp - x.gp ||
        x.time.localeCompare(y.time),
    );
    resultado[g] = {
      jogos: lista.sort(
        (x, y) => new Date(x.data_hora).getTime() - new Date(y.data_hora).getTime(),
      ),
      tabela,
    };
  }
  return resultado;
}

function HomePage() {
  const [aba, setAba] = useState<Aba>("jogos");
  const [filtro, setFiltro] = useState<Filtro>("hoje");
  const [busca, setBusca] = useState("");
  const [, tick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const { data, isLoading, error } = useQuery({
    queryKey: ["jogos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("jogos")
        .select("*")
        .order("data_hora", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Jogo[];
    },
  });

  const jogos = (data ?? []).filter((j) => {
    if (!busca.trim()) return true;
    const q = busca.toLowerCase();
    return (
      j.time_mandante.toLowerCase().includes(q) ||
      j.time_visitante.toLowerCase().includes(q)
    );
  });
  const visiveis = filtrar(jogos, filtro);
  const grupos = montarGrupos(jogos);
  const letrasGrupos = Object.keys(grupos).sort();

  return (
    <div
      className="min-h-screen text-foreground"
      style={{ background: "var(--gradient-pitch)" }}
    >
      <header className="px-4 pt-8 pb-4 max-w-3xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="text-3xl">⚽</div>
          <div>
            <h1 className="text-2xl font-bold leading-tight">Onde Assistir a Copa</h1>
            <p className="text-sm text-muted-foreground">
              Copa do Mundo 2026 · horários, estádios e placar.
            </p>
          </div>
        </div>

        <div
          className="mt-5 grid grid-cols-2 rounded-xl p-1 text-sm font-medium"
          style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}
        >
          {(["jogos", "grupos"] as Aba[]).map((a) => (
            <button
              key={a}
              onClick={() => setAba(a)}
              className={`py-2 rounded-lg transition ${
                aba === a ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              }`}
            >
              {a === "jogos" ? "Jogos" : "Grupos"}
            </button>
          ))}
        </div>

        {aba === "jogos" && (
          <>
            <input
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar seleção..."
              className="mt-4 w-full rounded-xl px-4 py-3 text-base outline-none focus:ring-2 focus:ring-primary"
              style={{
                background: "var(--glass-bg)",
                border: "1px solid var(--glass-border)",
                backdropFilter: "blur(8px)",
              }}
            />
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {(["hoje", "amanha", "semana", "todos"] as Filtro[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setFiltro(f)}
                  className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition ${
                    filtro === f
                      ? "bg-primary text-primary-foreground"
                      : "bg-card/60 text-foreground border border-white/10"
                  }`}
                >
                  {f === "hoje"
                    ? "Hoje"
                    : f === "amanha"
                      ? "Amanhã"
                      : f === "semana"
                        ? "Semana"
                        : "Todos"}
                </button>
              ))}
            </div>
          </>
        )}
      </header>

      <main className="px-4 pb-24 max-w-3xl mx-auto space-y-3">
        {isLoading && <SkeletonList />}
        {error && (
          <div className="rounded-xl p-4 bg-destructive/20 text-sm">
            Erro ao carregar jogos: {(error as Error).message}
          </div>
        )}

        {!isLoading && !error && aba === "jogos" && (
          <>
            {visiveis.length === 0 && (
              <div
                className="rounded-2xl p-8 text-center text-muted-foreground"
                style={{
                  background: "var(--glass-bg)",
                  border: "1px solid var(--glass-border)",
                }}
              >
                {data && data.length === 0
                  ? "Nenhum jogo disponível ainda."
                  : "Nenhum jogo nesse filtro."}
              </div>
            )}
            {visiveis.map((j) => (
              <JogoCard key={j.id} jogo={j} />
            ))}
          </>
        )}

        {!isLoading && !error && aba === "grupos" && (
          <>
            {letrasGrupos.length === 0 && (
              <div
                className="rounded-2xl p-8 text-center text-muted-foreground"
                style={{
                  background: "var(--glass-bg)",
                  border: "1px solid var(--glass-border)",
                }}
              >
                Nenhum grupo cadastrado ainda.
              </div>
            )}
            {letrasGrupos.map((g) => (
              <GrupoCard key={g} letra={g} dados={grupos[g]} />
            ))}
          </>
        )}
      </main>
    </div>
  );
}

function GrupoCard({
  letra,
  dados,
}: {
  letra: string;
  dados: { jogos: Jogo[]; tabela: LinhaTabela[] };
}) {
  return (
    <section
      className="rounded-2xl p-4"
      style={{
        background: "var(--glass-bg)",
        border: "1px solid var(--glass-border)",
        backdropFilter: "blur(8px)",
      }}
    >
      <h2 className="text-lg font-bold mb-3">Grupo {letra}</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-muted-foreground text-xs">
            <tr className="text-left">
              <th className="py-1 pr-2">#</th>
              <th className="py-1 pr-2">Seleção</th>
              <th className="py-1 px-1 text-center">PJ</th>
              <th className="py-1 px-1 text-center">V</th>
              <th className="py-1 px-1 text-center">E</th>
              <th className="py-1 px-1 text-center">D</th>
              <th className="py-1 px-1 text-center">SG</th>
              <th className="py-1 pl-1 text-center font-semibold">PTS</th>
            </tr>
          </thead>
          <tbody>
            {dados.tabela.map((l, i) => (
              <tr key={l.time} className="border-t border-white/5">
                <td className="py-1.5 pr-2 text-muted-foreground">{i + 1}</td>
                <td className="py-1.5 pr-2">
                  <span className="flex items-center gap-1.5">
                    <span className="text-base">{flagEmoji(l.bandeira)}</span>
                    <span className="font-medium">{l.time}</span>
                  </span>
                </td>
                <td className="py-1.5 px-1 text-center">{l.pj}</td>
                <td className="py-1.5 px-1 text-center">{l.v}</td>
                <td className="py-1.5 px-1 text-center">{l.e}</td>
                <td className="py-1.5 px-1 text-center">{l.d}</td>
                <td className="py-1.5 px-1 text-center">
                  {l.sg > 0 ? `+${l.sg}` : l.sg}
                </td>
                <td className="py-1.5 pl-1 text-center font-bold">{l.pts}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 space-y-2">
        {dados.jogos.map((j) => (
          <Link
            key={j.id}
            to="/jogo/$id"
            params={{ id: j.id }}
            className="flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm border border-white/5 hover:bg-white/5 transition"
          >
            <span className="text-xs text-muted-foreground w-20 shrink-0">
              {formatData(j.data_hora)}
            </span>
            <span className="flex-1 text-right truncate">
              {flagEmoji(j.bandeira_mandante)} {j.time_mandante}
            </span>
            <span className="font-bold min-w-12 text-center">
              {j.placar_mandante != null && j.placar_visitante != null
                ? `${j.placar_mandante} × ${j.placar_visitante}`
                : formatHora(j.data_hora)}
            </span>
            <span className="flex-1 truncate">
              {j.time_visitante} {flagEmoji(j.bandeira_visitante)}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function SkeletonList() {
  return (
    <>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="h-28 rounded-2xl animate-pulse"
          style={{ background: "var(--glass-bg)" }}
        />
      ))}
    </>
  );
}

function StatusBadge({ status }: { status: string | null }) {
  if (status === "ao_vivo")
    return (
      <span className="text-xs px-2 py-1 rounded-full bg-destructive text-destructive-foreground font-semibold flex items-center gap-1">
        <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
        AO VIVO
      </span>
    );
  if (status === "encerrado")
    return (
      <span className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground font-medium">
        Encerrado
      </span>
    );
  return null;
}

function JogoCard({ jogo }: { jogo: Jogo }) {
  const ended = jogo.status === "encerrado";
  return (
    <Link
      to="/jogo/$id"
      params={{ id: jogo.id }}
      className="block rounded-2xl p-4 transition hover:scale-[1.01] active:scale-[0.99]"
      style={{
        background: "var(--glass-bg)",
        border: "1px solid var(--glass-border)",
        backdropFilter: "blur(8px)",
      }}
    >
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {formatData(jogo.data_hora)} · {formatHora(jogo.data_hora)}
        </span>
        <div className="flex items-center gap-2">
          <StatusBadge status={jogo.status} />
          {!ended && jogo.status !== "ao_vivo" && (
            <span className="text-primary font-medium">{countdown(jogo.data_hora)}</span>
          )}
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <Time nome={jogo.time_mandante} logo={jogo.bandeira_mandante} />
        <div className="text-center min-w-16">
          {jogo.placar_mandante != null && jogo.placar_visitante != null ? (
            <div className="text-2xl font-bold">
              {jogo.placar_mandante} <span className="text-muted-foreground">×</span>{" "}
              {jogo.placar_visitante}
            </div>
          ) : (
            <div className="text-lg font-bold text-muted-foreground">×</div>
          )}
          {jogo.fase && (
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground mt-1">
              {jogo.fase}
            </div>
          )}
        </div>
        <Time nome={jogo.time_visitante} logo={jogo.bandeira_visitante} alinhar="right" />
      </div>

      {jogo.estadio && (
        <div className="mt-3 text-xs text-muted-foreground">
          🏟 {jogo.estadio}
          {jogo.cidade ? ` · ${jogo.cidade}` : ""}
        </div>
      )}
    </Link>
  );
}

function Time({
  nome,
  logo,
  alinhar = "left",
}: {
  nome: string;
  logo: string | null;
  alinhar?: "left" | "right";
}) {
  return (
    <div
      className={`flex-1 flex items-center gap-2 ${
        alinhar === "right" ? "flex-row-reverse text-right" : ""
      }`}
    >
      {logo && /^https?:\/\//.test(logo) ? (
        <img src={logo} alt={nome} className="w-10 h-10 object-contain" loading="lazy" />
      ) : (
        <div className="text-3xl leading-none">{flagEmoji(logo)}</div>
      )}
      <div className="font-semibold leading-tight">{nome}</div>
    </div>
  );
}
