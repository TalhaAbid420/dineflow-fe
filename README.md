<div align="center">

# Dineflow Frontend

AI restaurant ordering chat — Next.js + React + Tailwind CSS

[![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=next.js&logoColor=white)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Deployed on Vercel](https://img.shields.io/badge/Vercel-000000?logo=vercel&logoColor=white)](https://dineflow-fe-eight.vercel.app)

**Live app:** [https://dineflow-fe-eight.vercel.app](https://dineflow-fe-eight.vercel.app)

</div>

---

## Overview

Dineflow is an AI-powered restaurant ordering assistant. Customers chat with a natural-language agent that browses the menu, places orders, and tracks their status in real time — and chefs manage incoming orders from a live kitchen dashboard.

This repository is the **frontend**: a Next.js App Router application that renders the chat experience and proxies API calls to the FastAPI backend (server-side, so credentials never reach the browser).

The companion backend lives in the **[dineflow-be](https://github.com/TalhaAbid420/dineflow-be)** repository.

## Features

- **AI chat UI** — streams the agent's reply in real time via Server-Sent Events, with a "thinking" indicator while the agent works.
- **Rich message cards** — menu items render as tappable cards with photos, prices, and category chips; tapping an item adds it to the order.
- **Order placement & tracking** — place orders in chat and review them on the dedicated orders page.
- **Customer auth** — register / login with JWT; sessions persist across reloads.
- **Kitchen dashboard** (`/chef`) — chefs see incoming orders live via SSE and update their status.
- **Conversation persistence** — each user's chat history is saved locally and restored on return.
- **Dark mode** — built with Tailwind CSS 4.

## Tech Stack

| Layer     | Technology                                              |
| --------- | ------------------------------------------------------- |
| Framework | [Next.js](https://nextjs.org/) 16 (App Router, Turbopack) |
| UI        | [React](https://react.dev/) 19 + [Tailwind CSS](https://tailwindcss.com/) 4 |
| Language  | [TypeScript](https://www.typescriptlang.org/) 5         |
| Linting   | [ESLint](https://eslint.org/) 9 (`eslint-config-next`)  |

## Getting Started

### Prerequisites

- Node.js 20+ and npm (or pnpm / yarn / bun)

### 1. Clone & install

```bash
git clone https://github.com/TalhaAbid420/dineflow-fe.git
cd dineflow-fe
npm install
```

### 2. Configure environment

Create a `.env.local` file with the backend base URL (used **server-side only**, never exposed to the browser):

```dotenv
# Local development
BACKEND_URL=http://localhost:8000
```

For the hosted setup, point `BACKEND_URL` at the deployed FastAPI backend:

```dotenv
BACKEND_URL=https://dineflow-be-5bc08f20.fastapicloud.dev
```

See [`.env.example`](.env.example) for details.

### 3. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser.

> The backend must be running locally (see [dineflow-be](https://github.com/TalhaAbid420/dineflow-be#getting-started)).

## Scripts

| Command           | Description                  |
| ----------------- | ---------------------------- |
| `npm run dev`     | Start the dev server         |
| `npm run build`   | Create an optimized build    |
| `npm run start`   | Serve the production build   |
| `npm run lint`    | Run ESLint                   |

## Pages

| Route      | Description                                        |
| ---------- | -------------------------------------------------- |
| `/`        | AI chat interface (redirects to `/login` if signed out) |
| `/login`   | Sign in with an existing account                   |
| `/orders`  | Current user's order history and status            |
| `/chef`    | Kitchen dashboard with live incoming orders        |

## API Proxy Routes

The frontend proxies browser requests to the FastAPI backend so auth headers and API keys stay server-side:

| Route                          | Backend target                 |
| ------------------------------ | ------------------------------ |
| `/api/auth/login`              | `POST /api/auth/login`         |
| `/api/auth/register`           | `POST /api/auth/register`      |
| `/api/auth/me`                 | `GET /api/auth/me`             |
| `/api/chat`                    | `POST /api/chat` (SSE)         |
| `/api/events`                  | `GET /api/events` (SSE)        |
| `/api/orders`                  | `GET /api/orders`              |
| `/api/orders/mine`             | `GET /api/orders/mine`         |
| `/api/orders/[id]/status`      | `PATCH /api/orders/{id}/status`|
| `/api/menu/[id]/image`         | `GET /api/menu/{id}/image`     |

## Project Structure

```
dineflow-fe/
├── app/
│   ├── page.tsx              # AI chat interface (SSE streaming)
│   ├── layout.tsx            # Root layout
│   ├── login/page.tsx        # Sign-in / registration
│   ├── orders/page.tsx       # Order history
│   ├── chef/page.tsx         # Kitchen dashboard (live order feed)
│   └── api/
│       ├── auth/             # Login / register / me proxies
│       ├── chat/route.ts     # Chat proxy (streams SSE)
│       ├── events/route.ts   # Order events proxy (streams SSE)
│       ├── menu/[id]/image/  # Menu image proxy
│       └── orders/           # Orders + status proxies
└── lib/
    ├── backend.ts            # Server-only backend URL + proxy helper
    ├── auth.ts               # JWT session helpers (client)
    ├── orders.ts             # Order API helpers
    └── sse.ts                # SSE helpers for the chef dashboard
```

## Deployment

The app is deployed on **Vercel**:

```bash
npx vercel --prod
```

Set `BACKEND_URL` in the project's **Environment Variables** (Production and Preview) to the deployed backend, then redeploy:

```dotenv
BACKEND_URL=https://dineflow-be-5bc08f20.fastapicloud.dev
```

## Related

- [dineflow-be](https://github.com/TalhaAbid420/dineflow-be) — FastAPI agent backend (OpenAI Agents SDK + PostgreSQL + MongoDB)
- Live backend API: [https://dineflow-be-5bc08f20.fastapicloud.dev](https://dineflow-be-5bc08f20.fastapicloud.dev)

## License

Private — all rights reserved.
