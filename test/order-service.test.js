import test from 'node:test';
import assert from 'node:assert/strict';
import { OrderService } from '../src/order-service.js';
import { MemoryStore } from '../src/store.js';

const actor = { tenantId: 'tenant-a', role: 'operator' };

function fixture() {
  const store = new MemoryStore({ inventory: [{ sku: 'BOX-S', available: 10 }] });
  const service = new OrderService(store, {
    idFactory: () => 'order-1',
    now: () => new Date('2026-01-01T00:00:00.000Z')
  });
  return { store, service };
}

test('creates an order and reserves inventory', () => {
  const { store, service } = fixture();
  const order = service.createOrder(actor, {
    customerEmail: 'buyer@example.test',
    lines: [{ sku: 'BOX-S', quantity: 2 }]
  }, 'request-1');

  assert.equal(order.id, 'order-1');
  assert.equal(store.getInventory('BOX-S').available, 8);
});

test('replays an idempotent request without reserving twice', () => {
  const { store, service } = fixture();
  const input = { lines: [{ sku: 'BOX-S', quantity: 2 }] };

  const first = service.createOrder(actor, input, 'request-1');
  const second = service.createOrder(actor, input, 'request-1');

  assert.deepEqual(second, first);
  assert.equal(store.getInventory('BOX-S').available, 8);
});

test('rolls back earlier reservations when a later SKU is unavailable', () => {
  const { store, service } = fixture();

  assert.throws(() => service.createOrder(actor, {
    lines: [
      { sku: 'BOX-S', quantity: 2 },
      { sku: 'MISSING', quantity: 1 }
    ]
  }, 'request-1'), /Insufficient stock/);

  assert.equal(store.getInventory('BOX-S').available, 10);
});

test('does not reveal another tenant\'s order', () => {
  const store = new MemoryStore({
    orders: [{ id: 'private', tenantId: 'tenant-b', lines: [] }]
  });
  const service = new OrderService(store);

  assert.throws(() => service.getOrder(actor, 'private'), /Order not found/);
});

