import test from 'node:test';
import assert from 'node:assert/strict';
import { authenticate } from '../src/auth.js';

test('parses a tenant and accepted role', () => {
  assert.deepEqual(authenticate('Bearer tenant-a:operator'), {
    tenantId: 'tenant-a',
    role: 'operator'
  });
});

test('rejects unknown roles', () => {
  assert.throws(() => authenticate('Bearer tenant-a:viewer'), /not allowed/);
});

