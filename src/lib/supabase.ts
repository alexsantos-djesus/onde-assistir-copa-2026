import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://qbolkhzcbbcufxvxpjla.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFib2xraHpjYmJjdWZ4dnhwamxhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEwODA5OTUsImV4cCI6MjA5NjY1Njk5NX0.eRPeB9QIQ9aN_qG3Uq4NNdVUsK8aPgoPO-f4JPOhskc";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true },
});

export type Jogo = {
  id: string;
  data_hora: string; // ISO timestamp (UTC)
  time_mandante: string;
  time_visitante: string;
  bandeira_mandante: string | null;
  bandeira_visitante: string | null;
  canal_tv: string | null;
  streaming: string | null;
  estadio: string | null;
  cidade: string | null;
  fase: string | null;
  status: string | null; // agendado | ao_vivo | encerrado
  placar_mandante: number | null;
  placar_visitante: number | null;
};
