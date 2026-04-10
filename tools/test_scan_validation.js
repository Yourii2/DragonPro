// Simple automated tests for order-product validation logic used in SalesDaily
// Run with: node tools/test_scan_validation.js

const toNum = v => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

function matchesProductInOrderLine(p, sel) {
  const pid = p.productId ?? p.product_id ?? p.id ?? '';
  const name = (p.name || '').toString();
  const color = (p.color || p.variant_color || p.variant || '').toString();
  const size = (p.size || p.variant_size || p.measure || '').toString();
  const qty = toNum(p.quantity ?? p.qty ?? 0);

  const pidMatch = sel.productId ? Number(sel.productId) === Number(pid) : false;
  const nameMatch = sel.name ? sel.name.toString().trim() === name.toString().trim() : false;
  const colorMatch = sel.color ? sel.color.toString().trim() === color.toString().trim() : true;
  const sizeMatch = sel.size ? sel.size.toString().trim() === size.toString().trim() : true;
  const qtyOk = typeof sel.qty === 'undefined' || sel.qty === null ? true : qty >= Number(sel.qty);

  return (pidMatch || nameMatch) && colorMatch && sizeMatch && qtyOk;
}

function validateOrder(order, sel) {
  const prods = Array.isArray(order.products) ? order.products : [];
  return prods.some(p => matchesProductInOrderLine(p, sel));
}

const tests = [
  {
    name: 'Exact match id/color/size/qty sufficient',
    order: { products: [{ product_id: 101, name: 'Shirt', color: 'أحمر', size: 'M', quantity: 5 }] },
    sel: { productId: 101, name: 'Shirt', color: 'أحمر', size: 'M', qty: 3 },
    expect: true
  },
  {
    name: 'Insufficient quantity',
    order: { products: [{ product_id: 101, name: 'Shirt', color: 'أحمر', size: 'M', quantity: 2 }] },
    sel: { productId: 101, name: 'Shirt', color: 'أحمر', size: 'M', qty: 3 },
    expect: false
  },
  {
    name: 'Different color',
    order: { products: [{ product_id: 101, name: 'Shirt', color: 'أزرق', size: 'M', quantity: 10 }] },
    sel: { productId: 101, name: 'Shirt', color: 'أحمر', size: 'M', qty: 1 },
    expect: false
  },
  {
    name: 'Match by name only (no id provided)',
    order: { products: [{ product_id: 0, name: 'Special Shirt', color: 'أحمر', size: 'L', quantity: 4 }] },
    sel: { productId: null, name: 'Special Shirt', color: 'أحمر', size: 'L', qty: 2 },
    expect: true
  },
  {
    name: 'Order has no products',
    order: { products: [] },
    sel: { productId: 101, name: 'Shirt', color: 'أحمر', size: 'M', qty: 1 },
    expect: false
  }
];

let passed = 0;
tests.forEach((t, i) => {
  const res = validateOrder(t.order, t.sel);
  const ok = res === t.expect;
  console.log(`${i + 1}. ${t.name}: ${ok ? 'PASS' : 'FAIL'} (got ${res}, expected ${t.expect})`);
  if (ok) passed++;
});

console.log(`\n${passed}/${tests.length} tests passed.`);

if (passed !== tests.length) process.exit(2);
