import { AppError } from './errors.js';

function clone(value) {
  return structuredClone(value);
}

export class MemoryStore {
  #orders = new Map();
  #inventory = new Map();
  #idempotency = new Map();
  #bulkImports = new Map();

  constructor({ orders = [], inventory = [] } = {}) {
    for (const order of orders) this.#orders.set(order.id, clone(order));
    for (const item of inventory) this.#inventory.set(item.sku, clone(item));
  }

  getOrder(id) {
    const order = this.#orders.get(id);
    return order ? clone(order) : null;
  }

  saveOrder(order) {
    if (this.#orders.has(order.id)) {
      throw new AppError(409, 'ORDER_EXISTS', `Order ${order.id} already exists`);
    }
    this.#orders.set(order.id, clone(order));
    return clone(order);
  }

  upsertOrder(order) {
    this.#orders.set(order.id, clone(order));
    return clone(order);
  }

  reserve(sku, quantity) {
    const item = this.#inventory.get(sku);
    if (!item || item.available < quantity) {
      throw new AppError(409, 'INSUFFICIENT_STOCK', `Insufficient stock for ${sku}`);
    }
    item.available -= quantity;
  }

  release(sku, quantity) {
    const item = this.#inventory.get(sku);
    if (item) item.available += quantity;
  }

  getInventory(sku) {
    const item = this.#inventory.get(sku);
    return item ? clone(item) : null;
  }

  getIdempotentResult(tenantId, key) {
    return clone(this.#idempotency.get(`${tenantId}:${key}`) ?? null);
  }

  saveIdempotentResult(tenantId, key, result) {
    this.#idempotency.set(`${tenantId}:${key}`, clone(result));
  }

  getBulkImport(key) {
    return clone(this.#bulkImports.get(key) ?? null);
  }

  saveBulkImport(key, result) {
    this.#bulkImports.set(key, clone(result));
  }
}
