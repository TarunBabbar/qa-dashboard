# QA Dashboard / AI-assisted UI Automation (MVP)

## Quick Start

1. Clone repo & install deps:

```
cd backend && npm install
cd ../frontend && npm install
```

2. Copy environment template:

```
cp ../.env.example ../backend/.env
cp ../.env.example ../frontend/.env.local
```

(Or on Windows PowerShell)

```
Copy-Item ..\.env.example ..\backend\.env
Copy-Item ..\.env.example ..\frontend\.env.local
```

3. Put your real `OPENAI_API_KEY` inside `backend/.env`.
4. Start backend (default PORT=3000):

```
cd backend
npm run dev
```

5. Start frontend (runs at 3001 per `package.json`):

```
cd ../frontend
npm run dev
```

6. Visit http://localhost:3001

## Environment Variables

Backend (`backend/.env`):

- `PORT` (default 3000)
- `OPENAI_API_KEY` (required for AI features)
- `OPENAI_MODEL` (optional; default gpt-4o-mini)

Frontend (`frontend/.env.local`):

- `NEXT_PUBLIC_BACKEND_URL` (required; points to backend, e.g. http://localhost:3000)

A sample `.env.example` is provided at the repo root.

## AI Assistant Modes

- **Ask**: Show generated code only for review.
- **Agent**: Starts 30s countdown then auto-applies returned files (can Apply/Revert per file sooner).

## Revert Logic

Applies snapshot only for changed/new files. Revert removes newly created files or restores previous content.

## Project Structure

- `backend/` Express + TypeScript API (`/api/ai/generate-code`, `/api/ai/apply-code`, `/api/ai/revert`)
- `frontend/` Next.js UI (AI Assistant page + integrated IDE view)
- `data/` JSON storage (projects, runs, reverts)

## Troubleshooting

- 404 with HTML in AI output: Ensure `NEXT_PUBLIC_BACKEND_URL` points to the running backend port.
- OpenAI error: Verify `OPENAI_API_KEY` and network accessibility.
- Auto apply not triggering: Confirm Mode is set to Agent and files were returned.

## License

MVP internal prototype (add a license here if distributing externally).
