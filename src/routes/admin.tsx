import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase, type Jogo } from "../lib/supabase";
import { syncJogosFromSportsDB } from "../lib/sync-jogos.functions";
import { Bandeira } from "../components/Bandeira";

export const Route = createFileRoute("/admin")({
  component: AdminPage,
});

const ADMIN_PASS = import.meta.env.VITE_ADMIN_PASS || "copa2026";

function AdminPage() {
  const [autorizado, setAutorizado] = useState(
    () => typeof window !== "undefined" && localStorage.getItem("admin_ok") === "1",
  );
  const [senha, setSenha] = useState("");
  const [mostrar, setMostrar] = useState(false);
  const [erro, setErro] = useState("");

  if (!autorizado) {
    return (
      <div
        className="min-h-screen flex items-center justify-center p-4"
        style={{ background: "var(--gradient-pitch)" }}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (senha.trim().toLowerCase() === ADMIN_PASS.trim().toLowerCase()) {
              localStorage.setItem("admin_ok", "1");
              setAutorizado(true);
            } else setErro("Senha incorreta");
          }}
          className="w-full max-w-sm rounded-2xl p-6 space-y-3"
          style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}
        >
          <h1 className="text-xl font-bold">Admin</h1>
          <div className="relative">
            <input
              type={mostrar ? "text" : "password"}
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="Senha"
              className="w-full rounded-lg px-3 py-2 pr-10 bg-background/40 border border-white/10 outline-none"
              autoFocus
            />
            <button
              type="button"
              onClick={() => setMostrar((v) => !v)}
              aria-label={mostrar ? "Ocultar senha" : "Mostrar senha"}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-lg"
            >
              {mostrar ? "🙈" : "👁️"}
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground">Dica: senha padrão é <code>copa2026</code></p>
          {erro && <p className="text-xs text-destructive">{erro}</p>}
          <button className="w-full rounded-lg py-2 bg-primary text-primary-foreground font-semibold">
            Entrar
          </button>
        </form>
      </div>
    );
  }

  return <Painel onSair={() => { localStorage.removeItem("admin_ok"); setAutorizado(false); }} />;
}

function Painel({ onSair }: { onSair: () => void }) {
  const qc = useQueryClient();
  const [filtro, setFiltro] = useState("");
  const { data, isLoading } = useQuery({
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
    if (!filtro.trim()) return true;
    const q = filtro.toLowerCase();
    return (
      j.time_mandante.toLowerCase().includes(q) ||
      j.time_visitante.toLowerCase().includes(q) ||
      (j.fase ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="min-h-screen p-4 max-w-3xl mx-auto" style={{ background: "var(--gradient-pitch)" }}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold">Admin · Jogos</h1>
          <p className="text-xs text-muted-foreground">
            Edite placar e status. Salva direto no banco.
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/" className="text-xs underline text-muted-foreground">Voltar</Link>
          <button onClick={onSair} className="text-xs underline text-muted-foreground">Sair</button>
        </div>
      </div>

      <BotaoSync onSync={() => qc.invalidateQueries({ queryKey: ["jogos"] })} />

      <input
        value={filtro}
        onChange={(e) => setFiltro(e.target.value)}
        placeholder="Filtrar por seleção ou fase..."
        className="w-full mb-3 rounded-lg px-3 py-2 bg-background/40 border border-white/10 outline-none"
      />

      {isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}

      <div className="space-y-2">
        {jogos.map((j) => (
          <LinhaAdmin key={j.id} jogo={j} onSalvar={() => qc.invalidateQueries({ queryKey: ["jogos"] })} />
        ))}
      </div>
    </div>
  );
}

function LinhaAdmin({ jogo, onSalvar }: { jogo: Jogo; onSalvar: () => void }) {
  const [pm, setPm] = useState(jogo.placar_mandante?.toString() ?? "");
  const [pv, setPv] = useState(jogo.placar_visitante?.toString() ?? "");
  const [status, setStatus] = useState(jogo.status ?? "agendado");
  const [streaming, setStreaming] = useState(jogo.streaming ?? "");
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState<string>("");

  async function salvar() {
    setSalvando(true);
    setMsg("");
    const { error } = await supabase
      .from("jogos")
      .update({
        placar_mandante: pm === "" ? null : Number(pm),
        placar_visitante: pv === "" ? null : Number(pv),
        status,
        streaming: streaming.trim() === "" ? null : streaming.trim().slice(0, 500),
        updated_at: new Date().toISOString(),
      })
      .eq("id", jogo.id);
    setSalvando(false);
    if (error) setMsg("Erro: " + error.message);
    else {
      setMsg("✓ Salvo");
      onSalvar();
      setTimeout(() => setMsg(""), 2000);
    }
  }

  const data = new Date(jogo.data_hora).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
  });

  return (
    <div
      className="rounded-xl p-3 text-sm"
      style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}
    >
      <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
        <span>{jogo.fase} · {data}</span>
        <span>{jogo.estadio ?? ""}</span>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex-1 min-w-[100px] flex items-center gap-2">
          <Bandeira code={jogo.bandeira_mandante ?? jogo.time_mandante} size={22} />
          <span className="truncate font-medium">{jogo.time_mandante}</span>
        </div>
        <input
          type="number"
          value={pm}
          onChange={(e) => setPm(e.target.value)}
          className="w-14 text-center rounded-md bg-background/40 border border-white/10 py-1"
        />
        <span>×</span>
        <input
          type="number"
          value={pv}
          onChange={(e) => setPv(e.target.value)}
          className="w-14 text-center rounded-md bg-background/40 border border-white/10 py-1"
        />
        <div className="flex-1 min-w-[100px] flex items-center gap-2 justify-end">
          <span className="truncate font-medium text-right">{jogo.time_visitante}</span>
          <Bandeira code={jogo.bandeira_visitante ?? jogo.time_visitante} size={22} />
        </div>
      </div>
      <div className="mt-2">
        <label className="text-[10px] text-muted-foreground block mb-1">
          Link de transmissão (YouTube/CazéTV — cola o link da live para embedar o player)
        </label>
        <input
          type="url"
          value={streaming}
          onChange={(e) => setStreaming(e.target.value)}
          placeholder="https://www.youtube.com/watch?v=..."
          maxLength={500}
          className="w-full rounded-md bg-background/40 border border-white/10 py-1 px-2 text-xs"
        />
      </div>
      <div className="flex items-center justify-between mt-2 gap-2">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-md bg-background/40 border border-white/10 py-1 px-2 text-xs"
        >
          <option value="agendado">Agendado</option>
          <option value="ao_vivo">Ao vivo</option>
          <option value="intervalo">Intervalo</option>
          <option value="encerrado">Encerrado</option>
        </select>
        <div className="flex items-center gap-2">
          {msg && <span className="text-xs text-muted-foreground">{msg}</span>}
          <button
            onClick={salvar}
            disabled={salvando}
            className="text-xs rounded-md px-3 py-1 bg-primary text-primary-foreground font-semibold disabled:opacity-50"
          >
            {salvando ? "..." : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}

function BotaoSync({ onSync }: { onSync: () => void }) {
  const syncFn = useServerFn(syncJogosFromSportsDB);
  const mut = useMutation({
    mutationFn: () => syncFn(),
    onSuccess: () => onSync(),
  });
  return (
    <div
      className="mb-3 rounded-xl p-3 flex items-center justify-between gap-3 flex-wrap"
      style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}
    >
      <div className="text-xs">
        <div className="font-semibold">Sincronizar com TheSportsDB</div>
        <div className="text-muted-foreground">
          Importa jogos, horários, estádios e placares automaticamente (grátis).
        </div>
        {mut.data && (
          <div className="text-green-400 mt-1">
            ✓ {mut.data.inseridos} novos · {mut.data.atualizados} atualizados ({mut.data.total} eventos)
          </div>
        )}
        {mut.error && (
          <div className="text-destructive mt-1">
            Erro: {mut.error instanceof Error ? mut.error.message : String(mut.error)}
          </div>
        )}
      </div>
      <button
        onClick={() => mut.mutate()}
        disabled={mut.isPending}
        className="text-xs rounded-md px-3 py-2 bg-primary text-primary-foreground font-semibold disabled:opacity-50"
      >
        {mut.isPending ? "Sincronizando..." : "Sincronizar agora"}
      </button>
    </div>
  );
}
