# Idempotency

MerHouse uses idempotency keys for retry-sensitive create operations.

## Covered Operations

- `POST /api/v1/orders`
- `POST /api/v1/shipments`

## Client Contract

Clients send an `Idempotency-Key` header with a unique client-generated value.

## Stored Data

The backend stores the key, HTTP method, request path, request hash, response status, and response body.

## Replay Behavior

- Replaying the same key with the same request returns the stored response.
- Replaying the same key with a different request hash returns a conflict.

Idempotency is scoped to selected retry-sensitive operations rather than every write.
