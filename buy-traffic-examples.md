# Canton Network - Buy Traffic API Examples

## Successful API Calls

### Call #1 - Traffic Amount: 5 (Dec 22, 2025)

**Request:**
```bash
curl -X POST 'https://wallet-orph.validator.iap.vals.mpch.io/api/validator/v0/wallet/buy-traffic-requests' \
    --header 'Content-Type: application/json' \
    --header 'Authorization: Bearer <MAINNET_JWT_TOKEN>' \
    --cookie 'GCP_IAP_UID=<UID>; GCP_IAP_XSRF_NONCE_*=1; __Host-GCP_IAP_AUTH_TOKEN_181620A339F946C2=<IAP_TOKEN>' \
    --data '{
    "receiving_validator_party_id": "MPCH-ORPHvalidator-1::1220be1c48dd490ecf762b3a91ee25cd4588650444597db1115551a9d00a93138a48",
    "domain_id": "global-domain::1220b1431ef217342db44d516bb9befde802be7d8899637d290895fa58880f19accc",
    "traffic_amount": 5,
    "tracking_id": "canton-loop-rescue-ORPH-<timestamp>",
    "expires_at": 1767182403000000
  }'
```

**Response:**
```json
{
  "request_contract_id": "008d8be6fb7379df352d2f33611a610abf47f17379338d244d7dc9668e6d3fdc42ca121220ebab8c2d6a4fcb3531286dfb1e4027960e4948e108fecc3df2993efcdc767c8e"
}
```

---

### Call #2 - Traffic Amount: 100 (Dec 22, 2025)

**Request:**
```bash
curl -X POST 'https://wallet-orph.validator.iap.vals.mpch.io/api/validator/v0/wallet/buy-traffic-requests' \
    --header 'Content-Type: application/json' \
    --header 'Authorization: Bearer <MAINNET_JWT_TOKEN>' \
    --cookie 'GCP_IAP_UID=<UID>; GCP_IAP_XSRF_NONCE_*=1; __Host-GCP_IAP_AUTH_TOKEN_181620A339F946C2=<IAP_TOKEN>' \
    --data '{
    "receiving_validator_party_id": "MPCH-ORPHvalidator-1::1220be1c48dd490ecf762b3a91ee25cd4588650444597db1115551a9d00a93138a48",
    "domain_id": "global-domain::1220b1431ef217342db44d516bb9befde802be7d8899637d290895fa58880f19accc",
    "traffic_amount": 100,
    "tracking_id": "canton-loop-rescue-ORPH-<timestamp>",
    "expires_at": 1767182403000000
  }'
```

**Response:**
```json
{
  "request_contract_id": "00872cdfaa8d8158391a1f34a6e7970d7847cd3870d3db5594175e2a00c92196e6ca12122012a168b118426c5ad2d0dc5fb461f5cd6b863a0d4680b041b01723be2b29bfef"
}
```

---

## Required Headers

| Header | Description |
|--------|-------------|
| `Authorization` | Bearer token from Auth0 (mainnet-canton-mpch.eu.auth0.com) |
| `Content-Type` | application/json |
| `Cookie` | GCP IAP cookies (see below) |

## Required Cookies

| Cookie | Description |
|--------|-------------|
| `GCP_IAP_UID` | GCP IAP User ID |
| `GCP_IAP_XSRF_NONCE_*` | XSRF protection nonces |
| `__Host-GCP_IAP_AUTH_TOKEN_*` | IAP session token (NOT a JWT, starts with AVBi...) |

## Notes

- Must run from whitelisted IP address
- JWT tokens expire after ~24 hours
- The `__Host-` prefix on the cookie name is required
- `tracking_id` should be unique per request (use timestamp)
