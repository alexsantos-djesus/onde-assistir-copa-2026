import { createFileRoute } from "@tanstack/react-router";
import { syncJogosFromSportsDB } from "../../../lib/sync-jogos.functions";

export const Route = createFileRoute("/api/public/sync-jogos")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const result = await syncJogosFromSportsDB();
          return Response.json(result);
        } catch (e) {
          return Response.json(
            { ok: false, error: e instanceof Error ? e.message : String(e) },
            { status: 500 },
          );
        }
      },
      POST: async () => {
        try {
          const result = await syncJogosFromSportsDB();
          return Response.json(result);
        } catch (e) {
          return Response.json(
            { ok: false, error: e instanceof Error ? e.message : String(e) },
            { status: 500 },
          );
        }
      },
    },
  },
});
