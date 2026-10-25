// tailor-measure-bd \u2014 UI layer. Depends on TailorLogic + TailorI18n (loaded before).
'use strict';
(function () {
  const L = window.TailorLogic;
  const I18N = window.TailorI18n;
  const LS_KEY = 'tailor-measure-bd-v1';
  const LANG_KEY = 'tailor-measure-bd-lang';

  let lang = localStorage.getItem(LANG_KEY) || 'en';
  let customers = load();
  let editingId = null;
  let query = '';
  let statusFilter = 'all';

  function load() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return [];
      const data = JSON.parse(raw);
      const err = L.validateImport(data);
      return err ? [] : data.customers;
    } catch (e) { return []; }
  }
  function save() {
    localStorage.setItem(LS_KEY, JSON.stringify({ app: L.APP, version: L.VERSION, customers }));
  }
  function t(key) { return (I18N.STR[lang] && I18N.STR[lang][key]) || I18N.STR.en[key] || key; }
  function digits(s) { return lang === 'bn' ? L.bnDigits(s) : String(s); }
  function money(paisa) { return '\u09f3' + digits(L.fmtMoney(paisa)); }
  function garmentLabel(g) { return lang === 'bn' ? (I18N.GARMENT_BN[g] || g) : g; }
  function measureLabel(key, en) { return lang === 'bn' ? (I18N.MEASURE_BN[key] || en) : en; }
  function errText(code) {
    if (code.startsWith('measure:')) return t('err_measure');
    return t('err_' + code) || t('err_invalid');
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function uid() { return 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

  function applyLang() {
    document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
    document.querySelectorAll('[data-i18n-ph]').forEach(el => { el.placeholder = t(el.dataset.i18nPh); });
    document.documentElement.lang = lang === 'bn' ? 'bn' : 'en';
    document.getElementById('langBtn').textContent = lang === 'bn' ? 'English' : '\u09ac\u09be\u0982\u09b2\u09be';
    render();
  }

  function measureInputsHTML(values) {
    return L.MEASURE_FIELDS.map(f => {
      const v = values && values[f.key] != null ? values[f.key] : '';
      return '<label class="field"><span>' + esc(measureLabel(f.key, f.en)) + '</span>' +
        '<input type="number" step="0.25" min="' + f.min + '" max="' + f.max +
        '" data-measure="' + f.key + '" value="' + esc(v) + '" placeholder="\u2033"></label>';
    }).join('');
  }
  function garmentOptionsHTML(selected) {
    return L.GARMENTS.map(g =>
      '<option value="' + g + '"' + (g === selected ? ' selected' : '') + '>' + esc(garmentLabel(g)) + '</option>').join('');
  }

  function formHTML() {
    const c = editingId ? customers.find(x => x.id === editingId) : null;
    return '<form id="custForm" novalidate>' +
      '<div class="grid2">' +
      '<label class="field"><span data-i18n="name"></span><input id="fName" value="' + esc(c ? c.name : '') + '" maxlength="80"></label>' +
      '<label class="field"><span data-i18n="phone"></span><input id="fPhone" inputmode="tel" value="' + esc(c ? c.phone : '') + '" placeholder="01XXXXXXXXX"></label>' +
      '<label class="field"><span data-i18n="garment"></span><select id="fGarment">' + garmentOptionsHTML(c ? c.garment : 'Panjabi') + '</select></label>' +
      '<label class="field"><span data-i18n="price"></span><input id="fPrice" type="number" min="0" step="1" value="' + (c ? c.pricePaisa / 100 : '') + '"></label>' +
      '<label class="field"><span data-i18n="advance"></span><input id="fAdvance" type="number" min="0" step="1" value="' + (c ? c.advancePaisa / 100 : '') + '"></label>' +
      '<label class="field"><span data-i18n="orderDate"></span><input id="fOrderDate" type="date" value="' + esc(c ? c.orderDate : '') + '"></label>' +
      '<label class="field"><span data-i18n="deliveryDate"></span><input id="fDeliveryDate" type="date" value="' + esc(c ? c.deliveryDate : '') + '"></label>' +
      '</div>' +
      '<div class="sectionLabel" data-i18n="measurements"></div>' +
      '<div class="measureGrid">' + measureInputsHTML(c ? c.measurements : null) + '</div>' +
      '<label class="field"><span data-i18n="note"></span><input id="fNote" value="' + esc(c ? c.note : '') + '" maxlength="200"></label>' +
      '<p id="formError" class="error" role="alert"></p>' +
      '<div class="row"><button type="submit" class="btn primary" data-i18n="save"></button>' +
      (editingId ? '<button type="button" class="btn" id="cancelEdit" data-i18n="cancel"></button>' : '') + '</div>' +
      '</form>';
  }

  function badgeHTML(c, today) {
    const b = L.deliveryBadge(c, today);
    if (!b) return '';
    const label = b.kind === 'overdue' ? t('badge_overdue') + ' ' + digits(b.days) + ' ' + t('days')
      : b.kind === 'today' ? t('badge_today')
      : t('badge_soon') + ' ' + digits(b.days) + ' ' + t('days');
    return '<span class="badge ' + b.kind + '">' + esc(label) + '</span>';
  }

  function cardHTML(c, today) {
    const measures = L.MEASURE_FIELDS.filter(f => c.measurements[f.key] != null && c.measurements[f.key] !== '')
      .map(f => '<span class="chip">' + esc(measureLabel(f.key, f.en)) + ': ' + digits(c.measurements[f.key]) + '\u2033</span>').join('');
    const next = L.nextStatus(c.status);
    return '<article class="card" data-id="' + esc(c.id) + '">' +
      '<div class="cardHead"><div><strong>' + esc(c.name) + '</strong>' +
      (c.phone ? '<div class="muted">' + esc(c.phone) + '</div>' : '') + '</div>' +
      '<span class="status ' + c.status + '">' + esc(t('status_' + c.status)) + '</span></div>' +
      '<div class="row wrap">' + badgeHTML(c, today) +
      '<span class="chip">' + esc(garmentLabel(c.garment)) + '</span>' +
      (c.deliveryDate ? '<span class="chip">' + esc(t('delivery')) + ': ' + digits(c.deliveryDate) + '</span>' : '') +
      (c.orderDate ? '<span class="chip">' + esc(t('order')) + ': ' + digits(c.orderDate) + '</span>' : '') + '</div>' +
      '<div class="measures">' + measures + '</div>' +
      '<div class="moneyRow"><span>' + esc(t('total')) + ': ' + money(c.pricePaisa) + '</span>' +
      '<span>' + esc(t('paid')) + ': ' + money(c.advancePaisa) + '</span>' +
      '<strong>' + esc(t('due')) + ': ' + money(L.duePaisa(c)) + '</strong></div>' +
      (c.note ? '<p class="note">' + esc(c.note) + '</p>' : '') +
      '<div class="row wrap">' +
      '<button class="btn small" data-act="edit" data-i18n="edit"></button>' +
      (next ? '<button class="btn small primary" data-act="next">' + esc(t('moveNext')) + ' \u2192 ' + esc(t('status_' + next)) + '</button>' : '') +
      '<button class="btn small" data-act="print" data-i18n="printCard"></button>' +
      '<button class="btn small danger" data-act="delete" data-i18n="del"></button>' +
      '</div></article>';
  }

  function render() {
    const today = L.todayStr();
    const stats = L.dashboardStats(customers, today);
    document.getElementById('statCustomers').textContent = digits(stats.total);
    document.getElementById('statActive').textContent = digits(stats.active);
    document.getElementById('statOverdue').textContent = digits(stats.overdue);
    document.getElementById('statDueToday').textContent = digits(stats.dueToday);
    document.getElementById('statDue').textContent = money(stats.totalDuePaisa);
    document.getElementById('formWrap').innerHTML = formHTML();
    document.querySelectorAll('#formWrap [data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
    const filtered = L.sortCustomers(L.filterCustomers(customers, query, statusFilter), today);
    const list = document.getElementById('list');
    if (!customers.length) list.innerHTML = '<p class="empty" data-i18n="empty"></p>';
    else if (!filtered.length) list.innerHTML = '<p class="empty" data-i18n="emptySearch"></p>';
    else list.innerHTML = filtered.map(c => cardHTML(c, today)).join('');
    document.querySelectorAll('#list [data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
    bindForm();
    bindList();
  }

  function collectForm() {
    const measurements = {};
    document.querySelectorAll('[data-measure]').forEach(inp => {
      measurements[inp.dataset.measure] = inp.value === '' ? null : Number(inp.value);
    });
    const price = L.toPaisa(document.getElementById('fPrice').value);
    const advance = L.toPaisa(document.getElementById('fAdvance').value);
    return {
      id: editingId || uid(),
      name: document.getElementById('fName').value.trim(),
      phone: L.normalizePhone(document.getElementById('fPhone').value),
      garment: document.getElementById('fGarment').value,
      measurements,
      pricePaisa: isNaN(price) ? -1 : price,
      advancePaisa: isNaN(advance) ? -1 : advance,
      orderDate: document.getElementById('fOrderDate').value,
      deliveryDate: document.getElementById('fDeliveryDate').value,
      note: document.getElementById('fNote').value.trim(),
      status: editingId ? (customers.find(x => x.id === editingId) || {}).status || 'pending' : 'pending',
      createdAt: editingId ? (customers.find(x => x.id === editingId) || {}).createdAt || new Date().toISOString() : new Date().toISOString(),
    };
  }

  function bindForm() {
    const form = document.getElementById('custForm');
    form.addEventListener('submit', e => {
      e.preventDefault();
      const c = collectForm();
      const errs = L.validateCustomer(c);
      const errEl = document.getElementById('formError');
      if (errs.length) { errEl.textContent = errs.map(errText).join(' '); return; }
      if (editingId) customers = customers.map(x => x.id === editingId ? c : x);
      else customers.unshift(c);
      editingId = null;
      save();
      render();
      document.getElementById('formWrap').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    const cancel = document.getElementById('cancelEdit');
    if (cancel) cancel.addEventListener('click', () => { editingId = null; render(); });
  }

  function bindList() {
    document.querySelectorAll('#list .card').forEach(card => {
      const id = card.dataset.id;
      card.addEventListener('click', e => {
        const btn = e.target.closest('[data-act]');
        if (!btn) return;
        const act = btn.dataset.act;
        const c = customers.find(x => x.id === id);
        if (!c) return;
        if (act === 'delete') {
          if (confirm(t('confirmDelete'))) { customers = customers.filter(x => x.id !== id); save(); render(); }
        } else if (act === 'edit') {
          editingId = id; render();
          document.getElementById('formWrap').scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else if (act === 'next') {
          const next = L.nextStatus(c.status);
          if (next) { c.status = next; save(); render(); }
        } else if (act === 'print') {
          printCard(c);
        }
      });
    });
  }

  function printCard(c) {
    const measures = L.MEASURE_FIELDS.filter(f => c.measurements[f.key] != null && c.measurements[f.key] !== '')
      .map(f => '<tr><td>' + esc(measureLabel(f.key, f.en)) + '</td><td>' + digits(c.measurements[f.key]) + '\u2033</td></tr>').join('');
    document.getElementById('printArea').innerHTML =
      '<h2>' + esc(t('printTitle')) + ' \u2014 Tailor Measure BD</h2>' +
      '<p><strong>' + esc(c.name) + '</strong> \u00b7 ' + esc(garmentLabel(c.garment)) +
      (c.phone ? ' \u00b7 ' + esc(c.phone) : '') + '</p>' +
      '<table>' + measures + '</table>' +
      '<p>' + esc(t('total')) + ': ' + money(c.pricePaisa) + ' \u00b7 ' + esc(t('paid')) + ': ' + money(c.advancePaisa) +
      ' \u00b7 ' + esc(t('due')) + ': ' + money(L.duePaisa(c)) + '</p>' +
      (c.deliveryDate ? '<p>' + esc(t('delivery')) + ': ' + digits(c.deliveryDate) + '</p>' : '') +
      (c.note ? '<p>' + esc(c.note) + '</p>' : '');
    document.body.classList.add('printing');
    window.print();
    setTimeout(() => document.body.classList.remove('printing'), 500);
  }

  document.getElementById('langBtn').addEventListener('click', () => {
    lang = lang === 'bn' ? 'en' : 'bn';
    localStorage.setItem(LANG_KEY, lang);
    applyLang();
  });
  document.getElementById('searchInput').addEventListener('input', e => { query = e.target.value; render(); });
  document.querySelectorAll('[data-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
      statusFilter = btn.dataset.filter;
      document.querySelectorAll('[data-filter]').forEach(b => b.classList.toggle('active', b === btn));
      render();
    });
  });
  document.getElementById('exportBtn').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify({ app: L.APP, version: L.VERSION, customers }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'tailor-measure-bd.json';
    a.click();
    URL.revokeObjectURL(a.href);
  });
  document.getElementById('importFile').addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const msg = document.getElementById('dataMsg');
      try {
        const data = JSON.parse(reader.result);
        const err = L.validateImport(data);
        if (err) { msg.textContent = t('importBad') + err; msg.className = 'error'; return; }
        customers = data.customers;
        save(); render();
        msg.textContent = t('imported'); msg.className = 'ok';
      } catch (ex) { msg.textContent = t('importBad') + 'invalid JSON'; msg.className = 'error'; }
    };
    reader.readAsText(file);
    e.target.value = '';
  });
  document.getElementById('eraseBtn').addEventListener('click', () => {
    const v = prompt(t('eraseConfirm'));
    const msg = document.getElementById('dataMsg');
    if (v === 'DELETE') { customers = []; editingId = null; save(); render(); msg.textContent = t('erased'); msg.className = 'ok'; }
  });

  applyLang();
})();
