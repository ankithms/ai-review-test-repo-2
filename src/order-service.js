import { randomUUID } from 'node:crypto';
import { AppError } from './errors.js';

function validateLines(lines) {
  if (!Array.isArray(lines) || lines.length === 0) {
    throw new AppError(400, 'INVALID_LINES', 'At least one order line is required');
  }

  for (const line of lines) {
    if (typeof line?.sku !== 'string' || !Number.isInteger(line.quantity) || line.quantity <= 0) {
      throw new AppError(400, 'INVALID_LINE', 'Each line needs a SKU and positive integer quantity');
    }
  }
}

export class OrderService {
  constructor(store, { idFactory = randomUUID, now = () => new Date() } = {}) {
    this.store = store;
    this.idFactory = idFactory;
    this.now = now;
  }

  getOrder(actor, orderId) {
    const order = this.store.getOrder(orderId);
    if (!order || order.tenantId !== actor.tenantId) {
      throw new AppError(404, 'ORDER_NOT_FOUND', 'Order not found');
    }
    return order;
  }

  createOrder(actor, input, idempotencyKey) {
    if (!idempotencyKey) {
      throw new AppError(400, 'IDEMPOTENCY_REQUIRED', 'Idempotency-Key is required');
    }

    const existing = this.store.getIdempotentResult(actor.tenantId, idempotencyKey);
    if (existing) return existing;

    validateLines(input.lines);
    const reserved = [];
    try {
      for (const line of input.lines) {
        this.store.reserve(line.sku, line.quantity);
        reserved.push(line);
      }

      const order = this.store.saveOrder({
        id: this.idFactory(),
        tenantId: actor.tenantId,
        customerEmail: input.customerEmail,
        lines: input.lines,
        status: 'reserved',
        createdAt: this.now().toISOString()
      });
      this.store.saveIdempotentResult(actor.tenantId, idempotencyKey, order);
      return order;
    } catch (error) {
      for (const line of reserved) this.store.release(line.sku, line.quantity);
      throw error;
    }
  }
}

