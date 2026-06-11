import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { supabase, type Jogo } from "../lib/supabase";
import { countdown, formatData, formatHora } from "../lib/format";
import { Bandeira } from "../components/Bandeira";

function normalizar(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

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
type Aba = "jogos" | "grupos" | "mata";

// Duração estimada de uma partida (jogo + acréscimos + intervalo)
const DURACAO_JOGO_MS = 1000 * 60 * 60 * 3;

function comStatusEfetivo(j: Jogo): Jogo {
  if (j.status === "agendado") {
    const inicio = new Date(j.data_hora).getTime();
    const agora = Date.now();
    if (agora >= inicio && agora < inicio + DURACAO_JOGO_MS) {
      return { ...j, status: "ao_vivo" };
    }
  }
  return j;
}

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

    // Confronto direto entre dois times empatados
    const confrontoDireto = (x: LinhaTabela, y: LinhaTabela): number => {
      let sx = 0, sy = 0;
      for (const j of lista) {
        if (
          j.status !== "encerrado" ||
          j.placar_mandante == null ||
          j.placar_visitante == null
        ) continue;
        if (j.time_mandante === x.time && j.time_visitante === y.time) {
          if (j.placar_mandante > j.placar_visitante) sx += 3;
          else if (j.placar_mandante < j.placar_visitante) sy += 3;
          else { sx++; sy++; }
        } else if (j.time_mandante === y.time && j.time_visitante === x.time) {
          if (j.placar_mandante > j.placar_visitante) sy += 3;
          else if (j.placar_mandante < j.placar_visitante) sx += 3;
          else { sx++; sy++; }
        }
      }
      return sy - sx;
    };

    // Critérios FIFA: PTS → SG → GP → confronto direto → menos GC → nome
    tabela.sort(
      (x, y) =>
        y.pts - x.pts ||
        y.sg - x.sg ||
        y.gp - x.gp ||
        confrontoDireto(x, y) ||
        x.gc - y.gc ||
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
  const [grupoSel, setGrupoSel] = useState<string | "todos">("todos");
  const [faseSel, setFaseSel] = useState<string>("todas");
  const [statusSel, setStatusSel] = useState<"todos" | "ao_vivo" | "agendado" | "encerrado">("todos");
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
      return ((data ?? []) as Jogo[]).map(comStatusEfetivo);
    },
  });

  const jogos = (data ?? []).filter((j) => {
    if (busca.trim()) {
      const q = normalizar(busca);
      const campos = [
        j.time_mandante,
        j.time_visitante,
        j.bandeira_mandante ?? "",
        j.bandeira_visitante ?? "",
        j.fase ?? "",
        j.estadio ?? "",
        j.cidade ?? "",
        j.canal_tv ?? "",
      ];
      if (!campos.some((c) => normalizar(c).includes(q))) return false;
    }
    if (statusSel !== "todos" && j.status !== statusSel) return false;
    if (faseSel !== "todas") {
      const f = normalizar(j.fase ?? "");
      if (faseSel === "grupos" && !f.includes("grupo")) return false;
      if (faseSel === "oitavas" && !f.includes("oitava")) return false;
      if (faseSel === "quartas" && !f.includes("quart")) return false;
      if (faseSel === "semi" && !f.includes("semi")) return false;
      if (faseSel === "final" && !(f === "final" || f.includes("3") || f.includes("terceiro"))) return false;
    }
    return true;
  });
  const visiveis = filtrar(jogos, filtro);
  const grupos = montarGrupos(data ?? []);
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
          className="mt-5 grid grid-cols-3 rounded-xl p-1 text-sm font-medium"
          style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}
        >
          {(["jogos", "grupos", "mata"] as Aba[]).map((a) => (
            <button
              key={a}
              onClick={() => setAba(a)}
              className={`py-2 rounded-lg transition ${
                aba === a ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              }`}
            >
              {a === "jogos" ? "Jogos" : a === "grupos" ? "Grupos" : "Mata-mata"}
            </button>
          ))}
        </div>


        {aba === "jogos" && (
          <>
            <input
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por seleção, fase, estádio, canal..."
              className="mt-4 w-full rounded-xl px-4 py-3 text-base outline-none focus:ring-2 focus:ring-primary"
              style={{
                background: "var(--glass-bg)",
                border: "1px solid var(--glass-border)",
                backdropFilter: "blur(8px)",
              }}
            />

            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {(["hoje", "amanha", "semana", "todos"] as Filtro[]).map((f) => (
                <Chip
                  key={f}
                  ativo={filtro === f}
                  onClick={() => setFiltro(f)}
                  label={f === "hoje" ? "Hoje" : f === "amanha" ? "Amanhã" : f === "semana" ? "Semana" : "Todos"}
                />
              ))}
            </div>

            <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
              {(
                [
                  ["todos", "Todos status"],
                  ["ao_vivo", "🔴 Ao vivo"],
                  ["agendado", "Agendados"],
                  ["encerrado", "Encerrados"],
                ] as const
              ).map(([v, lab]) => (
                <Chip key={v} ativo={statusSel === v} onClick={() => setStatusSel(v)} label={lab} />
              ))}
            </div>

            <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
              {(
                [
                  ["todas", "Todas fases"],
                  ["grupos", "Fase de grupos"],
                  ["oitavas", "Oitavas"],
                  ["quartas", "Quartas"],
                  ["semi", "Semifinal"],
                  ["final", "Final / 3º"],
                ] as const
              ).map(([v, lab]) => (
                <Chip key={v} ativo={faseSel === v} onClick={() => setFaseSel(v)} label={lab} />
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
            {letrasGrupos.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                <button
                  onClick={() => setGrupoSel("todos")}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition ${
                    grupoSel === "todos"
                      ? "bg-primary text-primary-foreground"
                      : "bg-card/60 text-foreground border border-white/10"
                  }`}
                >
                  Todos
                </button>
                {letrasGrupos.map((g) => (
                  <button
                    key={g}
                    onClick={() => setGrupoSel(g)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition ${
                      grupoSel === g
                        ? "bg-primary text-primary-foreground"
                        : "bg-card/60 text-foreground border border-white/10"
                    }`}
                  >
                    Grupo {g}
                  </button>
                ))}
              </div>
            )}
            {letrasGrupos
              .filter((g) => grupoSel === "todos" || g === grupoSel)
              .map((g) => (
                <GrupoCard key={g} letra={g} dados={grupos[g]} />
              ))}
          </>
        )}

        {!isLoading && !error && aba === "mata" && <MataMata jogos={jogos} />}



        <Rodape jogos={jogos} />
      </main>
    </div>
  );
}

type FaseDef = { key: string; label: string; match: (f: string) => boolean };

const FASES_LADO: FaseDef[] = [
  {
    key: "segunda",
    label: "Segunda Fase",
    match: (f) => /segunda|round of 32|32-?avos|playoff/i.test(f),
  },
  { key: "oitavas", label: "Oitavas de Final", match: (f) => /oitava|round of 16|16-?avos/i.test(f) },
  { key: "quartas", label: "Quartas de Final", match: (f) => /quart/i.test(f) },
  { key: "semi", label: "Semifinal", match: (f) => /semi/i.test(f) },
];

function MataMata({ jogos }: { jogos: Jogo[] }) {
  const filtrarFase = (m: (f: string) => boolean) =>
    jogos
      .filter((j) => j.fase && m(j.fase))
      .sort((a, b) => new Date(a.data_hora).getTime() - new Date(b.data_hora).getTime());

  const ladoDireitoFases = FASES_LADO.map((fase) => {
    const lista = filtrarFase(fase.match);
    const meio = Math.ceil(lista.length / 2);
    return {
      ...fase,
      esquerda: lista.slice(0, meio),
      direita: lista.slice(meio),
    };
  });

  const finais = filtrarFase((f) => /^final$|^grande final/i.test(f));
  const terceiros = filtrarFase((f) => /terceiro|3.*lugar/i.test(f));

  const temAlgum =
    ladoDireitoFases.some((f) => f.esquerda.length + f.direita.length > 0) ||
    finais.length + terceiros.length > 0;

  if (!temAlgum) {
    return (
      <div
        className="rounded-2xl p-8 text-center text-muted-foreground"
        style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}
      >
        O chaveamento será preenchido após o término da fase de grupos.
      </div>
    );
  }

  // Esconde colunas (Segunda/Oitavas/etc) totalmente vazias
  const colunasVisiveis = ladoDireitoFases.filter(
    (f) => f.esquerda.length + f.direita.length > 0,
  );

  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; left: number; top: number; moved: boolean } | null>(null);
  const [arrastando, setArrastando] = useState(false);

  const onDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse") return;
    const el = ref.current;
    if (!el) return;
    drag.current = { x: e.clientX, y: e.clientY, left: el.scrollLeft, top: el.scrollTop, moved: false };
    setArrastando(true);
  };
  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el || !drag.current) return;
    const dx = e.clientX - drag.current.x;
    const dy = e.clientY - drag.current.y;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) drag.current.moved = true;
    el.scrollLeft = drag.current.left - dx;
    el.scrollTop = drag.current.top - dy;
  };
  const onUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (drag.current?.moved) {
      e.preventDefault();
      e.stopPropagation();
    }
    drag.current = null;
    setArrastando(false);
  };

  return (
    <div
      ref={ref}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerLeave={onUp}
      onClickCapture={(e) => {
        if (drag.current?.moved) {
          e.preventDefault();
          e.stopPropagation();
        }
      }}
      className={`overflow-x-auto -mx-4 px-4 pb-2 ${
        arrastando ? "cursor-grabbing select-none" : "cursor-grab"
      }`}
      style={{ touchAction: "pan-x pan-y", overscrollBehaviorX: "contain" }}
    >
      <div className="flex items-stretch gap-3 min-w-max py-2">
        {/* LADO ESQUERDO */}
        {colunasVisiveis.map((fase) => (
          <ColunaBracket
            key={`L-${fase.key}`}
            label={fase.label}
            jogos={fase.esquerda}
            lado="esquerda"
          />
        ))}

        {/* CENTRO: FINAL centralizada + 3º LUGAR logo abaixo */}
        <div className="w-56 shrink-0 flex flex-col items-center justify-center gap-5 px-1">
          <div className="w-full">
            <h3 className="text-xs font-bold uppercase tracking-wider text-center mb-2 text-accent">
              Final
            </h3>
            {finais.length === 0 ? (
              <SlotVazio destaque />
            ) : (
              finais.map((j) => <BracketCard key={j.id} jogo={j} destaque />)
            )}
          </div>
          <div className="w-full opacity-90">
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-center mb-2 text-muted-foreground">
              3º Lugar
            </h3>
            {terceiros.length === 0 ? (
              <SlotVazio />
            ) : (
              terceiros.map((j) => <BracketCard key={j.id} jogo={j} />)
            )}
          </div>
        </div>

        {/* LADO DIREITO (espelhado) */}
        {[...colunasVisiveis].reverse().map((fase) => (
          <ColunaBracket
            key={`R-${fase.key}`}
            label={fase.label}
            jogos={fase.direita}
            lado="direita"
          />
        ))}
      </div>
    </div>
  );
}

function ColunaBracket({
  label,
  jogos,
  lado,
}: {
  label: string;
  jogos: Jogo[];
  lado: "esquerda" | "direita";
}) {
  // Número de slots = max(jogos.length, 1), distribui igualmente
  const slots = jogos.length === 0 ? [null] : jogos;
  return (
    <div className="w-44 sm:w-52 shrink-0 flex flex-col">
      <h3 className="text-[11px] font-bold uppercase tracking-wider text-accent text-center mb-2">
        {label}
      </h3>
      <div className="flex-1 flex flex-col justify-around gap-2" style={{ minHeight: 520 }}>
        {slots.map((j, i) =>
          j ? (
            <div
              key={j.id}
              className={`flex items-center ${lado === "direita" ? "flex-row-reverse" : ""}`}
            >
              <div className="flex-1 min-w-0">
                <BracketCard jogo={j} />
              </div>
              <div className="w-2 h-px bg-white/20 shrink-0" />
            </div>
          ) : (
            <div
              key={i}
              className={`flex items-center ${lado === "direita" ? "flex-row-reverse" : ""}`}
            >
              <div className="flex-1 min-w-0">
                <SlotVazio />
              </div>
              <div className="w-2 h-px bg-white/20 shrink-0" />
            </div>
          ),
        )}
      </div>
    </div>
  );
}

function SlotVazio({ destaque = false }: { destaque?: boolean }) {
  return (
    <div
      className={`rounded-xl px-3 py-4 text-center text-[11px] text-muted-foreground border border-dashed ${
        destaque ? "border-accent/40" : "border-white/10"
      }`}
    >
      A definir
    </div>
  );
}




function BracketCard({ jogo: j, destaque = false }: { jogo: Jogo; destaque?: boolean }) {
  const aoVivo = j.status === "ao_vivo";
  const placar =
    j.placar_mandante != null && j.placar_visitante != null
      ? `${j.placar_mandante}-${j.placar_visitante}`
      : null;
  return (
    <Link
      to="/jogo/$id"
      params={{ id: j.id }}
      className="block rounded-xl p-3 transition hover:scale-[1.02]"
      style={{
        background: destaque ? "var(--gradient-accent, var(--glass-bg))" : "var(--glass-bg)",
        border: `1px solid ${
          aoVivo ? "var(--destructive)" : destaque ? "var(--accent)" : "var(--glass-border)"
        }`,
        boxShadow: destaque ? "0 0 0 2px color-mix(in oklab, var(--accent) 30%, transparent)" : undefined,
      }}
    >
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-2 flex items-center justify-between">
        <span>{formatData(j.data_hora)}</span>
        <span>{formatHora(j.data_hora)}</span>
      </div>
      <Linha
        nome={j.time_mandante}
        cod={j.bandeira_mandante}
        gols={j.placar_mandante}
        venceu={
          placar != null &&
          j.placar_mandante != null &&
          j.placar_visitante != null &&
          j.placar_mandante > j.placar_visitante
        }
      />
      <Linha
        nome={j.time_visitante}
        cod={j.bandeira_visitante}
        gols={j.placar_visitante}
        venceu={
          placar != null &&
          j.placar_mandante != null &&
          j.placar_visitante != null &&
          j.placar_visitante > j.placar_mandante
        }
      />
      {j.estadio && (
        <div className="text-[10px] text-muted-foreground mt-2 truncate">
          🏟 {j.estadio}
        </div>
      )}
    </Link>
  );
}

function Linha({
  nome,
  cod,
  gols,
  venceu,
}: {
  nome: string;
  cod: string | null;
  gols: number | null;
  venceu: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-2 py-1 text-sm ${
        venceu ? "font-bold" : "text-muted-foreground"
      }`}
    >
      <span className="flex items-center gap-2 truncate">
        <Bandeira code={cod} size={18} />
        <span className="truncate">{nome}</span>
      </span>
      <span className="tabular-nums w-5 text-right">{gols ?? "–"}</span>
    </div>
  );
}

function Rodape({ jogos }: { jogos: Jogo[] }) {
  const ultima = jogos

    .map((j) => j.updated_at)
    .filter((d): d is string => !!d)
    .sort()
    .pop();
  if (!ultima) return null;
  const d = new Date(ultima);
  const fmt = d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  return (
    <p className="text-center text-xs text-muted-foreground mt-8 pb-4">
      Calendário atualizado em {fmt}
    </p>
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
                    <Bandeira code={l.bandeira} size={20} />
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

      <div className="mt-4 space-y-4">
        {(() => {
          const agora = Date.now();
          const proximos = dados.jogos.filter(
            (j) =>
              j.status !== "encerrado" &&
              (j.status === "ao_vivo" ||
                new Date(j.data_hora).getTime() >= agora - 2 * 60 * 60 * 1000),
          );
          const ultimos = dados.jogos
            .filter(
              (j) =>
                j.status === "encerrado" ||
                new Date(j.data_hora).getTime() < agora - 2 * 60 * 60 * 1000,
            )
            .reverse();
          return (
            <>
              {proximos.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                    Próximos
                  </h3>
                  <div className="space-y-2">
                    {proximos.map((j) => (
                      <JogoLinhaGrupo key={j.id} jogo={j} />
                    ))}
                  </div>
                </div>
              )}
              {ultimos.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                    Últimos
                  </h3>
                  <div className="space-y-2">
                    {ultimos.map((j) => (
                      <JogoLinhaGrupo key={j.id} jogo={j} />
                    ))}
                  </div>
                </div>
              )}
            </>
          );
        })()}
      </div>
    </section>
  );
}

function JogoLinhaGrupo({ jogo: j }: { jogo: Jogo }) {
  const aoVivo = j.status === "ao_vivo";
  return (
    <Link
      to="/jogo/$id"
      params={{ id: j.id }}
      className="flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm border border-white/5 hover:bg-white/5 transition"
    >
      <span className="text-xs text-muted-foreground w-20 shrink-0">
        {formatData(j.data_hora)}
      </span>
      <span className="flex-1 flex items-center justify-end gap-1.5 truncate">
        <span className="truncate">{j.time_mandante}</span>
        <Bandeira code={j.bandeira_mandante} size={18} />
      </span>
      <span
        className={`font-bold min-w-12 text-center ${
          aoVivo ? "text-destructive" : ""
        }`}
      >
        {(() => {
          const ended = j.status === "encerrado";
          const pm = j.placar_mandante ?? (aoVivo || ended ? 0 : null);
          const pv = j.placar_visitante ?? (aoVivo || ended ? 0 : null);
          return pm != null && pv != null ? `${pm} × ${pv}` : formatHora(j.data_hora);
        })()}
      </span>
      <span className="flex-1 flex items-center gap-1.5 truncate">
        <Bandeira code={j.bandeira_visitante} size={18} />
        <span className="truncate">{j.time_visitante}</span>
      </span>

    </Link>
  );
}

function Chip({
  ativo,
  onClick,
  label,
}: {
  ativo: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition ${
        ativo
          ? "bg-primary text-primary-foreground shadow"
          : "bg-card/60 text-foreground border border-white/10 hover:bg-card"
      }`}
    >
      {label}
    </button>
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
          {(() => {
            const live = jogo.status === "ao_vivo";
            const pm = jogo.placar_mandante ?? (live || ended ? 0 : null);
            const pv = jogo.placar_visitante ?? (live || ended ? 0 : null);
            return pm != null && pv != null ? (
              <div className={`text-2xl font-bold ${live ? "text-destructive" : ""}`}>
                {pm} <span className="text-muted-foreground">×</span> {pv}
              </div>
            ) : (
              <div className="text-lg font-bold text-muted-foreground">×</div>
            );
          })()}
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
      <Bandeira code={logo} size={40} />

      <div className="font-semibold leading-tight">{nome}</div>
    </div>
  );
}
