import { createClient } from "@supabase/supabase-js";
const s = createClient("https://qbolkhzcbbcufxvxpjla.supabase.co","eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFib2xraHpjYmJjdWZ4dnhwamxhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEwODA5OTUsImV4cCI6MjA5NjY1Njk5NX0.eRPeB9QIQ9aN_qG3Uq4NNdVUsK8aPgoPO-f4JPOhskc");
const {data} = await s.from("jogos").select("id").ilike("fase","%Oitavas%").order("data_hora");
const ids = data.map(d=>d.id);
console.log("count", ids.length);
for (let i=0;i<ids.length;i++){
  const m = 2*i+1, v = 2*i+2;
  const {error} = await s.from("jogos").update({
    time_mandante:`Vencedor 16avos ${m}`,
    time_visitante:`Vencedor 16avos ${v}`,
    bandeira_mandante:null,
    bandeira_visitante:null,
    placar_mandante:null,
    placar_visitante:null,
    status:"agendado",
  }).eq("id", ids[i]);
  if(error) console.log("err",i,error);
}
console.log("done");
