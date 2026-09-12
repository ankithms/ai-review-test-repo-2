# ParcelPilot review playground

ParcelPilot is a deliberately small, dependency-free order fulfillment API used
to evaluate automated code reviewers. It is designed to look and behave like a
real service while remaining quick to understand and run.

## Quick start

```bash
npm test
npm start
```

The server listens on `http://localhost:3000` by default.

```bash
curl http://localhost:3000/health
curl -H 'Authorization: Bearer tenant-a:operator' \
  http://localhost:3000/v1/orders/order-100
```

## Review exercise

The `main` branch is the trusted baseline. The `review/bulk-order-import`
branch adds a fictional bulk-import feature and intentionally contains a mix of
review-worthy defects and harmless changes.

```bash
git diff main...review/bulk-order-import
git log --oneline --decorate --graph --all
```

Point your AI reviewer at that diff. Ask it to prioritize concrete defects that
could cause incorrect behavior, data exposure, security issues, or production
incidents. Style-only feedback should be low priority.

The evaluator's answer key is stored outside the candidate diff on the
`review-answer-key` tag. Inspect it only after the reviewer has produced its
findings:

```bash
git show review-answer-key:docs/EXPECTED_FINDINGS.md
```

## API

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Liveness check |
| `GET` | `/v1/orders/:id` | Fetch an order for the authenticated tenant |
| `POST` | `/v1/orders` | Create and reserve inventory for an order |
| `POST` | `/v1/imports/orders` | Import a batch and optionally notify a webhook |

Bulk imports accept an `Idempotency-Key` header and a body shaped like this:

```json
{
  "notifyUrl": "https://ops.example.test/import-complete",
  "orders": [
    {
      "customerEmail": "buyer@example.test",
      "lines": [{ "sku": "BOX-S", "quantity": "2", "unitPrice": "1.25" }]
    }
  ]
}
```

Authentication uses a deliberately simple demo token:
`Authorization: Bearer <tenant-id>:<role>`.

## What this fixture measures

- Diff comprehension across controllers, services, and persistence code
- Security and tenant-isolation reasoning
- Business-logic and data-integrity review
- Async/concurrency analysis
- Signal-to-noise discipline
- Whether findings include a reproducible failure mode and useful fix

All names, customers, and tokens are synthetic. Do not use this service in
production.
