# EscrowService - Claude Code Instructions

## Project Overview
EscrowService is a full-stack escrow platform with React (Vite) frontend and Express.js backend, using PostgreSQL (Railway) for data persistence.

---

## Running Locally

**See: [HOW_TO_RUN_LOCALLY.md](./HOW_TO_RUN_LOCALLY.md)** for complete startup instructions.

### Quick Reference
```
Backend:  PORT=5001, DATABASE_URL=Railway connection string
Frontend: PORT=5000, proxies /api/* to backend
Access:   http://localhost:5000
```

### Start Commands
```bash
# Backend (port 5001)
DATABASE_URL="postgresql://postgres:UxONIpkTnNzOiLHQkMAYPnlOiPONEpkW@yamanote.proxy.rlwy.net:51998/railway" HOST=127.0.0.1 PORT=5001 NODE_ENV=development npx tsx backend/src/index.ts

# Frontend (port 5000)
npm run dev:client
```

---

## Database

- **Production/Dev Database**: Railway PostgreSQL
- **Connection**: `postgresql://postgres:UxONIpkTnNzOiLHQkMAYPnlOiPONEpkW@yamanote.proxy.rlwy.net:51998/railway`
- **DO NOT USE**: Neon database (different project)

---

## Key Directories

```
frontend/
├── backend/src/          # Express.js API
│   ├── db/               # Database migrations
│   ├── routes/           # API routes
│   ├── services/         # Business logic
│   └── types/            # TypeScript types
├── client/src/           # React frontend
│   ├── components/       # UI components
│   ├── hooks/            # React Query hooks
│   ├── lib/              # API client
│   └── pages/            # Page components
├── docs/                 # API documentation
├── .env                  # Environment variables
└── vite.config.ts        # Vite + proxy config
```

---

## Git Workflow

- **Branches**: `master` and `main` (keep in sync)
- **Deploy**: Push to both for Railway auto-deploy
- **Commit**: Always push to both branches

```bash
git add -A && git commit -m "message" && git push origin master
git checkout main && git merge master && git push origin main && git checkout master
```

---

## Key Features

1. **Escrow Management** - Create, fund, confirm, cancel escrows
2. **Canton Tokenization** - Register escrows on Canton blockchain via theRegistry
3. **Organization Support** - Multi-org with feature flags
4. **Attachments** - File uploads with escrow-until-completion option

---

## Documentation

- **[PRODUCT_OVERVIEW.md](./PRODUCT_OVERVIEW.md)** - Feature descriptions
- **[DEVELOPMENT_LOG.md](./DEVELOPMENT_LOG.md)** - Session history
- **[HOW_TO_RUN_LOCALLY.md](./HOW_TO_RUN_LOCALLY.md)** - Startup instructions
- **[docs/theRegistry-API-Guide.md](./docs/theRegistry-API-Guide.md)** - Tokenization API
