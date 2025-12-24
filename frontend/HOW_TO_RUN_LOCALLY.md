# How to Run EscrowService Locally

## Quick Start

### Prerequisites
- Node.js installed
- Access to the Railway PostgreSQL database

### Architecture
```
Frontend (Vite)  →  Port 5000  →  Proxies /api/* to backend
Backend (Express) →  Port 5001  →  Connects to Railway PostgreSQL
```

---

## Step 1: Kill Any Existing Servers

First, check if any servers are running on ports 5000 or 5001:

```bash
netstat -ano | findstr "LISTENING" | findstr "500"
```

If you see processes, kill them:

```powershell
powershell -Command "Stop-Process -Id <PID> -Force"
```

Or kill all node processes:

```powershell
powershell -Command "Stop-Process -Name node -Force -ErrorAction SilentlyContinue"
```

---

## Step 2: Start the Backend (Port 5001)

Navigate to the frontend directory and start the backend with the DATABASE_URL:

```bash
cd "C:\Users\oreph\Documents\Canton Apps\DAML Projects\EscrowService\frontend"

DATABASE_URL="postgresql://postgres:UxONIpkTnNzOiLHQkMAYPnlOiPONEpkW@yamanote.proxy.rlwy.net:51998/railway" HOST=127.0.0.1 PORT=5001 NODE_ENV=development npx tsx backend/src/index.ts
```

**Expected Output:**
```
╔═══════════════════════════════════════════════════════════╗
║                    ESCROW SERVICE API                     ║
╠═══════════════════════════════════════════════════════════╣
║  Server running on port 5001                             ║
║  Environment: development                                 ║
╚═══════════════════════════════════════════════════════════╝
```

---

## Step 3: Start the Frontend (Port 5000)

In a new terminal, start the Vite dev server:

```bash
cd "C:\Users\oreph\Documents\Canton Apps\DAML Projects\EscrowService\frontend"

npm run dev:client
```

**Expected Output:**
```
VITE v7.1.12  ready in 640 ms

➜  Local:   http://localhost:5000/
➜  Network: http://192.168.1.93:5000/
```

---

## Step 4: Verify It's Working

1. **Open browser**: http://localhost:5000
2. **Test API proxy**: `curl http://localhost:5000/api/service-types`

---

## Configuration Files

### .env (in frontend directory)
```env
# Backend API URL (use relative path for Vite proxy in dev)
VITE_API_URL=/api

# Database (Railway)
DATABASE_URL=postgresql://postgres:UxONIpkTnNzOiLHQkMAYPnlOiPONEpkW@yamanote.proxy.rlwy.net:51998/railway
```

### vite.config.ts - Proxy Configuration
The frontend proxies `/api/*` and `/webhooks/*` requests to the backend on port 5001:
```typescript
proxy: {
  '/api': {
    target: 'http://localhost:5001',
    changeOrigin: true,
  },
  '/webhooks': {
    target: 'http://localhost:5001',
    changeOrigin: true,
  },
},
```

---

## Common Issues

### "SASL: client password must be a string"
- **Cause**: DATABASE_URL not set or wrong database
- **Fix**: Ensure DATABASE_URL is set with the Railway connection string

### "relation users does not exist"
- **Cause**: Connected to wrong database (e.g., Neon instead of Railway)
- **Fix**: Use the Railway DATABASE_URL, not Neon

### Port already in use
- **Cause**: Previous server still running
- **Fix**: Kill the process using the port (see Step 1)

### API calls return 404
- **Cause**: Backend not running or wrong port
- **Fix**: Ensure backend is on port 5001 and frontend proxy points to 5001

---

## Running Both in Background (Claude Code)

For Claude Code to run both servers in background:

```bash
# Backend
DATABASE_URL="postgresql://postgres:UxONIpkTnNzOiLHQkMAYPnlOiPONEpkW@yamanote.proxy.rlwy.net:51998/railway" HOST=127.0.0.1 PORT=5001 NODE_ENV=development npx tsx backend/src/index.ts

# Frontend
npm run dev:client
```

Both should be run with `run_in_background: true` in Claude Code.

---

## Summary

| Component | Port | Command |
|-----------|------|---------|
| Backend | 5001 | `DATABASE_URL="..." PORT=5001 npx tsx backend/src/index.ts` |
| Frontend | 5000 | `npm run dev:client` |
| Access | - | http://localhost:5000 |
