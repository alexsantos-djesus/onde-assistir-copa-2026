import { createServerFn } from "@tanstack/react-start";

export type Jogo = {
  id: string;
  data_hora: string;
  time_mandante: string;
  time_visitante: string;
  bandeira_mandante: string | null; // URL do logo
  bandeira_visitante: string | null;
  canal_tv: string | null;
  streaming: string | null;
  estadio: string | null;
  cidade: string | null;
  fase: string | null;
  status: "agendado" | "ao_vivo" | "encerrado" | null;
  placar_mandante: number | null;
  placar_visitante: number | null;
};

const LEAGUE_ID = 1; // FIFA World Cup
const SEASON = 2026;

function mapStatus(s: string): Jogo["status"] {
  if (["NS", "TBD", "PST"].includes(s)) return "agendado";
  if (["1H", "HT", "2H", "ET", "BT", "P", "LIVE", "INT"].includes(s)) return "ao_vivo";
  if (["FT", "AET", "PEN", "CANC", "ABD", "AWD", "WO"].includes(s)) return "encerrado";
  return "agendado";
}

type ApiFixture = {
  fixture: {
    id: number;
    date: string;
    venue: { name: string | null; city: string | null };
    status: { short: string };
  };
  league: { round: string | null };
  teams: {
    home: { name: string; logo: string };
    away: { name: string; logo: string };
  };
  goals: { home: number | null; away: number | null };
};

function mapFixture(f: ApiFixture): Jogo {
  return {
    id: String(f.fixture.id),
    data_hora: f.fixture.date,
    time_mandante: f.teams.home.name,
    time_visitante: f.teams.away.name,
    bandeira_mandante: f.teams.home.logo ?? null,
    bandeira_visitante: f.teams.away.logo ?? null,
    canal_tv: null,
    streaming: null,
    estadio: f.fixture.venue?.name ?? null,
    cidade: f.fixture.venue?.city ?? null,
    fase: f.league.round ?? null,
    status: mapStatus(f.fixture.status.short),
    placar_mandante: f.goals.home,
    placar_visitante: f.goals.away,
  };
}

async function apiFootball(path: string): Promise<{ response: ApiFixture[] }> {
  const key = process.env.API_FOOTBALL_KEY;
  if (!key) throw new Error("API_FOOTBALL_KEY não configurada");
  const res = await fetch(`https://v3.football.api-sports.io${path}`, {
    headers: { "x-apisports-key": key },
  });
  if (!res.ok) throw new Error(`API-Football ${res.status}`);
  return res.json();
}

export const listarJogos = createServerFn({ method: "GET" }).handler(async () => {
  const data = await apiFootball(`/fixtures?league=${LEAGUE_ID}&season=${SEASON}`);
  return data.response.map(mapFixture);
});

export const obterJogo = createServerFn({ method: "GET" })
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    const res = await apiFootball(`/fixtures?id=${encodeURIComponent(data.id)}`);
    const f = res.response[0];
    return f ? mapFixture(f) : null;
  });
