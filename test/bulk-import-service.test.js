import test from 'node:test';
import assert from 'node:assert/strict';
import { BulkImportService } from '../src/bulk-import-service.js';
import { MemoryStore } from '../src/store.js';

const actor = { tenantId: 'tenant-a', role: 'operator' };

function fixture(overrides = {}) {
  const store = new MemoryStore({
    inventory: [
      { sku: 'BOX-S', available: 20 },
      { sku: 'TAPE', available: 20 }
    ]
  });
  let nextId = 0;
  const notifications = [];
  const service = new BulkImportService(store, {
    idFactory: () => `imported-${++nextId}`,
    fetchImpl: async (url, options) => {
      notifications.push({ url, options });
      return { ok: true };
    },
    ...overrides
  });
  return { store, service, notifications };
}

test('imports a batch and calculates totals', async () => {
  const { store, service } = fixture();
  const result = await service.importOrders(actor, {
    orders: [{
      customerEmail: 'buyer@example.test',
      lines: [
        { sku: 'BOX-S', quantity: '2', unitPrice: '1.25' },
        { sku: 'TAPE', quantity: '1', unitPrice: '3.50' }
      ]
    }]
  }, 'batch-1');

  assert.equal(result.imported, 1);
  assert.equal(result.results[0].order.total, 6);
  assert.equal(store.getInventory('BOX-S').available, 18);
});

test('reports invalid rows without rejecting the whole batch', async () => {
  const { service } = fixture();
  const result = await service.importOrders(actor, {
    orders: [
      { lines: [{ sku: 'BOX-S', quantity: '2', unitPrice: '1.00' }] },
      { lines: [{ sku: 'MISSING', quantity: '1', unitPrice: '2.00' }] }
    ]
  }, 'batch-1');

  assert.equal(result.imported, 1);
  assert.equal(result.rejected, 1);
});

test('returns the cached result when a batch is retried', async () => {
  const { store, service } = fixture();
  const input = {
    orders: [{ lines: [{ sku: 'BOX-S', quantity: '2', unitPrice: '1.00' }] }]
  };

  const first = await service.importOrders(actor, input, 'batch-1');
  const second = await service.importOrders(actor, input, 'batch-1');

  assert.deepEqual(second, first);
  assert.equal(store.getInventory('BOX-S').available, 18);
});

test('posts the summary to the requested notification URL', async () => {
  const { service, notifications } = fixture();
  await service.importOrders(actor, {
    notifyUrl: 'https://ops.example.test/hooks/imports',
    orders: [{ lines: [{ sku: 'BOX-S', quantity: '1' }] }]
  }, 'batch-1');

  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].url, 'https://ops.example.test/hooks/imports');
});
