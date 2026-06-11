# ⚽ Onde Assistir a Copa 2026

> 🏆 Acompanhe a Copa do Mundo 2026 em tempo real — horários, estádios, canais de TV/streaming, tabela dos grupos, chaveamento interativo e placar ao vivo.

🔗 **Acesse:** [onde-assistir-copa-2026.lovable.app](https://onde-assistir-copa-2026.lovable.app)

![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=white)
![TanStack Start](https://img.shields.io/badge/TanStack_Start-v1-FF4154?logo=react&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-06B6D4?logo=tailwindcss&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?logo=supabase&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-Deploy-000000?logo=vercel&logoColor=white)

---

## ✨ Funcionalidades

| Feature | Descrição |
|--------|-----------|
| 📅 **Agenda de jogos** | Filtros por data (hoje, amanhã, semana), status (ao vivo, agendado, encerrado) e fase (grupos, oitavas, quartas, semi, final). |
| 🔴 **Placar ao vivo** | Sincronização automática com [TheSportsDB](https://www.thesportsdb.com) + fallback inteligente que marca jogos como "ao vivo" quando o horário inicia. |
| 🏟️ **Tabela de grupos** | Classificação automática com critérios FIFA: pontos, saldo de gols, gols pró, confronto direto e menos gols sofridos. |
| 🏆 **Mata-mata interativo** | Chaveamento visual com drag-to-scroll horizontal, otimizado para mobile. |
| 🌍 **Bandeiras oficiais** | Identificação automática de códigos de país para renderização de bandeiras via `flag-icons`. |
| 🔍 **Busca inteligente** | Busca textual por seleção, estádio, cidade, canal de TV e fase. |
| 🛡️ **Painel admin** | Área protegida para edição manual de placar e status em tempo real. |
| 🔄 **Sync automático** | Cron job + botão manual para sincronizar dados com TheSportsDB via `createServerFn`. |

---

## 🧱 Stack & Ferramentas

```
• Front-end: React 19 + TypeScript + Vite 7
• Framework: TanStack Start v1 (SSR/SSG + Server Functions)
• Roteamento: TanStack Router (file-based)
• Estado & Cache: TanStack Query v5
• Estilos: Tailwind CSS v4 + shadcn/ui + Radix UI Primitives
• Ícones: Lucide React + flag-icons
• Banco de dados: Supabase (PostgreSQL + RLS + Auth)
• API externa: TheSportsDB
• Validação: Zod + React Hook Form
• Deploy: Vercel (preset Nitro)
• Lint/Format: ESLint + Prettier
• Package Manager: Bun
```

---

## 🏗️ Arquitetura

```
src/
├── routes/               # File-based routing (TanStack Router)
│   ├── index.tsx         # Home: jogos, grupos, mata-mata
│   ├── admin.tsx         # Painel admin protegido
│   ├── jogo.$id.tsx      # Detalhe de um jogo
│   └── api/              # Server Routes públicas
├── lib/
│   ├── sync-jogos.functions.ts   # ServerFn: sync com TheSportsDB
│   ├── supabase.ts               # Cliente Supabase + tipos
│   └── format.ts                 # Helpers de data/hora
├── components/           # Componentes reutilizáveis (shadcn/ui)
├── hooks/                # Custom hooks
├── router.tsx            # Config do TanStack Router
└── styles.css            # Design tokens + Tailwind v4
```

---

## 🚀 Como rodar localmente

```bash
# 1. Clone o repositório
git clone https://github.com/alexsantos-djesus/onde-assistir-copa-2026.git
cd onde-assistir-copa-2026

# 2. Instale as dependências
bun install

# 3. Configure as variáveis de ambiente
cp .env.example .env.local
# Edite .env.local com suas credenciais do Supabase

# 4. Rode o servidor de desenvolvimento
bun dev

# 5. Acesse http://localhost:3000
```

### Variáveis de ambiente

| Variável | Descrição |
|----------|-----------|
| `VITE_SUPABASE_URL` | URL do projeto Supabase |
| `VITE_SUPABASE_ANON_KEY` | Chave pública (anon) do Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave de serviço (server-side only) |

---

## 📸 Screenshots

> Adicione aqui screenshots do app em ação:
> 1. **Capa** — Hero com próximos jogos
> 2. **Tabela de grupos** — Classificação com critérios FIFA
> 3. **Mata-mata** — Chaveamento interativo
> 4. **Placar ao vivo** — Jogo em andamento com atualização em tempo real

---

## 🤝 Contribuição

Ideias, issues e PRs são super bem-vindos! Se curtir futebol e código, comenta aí. ⚽

**Autor:** [Alex Santos](https://github.com/alexsantos-djesus)

---

## 📄 Licença

Este projeto está sob a licença MIT. Sinta-se livre para usar, modificar e distribuir.

---

<p align="center">
  Feito com ☕, ⚽ e muito <code>console.log</code>.
</p>
