import { createClient } from "@supabase/supabase-js";
const s = createClient("https://qbolkhzcbbcufxvxpjla.supabase.co","eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFib2xraHpjYmJjdWZ4dnhwamxhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEwODA5OTUsImV4cCI6MjA5NjY1Njk5NX0.eRPeB9QIQ9aN_qG3Uq4NNdVUsK8aPgoPO-f4JPOhskc");
const {data} = await s.from("jogos").select("id,data_hora,time_mandante,time_visitante,fase,status").or("fase.ilike.%oitavas%,fase.ilike.%Oitavas%").order("data_hora");
console.table(data);
