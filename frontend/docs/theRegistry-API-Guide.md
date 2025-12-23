# theRegistry Public API Integration Guide

This guide explains how to integrate with theRegistry's Public API to register AI agents/assets on the Canton blockchain and create usage licenses.

## Base URLs

- **Production (Mainnet)**: `https://theregistry.agenticledger.ai`
- **Testnet**: `https://testnetregistry.agenticledger.ai`

## Authentication

Bearer token via API key in Authorization header:
```
Authorization: Bearer <your_api_key>
```

Create API keys in Admin Settings with scopes: `public-api:read`, `public-api:write`

---

## Endpoint 1: List Asset Types

**GET** `/api/public/asset-types`

Discover available asset types and their required fields/attributes. Use this FIRST to understand what data you need to provide when registering assets.

### Response Example

```json
{
  "success": true,
  "data": {
    "asset_types": [
      {
        "id": 4,
        "name": "AI Agents",
        "description": "Tokenize AI agents creating immutable records of ownership...",
        "fields": [
          {
            "key": "assetName",
            "name": "Asset Name",
            "type": "text",
            "required": true,
            "help_text": "A unique identifier for this asset"
          },
          {
            "key": "assetDescription",
            "name": "Asset Description",
            "type": "textarea",
            "required": true
          },
          {
            "key": "assetUrl",
            "name": "Asset URL",
            "type": "url",
            "required": false
          },
          {
            "key": "instruct",
            "name": "Instructions",
            "type": "textarea",
            "required": false
          }
        ],
        "attributes": [
          {
            "id": 5,
            "name": "Model",
            "selection_mode": "multi",
            "values": ["GPT-5", "Claude", "Llama", "Gemini", "Grok"]
          },
          {
            "id": 6,
            "name": "Tools/Capabilities",
            "selection_mode": "multi",
            "values": ["Drive"]
          },
          {
            "id": 7,
            "name": "Interaction Channels",
            "selection_mode": "multi",
            "values": ["Slack", "Teams", "Discord"]
          }
        ]
      }
    ],
    "total": 1
  }
}
```

---

## Endpoint 2: Create Asset Registration

**POST** `/api/public/asset-registrations`

Register an asset on the Canton blockchain. Creates an ERC-721 ownership token.

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `asset_type_id` | number | YES | Use ID from asset-types endpoint (e.g., 4 for "AI Agents") |
| `wallet_address` | string | YES | Blockchain wallet that will own this asset (must be pre-registered) |
| `network` | string | YES | "CANTON" (currently only Canton supported) |
| `environment` | string | NO | "TESTNET" or "MAINNET" (default: TESTNET) |
| `fields` | array | YES | Core asset information (see format below) |
| `attributes` | array | NO | Capabilities and features (see format below) |
| `metadata` | object | NO | Any additional platform-specific data |

### Fields Array Format

```json
[
  {"key": "assetName", "value": "Your Agent Name"},
  {"key": "assetDescription", "value": "What your agent does"},
  {"key": "assetUrl", "value": "https://your-platform.com/agents/123"},
  {"key": "instruct", "value": "System prompt or instructions"}
]
```

### Attributes Array Format

```json
[
  {"key": "Model", "value": "Claude"},
  {"key": "Tools/Capabilities", "value": "Drive"},
  {"key": "Interaction Channels", "value": "Slack"}
]
```

### Request Example

```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "asset_type_id": 4,
    "wallet_address": "your_wallet_address",
    "network": "CANTON",
    "environment": "MAINNET",
    "fields": [
      {"key": "assetName", "value": "Customer Support Bot"},
      {"key": "assetDescription", "value": "AI agent that handles customer inquiries"}
    ],
    "attributes": [
      {"key": "Model", "value": "Claude"}
    ],
    "metadata": {
      "platform_agent_id": "cs-bot-001",
      "version": "1.2.0"
    }
  }' \
  "https://theregistry.agenticledger.ai/api/public/asset-registrations"
```

### Response Example

```json
{
  "success": true,
  "data": {
    "asset_registration_id": 13,
    "asset_type": {
      "id": 4,
      "name": "AI Agents"
    },
    "token_id": "TOKEN_1766454391541_orm3rk",
    "wallet_address": "your_wallet_address",
    "network": "CANTON",
    "environment": "MAINNET",
    "blockchain": {
      "update_id": "1220f3254405becee3196b6bdcb8f332980f9b5d68182d706e0a5c669452a910d577",
      "completion_offset": 192222,
      "contract_id": null,
      "status": "pending"
    },
    "created_at": "2025-12-23T01:46:31.555Z"
  }
}
```

**Important**: `contract_id` is **null initially** with `status: "pending"`. It gets populated after async blockchain sync.

---

## Endpoint 3: Get Asset Registration Status

**GET** `/api/public/asset-registrations/:id`

Check the blockchain sync status of a registered asset. Poll this to confirm blockchain confirmation.

### Response Example

```json
{
  "success": true,
  "data": {
    "id": 13,
    "asset_type": {
      "id": 4,
      "name": "AI Agents"
    },
    "token_id": "TOKEN_1766454391541_orm3rk",
    "network": "CANTON",
    "environment": "MAINNET",
    "field_values": {
      "assetName": "Test Agent",
      "assetDescription": "An AI agent created via the public API"
    },
    "attribute_values": {
      "Model": "Claude"
    },
    "blockchain": {
      "update_id": "1220f3254405...",
      "completion_offset": "192222",
      "contract_id": "00ca4eff7ad9045b...",
      "sync_status": "synced",
      "onchain_status": "confirmed"
    },
    "created_at": "2025-12-23T01:46:31.555Z"
  }
}
```

---

## Endpoint 4: Sync Asset Registration (IMPORTANT)

**POST** `/api/public/asset-registrations/:id/sync`

**Actively query Canton blockchain to fetch contract_id.** This is the equivalent of clicking the "Refresh" button in the dashboard.

### When to Use

- AFTER creating an asset registration, the initial response has `contract_id=null`
- Canton processes the transaction asynchronously
- Call this endpoint to query Canton and fetch the `contract_id` once available

### Important Note

**GET `/asset-registrations/:id` only reads from database - it does NOT query Canton!**

You MUST call this POST /sync endpoint to trigger a Canton lookup.

### Workflow

1. `POST /asset-registrations` to create asset (`contract_id` may be null)
2. Wait 2-5 seconds (Canton processing time)
3. `POST /asset-registrations/:id/sync` to fetch `contract_id` from Canton
4. If `found_on_chain=true`, `contract_id` is now populated
5. If `found_on_chain=false`, wait and retry later

### Request Example

```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_API_KEY" \
  "https://theregistry.agenticledger.ai/api/public/asset-registrations/13/sync"
```

### Response Example (Contract Found)

```json
{
  "success": true,
  "data": {
    "asset_registration_id": 13,
    "token_id": "TOKEN_1766454391541_orm3rk",
    "sync_performed": true,
    "blockchain": {
      "contract_id": "000ea523ce6ebb00757cd0885aeabe3d1dc7728a1713ac1e0e3a84036c1ae655b8ca...",
      "update_id": "1220f3254405becee3196b6bdcb8f332980f9b5d68182d706e0a5c669452a910d577",
      "completion_offset": "192222",
      "sync_status": "synced",
      "onchain_status": "onchain",
      "found_on_chain": true
    },
    "synced_at": "2025-12-23T19:22:21.064Z"
  }
}
```

### Response Example (Still Pending)

```json
{
  "success": true,
  "data": {
    "asset_registration_id": 13,
    "token_id": "TOKEN_1766454391541_orm3rk",
    "sync_performed": true,
    "blockchain": {
      "contract_id": null,
      "update_id": "1220f3254405...",
      "completion_offset": "192222",
      "sync_status": "pending",
      "onchain_status": "local-only",
      "found_on_chain": false
    },
    "synced_at": "2025-12-23T03:15:00.000Z"
  }
}
```

### Recommended Polling Strategy

- Wait 2-5 seconds after creation before first sync call
- If `found_on_chain=false`, wait 5-10 seconds and retry
- After 3-5 retries, consider the transaction may have failed

---

## Endpoint 5: Create Usage License

**POST** `/api/public/asset-registrations/:id/usage-licenses`

Create a usage license (ERC-1155) for a registered asset.

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `wallet_address` | string | YES | Wallet that will hold this license |
| `selected_attributes` | object | NO | Which capabilities are included |
| `supply_total` | number | NO | Number of license units (default: 1) |
| `starts_at` | datetime | NO | License start date (ISO 8601) |
| `ends_at` | datetime | NO | License expiry date (ISO 8601) |
| `price_amount` | string | NO | License price |
| `price_currency` | string | NO | Currency code (USD, EUR, etc.) |
| `metadata` | object | NO | Any additional license data |

### Response Example

```json
{
  "success": true,
  "data": {
    "usage_license_id": 10,
    "asset_registration_id": 13,
    "token_id": "USAGE_1766454408232_todrcc",
    "wallet_address": "...",
    "network": "CANTON",
    "environment": "MAINNET",
    "blockchain": {
      "update_id": "1220e94e547c4f36...",
      "completion_offset": 192227,
      "contract_id": null,
      "status": "pending"
    },
    "created_at": "2025-12-23T01:46:48.245Z"
  }
}
```

---

## Endpoint 6: Update Metadata

**PATCH** `/api/public/asset-registrations/:id/metadata`

Update metadata on an existing asset registration. This pushes changes to Canton blockchain - creates a NEW contract (old is archived).

### Important Notes

1. The asset **MUST have a contract_id** (initial sync must be complete)
2. This is a CONSUMING choice on Canton - old contract archived, new one created
3. **SEND ALL METADATA EVERY TIME** - blockchain completely REPLACES metadata on each update

### Request Body

```json
{
  "metadata": {
    "version": "2.0.0",
    "deployment_status": "production",
    "last_sync_timestamp": "2025-12-23T02:50:00Z",
    "usage_metrics": {
      "total_requests": 15000,
      "avg_response_time_ms": 245
    }
  }
}
```

### Response Example

```json
{
  "success": true,
  "data": {
    "asset_registration_id": 11,
    "metadata_updated": true,
    "merge_mode": "merge",
    "previous_contract_id": "00ca4eff7ad9045b...",
    "blockchain": {
      "update_id": "1220e5a41b8da61f...",
      "completion_offset": 192473,
      "contract_id": "00ca4eff7ad9045b...",
      "status": "pending",
      "note": "UpdateAssetMetadata is a consuming choice - old contract archived, new contract created"
    },
    "updated_at": "2025-12-23T02:41:53.097Z"
  }
}
```

---

## Error Responses

All errors follow this format:

```json
{
  "error": true,
  "code": "ERROR_CODE",
  "message": "Human readable message",
  "details": { ... }
}
```

### Common Error Codes

| Code | Description |
|------|-------------|
| `MISSING_API_KEY` | No Authorization header provided |
| `INVALID_API_KEY` | API key not found or inactive |
| `INSUFFICIENT_SCOPE` | API key lacks required scope |
| `VALIDATION_ERROR` | Request body validation failed |
| `ASSET_TYPE_NOT_FOUND` | Invalid asset_type_id |
| `WALLET_NOT_FOUND` | Wallet not registered in platform |
| `MISSING_REQUIRED_FIELDS` | Required fields not provided |
| `BLOCKCHAIN_ERROR` | Canton blockchain push failed |
| `NO_CONTRACT_ID` | Asset not yet synced (wait for contract_id before updating metadata) |

---

## Integration Checklist

1. Get an API key with `public-api:read` and `public-api:write` scopes
2. Register a wallet address in theRegistry (via UI or internal API)
3. Call `GET /asset-types` to understand required fields
4. Map your platform's data to theRegistry fields:
   - Your name → `fields[assetName]`
   - Your description → `fields[assetDescription]`
   - Your URL → `fields[assetUrl]`
   - Everything else → `metadata{}`
5. `POST /asset-registrations` to create asset registration
6. Store the `asset_registration_id` returned
7. **CALL `POST /asset-registrations/:id/sync` TO GET contract_id:**
   - Wait 2-5 seconds after creation
   - Call sync endpoint to query Canton
   - If `found_on_chain=true`, `contract_id` is now available
   - If `found_on_chain=false`, wait and retry (5-10 sec intervals)
   - **NOTE**: GET endpoint only reads database, sync endpoint queries Canton
8. Use `PATCH /metadata` for ongoing updates (requires `contract_id` to exist)

---

## Response Structure Summary

All responses are wrapped in:
```json
{
  "success": true,
  "data": {
    // Actual response data here
    "blockchain": {
      "update_id": "...",
      "completion_offset": 123,
      "contract_id": "..." // null if pending
    }
  }
}
```

Key fields:
- `data.asset_registration_id` - Your registration ID (store this!)
- `data.token_id` - Unique blockchain token identifier
- `data.blockchain.update_id` - Canton transaction ID
- `data.blockchain.completion_offset` - Canton ledger position
- `data.blockchain.contract_id` - Contract ID (null initially, populated after sync)
- `data.blockchain.status` - "pending" | "confirmed" | "failed"
