// tailor-measure-bd \u2014 DOM-free business logic (shared by the app and node tests).
// Money is integer paisa throughout (no float error). Dates are ISO yyyy-mm-dd.
'use strict';
(function (root) {
  const APP = 'tailor-measure-bd';
  const VERSION = 1;
  const GARMENTS = ['Panjabi', 'Shirt', 'Pant', 'Salwar Kameez', 'Sherwani', 'Suit', 'Other'];
  const STATUSES = ['pending', 'cutting', 'stitching', 'ready', 'delivered'];
  const MEASURE_FIELDS = [
    { key: 'length',   en: 'Length',   min: 5,  max: 80 },
    { key: 'chest',    en: 'Chest',    min: 5,  max: 80 },
    { key: 'waist',    en: 'Waist',    min: 5,  max: 80 },
    { key: 'hip',      en: 'Hip',      min: 5,  max: 80 },
    { key: 'shoulder', en: 'Shoulder', min: 2,  max: 40 },
    { key: 'sleeve',   en: 'Sleeve',   min: 2,  max: 40 },
    { key: 'neck',     en: 'Neck',     min: 5,  max: 30 },
    { key: 'bottom',   en: 'Bottom',   min: 2,  max: 40 },
  ];

  function isValidDateStr(s) {
    if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    const d = new Date(s + 'T00:00:00Z');
    return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
  }
  function daysBetween(a, b) { // b - a in whole days (UTC)
    const da = new Date(a + 'T00:00:00Z').getTime();
    const db = new Date(b + 'T00:00:00Z').getTime();
    return Math.round((db - da) / 86400000);
  }
  function todayStr(d) {
    const t = d || new Date();
    const y = t.getFullYear(), m = String(t.getMonth() + 1).padStart(2, '0'), day = String(t.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }
  function toPaisa(taka) {
    if (taka === '' || taka === null || taka === undefined) return 0;
    const n = Number(taka);
    if (!isFinite(n)) return NaN;
    return Math.round(n * 100);
  }
  function fmtMoney(paisa) {
    const neg = paisa < 0;
    const abs = Math.abs(paisa);
    const whole = Math.floor(abs / 100);
    const frac = String(abs % 100).padStart(2, '0');
    const grouped = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return (neg ? '-' : '') + grouped + '.' + frac;
  }
  const BN_DIGITS = ['\u09e6', '\u09e7', '\u09e8', '\u09e9', '\u09ea', '\u09eb', '\u09ec', '\u09ed', '\u09ee', '\u09ef'];
  function bnDigits(s) { return String(s).replace(/[0-9]/g, d => BN_DIGITS[Number(d)]); }

  function normalizePhone(raw) {
    return String(raw || '').replace(/[^0-9]/g, '');
  }
  function isValidBdMobile(raw) {
    const p = normalizePhone(raw);
    return /^01[3-9]\d{8}$/.test(p);
  }

  // Customer shape: {id, name, phone, garment, measurements:{key:number|null},
  //   pricePaisa, advancePaisa, orderDate, deliveryDate, status, note, createdAt}
  function validateCustomer(c) {
    const errs = [];
    if (!c || typeof c !== 'object') return ['invalid'];
    if (!c.name || !String(c.name).trim()) errs.push('name');
    else if (String(c.name).trim().length > 80) errs.push('nameLong');
    if (c.phone && !isValidBdMobile(c.phone)) errs.push('phone');
    if (!GARMENTS.includes(c.garment)) errs.push('garment');
    const m = c.measurements || {};
    let anyMeasure = false;
    for (const f of MEASURE_FIELDS) {
      const v = m[f.key];
      if (v === null || v === undefined || v === '') continue;
      const n = Number(v);
      if (!isFinite(n) || n < f.min || n > f.max) errs.push('measure:' + f.key);
      else anyMeasure = true;
    }
    if (!anyMeasure) errs.push('noMeasure');
    if (!Number.isInteger(c.pricePaisa) || c.pricePaisa < 0) errs.push('price');
    if (!Number.isInteger(c.advancePaisa) || c.advancePaisa < 0) errs.push('advance');
    if (Number.isInteger(c.pricePaisa) && Number.isInteger(c.advancePaisa) && c.advancePaisa > c.pricePaisa) errs.push('advanceOver');
    if (c.orderDate && !isValidDateStr(c.orderDate)) errs.push('orderDate');
    if (c.deliveryDate && !isValidDateStr(c.deliveryDate)) errs.push('deliveryDate');
    if (isValidDateStr(c.orderDate) && isValidDateStr(c.deliveryDate) && c.deliveryDate < c.orderDate) errs.push('dateOrder');
    if (!STATUSES.includes(c.status)) errs.push('status');
    return errs;
  }

  function duePaisa(c) { return (c.pricePaisa || 0) - (c.advancePaisa || 0); }
  function nextStatus(s) {
    const i = STATUSES.indexOf(s);
    return i >= 0 && i < STATUSES.length - 1 ? STATUSES[i + 1] : null;
  }
  function deliveryBadge(c, today) {
    if (!c.deliveryDate || c.status === 'delivered') return null;
    const d = daysBetween(today, c.deliveryDate);
    if (d < 0) return { kind: 'overdue', days: -d };
    if (d === 0) return { kind: 'today', days: 0 };
    if (d <= 3) return { kind: 'soon', days: d };
    return null;
  }
  function dashboardStats(customers, today) {
    const active = customers.filter(c => c.status !== 'delivered');
    let overdue = 0, dueToday = 0, totalDue = 0;
    for (const c of active) {
      totalDue += duePaisa(c);
      const b = deliveryBadge(c, today);
      if (b && b.kind === 'overdue') overdue++;
      if (b && b.kind === 'today') dueToday++;
    }
    return { total: customers.length, active: active.length, overdue, dueToday, totalDuePaisa: totalDue };
  }
  function filterCustomers(customers, query, statusFilter) {
    const q = String(query || '').trim().toLowerCase();
    return customers.filter(c => {
      if (statusFilter && statusFilter !== 'all' && c.status !== statusFilter) return false;
      if (!q) return true;
      return c.name.toLowerCase().includes(q) ||
        (c.phone || '').includes(q) ||
        (c.garment || '').toLowerCase().includes(q);
    });
  }
  function sortCustomers(customers, today) {
    // Overdue first, then earliest delivery date, then newest created.
    const rank = c => {
      const b = deliveryBadge(c, today);
      if (b && b.kind === 'overdue') return 0;
      if (c.status === 'delivered') return 3;
      return c.deliveryDate ? 1 : 2;
    };
    return [...customers].sort((a, b) => {
      const r = rank(a) - rank(b);
      if (r !== 0) return r;
      if (a.deliveryDate && b.deliveryDate && a.deliveryDate !== b.deliveryDate)
        return a.deliveryDate < b.deliveryDate ? -1 : 1;
      return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
    });
  }

  function validateImport(data) {
    if (!data || typeof data !== 'object') return 'notObject';
    if (data.app !== APP) return 'wrongApp';
    if (data.version !== VERSION) return 'wrongVersion';
    if (!Array.isArray(data.customers)) return 'noCustomers';
    for (const c of data.customers) {
      if (typeof c.id !== 'string' || !c.id) return 'badId';
      const errs = validateCustomer(c);
      if (errs.length) return 'badCustomer:' + errs[0];
    }
    const ids = data.customers.map(c => c.id);
    if (new Set(ids).size !== ids.length) return 'dupId';
    return null;
  }

  const api = {
    APP, VERSION, GARMENTS, STATUSES, MEASURE_FIELDS,
    isValidDateStr, daysBetween, todayStr, toPaisa, fmtMoney, bnDigits,
    normalizePhone, isValidBdMobile, validateCustomer, duePaisa, nextStatus,
    deliveryBadge, dashboardStats, filterCustomers, sortCustomers, validateImport,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TailorLogic = api;
})(typeof window !== 'undefined' ? window : globalThis);
