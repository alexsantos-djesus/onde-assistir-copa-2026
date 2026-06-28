import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { COUNTRY_CODES } from "./country-codes";

const SPORTSDB_PAST_LEAGUE = "https://www.thesportsdb.com/api/v1/json/3/eventspastleague.php?id=4429";
const SPORTSDB_NEXT_LEAGUE = "https://www.thesportsdb.com/api/v1/json/3/eventsnextleague.php?id=4429";

const SPORTSDB_SEARCH_EVENT = (home: string, away: string) =>
  `https://www.thesportsdb.com/api/v1/json/3/searchevents.php?e=${encodeURIComponent(`${home}_vs_${away}`)}`;

const MIN_SYNC_INTERVAL_MS = 60_000;
let lastSyncAt = 0;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type SportsDBEvent = {
  idEvent: string;
  idLeague?: string | null;
  strHomeTeam: string;
  strAwayTeam: string;
  strSeason?: string | null;
  strTimestamp: string | null;
  dateEvent: string | null;
  strTime: string | null;
  intHomeScore: string | null;
  intAwayScore: string | null;
  strVenue: string | null;
  strCountry: string | null;
  intRound: string | null;
  strStatus: string | null;
  strPostponed: string | null;
};

type ExistingGame = {
  id: string;
  time_mandante: string;
  time_visitante: string;
  data_hora: string | null;
  fase: string | null;
  status: string | null;
  placar_mandante: number | null;
  placar_visitante: number | null;
};

function codigo(nome: string | null): string | null {
  if (!nome) return null;
  return COUNTRY_CODES[nome] ?? null;
}

// TheSportsDB retorna nomes em inglês; o banco usa português.
const TEAM_PT: Record<string, string> = {
  Mexico: "México",
  "South Africa": "África do Sul",
  "South Korea": "Coreia do Sul",
  Korea: "Coreia do Sul",
  "Republic of Korea": "Coreia do Sul",
  "Czech Republic": "Rep. Tcheca",
  Czechia: "Rep. Tcheca",
  Canada: "Canadá",
  "Bosnia-Herzegovina": "Bósnia e Herzegovina",
  "Bosnia and Herzegovina": "Bósnia e Herzegovina",
  USA: "EUA",
  "United States": "EUA",
  Paraguay: "Paraguai",
  Brazil: "Brasil",
  Morocco: "Marrocos",
  Qatar: "Catar",
  Switzerland: "Suíça",
  Haiti: "Haiti",
  Scotland: "Escócia",
  Germany: "Alemanha",
  Curacao: "Curaçao",
  "Curaçao": "Curaçao",
  "Ivory Coast": "Costa do Marfim",
  Ecuador: "Equador",
  Netherlands: "Holanda",
  Japan: "Japão",
  Australia: "Austrália",
  Turkey: "Turquia",
  Belgium: "Bélgica",
  Egypt: "Egito",
  "Saudi Arabia": "Arábia Saudita",
  Uruguay: "Uruguai",
  Spain: "Espanha",
  "Cape Verde": "Cabo Verde",
  Sweden: "Suécia",
  Tunisia: "Tunísia",
  Argentina: "Argentina",
  Algeria: "Argélia",
  Colombia: "Colômbia",
  Croatia: "Croácia",
  England: "Inglaterra",
  France: "França",
  Ghana: "Gana",
  Iran: "Irã",
  Iraq: "Iraque",
  Jordan: "Jordânia",
  Norway: "Noruega",
  "New Zealand": "Nova Zelândia",
  Panama: "Panamá",
  Portugal: "Portugal",
  "DR Congo": "RD Congo",
  Senegal: "Senegal",
  Uzbekistan: "Uzbequistão",
  Austria: "Áustria",
};

function nomePT(nome: string): string {
  return TEAM_PT[nome] ?? nome;
}

function nomeEN(nome: string): string {
  const hit = Object.entries(TEAM_PT).find(([, pt]) => pt === nome);
  return hit?.[0] ?? nome;
}

async function fetchSearchEvent(homePt: string, awayPt: string): Promise<SportsDBEvent[]> {
  const home = nomeEN(homePt);
  const away = nomeEN(awayPt);
  const r = await fetch(SPORTSDB_SEARCH_EVENT(home, away), { cache: "no-store" });
  if (!r.ok) return [];
  const j = (await r.json()) as { event?: SportsDBEvent[] | null };
  return (j.event ?? []).filter(
    (e) => e.idLeague === "4429" && (e.strSeason == null || e.strSeason === "2026"),
  );
}

function mapStatus(s: string | null, postponed: string | null): string {
  if (postponed === "yes") return "adiado";
  const x = (s ?? "").toUpperCase();
  if (x === "FT" || x === "AET" || x === "PEN" || x === "FINISHED") return "encerrado";
  if (x === "HT") return "intervalo";
  if (x === "1H" || x === "2H" || x === "LIVE" || x === "ET") return "ao_vivo";
  return "agendado";
}

function mapFase(round: string | null, dataHora?: string | null): string | null {
  if (!round) return null;
  const n = Number(round);
  if (!Number.isFinite(n)) return round;
  const isMataMataFinal = dataHora ? new Date(dataHora).getTime() >= Date.UTC(2026, 6, 8) : false;
  // No formato 2026: 32 classificados começam em 16avos; depois oitavas, quartas, semi e final.
  if (!isMataMataFinal && n >= 1 && n <= 3) return `Fase de Grupos - Rodada ${n}`;
  if (n === 16 || n === 125) return "16avos de Final";
  if (n === 32) return "16avos de Final";
  if (n === 8 || n === 150) return "Oitavas de Final";
  if (n === 4 || n === 180) return "Quartas de Final";
  if (n === 2) return "Semifinal";
  if (n === 200) return "Disputa de 3º Lugar";
  if (n === 1 || n === 250) return "Final";
  return `Rodada ${n}`;
}

export const syncJogosFromSportsDB = createServerFn({ method: "POST" }).handler(
  async () => {
    const nowMs = Date.now();
    if (nowMs - lastSyncAt < MIN_SYNC_INTERVAL_MS) {
      return {
        ok: true,
        total: 0,
        inseridos: 0,
        atualizados: 0,
        erros: [],
        skipped: true,
        timestamp: new Date().toISOString(),
      };
    }

    const SUPABASE_URL =
      process.env.SUPABASE_URL ||
      process.env.VITE_SUPABASE_URL ||
      "https://qbolkhzcbbcufxvxpjla.supabase.co";
    const KEY =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_PUBLISHABLE_KEY ||
      process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
      process.env.VITE_SUPABASE_ANON_KEY ||
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFib2xraHpjYmJjdWZ4dnhwamxhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEwODA5OTUsImV4cCI6MjA5NjY1Njk5NX0.eRPeB9QIQ9aN_qG3Uq4NNdVUsK8aPgoPO-f4JPOhskc";
    const supabase = createClient(SUPABASE_URL, KEY);

    const events: SportsDBEvent[] = [];
    const seen = new Set<string>();
    for (const url of [SPORTSDB_PAST_LEAGUE, SPORTSDB_NEXT_LEAGUE]) {
      try {
        const r = await fetch(url, { cache: "no-store" });
        if (!r.ok) continue;
        const j = (await r.json()) as { events: SportsDBEvent[] | null };
        for (const ev of j.events ?? []) {
          if (seen.has(ev.idEvent)) continue;
          seen.add(ev.idEvent);
          events.push(ev);
        }
        await wait(120);
      } catch {
        // ignora falha de uma lista
      }
    }

    // Busca jogos existentes (todos) para deduplicar
    const { data: existentes, error: errSel } = await supabase
      .from("jogos")
      .select("id, time_mandante, time_visitante, data_hora, fase, status, placar_mandante, placar_visitante");
    if (errSel) throw errSel;

    const existingGames = (existentes ?? []) as ExistingGame[];
    const eventKeys = new Set(
      events.map(
        (e) => `${nomePT(e.strHomeTeam)}|${nomePT(e.strAwayTeam)}|${(e.strTimestamp ?? e.dateEvent ?? "").slice(0, 10)}`,
      ),
    );

    for (const jogo of existingGames) {
      const gameDate = (jogo.data_hora ?? "").slice(0, 10);
      if (!gameDate) continue;
      if (new Date(jogo.data_hora ?? gameDate).getTime() > Date.now()) continue;
      if (jogo.placar_mandante != null && jogo.placar_visitante != null) continue;
      if (eventKeys.has(`${jogo.time_mandante}|${jogo.time_visitante}|${gameDate}`)) continue;

      try {
        const found = await fetchSearchEvent(jogo.time_mandante, jogo.time_visitante);
        for (const ev of found) {
          if (seen.has(ev.idEvent)) continue;
          const evDate = (ev.strTimestamp ?? ev.dateEvent ?? "").slice(0, 10);
          if (evDate && evDate !== gameDate) continue;
          seen.add(ev.idEvent);
          events.push(ev);
        }
        await wait(300);
      } catch {
        // ignora falha de busca específica
      }
    }

    const byKey = new Map<string, { id: string; pm: number | null; pv: number | null }>();
    const byTimes = new Map<string, { id: string; pm: number | null; pv: number | null }>();
    for (const j of existingGames.filter((g) => g.status !== "oculto" && g.fase !== "Duplicado")) {
      const k = `${j.time_mandante}|${j.time_visitante}|${(j.data_hora ?? "").slice(0, 10)}`;
      const v = { id: j.id, pm: j.placar_mandante, pv: j.placar_visitante };
      byKey.set(k, v);
      byTimes.set(`${j.time_mandante}|${j.time_visitante}`, v);
    }

    let inseridos = 0;
    let atualizados = 0;
    const erros: string[] = [];

    for (const e of events) {
      const dataHora =
        e.strTimestamp ??
        (e.dateEvent && e.strTime ? `${e.dateEvent}T${e.strTime}Z` : null);
      if (!dataHora || !e.strHomeTeam || !e.strAwayTeam) continue;

      let status = mapStatus(e.strStatus, e.strPostponed);
      const placarM = e.intHomeScore != null ? Number(e.intHomeScore) : null;
      const placarV = e.intAwayScore != null ? Number(e.intAwayScore) : null;

      // Fallback: TheSportsDB às vezes demora a marcar como LIVE.
      // Se o jogo já começou (até 3h após o horário) e não foi encerrado/adiado, marca ao vivo.
      if (status === "agendado") {
        const inicio = new Date(dataHora).getTime();
        const agora = Date.now();
        if (agora >= inicio && agora < inicio + 1000 * 60 * 60 * 3) {
          status = "ao_vivo";
        }
      }

      const mandante = nomePT(e.strHomeTeam);
      const visitante = nomePT(e.strAwayTeam);

      const key = `${mandante}|${visitante}|${dataHora.slice(0, 10)}`;
      const porData = byKey.get(key);
      // Fallback: mesmo confronto com data divergente — atualiza e corrige a data
      const exist = porData ?? byTimes.get(`${mandante}|${visitante}`);

      if (exist) {
        const fase = mapFase(e.intRound, dataHora);
        const patch: Record<string, unknown> = {
          status,
          placar_mandante: placarM,
          placar_visitante: placarV,
        };
        if (fase) patch.fase = fase;
        if (!porData) patch.data_hora = dataHora;
        const { error } = await supabase
          .from("jogos")
          .update(patch)
          .eq("id", exist.id);
        if (error) erros.push(`${key}: ${error.message}`);
        else atualizados++;
      } else {
        const row = {
          data_hora: dataHora,
          time_mandante: mandante,
          time_visitante: visitante,
          bandeira_mandante: codigo(e.strHomeTeam),
          bandeira_visitante: codigo(e.strAwayTeam),
          estadio: e.strVenue,
          cidade: e.strCountry,
          fase: mapFase(e.intRound, dataHora),
          status,
          placar_mandante: placarM,
          placar_visitante: placarV,
        };
        const { error } = await supabase.from("jogos").insert(row);
        if (error) erros.push(`${key}: ${error.message}`);
        else inseridos++;
      }
    }

    const duplicadosOcultos = await deduplicarJogos(supabase);

    // Resolve chaveamento: substitui placeholders ("1º Grupo A", "Vencedor 16avos 3", etc)
    // pelos times reais quando já é possível determinar.
    let resolvidos = 0;
    try {
      resolvidos = await resolverChaveamento(supabase);
    } catch {
      // não bloqueia o sync se falhar
    }

    const result = {
      ok: erros.length === 0,
      total: events.length,
      inseridos,
      atualizados,
      duplicadosOcultos,
      resolvidos,
      erros: erros.slice(0, 5),
      timestamp: new Date().toISOString(),
    };
    lastSyncAt = Date.now();
    return result;
  },
);



type JogoLite = {
  id: string;
  fase: string | null;
  data_hora: string;
  status: string | null;
  time_mandante: string;
  time_visitante: string;
  bandeira_mandante: string | null;
  bandeira_visitante: string | null;
  placar_mandante: number | null;
  placar_visitante: number | null;
};

const PLACEHOLDER_RE =
  /^(?:[12]º\s*Grupo|3º\s*Grupo|Vencedor\s+(?:16avos|oitavas|quartas|semi)|Perdedor\s+semi)\b/i;

const CONFRONTOS_DEFINIDOS: Record<string, { time: string; bandeira: string | null }> = {
  "Alemanha|3º Grupo A/B/C/D/F": { time: "Paraguai", bandeira: codigo("Paraguay") },
  "França|3º Grupo C/D/F/G/H": { time: "Suécia", bandeira: codigo("Sweden") },
};

function isPlaceholder(t: string): boolean {
  return PLACEHOLDER_RE.test(t);
}

async function deduplicarJogos(supabase: any): Promise<number> {
  const { data } = await supabase
    .from("jogos")
    .select("id, fase, data_hora, status, time_mandante, time_visitante, placar_mandante, placar_visitante")
    .neq("status", "oculto")
    .neq("fase", "Duplicado")
    .order("data_hora", { ascending: true });
  const jogos = (data ?? []) as JogoLite[];
  const grupos = new Map<string, JogoLite[]>();

  for (const j of jogos) {
    const dia = (j.data_hora ?? "").slice(0, 10);
    if (!dia) continue;
    const key = `${j.time_mandante}|${j.time_visitante}|${dia}`;
    const arr = grupos.get(key) ?? [];
    arr.push(j);
    grupos.set(key, arr);
  }

  let total = 0;
  for (const arr of grupos.values()) {
    if (arr.length < 2) continue;
    arr.sort((a, b) => {
      const scoreA = (a.placar_mandante != null && a.placar_visitante != null ? 4 : 0) +
        ((a.fase ?? "") === "16avos de Final" ? 2 : 0) +
        (a.status === "encerrado" ? 1 : 0);
      const scoreB = (b.placar_mandante != null && b.placar_visitante != null ? 4 : 0) +
        ((b.fase ?? "") === "16avos de Final" ? 2 : 0) +
        (b.status === "encerrado" ? 1 : 0);
      return scoreB - scoreA || new Date(a.data_hora).getTime() - new Date(b.data_hora).getTime();
    });
    const duplicados = arr.slice(1).map((j) => j.id);
    if (duplicados.length === 0) continue;
    const { error } = await supabase
      .from("jogos")
      .update({ fase: "Duplicado", status: "oculto" })
      .in("id", duplicados);
    if (!error) total += duplicados.length;
  }
  return total;
}

// supabase typed loosely para evitar conflito de generics do client

async function resolverChaveamento(supabase: any): Promise<number> {
  const { data } = await supabase
    .from("jogos")
    .select(
      "id, fase, data_hora, status, time_mandante, time_visitante, bandeira_mandante, bandeira_visitante, placar_mandante, placar_visitante",
    )
    .order("data_hora", { ascending: true });
  const all = (data ?? []) as JogoLite[];
  if (all.length === 0) return 0;

  // Top 1/2 por grupo (quando todos os 6 jogos do grupo estão encerrados)
  const grupos: Record<string, JogoLite[]> = {};
  for (const j of all) {
    const m = (j.fase ?? "").match(/grupo\s*([a-l])/i);
    if (!m) continue;
    (grupos[m[1].toUpperCase()] ??= []).push(j);
  }

  type Linha = { time: string; bandeira: string | null; pts: number; sg: number; gp: number; gc: number };
  const top: Record<string, Linha[]> = {};
  for (const [g, lista] of Object.entries(grupos)) {
    const fim = lista.filter(
      (j) => j.status === "encerrado" && j.placar_mandante != null && j.placar_visitante != null,
    );
    if (fim.length < 6) continue;
    const stats = new Map<string, Linha>();
    const ens = (n: string, b: string | null) => {
      let l = stats.get(n);
      if (!l) {
        l = { time: n, bandeira: b, pts: 0, sg: 0, gp: 0, gc: 0 };
        stats.set(n, l);
      } else if (!l.bandeira && b) l.bandeira = b;
      return l;
    };
    for (const j of fim) {
      const a = ens(j.time_mandante, j.bandeira_mandante);
      const b = ens(j.time_visitante, j.bandeira_visitante);
      a.gp += j.placar_mandante!; a.gc += j.placar_visitante!;
      b.gp += j.placar_visitante!; b.gc += j.placar_mandante!;
      if (j.placar_mandante! > j.placar_visitante!) a.pts += 3;
      else if (j.placar_mandante! < j.placar_visitante!) b.pts += 3;
      else { a.pts++; b.pts++; }
    }
    const tabela = [...stats.values()]
      .map((l) => ({ ...l, sg: l.gp - l.gc }))
      .sort(
        (x, y) =>
          y.pts - x.pts ||
          y.sg - x.sg ||
          y.gp - x.gp ||
          x.time.localeCompare(y.time),
      );
    top[g] = tabela;
  }

  // Ranking dos melhores 3º colocados (regra Copa 2026: 8 entre 12 avançam).
  // Critérios: pontos, saldo, gols pró, depois ordem alfabética (fair-play/sorteio não disponíveis).
  const terceiros: Array<Linha & { grupo: string }> = [];
  for (const [g, tabela] of Object.entries(top)) {
    if (tabela[2]) terceiros.push({ ...tabela[2], grupo: g });
  }
  terceiros.sort(
    (x, y) =>
      y.pts - x.pts || y.sg - x.sg || y.gp - x.gp || x.time.localeCompare(y.time),
  );
  const terceirosClassificados =
    Object.keys(top).length >= 12 ? terceiros.slice(0, 8) : [];
  const usados3 = new Set<string>();

  const dezesseisAvos = all.filter((j) => /16\s*avos|16-?avos/i.test(j.fase ?? ""));
  const oitavas = all.filter((j) => /oitava/i.test(j.fase ?? ""));
  const quartas = all.filter((j) => /quart/i.test(j.fase ?? ""));
  const semis = all.filter((j) => /semi/i.test(j.fase ?? ""));

  const winnerOf = (j: JogoLite) => {
    if (j.status !== "encerrado" || j.placar_mandante == null || j.placar_visitante == null) return null;
    if (j.placar_mandante > j.placar_visitante)
      return { time: j.time_mandante, bandeira: j.bandeira_mandante };
    if (j.placar_mandante < j.placar_visitante)
      return { time: j.time_visitante, bandeira: j.bandeira_visitante };
    return null;
  };
  const loserOf = (j: JogoLite) => {
    if (j.status !== "encerrado" || j.placar_mandante == null || j.placar_visitante == null) return null;
    if (j.placar_mandante < j.placar_visitante)
      return { time: j.time_mandante, bandeira: j.bandeira_mandante };
    if (j.placar_mandante > j.placar_visitante)
      return { time: j.time_visitante, bandeira: j.bandeira_visitante };
    return null;
  };

  const resolveSlot = (nome: string): { time: string; bandeira: string | null } | null => {
    let m: RegExpMatchArray | null;
    if ((m = nome.match(/^([12])º\s*Grupo\s*([A-L])$/i))) {
      const t = top[m[2].toUpperCase()];
      if (t && t[Number(m[1]) - 1]) {
        const l = t[Number(m[1]) - 1];
        return { time: l.time, bandeira: l.bandeira };
      }
    }
    // "3º Grupo X/Y/Z/..." — escolhe o melhor 3º colocado dentre os grupos listados
    if ((m = nome.match(/^3º\s*Grupo\s*([A-L](?:\s*\/\s*[A-L])+)$/i))) {
      if (terceirosClassificados.length === 0) return null;
      const gruposAllow = m[1].split("/").map((s) => s.trim().toUpperCase());
      for (const t of terceirosClassificados) {
        if (!gruposAllow.includes(t.grupo)) continue;
        if (usados3.has(t.grupo)) continue;
        usados3.add(t.grupo);
        return { time: t.time, bandeira: t.bandeira };
      }
    }
    if ((m = nome.match(/^Vencedor\s+oitavas\s+(\d+)$/i))) {
      const j = oitavas[Number(m[1]) - 1];
      if (j) return winnerOf(j);
    }
    if ((m = nome.match(/^Vencedor\s+16avos\s+(\d+)$/i))) {
      const j = dezesseisAvos[Number(m[1]) - 1];
      if (j) return winnerOf(j);
    }
    if ((m = nome.match(/^Vencedor\s+quartas\s+(\d+)$/i))) {
      const j = quartas[Number(m[1]) - 1];
      if (j) return winnerOf(j);
    }
    if ((m = nome.match(/^Vencedor\s+semi\s+(\d+)$/i))) {
      const j = semis[Number(m[1]) - 1];
      if (j) return winnerOf(j);
    }
    if ((m = nome.match(/^Perdedor\s+semi\s+(\d+)$/i))) {
      const j = semis[Number(m[1]) - 1];
      if (j) return loserOf(j);
    }
    return null;
  };

  let total = 0;
  // várias passadas para propagar (grupos → 16avos → oitavas → quartas → semi → final/3º)
  for (let pass = 0; pass < 5; pass++) {
    let changed = false;
    for (const j of all) {
      if (!j.fase) continue;
      const patch: Record<string, unknown> = {};
      if (isPlaceholder(j.time_mandante)) {
        const r = CONFRONTOS_DEFINIDOS[`${j.time_visitante}|${j.time_mandante}`] ?? resolveSlot(j.time_mandante);
        if (r && r.time && r.time !== j.time_mandante) {
          patch.time_mandante = r.time;
          patch.bandeira_mandante = r.bandeira ?? codigo(r.time);
        }
      }
      if (isPlaceholder(j.time_visitante)) {
        const r = CONFRONTOS_DEFINIDOS[`${j.time_mandante}|${j.time_visitante}`] ?? resolveSlot(j.time_visitante);
        if (r && r.time && r.time !== j.time_visitante) {
          patch.time_visitante = r.time;
          patch.bandeira_visitante = r.bandeira ?? codigo(r.time);
        }
      }
      if (Object.keys(patch).length > 0) {
        const { error } = await supabase.from("jogos").update(patch).eq("id", j.id);
        if (!error) {
          Object.assign(j, patch);
          total++;
          changed = true;
        }
      }
    }
    if (!changed) break;
  }
  return total;
}

