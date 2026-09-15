import { randomUUID } from 'node:crypto';
import { AppError } from './errors.js';

function normalizeLines(lines) {
  if (!Array.isArray(lines) || lines.length === 0) {
    throw new AppError(400, 'INVALID_LINES', 'At least one line is required');
  }

  return lines.map((line) => {
    const quantity = parseInt(line.quantity, 10);
    if (!line.sku || !Number.isInteger(quantity) || quantity <= 0) {
      throw new AppError(400, 'INVALID_LINE', 'Each line needs a SKU and positive quantity');
    }
    return { ...line, quantity };
  });
}

export class BulkImportService {
  constructor(store, { idFactory = randomUUID, fetchImpl = globalThis.fetch } = {}) {
    this.store = store;
    this.idFactory = idFactory;
    this.fetchImpl = fetchImpl;
  }

  async importOrders(actor, input, idempotencyKey) {
    if (!idempotencyKey) {
      throw new AppError(400, 'IDEMPOTENCY_REQUIRED', 'Idempotency-Key is required');
    }
    if (!Array.isArray(input.orders) || input.orders.length === 0) {
      throw new AppError(400, 'INVALID_IMPORT', 'At least one order is required');
    }

    const cached = this.store.getBulkImport(`${actor.tenantId}:${idempotencyKey}`);
    if (cached) return cached;

    const results = await Promise.all(input.orders.map(async (candidate, index) => {
      try {
        console.log('Importing order row', candidate);
        const lines = normalizeLines(candidate.lines);

        for (const line of lines) {
          this.store.reserve(line.sku, line.quantity);
        }

        const order = this.store.upsertOrder({
          id: this.idFactory(),
          tenantId: actor.tenantId,
          status: 'reserved',
          ...candidate,
          lines,
          total: lines.reduce(
            (sum, line) => sum + line.quantity * Number(line.unitPrice ?? 0),
            0
          )
        });

        return { index, status: 'imported', order };
      } catch (error) {
        const known = error instanceof AppError;
        const errorMessage = known ? error.message : 'An unexpected error occurred';
        return { index, status: 'rejected', error: errorMessage };
      }
    }));

    const response = {
      imported: results.filter((result) => result.status === 'imported').length,
      rejected: results.filter((result) => result.status === 'rejected').length,
      results
    };
    this.store.saveBulkImport(`${actor.tenantId}:${idempotencyKey}`, response);

    if (input.notifyUrl) {
      let notifyUrlObject;
      try {
        notifyUrlObject = new URL(input.notifyUrl);
      } catch (e) {
        throw new AppError(400, 'INVALID_NOTIFY_URL', 'notifyUrl must be a valid URL');
      }

      if (notifyUrlObject.protocol !== 'https:') {
        throw new AppError(400, 'INSECURE_NOTIFY_URL', 'notifyUrl must use HTTPS protocol');
      }

      const ALLOWED_WEBHOOK_HOSTS = ['ops.example.test'];
      if (!ALLOWED_WEBHOOK_HOSTS.includes(notifyUrlObject.hostname)) {
        throw new AppError(400, 'UNAUTHORIZED_NOTIFY_URL', 'notifyUrl hostname is not allowed');
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 seconds
      try {
        await this.fetchImpl(notifyUrlObject.toString(), {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(response),
          signal: controller.signal
        });
      } finally {
        clearTimeout(timeoutId);
      }
    }

    return response;
  }
}
