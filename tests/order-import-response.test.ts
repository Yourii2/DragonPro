import assert from 'node:assert/strict';
import test from 'node:test';
import { attachPersistedOrderIdentity } from '../services/orderImportResponse.ts';

test('uses server-assigned order numbers for imported orders before printing', () => {
  const importedOrders = [
    { id: 1, orderNumber: '1042', customerName: 'First customer' },
    { id: 2, orderNumber: '1043', customerName: 'Second customer' }
  ];
  const createdOrders = [
    { order_id: 501, order_number: '9001' },
    { order_id: 502, order_number: '9002' }
  ];

  const result = attachPersistedOrderIdentity(importedOrders, createdOrders);

  assert.deepEqual(
    result.map(order => ({ id: order.id, orderNumber: order.orderNumber })),
    [
      { id: 501, orderNumber: '9001' },
      { id: 502, orderNumber: '9002' }
    ]
  );
});

test('rejects an incomplete server response instead of showing stale numbers', () => {
  assert.throws(
    () => attachPersistedOrderIdentity([{ id: 1, orderNumber: '1042' }], []),
    /does not match/
  );
});
