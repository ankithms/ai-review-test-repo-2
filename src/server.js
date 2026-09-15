import { createServer } from 'node:http';
import { createHandler } from './http.js';
import { BulkImportService } from './bulk-import-service.js';
import { OrderService } from './order-service.js';
import { MemoryStore } from './store.js';

export function buildServer() {
  const store = new MemoryStore({
    inventory: [
      { sku: 'BOX-S', available: 100 },
      { sku: 'BOX-L', available: 40 },
      { sku: 'TAPE', available: 250 }
    ]
  });
  return createServer(createHandler(
    new OrderService(store),
    new BulkImportService(store)
  ));
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const port = Number(process.env.PORT ?? 3000);
  buildServer().listen(port, () => {
    console.log(`ParcelPilot listening on http://localhost:${port}`);
  });
}
