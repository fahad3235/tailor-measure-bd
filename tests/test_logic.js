// tailor-measure-bd \u2014 node unit tests for logic.js. Run: node tests/test_logic.js
'use strict';
const L = require('../logic.js');
let pass = 0, fail = 0;
function eq(actual, expected, name) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) pass++; else { fail++; console.log('FAIL: ' + name + ' \u2014 got ' + a + ', want ' + e); }
}
function ok(cond, name) { if (cond) pass++; else { fail++; console.log('FAIL: ' + name); } }

const base = () => ({
  id: 'c1', name: 'Rahim Uddin', phone: '01712345678', garment: 'Panjabi',
  measurements: { length: 42, chest: 40, waist: 36, hip: 38, shoulder: 18, sleeve: 24, neck: 16, bottom: null },
  pricePaisa: 500000, advancePaisa: 200000, orderDate: '2026-10-20', deliveryDate: '2026-10-27',
  status: 'cutting', note: '', createdAt: '2026-10-20T00:00:00.000Z',
});

// Money
eq(L.toPaisa('2500.50'), 250050, 'toPaisa 2500.50');
eq(L.toPaisa('0'), 0, 'toPaisa 0');
eq(L.fmtMoney(250050), '2,500.50', 'fmtMoney 250050');
eq(L.fmtMoney(0), '0.00', 'fmtMoney 0');
eq(L.duePaisa(base()), 300000, 'due = 500000-200000');
eq(L.bnDigits('123'), '\u09e7\u09e8\u09e9', 'bnDigits 123');

// Phones
ok(L.isValidBdMobile('01712345678'), 'valid 017 mobile');
ok(L.isValidBdMobile('01 712-345678'), 'valid mobile with separators');
ok(!L.isValidBdMobile('01212345678'), '012 prefix invalid');
ok(!L.isValidBdMobile('0171234567'), '10-digit invalid');
ok(!L.isValidBdMobile(''), 'empty invalid');

// Validation \u2014 happy path + each error
eq(L.validateCustomer(base()), [], 'valid customer');
eq(L.validateCustomer({ ...base(), name: '  ' }), ['name'], 'empty name');
eq(L.validateCustomer({ ...base(), name: 'x'.repeat(81) }), ['nameLong'], 'name too long');
eq(L.validateCustomer({ ...base(), phone: '017123' }), ['phone'], 'bad phone');
eq(L.validateCustomer({ ...base(), garment: 'Kurta' }), ['garment'], 'bad garment');
eq(L.validateCustomer({ ...base(), measurements: {} }), ['noMeasure'], 'no measures');
eq(L.validateCustomer({ ...base(), measurements: { chest: 200 } }), ['measure:chest', 'noMeasure'], 'chest out of range (invalid value counts as no valid measure)');
eq(L.validateCustomer({ ...base(), advancePaisa: 600000 }), ['advanceOver'], 'advance over price');
eq(L.validateCustomer({ ...base(), orderDate: '2026-10-27', deliveryDate: '2026-10-20' }), ['dateOrder'], 'delivery before order');
eq(L.validateCustomer({ ...base(), deliveryDate: '2026-13-01' }), ['deliveryDate'], 'bad delivery date');

// Status pipeline
eq(L.nextStatus('pending'), 'cutting', 'pending -> cutting');
eq(L.nextStatus('ready'), 'delivered', 'ready -> delivered');
eq(L.nextStatus('delivered'), null, 'delivered -> null');

// Delivery badges (today 2026-10-25)
eq(L.deliveryBadge({ ...base(), deliveryDate: '2026-10-20' }, '2026-10-25'), { kind: 'overdue', days: 5 }, 'overdue 5d');
eq(L.deliveryBadge({ ...base(), deliveryDate: '2026-10-25' }, '2026-10-25'), { kind: 'today', days: 0 }, 'due today');
eq(L.deliveryBadge({ ...base(), deliveryDate: '2026-10-27' }, '2026-10-25'), { kind: 'soon', days: 2 }, 'soon 2d');
eq(L.deliveryBadge({ ...base(), deliveryDate: '2026-11-10' }, '2026-10-25'), null, 'far future null');
eq(L.deliveryBadge({ ...base(), deliveryDate: '2026-10-20', status: 'delivered' }, '2026-10-25'), null, 'delivered no badge');

// Dashboard stats: A overdue due 300000, B due today due 100000, C delivered due 50000 (excluded)
const A = { ...base(), id: 'a', deliveryDate: '2026-10-20', status: 'cutting' };
const B = { ...base(), id: 'b', name: 'Karim', pricePaisa: 300000, advancePaisa: 200000, deliveryDate: '2026-10-25', status: 'stitching' };
const C = { ...base(), id: 'c', name: 'Sumon', pricePaisa: 200000, advancePaisa: 150000, deliveryDate: '2026-10-20', status: 'delivered' };
eq(L.dashboardStats([A, B, C], '2026-10-25'),
  { total: 3, active: 2, overdue: 1, dueToday: 1, totalDuePaisa: 400000 }, 'dashboard stats');

// Filter + sort
eq(L.filterCustomers([A, B, C], 'karim', 'all').map(c => c.id), ['b'], 'filter by name');
eq(L.filterCustomers([A, B, C], '', 'delivered').map(c => c.id), ['c'], 'filter by status');
eq(L.sortCustomers([C, B, A], '2026-10-25').map(c => c.id), ['a', 'b', 'c'], 'sort overdue first, delivered last');

// Import validation
eq(L.validateImport({ app: 'tailor-measure-bd', version: 1, customers: [A] }), null, 'valid import');
eq(L.validateImport({ app: 'other', version: 1, customers: [] }), 'wrongApp', 'wrong app');
eq(L.validateImport({ app: 'tailor-measure-bd', version: 2, customers: [] }), 'wrongVersion', 'wrong version');
eq(L.validateImport({ app: 'tailor-measure-bd', version: 1, customers: [A, A] }), 'dupId', 'dup id');
eq(L.validateImport({ app: 'tailor-measure-bd', version: 1, customers: [{ ...A, name: '' }] }), 'badCustomer:name', 'bad customer in import');
eq(L.validateImport(null), 'notObject', 'null import');

console.log('PASS ' + pass + ' / FAIL ' + fail);
process.exit(fail ? 1 : 0);
