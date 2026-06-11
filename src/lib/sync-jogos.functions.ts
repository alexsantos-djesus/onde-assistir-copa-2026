import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { COUNTRY_CODES } from "./country-codes";

const SPORTSDB_URL =
  "https://www.thesportsdb.com/api/v1/json/3/eventsseason.php?id=4429&s=2026";

type SportsDBEvent = {
  idEvent: string;
  strHomeTeam: string;
  strAwayTeam: string;
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

function mapStatus(s: string | null, postponed: string | null): string {
  if (postponed === "yes") return "adiado";
  const x = (s ?? "").toUpperCase();
  if (x === "FT" || x === "AET" || x === "PEN" || x === "FINISHED") return "encerrado";
  if (x === "1H" || x === "2H" || x === "HT" || x === "LIVE" || x === "ET") return "ao_vivo";
  return "agendado";
}

function mapFase(round: string | null): string | null {
  if (!round) return null;
  const n = Number(round);
  if (!Number.isFinite(n)) return round;
  // TheSportsDB usa rounds 1-3 para fase de grupos, depois 16/8/4/2/1
  if (n >= 1 && n <= 3) return `Fase de Grupos - Rodada ${n}`;
  if (n === 16 || n === 125) return "Oitavas de Final";
  if (n === 8 || n === 150) return "Quartas de Final";
  if (n === 4 || n === 180) return "Semifinal";
  if (n === 2 || n === 200) return "Disputa de 3º Lugar";
  if (n === 1 || n === 250) return "Final";
  return `Rodada ${n}`;
}

export const syncJogosFromSportsDB = createServerFn({ method: "POST" }).handler(
  async () => {
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

    const res = await fetch(SPORTSDB_URL);
    if (!res.ok) throw new Error(`TheSportsDB falhou: ${res.status}`);
    const json = (await res.json()) as { events: SportsDBEvent[] | null };
    const events = json.events ?? [];

    // Busca jogos existentes (todos) para deduplicar
    const { data: existentes, error: errSel } = await supabase
      .from("jogos")
      .select("id, time_mandante, time_visitante, data_hora, placar_mandante, placar_visitante");
    if (errSel) throw errSel;

    const byKey = new Map<string, { id: string; pm: number | null; pv: number | null }>();
    const byTimes = new Map<string, { id: string; pm: number | null; pv: number | null }>();
    for (const j of existentes ?? []) {
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
      const exist = byKey.get(key);

      if (exist) {
        // Atualiza só placar e status para não sobrescrever dados editados
        const { error } = await supabase
          .from("jogos")
          .update({ status, placar_mandante: placarM, placar_visitante: placarV })
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
          fase: mapFase(e.intRound),
          status,
          placar_mandante: placarM,
          placar_visitante: placarV,
        };
        const { error } = await supabase.from("jogos").insert(row);
        if (error) erros.push(`${key}: ${error.message}`);
        else inseridos++;
      }
    }

    return {
      ok: erros.length === 0,
      total: events.length,
      inseridos,
      atualizados,
      erros: erros.slice(0, 5),
      timestamp: new Date().toISOString(),
    };
  },
);
