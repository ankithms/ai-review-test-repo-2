import { AppError } from './errors.js';
import { authenticate } from './auth.js';

const MAX_BODY_BYTES = 1_000_000;

async function readJson(req) {
  let body = '';
  for await (const chunk of req) {
    body += chunk;
    if (Buffer.byteLength(body) > MAX_BODY_BYTES) {
      throw new AppError(413, 'BODY_TOO_LARGE', 'Request body is too large');
    }
  }

  try {
    return JSON.parse(body || '{}');
  } catch {
    throw new AppError(400, 'INVALID_JSON', 'Request body must be valid JSON');
  }
}

function send(res, status, payload) {
  const data = JSON.stringify(payload);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(data)
  });
  res.end(data);
}

export function createHandler(orderService, bulkImportService) {
  return async function handler(req, res) {
    try {
      const url = new URL(req.url, 'http://localhost');
      if (req.method === 'GET' && url.pathname === '/health') {
        return send(res, 200, { status: 'ok' });
      }

      const actor = authenticate(req.headers.authorization);
      const orderMatch = url.pathname.match(/^\/v1\/orders\/([^/]+)$/);

      if (req.method === 'GET' && orderMatch) {
        const order = orderService.getOrder(actor, decodeURIComponent(orderMatch[1]));
        return send(res, 200, { order });
      }

      if (req.method === 'POST' && url.pathname === '/v1/orders') {
        const input = await readJson(req);
        const order = orderService.createOrder(actor, input, req.headers['idempotency-key']);
        return send(res, 201, { order });
      }

      if (req.method === 'POST' && url.pathname === '/v1/imports/orders') {
        const input = await readJson(req);
        const result = await bulkImportService.importOrders(
          actor,
          input,
          req.headers['idempotency-key']
        );
        return send(res, 202, result);
      }

      throw new AppError(404, 'NOT_FOUND', 'Route not found');
    } catch (error) {
      const known = error instanceof AppError;
      send(res, known ? error.status : 500, {
        error: known ? error.code : 'INTERNAL_ERROR',
        message: known ? error.message : 'An unexpected error occurred'
      });
    }
  };
}
