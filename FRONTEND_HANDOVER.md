# Frontend Handover Specification

**Version:** 1.0.0
**Date:** Dec 18, 2025
**Author:** Frontend Design Agent

## 1. Overview
This frontend is built using **React 19**, **Vite**, **TypeScript**, **Tailwind CSS**, and **wouter** for routing. It is currently running in "Mockup Mode" with no backend integration.

## 2. Component Architecture

### Layouts
- `components/layout/Header.tsx`: Main navigation. Uses `wouter` for links.
- `components/admin/AdminLayout.tsx`: Specialized sidebar layout for `/admin/*` routes.

### Reusable UI
- We use a modified version of **shadcn/ui**. All primitives are in `components/ui/`.
- **Do not replace these** unless necessary; they are styled to match the design system.

## 3. Data Models (Types)

Located in `client/src/lib/types.ts`.
You should generate TypeScript interfaces from your backend schema to replace these.

**Key Enums:**
- `EscrowStatus`: 'CREATED', 'FUNDED', 'COMPLETED', etc.
- `ServiceType`: 'TRAFFIC_BUY', 'DOCUMENT_DELIVERY', etc.

## 4. Integration Points (Action Items for Backend Team)

### A. Authentication
- Currently, the app assumes a logged-in user (John Doe).
- **TODO:** Implement auth provider (Auth0/Supabase/Custom).
- Update `Header.tsx` to show real user avatar/name.

### B. Dashboard (`/`)
- **API Call Needed:** `GET /api/escrows/active`
- **API Call Needed:** `GET /api/escrows/pending-acceptance` (For the "Inbox" section)
- **API Call Needed:** `GET /api/account/balance`

### C. Escrow Creation (`/escrow/new`)
- **API Call Needed:** `POST /api/escrows`
- Payload structure matches the form state in `pages/escrow-new.tsx`.
- **Note:** The "Service Type" dropdown should ideally be populated from the backend config, not hardcoded.

### D. Escrow Detail (`/escrow/:id`)
- **API Call Needed:** `GET /api/escrows/:id`
- **Real-time:** Implement WebSocket/Polling for status updates in `EscrowTimeline.tsx`.
- **Attachments:** `AttachmentList.tsx` expects a list of files. You need endpoints for `POST /api/escrows/:id/attachments` and `GET /download/:fileId`.

### E. Admin - Service Configuration (`/admin/service-types`)
- **Feature:** Dynamic Field Configuration.
- **API Call Needed:** `GET /api/admin/service-types`
- **API Call Needed:** `PUT /api/admin/service-types/:id`
- The frontend sends a JSON object defining the fields (name, type, required). The backend must store this schema and validate future escrow creation requests against it.

### F. Settings - Auto Accept (`/settings`)
- **API Call Needed:** `GET /api/user/settings/auto-accept`
- **API Call Needed:** `PUT /api/user/settings/auto-accept`
- Logic: The backend should check these rules when an escrow is created targeting this user. If rules match, automatically transition state to `PENDING_FUNDING`.

## 5. Routing Structure
| Route | Component | Purpose |
|-------|-----------|---------|
| `/` | `Dashboard` | User home |
| `/escrow` | `EscrowList` | Searchable list |
| `/escrow/new` | `EscrowNew` | Creation wizard |
| `/escrow/:id` | `EscrowDetail` | Transaction room |
| `/account` | `AccountPage` | Balance & ledger |
| `/settings` | `SettingsPage` | User preferences & Auto-accept |
| `/admin/service-types` | `ServiceTypesPage` | **(NEW)** Configure dynamic fields |
| `/admin/organizations` | `AdminOrganizationsPage` | **(NEW)** Manage orgs |

## 6. Design System Tokens
Colors are defined in `client/src/index.css` using HSL variables.
- Primary (Dark Slate): `hsl(222 47% 11%)`
- Accent (Emerald): `hsl(158 64% 52%)`
- Use `@theme inline` block for Tailwind v4 custom variables.
