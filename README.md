# QA Dashboard / AI-assisted UI Automation (MVP)

## Quick Start

1. Clone repo & install deps:

```
cd backend && npm install
cd ../frontend && npm install
```

2. Configure environment files:

The project uses separate `.env` files for backend and frontend. You can use `.env.example` as a template:

```bash
# Copy template and edit with your API keys
cp .env.example backend/.env
cp .env.example frontend/.env
```

(Or on Windows PowerShell)

```powershell
Copy-Item .env.example backend\.env
Copy-Item .env.example frontend\.env
```

3. Update `backend/.env` with your real `OPENAI_API_KEY`.
4. Start backend (runs on port 3000):

```bash
cd backend
npm run dev
```

5. Start frontend (runs on port 3001):

```bash
cd frontend
npm run dev
```

6. Visit http://localhost:3001

## Environment Variables

Backend (`backend/.env`):

- `PORT` (default 3000)
  Backend (`backend/.env`):

- `PORT` (optional; default 3000)
- `HOST` (optional; default 0.0.0.0)
- `OPENAI_API_KEY` (required for AI features)
- `OPENAI_MODEL` (optional; default gpt-4o)

Frontend (`frontend/.env`):

- `PORT` (optional; default 3001)
- `NEXT_PUBLIC_BACKEND_URL` (required; points to backend, e.g. http://localhost:3000)
- `NEXT_PUBLIC_FRONTEND_URL` (optional; frontend URL for reference)

A sample `.env.example` is provided at the repo root as a template.

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
