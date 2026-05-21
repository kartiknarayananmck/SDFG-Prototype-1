// SDFG v2.1 — App Logic

const $el = id => document.getElementById(id);

// ── Formatters ────────────────────────────────────────────────────────────────
const fmtD = n => {
  const a=Math.abs(n), s=n<0?'-':'+';
  if(a>=1000000) return s+'$'+(a/1000000).toFixed(1)+'M';
  if(a>=1000)    return s+'$'+Math.round(a/1000)+'K';
  return s+'$'+a.toLocaleString();
};
const fmtDol = n => {
  const a=Math.abs(n);
  if(a>=1000000) return '$'+(a/1000000).toFixed(2)+'M';
  if(a>=1000)    return '$'+Math.round(a/1000)+'K';
  return '$'+a.toLocaleString();
};
const fmtPct  = n => (n>=0?'+':'')+n.toFixed(1)+'%';
const fmtFid  = n => (n*100).toFixed(1)+'%';
const sc      = n => n>0?'pos':n<0?'neg':'flat';

// ── State ─────────────────────────────────────────────────────────────────────
const TABS = ['primary-opp','primary-leak','secondary-opp','secondary-leak','primary-opp2','primary-opp3'];
const SENS_THR = { low:5, medium:10, high:20, veryhigh:35 };

const ST = {
  sensitivity: 'high',
  persistence: 'p3',
  worklist:    'to-review',
  rxotc:       'all',
  activeTab:   'primary-opp',
  search:      '',
  rep:         '',
  selectedId:  null,
  selectedTab: null,
  fidWindow:   12,
  sparkChart:  null,
  fidChart:    null,
  prodStoreId: null,
  prodTab:     null,
  povRxOtc:   'all',
  prodSortCol: 'diffSales',
  prodSortDir: 'desc',
  prodChart:   null,
  scroll: Object.fromEntries(TABS.map(t => [t, { filtered:[], rendered:0, PAGE:30 }])),
  kpi2pw: 3,   // last-used pw snapshot for renderBatchKPI column header refresh
};

function getSignal(store) { return store.signals[ST.persistence]; }
// KPI/Relative tabs reuse primary-opp2 store pool — DB may not have their key
const dbFor = tab => DB[tab] || DB['primary-opp2'];

// ── Action / Worklist helpers (localStorage) ─────────────────────────────────
const ACTIONS_KEY = 'sdfg_store_actions';

function getStoreActions() {
  try { return JSON.parse(localStorage.getItem(ACTIONS_KEY) || '{}'); }
  catch (e) { return {}; }
}

function getStoreAction(storeId) {
  return getStoreActions()[storeId] || null;
}

// Returns the worklist bucket for a store based on its saved action.
// 'to-review' | 'actioned' | 'not-actionable' | 'snoozed'
function computeStoreWorklist(storeId) {
  const a = getStoreAction(storeId);
  if (!a || !a.action_status || a.action_status === 'New' || a.action_status === 'To Review') return 'to-review';
  if (a.action_status === 'Actioned') return 'actioned';
  if (a.action_status === 'Not Actionable (Permanent)') return 'not-actionable';
  if (a.action_status === 'Not Actionable (Temporary / Snooze)') {
    const today = new Date().toISOString().slice(0, 10);
    if (a.snooze_until && a.snooze_until >= today) return 'snoozed';
    return 'to-review'; // snooze expired — reactivate
  }
  return 'to-review';
}

// Returns HTML for the combined Action cell (badge + reason + update link)
function getActionCellHtml(storeId, updUrl) {
  const a     = getStoreAction(storeId);
  const today = new Date().toISOString().slice(0, 10);

  let icon = '', label = 'To Review', cls = 'sa-new', reasonTxt = '';

  if (a && a.action_status && a.action_status !== 'New' && a.action_status !== 'To Review') {
    const rc = (a.reason_code === 'Other (free text required)' && a.reason_other_text)
      ? a.reason_other_text
      : (a.reason_code || '').replace(' (free text required)', '');

    if (a.action_status === 'Actioned') {
      icon = '\u2705'; label = 'Actioned'; cls = 'sa-actioned'; reasonTxt = rc;
    } else if (a.action_status === 'Not Actionable (Permanent)') {
      icon = '\ud83d\udeab'; label = 'Not Actionable'; cls = 'sa-na'; reasonTxt = rc;
    } else if (a.action_status === 'Not Actionable (Temporary / Snooze)') {
      if (a.snooze_until && a.snooze_until >= today) {
        // Format snooze date as e.g. "Jun 04"
        const sd = new Date(a.snooze_until + 'T00:00:00');
        const shortDate = sd.toLocaleDateString('en-CA', { month: 'short', day: '2-digit' });
        icon = '\u23f3'; label = 'Snoozed (' + shortDate + ')'; cls = 'sa-snoozed'; reasonTxt = rc;
      }
      // else: expired — falls through to To Review defaults
    }
  }

  const iconHtml   = icon ? icon + ' ' : '';
  const reasonLine = reasonTxt
    ? '<div class="action-reason">' + reasonTxt + '</div>' : '';

  return `<a class="action-cell-link" href="${updUrl}" onclick="event.stopPropagation()"
     title="Click to update status">
    <span class="sa-badge ${cls}">${iconHtml}${label}</span>
    ${reasonLine}
  </a>`;
}

function showToast(msg) {
  let el = document.getElementById('status-toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'status-toast';
    el.className = 'status-toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add('visible');
  setTimeout(() => el.classList.remove('visible'), 3500);
}

// ── Filter & rank ─────────────────────────────────────────────────────────────
function buildFiltered(tab) {
  const src = DB[tab];
  const thr = SENS_THR[ST.sensitivity];
  const q   = ST.search.toLowerCase();
  return src.filter(d => {
    const sig = getSignal(d);
    if (Math.abs(sig.pct) < thr) return false;
    if (ST.worklist !== 'all' && computeStoreWorklist(d.id) !== ST.worklist) return false;
    if (q && !d.name.toLowerCase().includes(q) && !String(d.id).includes(q) && !d.city.toLowerCase().includes(q)) return false;
    if (ST.rep && d.rep !== ST.rep) return false;
    return true;
  }).sort((a,b) => Math.abs(getSignal(b).delta) - Math.abs(getSignal(a).delta));
}

// ── KPI-driven ranking for primary-opp2 ────────────────────────────────────
// Applies penalty multipliers (never removes stores) to down-rank:
//   Market-driven × 0.60 | Single-driver × 0.80 | Small + low-impact × 0.85
function buildFilteredKPI() {
  const thr = SENS_THR[ST.sensitivity];
  const q   = ST.search.toLowerCase();
  const pw  = getPW();
  return DB['primary-opp2'].filter(d => {
    const sig = getSignal(d);
    if (Math.abs(sig.pct) < thr) return false;
    if (ST.worklist !== 'all' && computeStoreWorklist(d.id) !== ST.worklist) return false;
    if (q && !d.name.toLowerCase().includes(q) && !String(d.id).includes(q) && !d.city.toLowerCase().includes(q)) return false;
    if (ST.rep && d.rep !== ST.rep) return false;
    return true;
  }).map(d => {
    const sig  = getSignal(d);
    const kpi  = computeKPIDiagnostics(d, pw);
    let   score = Math.abs(sig.delta);                        // base: |Signal $|
    if (kpi.divergence === 'Market-driven') score *= 0.60;   // Rule A
    if (kpi.concentration === 'Single')     score *= 0.80;   // Rule B
    if (d.sizeTier === 'S' && Math.abs(sig.delta) < 5000) score *= 0.85; // Rule C
    return { ...d, _kpi: kpi, _score: score };
  }).sort((a, b) => b._score - a._score);
}

// ── Relative Impact ranking for primary-opp3 ───────────────────────────────────────────
// Sort by ABS(Relative Impact $) DESC, tie-break by ABS(Actual $) DESC.
function buildFilteredOpp3() {
  const thr = SENS_THR[ST.sensitivity];
  const q   = ST.search.toLowerCase();
  const pw  = getPW();
  return DB['primary-opp2'].filter(d => {
    const sig = getSignal(d);
    if (Math.abs(sig.pct) < thr) return false;
    if (ST.worklist !== 'all' && computeStoreWorklist(d.id) !== ST.worklist) return false;
    if (q && !d.name.toLowerCase().includes(q) && !String(d.id).includes(q) && !d.city.toLowerCase().includes(q)) return false;
    if (ST.rep && d.rep !== ST.rep) return false;
    return true;
  }).map(d => {
    const ri = computeRelativeImpact(d, pw);
    return { ...d, _ri: ri };
  }).sort((a, b) => {
    const diff = Math.abs(b._ri.relativeImpact) - Math.abs(a._ri.relativeImpact);
    return diff !== 0 ? diff : Math.abs(b._ri.actual) - Math.abs(a._ri.actual);
  });
}

function refilter(tab) {
  const s = ST.scroll[tab];
  s.filtered = tab === 'primary-opp2' ? buildFilteredKPI()
             : tab === 'primary-opp3' ? buildFilteredOpp3()
             : buildFiltered(tab);
  s.rendered = 0;
  const tbody = $el('tbody-'+tab);
  if (tbody) tbody.innerHTML = '';
  if (tab === 'primary-opp2') renderBatchKPI(tab);
  else if (tab === 'primary-opp3') renderBatchOpp3(tab);
  else renderBatch(tab);
  const cnt = $el('count-'+tab);
  if (cnt) cnt.textContent = s.filtered.length + ' stores';
}

function refilterAll() { TABS.forEach(t => refilter(t)); }

// ── Render rows ───────────────────────────────────────────────────────────────
function renderBatch(tab) {
  if (tab === 'primary-opp2') { renderBatchKPI(tab); return; }
  if (tab === 'primary-opp3') { renderBatchOpp3(tab); return; }
  const s     = ST.scroll[tab];
  const tbody = $el('tbody-'+tab);
  if (!tbody || !s.filtered.length) return;
  const isPrimary = tab.startsWith('primary');
  const maxDelta  = Math.max(...s.filtered.map(d => Math.abs(getSignal(d).delta)));
  const batch     = s.filtered.slice(s.rendered, s.rendered + s.PAGE);
  if (!batch.length) return;

  const frag = document.createDocumentFragment();
  batch.forEach(d => {
    const sig    = getSignal(d);
    const cls    = sc(sig.delta);
    const barPct = Math.round(Math.abs(sig.delta)/maxDelta*100);
    const fidCol = isPrimary
      ? `<td class="fid-cell ${d.fidelity>=0.93?'fid-high':d.fidelity>=0.85?'fid-mid':'fid-low'}">${fmtFid(d.fidelity)}</td>`
      : `<td class="fid-na">—</td>`;

    const sigType = tab.includes('leak') ? 'Risk' : 'Opportunity';
    const updUrl  = `action_update.html?store_id=${d.id}&store_name=${encodeURIComponent(d.name)}&rep=${encodeURIComponent(d.rep)}&signal_type=${sigType}&return_tab=${tab}`;
    const tr = document.createElement('tr');
    tr.dataset.id = d.id; tr.dataset.tab = tab;
    if (d.id === ST.selectedId && tab === ST.selectedTab) tr.className = 'selected';
    tr.innerHTML = `
      <td class="edit-col"><a class="edit-icon-btn" href="${updUrl}" onclick="event.stopPropagation()" title="Update status">✏️</a></td>
      <td><div class="store-name">${d.name}</div><div class="store-meta">#${d.id} · ${d.city} · ${d.banner}</div></td>
      <td class="rep-cell">${d.rep}</td>
      <td><span class="sig-badge ${cls}">${fmtPct(sig.pct)}</span></td>
      ${fidCol}
      <td class="action-col">${getActionCellHtml(d.id, updUrl)}</td>
      <td class="delta-cell">
        <div class="delta-inner">
          <span class="delta-value ${cls}">${fmtD(sig.delta)}</span>
          <div class="delta-bar-wrap"><div class="delta-bar ${cls}" style="width:${barPct}%"></div></div>
        </div>
      </td>`;
    tr.addEventListener('click', () => selectStore(tab, d.id));
    frag.appendChild(tr);
  });
  tbody.appendChild(frag);
  s.rendered += batch.length;
}

// ── KPI Ranking render (primary-opp2 only) ────────────────────────────────────
function renderBatchKPI(tab) {
  const s     = ST.scroll[tab];
  const tbody = $el('tbody-'+tab);
  if (!tbody || !s.filtered.length) return;
  const maxScore = Math.max(...s.filtered.map(d => d._score)) || 1;
  const batch    = s.filtered.slice(s.rendered, s.rendered + s.PAGE);
  if (!batch.length) return;

  const pw      = getPW();
  const persFmt = pw === 2 ? '2-wk' : pw === 3 ? '3-wk' : '4-wk';

  const frag = document.createDocumentFragment();
  batch.forEach(d => {
    const sig  = getSignal(d);
    const cls  = sc(sig.delta);
    const barPct = Math.round(d._score / maxScore * 100);
    const kpi  = d._kpi;

    // ── Market Context classification (4-step hierarchy) ──────────────────────
    // Step 1 — Directional divergence (highest priority)
    //   Store moves opposite to both peers → Store-Led (Opposite to Market).
    // Step 2 — Magnitude dominance
    //   Same/partial direction but store % ≥ K× strongest peer → Store-Led (Outpacing).
    //   K=3.0: store growing 3× faster than any peer = store-specific driver.
    // Step 3 — Market-Driven
    //   Same direction AND store magnitude < 2× max peer → broad market effect.
    // Step 4 — Mixed / Unclear (true edge cases only)
    //   Peers disagree or magnitude is inconclusive. Must be rare.
    const K_DOMINANCE = 3.0;
    const storeAbsPct = Math.abs(kpi.storePct);
    const maxPeerPct  = Math.max(Math.abs(kpi.bannerPct), Math.abs(kpi.provPct), Math.abs(kpi.mckPct));
    const storeUp     = kpi.storePct >= 0;
    const bannerUp    = kpi.bannerPct >= 0;
    const provUp      = kpi.provPct   >= 0;
    const sameDir     = (storeUp === bannerUp) || (storeUp === provUp);
    const oppBoth     = (storeUp !== bannerUp) && (storeUp !== provUp);

    // Alignment note for tooltip (informational only — not a separate decision axis)
    const fmtK = n => (n >= 0 ? '+' : '') + n.toFixed(1) + '%';
    const alignNote = oppBoth
      ? 'Store direction is opposite to market trends.'
      : storeAbsPct >= K_DOMINANCE * Math.max(maxPeerPct, 0.1)
        ? `Store change exceeds peer magnitude by ~${Math.round(storeAbsPct / Math.max(maxPeerPct, 0.1))}×, despite similar direction.`
        : 'Store change is broadly aligned in direction and magnitude with market trends.';

    let mcLabel, mcCls;
    if (oppBoth) {
      // Step 1: opposite direction to both peers
      mcLabel = 'Store-Led (Opposite)'; mcCls = 'mc-led';
    } else if (storeAbsPct >= K_DOMINANCE * Math.max(maxPeerPct, 0.1)) {
      // Step 2: same/partial direction but magnitude dwarfs peers
      mcLabel = 'Store-Led (Outpacing)'; mcCls = 'mc-led';
    } else if (sameDir && storeAbsPct < 2 * Math.max(maxPeerPct, 0.1)) {
      // Step 3: same direction, broadly in-line magnitude → macro / market effect
      mcLabel = 'Market-Driven'; mcCls = 'mc-driven';
    } else {
      // Step 4: peers disagree or magnitude is inconclusive
      mcLabel = 'Mixed / Unclear'; mcCls = 'mc-mixed';
    }
    const mcTooltip = `${alignNote} | Store: ${fmtK(kpi.storePct)} · Banner (${d.banner}): ${fmtK(kpi.bannerPct)} · Province (${d.province}): ${fmtK(kpi.provPct)} · McK: ${fmtK(kpi.mckPct)}`;

    // Concentration badge colour
    const concCls = kpi.concentration === 'Single' ? 'conc-single' : 'conc-distr';
    const concLbl = kpi.concentration === 'Single' ? 'Single' : 'Distrib.';

    // Down-rank note (shown inline in delta cell)
    const penalties = [];
    if (kpi.divergence === 'Market-driven') penalties.push('mkt ×0.6');
    if (kpi.concentration === 'Single')     penalties.push('1-prod ×0.8');
    if (d.sizeTier === 'S' && Math.abs(sig.delta) < 5000) penalties.push('small ×0.85');
    const adjNote = penalties.length
      ? `<div class="rank-adj" title="Down-ranked: ${penalties.join(', ')}">↓ ${penalties.join(' · ')}</div>`
      : '';

    const tr = document.createElement('tr');
    tr.dataset.id = d.id; tr.dataset.tab = tab;
    if (d.id === ST.selectedId && tab === ST.selectedTab) tr.className = 'selected';
    tr.innerHTML = `
      <td>
        <div class="store-name">${d.name}</div>
        <div class="store-meta">#${d.id} · ${d.city} · ${d.province} · ${d.banner}</div>
      </td>
      <td class="rep-cell">${d.rep}</td>
      <td><span class="sig-badge ${cls}">${fmtPct(sig.pct)}</span></td>
      <td class="fid-cell ${d.fidelity>=0.93?'fid-high':d.fidelity>=0.85?'fid-mid':'fid-low'}">${fmtFid(d.fidelity)}</td>
      <td title="${mcTooltip}">
        <span class="mc-badge ${mcCls}">${mcLabel}</span>
      </td>
      <td title="Size tier based on L12M sales (terciles across 520 stores): S = Small · M = Medium · L = Large">
        <span class="tier-badge tier-${d.sizeTier}">${d.sizeTier}</span>
      </td>
      <td title="Concentration: top product drives &gt;70% of window delta = Single-driver">
        <span class="conc-badge ${concCls}">${concLbl}</span>
      </td>
      <td class="delta-cell">
        <div class="delta-inner">
          <span class="delta-value ${cls}">${fmtD(sig.delta)}</span>
          <div class="delta-bar-wrap"><div class="delta-bar ${cls}" style="width:${barPct}%"></div></div>
        </div>
        ${adjNote}
      </td>`;
    tr.addEventListener('click', () => selectStore(tab, d.id));
    frag.appendChild(tr);
  });
  tbody.appendChild(frag);
  s.rendered += batch.length;
}

// ── Relative Impact render (primary-opp3 only) ────────────────────────────────
function renderBatchOpp3(tab) {
  const s     = ST.scroll[tab];
  const tbody = $el('tbody-'+tab);
  if (!tbody || !s.filtered.length) return;
  const maxRI    = Math.max(...s.filtered.map(d => Math.abs(d._ri.relativeImpact))) || 1;
  const maxDelta = Math.max(...s.filtered.map(d => Math.abs(getSignal(d).delta))) || 1;
  const batch    = s.filtered.slice(s.rendered, s.rendered + s.PAGE);
  if (!batch.length) return;

  const frag = document.createDocumentFragment();
  batch.forEach(d => {
    const sig = getSignal(d);
    const ri  = d._ri;
    const cls = sc(sig.delta);
    const riCls = ri.relativeImpact > 0 ? 'pos' : ri.relativeImpact < 0 ? 'neg' : 'flat';
    const barPct = Math.round(Math.abs(ri.relativeImpact) / maxRI * 100);

    // Peer context badge
    const pcCls = ri.peerContext === 'Outperforming'   ? 'pc-out'
                : ri.peerContext === 'Underperforming' ? 'pc-under'
                :                                        'pc-inline';

    // Concentration badge
    const concCls = ri.concentration === 'Single' ? 'conc-single' : 'conc-distr';
    const concLbl = ri.concentration === 'Single' ? 'Single' : 'Distrib.';

    // Tooltip: show the peer share context (not raw columns per spec)
    const riTip = `Actual: ${fmtD(ri.actual)} · Expected (blended banner/prov/McK): ${fmtD(ri.expectedDelta)} · Relative Impact: ${fmtD(ri.relativeImpact)}`;
    const pcTip = `${ri.peerContext}: store's share of banner ${ri.bannerPct}% · province ${ri.provPct}% · McK ${ri.mckPct}%`;

    const tr = document.createElement('tr');
    tr.dataset.id = d.id; tr.dataset.tab = tab;
    if (d.id === ST.selectedId && tab === ST.selectedTab) tr.className = 'selected';
    tr.innerHTML = `
      <td>
        <div class="store-name">${d.name}</div>
        <div class="store-meta">#${d.id} · ${d.city} · ${d.province} · ${d.banner}</div>
      </td>
      <td class="rep-cell">${d.rep}</td>
      <td><span class="sig-badge ${cls}">${fmtPct(sig.pct)}</span></td>
      <td class="fid-cell ${d.fidelity>=0.93?'fid-high':d.fidelity>=0.85?'fid-mid':'fid-low'}">${fmtFid(d.fidelity)}</td>
      <td title="${riTip}">
        <div class="ri-cell">
          <span class="ri-value ${riCls}">${fmtD(ri.relativeImpact)}</span>
          <div class="delta-bar-wrap"><div class="delta-bar ${riCls}" style="width:${barPct}%"></div></div>
        </div>
      </td>
      <td title="${pcTip}">
        <span class="pc-badge ${pcCls}">${ri.peerContext}</span>
      </td>
      <td title="Size tier by L12M sales (terciles): S=Small · M=Medium · L=Large">
        <span class="tier-badge tier-${d.sizeTier}">${d.sizeTier}</span>
      </td>
      <td title="Concentration: top product drives >70% of window delta = Single-driver">
        <span class="conc-badge ${concCls}">${concLbl}</span>
      </td>
      <td class="delta-cell">
        <div class="delta-inner">
          <span class="delta-value ${cls}">${fmtD(sig.delta)}</span>
          <div class="delta-bar-wrap"><div class="delta-bar ${cls}" style="width:${Math.round(Math.abs(sig.delta)/maxDelta*100)}%"></div></div>
        </div>
      </td>`;
    tr.addEventListener('click', () => selectStore(tab, d.id));
    frag.appendChild(tr);
  });
  tbody.appendChild(frag);
  s.rendered += batch.length;
}

// ── Infinite scroll ───────────────────────────────────────────────────────────
const OBS = {};
function initObserver(tab) {
  if (OBS[tab]) OBS[tab].disconnect();
  const el = $el('sentinel-'+tab);
  if (!el) return;
  OBS[tab] = new IntersectionObserver(entries => {
    if (entries[0].isIntersecting) renderBatch(tab);
  });
  OBS[tab].observe(el);
}

// ── Tab switching ─────────────────────────────────────────────────────────────
function switchTab(tab) {
  ST.activeTab = tab;
  document.querySelectorAll('.tab-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.tab-panel').forEach(p =>
    p.classList.toggle('active', p.id === 'tab-'+tab));
  closePanel();
}

// ── Slicer handlers ───────────────────────────────────────────────────────────
function setSensitivity(v) {
  ST.sensitivity = v;
  document.querySelectorAll('[data-sens]').forEach(b => b.classList.toggle('active', b.dataset.sens===v));
  refilterAll();
}
function setPersistence(v) {
  ST.persistence = v;
  document.querySelectorAll('[data-persist]').forEach(b => b.classList.toggle('active', b.dataset.persist===v));
  refilterAll();
  // Redraw trend chart if a store is currently selected (window highlight changes)
  if (ST.selectedId && ST.selectedTab) {
    const store = dbFor(ST.selectedTab).find(d => d.id === ST.selectedId);
    if (store) requestAnimationFrame(() => drawTrendChart(store));
  }
}
function setWorklist(v) {
  ST.worklist = v;
  const sel = document.getElementById('worklist-select');
  if (sel) sel.value = v;
  document.body.classList.toggle('worklist-to-review', v === 'to-review');
  refilterAll();
}

// ── Sticky top recalculator ──────────────────────────────────────────────────────────
function fixStickyTops() {
  const HEADER_H = 52;
  const cb = document.getElementById('control-bar');
  const cbH = cb ? cb.offsetHeight : 0;
  const tabsNav = document.querySelector('.tabs-nav');
  if (tabsNav) {
    const navTop = HEADER_H + cbH;
    tabsNav.style.top = navTop + 'px';
    const navH = tabsNav.offsetHeight;
    document.querySelectorAll('.tab-subbar').forEach(el => {
      el.style.top = (navTop + navH) + 'px';
    });
  }
}
function setRxOtc(v) {
  ST.rxotc = v;
  document.querySelectorAll('[data-rxotc]').forEach(b => b.classList.toggle('active', b.dataset.rxotc===v));
  refilterAll();
  // Refresh product overlay if open
  if (ST.prodStoreId && ST.prodTab) {
    const store = dbFor(ST.prodTab).find(d => d.id === ST.prodStoreId);
    if (store) renderProductOverlay(store, ST.prodTab);
  }
}
function onSearch(v)  { ST.search = v; refilterAll(); }
function onRep(v)     { ST.rep = v;    refilterAll(); }

// ── Fiscal Year Utilities ────────────────────────────────────────────────────
// McKesson FY: April 1 → March 31  (e.g. FY27 = Apr 1 2026 – Mar 31 2027)
function getFiscalYear(date) {
  // If month >= April (0-indexed: 3), the FY rolls to year+1
  return date.getMonth() >= 3 ? date.getFullYear() + 1 : date.getFullYear();
}
function fyLabel(fyNum) { return 'FY' + String(fyNum).slice(-2); }

// ── 53-week trend chart helpers ───────────────────────────────────────────────
// Latest week ending: May 2, 2026 (Saturday)
const WEEK_LATEST = new Date(2026, 4, 2);

// Dynamic FY labels derived from WEEK_LATEST — no hardcoding needed
const CUR_FY      = getFiscalYear(WEEK_LATEST);          // e.g. 2027
const PREV_FY     = CUR_FY - 1;                          // e.g. 2026
const CUR_FY_LBL  = fyLabel(CUR_FY);                     // e.g. 'FY27'
const PREV_FY_LBL = fyLabel(PREV_FY);                    // e.g. 'FY26'
// First day of current FY (Apr 1)
const CUR_FY_START = new Date(CUR_FY - 1, 3, 1);         // Apr 1 of start-year
// FYTD week count: how many weeks from Apr 1 of current FY to WEEK_LATEST
const FYTD_WEEKS  = Math.floor((WEEK_LATEST - CUR_FY_START) / (7 * 24 * 3600 * 1000)) + 1;

function getWeekLabels() {
  const out = [];
  for (let i = 0; i < 53; i++) {
    const d = new Date(WEEK_LATEST);
    d.setDate(d.getDate() - (52 - i) * 7);
    out.push(d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' }));
  }
  return out;
}
// Short x-axis tick — show only if week is near the 1st of a month
function getTickLabels() {
  const out = [];
  for (let i = 0; i < 53; i++) {
    const d = new Date(WEEK_LATEST);
    d.setDate(d.getDate() - (52 - i) * 7);
    // Show label every ~4 weeks (roughly monthly grid)
    out.push(d.getDate() <= 7 ? d.toLocaleString('en-CA', { month: 'short', year: 'numeric' }) : '');
  }
  return out;
}
function computeStats(w) {
  const n   = w.length;
  const mean = w.reduce((a,b)=>a+b,0)/n;
  const variance = w.reduce((a,b)=>a+(b-mean)**2,0)/(n-1);
  const sd  = Math.sqrt(variance);
  return { mean: Math.round(mean), upper: Math.round(mean + 1.5*sd), lower: Math.round(Math.max(0, mean - 1.5*sd)) };
}
function getPercentileRank(sorted, value) {
  let count = 0;
  for (const v of sorted) { if (v <= value) count++; }
  const pct = Math.round((count / sorted.length) * 100);
  const sfx = pct === 1 ? 'st' : pct === 2 ? 'nd' : pct === 3 ? 'rd' : 'th';
  return pct + sfx;
}
const WEEK_LABELS = getWeekLabels();
const TICK_LABELS = getTickLabels();

// Persistence window length in weeks
function getPW() { return ST.persistence === 'p2' ? 2 : ST.persistence === 'p3' ? 3 : 4; }

// ── Seasonality Context ───────────────────────────────────────────────────────
// Compares current persistence window vs same calendar weeks one year ago.
// Uses existing 53-week array only — no forecasting, no scoring.
function getSeasonality(store, pw) {
  const w = store.weekly;
  // Need at least 2*pw weeks for a valid LY comparison
  if (!w || w.length < pw * 2 + 1) {
    return { icon:'\u2139\ufe0f', text:'Not available for same period last year', hint:'' };
  }

  // Current window: last pw weeks
  const winCur   = w.slice(-pw).reduce((a,b) => a+b, 0);
  // Prior window (immediately before current): used to compute cur signal direction
  const winPrior = w.slice(-(pw*2), -pw).reduce((a,b) => a+b, 0);

  // Same calendar window last year: first pw weeks of the 53-week array (≈52 weeks ago)
  const winLY    = w.slice(0, pw).reduce((a,b) => a+b, 0);
  // Period before LY window
  const winLYpre = w.slice(pw, pw*2).reduce((a,b) => a+b, 0);

  // Guard: if LY data is negligible, no useful comparison
  if (winLY < 50) {
    return { icon:'\u2139\ufe0f', text:'No clear seasonal pattern last year', hint:'' };
  }

  // Directional signals (positive = rising vs prior reference)
  const curSignal = winCur  - winPrior;
  const lySignal  = winLY   - winLYpre;

  // How significant was the LY move relative to LY baseline?
  const lyPct = winLY > 0 ? lySignal / winLY : 0;

  // Directional hint for LY
  let hint;
  if (Math.abs(lyPct) < 0.05)       hint = 'Last year: → flat';
  else if (lySignal > 0)             hint = 'Last year: \u2191 spike';
  else                               hint = 'Last year: \u2193 dip';

  // If LY was essentially flat, call it "no clear pattern"
  if (Math.abs(lyPct) < 0.04) {
    return { icon:'\u2139\ufe0f', text:'No clear seasonal pattern last year', hint };
  }

  // Compare directions
  const sameDir = (curSignal >= 0 && lySignal >= 0) || (curSignal < 0 && lySignal < 0);
  return sameDir
    ? { icon:'\u2705', text:'Similar pattern observed same period last year', hint }
    : { icon:'\u26a0\ufe0f', text:'Different from same period last year', hint };
}

// ── Build 12-month monthly aggregated data from weekly for sparkline ──────────
function getMonthlyWeekly(store) {
  const weeks = store.weekly.slice(-52);
  const months = [];
  const ref = new Date(2026, 3, 1);
  for (let i = 11; i >= 0; i--) {
    const d = new Date(ref.getFullYear(), ref.getMonth()-i, 1);
    const lbl = d.toLocaleString('en-CA',{month:'short'});
    const start = Math.round((11-i)/12 * 52);
    const end   = Math.round((12-i)/12 * 52);
    const sum   = weeks.slice(start, end).reduce((a,b)=>a+b, 0);
    months.push({ lbl, val: sum });
  }
  return months;
}

// ── Store selection → panel ───────────────────────────────────────────────────
function selectStore(tab, id) {
  if (ST.selectedId === id && ST.selectedTab === tab) { closePanel(); return; }
  ST.selectedId  = id;
  ST.selectedTab = tab;
  document.querySelectorAll('.ranked-table tbody tr').forEach(tr =>
    tr.classList.toggle('selected', parseInt(tr.dataset.id)===id && tr.dataset.tab===tab));
  const src   = dbFor(tab);
  const store = src.find(d => d.id === id);
  if (store) openPanel(store, tab);
}

function openPanel(store, tab) {
  if (ST.sparkChart) { ST.sparkChart.destroy(); ST.sparkChart = null; }
  const sig       = getSignal(store);
  const isPrimary = tab.startsWith('primary');
  const isLeak    = tab.endsWith('-leak');
  const persLabel = ST.persistence==='p2'?'2-wk':ST.persistence==='p3'?'3-wk':'4-wk';
  const sensLabel = ST.sensitivity.charAt(0).toUpperCase()+ST.sensitivity.slice(1);

  // Header
  $el('dp-store').textContent = `${store.id} — ${store.name}`;
  $el('dp-sub').textContent   = `${store.city}  ·  ${store.rep}  ·  ${store.banner}`;

  // Insight band
  const fytdGrowthDol = Math.round(store.fytdSales * store.fytdGrowth);
  const fidL1Chip = isPrimary
    ? `<div class="ib-chip"><div class="ib-lbl">Fidelity (L1 Month)</div><div class="ib-val ${store.fidelity>=0.93?'pos':store.fidelity>=0.80?'warn':'neg'}">${fmtFid(store.fidelity)}</div></div>` : '';
  const leakChip = (isPrimary && isLeak)
    ? `<div class="ib-sep"></div><div class="ib-chip"><div class="ib-lbl">Est. Leakage $</div><div class="ib-val neg">${fmtDol(store.leakage)}</div></div>` : '';
  $el('dp-insight').innerHTML = `
    <div class="ib-group">
      <div class="ib-group-lbl">${PREV_FY_LBL}</div>
      <div class="ib-group-chips">
        <div class="ib-chip"><div class="ib-lbl">FY Sales</div><div class="ib-val">${fmtDol(store.priorFYSales)}</div></div>
        <div class="ib-chip"><div class="ib-lbl">Growth %</div><div class="ib-val ${sc(store.priorFYGrowth)}">${(store.priorFYGrowth*100).toFixed(1)}%</div></div>
      </div>
    </div>
    <div class="ib-sep"></div>
    <div class="ib-group">
      <div class="ib-group-lbl">FYTD (${CUR_FY_LBL} — ${WEEK_LATEST.toLocaleDateString('en-CA',{month:'short',day:'numeric'})})</div>
      <div class="ib-group-chips">
        <div class="ib-chip"><div class="ib-lbl">Sales</div><div class="ib-val">${fmtDol(store.fytdSales)}</div></div>
        <div class="ib-chip"><div class="ib-lbl">Growth vs LY %</div><div class="ib-val ${sc(store.fytdGrowth)}">${(store.fytdGrowth*100).toFixed(1)}%</div></div>
        <div class="ib-chip"><div class="ib-lbl">Growth vs LY $</div><div class="ib-val ${sc(fytdGrowthDol)}">${fmtD(fytdGrowthDol)}</div></div>
        ${fidL1Chip}
      </div>
    </div>
    <div class="ib-sep"></div>
    <div class="ib-group">
      <div class="ib-group-lbl">Actuals</div>
      <div class="ib-group-chips">
        <div class="ib-chip"><div class="ib-lbl">Last ${persLabel} Sales</div><div class="ib-val">${fmtDol(store.trends.w3)}</div></div>
        <div class="ib-chip"><div class="ib-lbl">Signal ${persLabel}</div><div class="ib-val ${sc(sig.delta)}">${fmtPct(sig.pct)}</div></div>
        <div class="ib-chip ib-chip--highlight"><div class="ib-lbl">Signal $ Delta</div><div class="ib-val ${sc(sig.delta)}">${fmtD(sig.delta)}</div></div>
      </div>
    </div>
    ${leakChip}`;

  // Narrative in chart meta area
  const narr = sig.delta > 0
    ? `📈 Sales <strong>up ${fmtPct(sig.pct)}</strong> (${fmtD(sig.delta)}) over the last ${persLabel} vs prior — Sensitivity: ${sensLabel}`
    : `📉 Sales <strong>down ${fmtPct(sig.pct)}</strong> (${fmtD(sig.delta)}) over the last ${persLabel} vs prior — Sensitivity: ${sensLabel}`;
  $el('dp-narrative').innerHTML = narr;
  const scEl = $el('dp-scenario');
  if (store.fidScenario) {
    const map = { A:'Signal ↑ · Fidelity ↑', B:'Signal ↑ · Fidelity ↓', C:'Signal ↓ · Fidelity stable', D:'Signal ↓ · Fidelity ↓' };
    scEl.textContent = map[store.fidScenario] || '';
    scEl.style.display = '';
  } else {
    scEl.style.display = 'none';
  }

  // Action bar
  const fidBtn = isPrimary
    ? `<button class="act-btn act-btn--primary" onclick="openFidelity(${store.id})">📊 See Fidelity Data</button>` : '';
  const sigTypePanel = tab.includes('leak') ? 'Risk' : 'Opportunity';
  const updUrlPanel  = `action_update.html?store_id=${store.id}&store_name=${encodeURIComponent(store.name)}&rep=${encodeURIComponent(store.rep)}&signal_type=${sigTypePanel}&return_tab=${tab}`;
  $el('dp-actions').innerHTML = `
    ${fidBtn}
    <button class="act-btn act-btn--primary" onclick="openProductTrend(${store.id},'${tab}')">📦 Analyse Product Trend</button>
    <a class="act-btn act-btn--primary" href="${updUrlPanel}">✏️ Update Status</a>
    <button class="act-btn act-btn--ghost" onclick="closePanel()">✕ Close</button>`;

  document.body.classList.add('panel-open');
  $el('detail-panel').classList.add('visible');

  // Draw 53-week chart after layout settles
  requestAnimationFrame(() => drawTrendChart(store));
}

function closePanel() {
  ST.selectedId = ST.selectedTab = null;
  if (ST.sparkChart) { ST.sparkChart.destroy(); ST.sparkChart = null; }
  document.querySelectorAll('.ranked-table tbody tr').forEach(tr => tr.classList.remove('selected'));
  document.body.classList.remove('panel-open');
  $el('detail-panel').classList.remove('visible');
}

// ── 53-Week Trend Chart ───────────────────────────────────────────────────────
function drawTrendChart(store) {
  if (ST.sparkChart) { ST.sparkChart.destroy(); ST.sparkChart = null; }
  const canvas = $el('trend-canvas');
  if (!canvas || typeof Chart === 'undefined') return;

  const w      = store.weekly;           // 53 weekly values
  const pw     = getPW();                // persistence window weeks
  const stats  = computeStats(w);
  const sorted = [...w].sort((a,b)=>a-b);

  // Persistence window dataset: non-null only for last pw weeks
  const winData = w.map((v, i) => i >= 53 - pw ? v : null);

  // Point radius: larger for window weeks
  const ptRadius = w.map((v, i) => i >= 53 - pw ? 4 : 0);
  const ptColor  = w.map((v, i) => i >= 53 - pw ? '#1a1a80' : 'rgba(0,87,184,0.7)');

  ST.sparkChart = new Chart(canvas, {
    data: {
      labels: WEEK_LABELS,
      datasets: [
        {
          type: 'bar',
          label: 'Sales In Window',
          data: winData,
          backgroundColor: 'rgba(26,26,128,0.75)',
          borderRadius: 2,
          order: 1,
          yAxisID: 'y',
        },
        {
          type: 'line',
          label: 'Actual Sales',
          data: w,
          borderColor: '#0057B8',
          backgroundColor: 'rgba(0,87,184,0.10)',
          borderWidth: 2,
          pointRadius: ptRadius,
          pointBackgroundColor: ptColor,
          tension: 0.25,
          fill: 'origin',
          order: 2,
          yAxisID: 'y',
        },
        {
          type: 'line',
          label: 'Weekly Average',
          data: Array(53).fill(stats.mean),
          borderColor: '#555',
          borderDash: [7, 4],
          borderWidth: 1.5,
          pointRadius: 0,
          fill: false,
          order: 3,
          yAxisID: 'y',
        },
        {
          type: 'line',
          label: 'Upper Threshold',
          data: Array(53).fill(stats.upper),
          borderColor: '#1A7A4A',
          borderDash: [4, 3],
          borderWidth: 1.2,
          pointRadius: 0,
          fill: false,
          order: 4,
          yAxisID: 'y',
        },
        {
          type: 'line',
          label: 'Lower Threshold',
          data: Array(53).fill(stats.lower),
          borderColor: '#C0392B',
          borderDash: [4, 3],
          borderWidth: 1.2,
          pointRadius: 0,
          fill: false,
          order: 5,
          yAxisID: 'y',
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          position: 'top',
          labels: { font: { size: 10 }, usePointStyle: true, boxWidth: 8 }
        },
        tooltip: {
          backgroundColor: 'rgba(255,255,255,0.97)',
          borderColor: '#ccc',
          borderWidth: 1,
          titleColor: '#1A1F36',
          bodyColor: '#1A1F36',
          titleFont: { weight: '700', size: 12 },
          bodyFont: { size: 11 },
          padding: 10,
          callbacks: {
            title(items) {
              return 'Week ending  ' + items[0].label;
            },
            label(item) {
              if (item.dataset.label === 'Sales In Window' && item.parsed.y === null) return null;
              const v = item.parsed.y;
              if (item.dataset.label === 'Actual Sales') {
                const pct = getPercentileRank(sorted, v);
                return [
                  '  Actual Sales        ' + fmtDol(v),
                  '  Weekly Average   ' + fmtDol(stats.mean),
                  '  Lower Threshold  ' + fmtDol(stats.lower),
                  '  Percentile           ' + pct,
                ];
              }
              return null;
            },
            filter(item) { return item.dataset.label === 'Actual Sales'; }
          }
        }
      },
      scales: {
        y: {
          ticks: { callback: v => fmtDol(v), font: { size: 9 } },
          grid:  { color: 'rgba(0,0,0,0.04)' },
          beginAtZero: true,
        },
        x: {
          ticks: {
            callback(val, idx) { return TICK_LABELS[idx]; },
            font: { size: 9 },
            color: '#6B7280',
            maxRotation: 0,
          },
          grid: { color: 'rgba(0,0,0,0.03)' }
        }
      }
    }
  });
}

// ── Fidelity full overlay ─────────────────────────────────────────────────────
function openFidelity(storeId) {
  const store = DB_PRIMARY.find(d => d.id === storeId);
  if (!store) return;
  ST.fidWindow = 12;
  renderFidelityOverlay(store);
  $el('fid-overlay').classList.add('visible');
}

function closeFidelity() {
  $el('fid-overlay').classList.remove('visible');
  if (ST.fidChart) { ST.fidChart.destroy(); ST.fidChart = null; }
}

function setFidW(storeId, w) {
  ST.fidWindow = w;
  const store = DB_PRIMARY.find(d=>d.id===storeId);
  if (store) renderFidelityOverlay(store);
}

function renderFidelityOverlay(store) {
  const w    = ST.fidWindow;
  const hist = store.fidelityHistory.slice(-w);
  const full = store.fidelityHistory; // always the full 12-month array
  const tf   = store.fidTimeframes;   // pre-computed over full 12-month history

  // ── KPI calculations ───────────────────────────────────────────────────────
  const latestFid  = full[full.length-1].fidelity * 100;
  // Rolling L3M = last 3 months of full history; Prior L3M = 3 months before that
  const cur3   = full.slice(-3);
  const prior3 = full.slice(-6, -3);
  const fidL3M    = cur3.reduce((a,m)=>a+m.fidelity,0) / cur3.length * 100;
  const fidPrior3 = prior3.length ? prior3.reduce((a,m)=>a+m.fidelity,0) / prior3.length * 100 : null;
  const fidChg3M  = fidPrior3 != null ? +(fidL3M - fidPrior3).toFixed(1) : null;

  // L12M market totals (from pre-computed timeframes)
  const l12Iqvia = tf.L12M.iqviaTot;
  const l12Mck   = tf.L12M.mckTot;
  const l12Gap   = l12Iqvia - l12Mck;

  // Gain/Leakage for L3M — from McKesson $ change vs prior 3 months
  const gl3 = tf.L3M.gainLeak;
  const gl3IsGain = gl3 != null && gl3 >= 0;
  const gl3Lbl = gl3 == null ? 'N/A' : (gl3IsGain ? 'Gain' : 'Leakage');
  const gl3Cls = gl3 == null ? '' : (gl3IsGain ? 'pos' : 'neg');
  const gl3Val = gl3 == null ? 'N/A' : (gl3IsGain ? '+' : '') + fmtDol(gl3);

  // Trend direction for header info
  const h1 = hist.slice(0, Math.floor(hist.length/2));
  const h2 = hist.slice(Math.floor(hist.length/2));
  const improving = h2.length > 0 && h1.length > 0 &&
    h2.reduce((a,b)=>a+b.fidelity,0)/h2.length > h1.reduce((a,b)=>a+b.fidelity,0)/h1.length;
  const tLbl = improving ? '↑ Improving' : '↓ Declining';
  const tCls = improving ? 'pos' : 'neg';

  // Month labels for rolling window description
  const cur3Start  = cur3[0]   ? cur3[0].month   : '–';
  const cur3End    = cur3[2]   ? cur3[2].month   : cur3[cur3.length-1].month;
  const prior3Start = prior3[0] ? prior3[0].month : '–';
  const prior3End   = prior3[2] ? prior3[2].month : prior3.length ? prior3[prior3.length-1].month : '–';

  // ── Timeframe table rows (full 7-column layout) ─────────────────────────────
  const TF_LABELS = { L1M:'Last 1 Month', L3M:'Last 3 Months', L6M:'Last 6 Months', L12M:'Last 12 Months' };
  const tfRows = ['L1M','L3M','L6M','L12M'].map(k => {
    const x   = tf[k];
    const gap = x.iqviaTot - x.mckTot;
    // Fidelity change colouring
    const chgCls   = x.chg > 0 ? 'pos' : x.chg < 0 ? 'neg' : '';
    const chgArrow = x.chg > 0 ? '▲' : x.chg < 0 ? '▼' : '–';
    const chgStr   = x.chg === 0 ? '–' : `${chgArrow} ${Math.abs(x.chg).toFixed(1)}%`;
    // Gain vs Leakage
    const gl = x.gainLeak;
    const glIsGain = gl != null && gl >= 0;
    const glCls = gl == null ? '' : (glIsGain ? 'pos' : 'neg');
    const glLbl = gl == null ? 'Not Available' : (glIsGain ? '▲ ' : '▼ ') + fmtDol(Math.abs(gl));
    return `<tr>
      <td class="tf-key" title="${TF_LABELS[k]}">${k}</td>
      <td>${fmtDol(x.iqviaTot)}</td>
      <td>${fmtDol(x.directTot)}</td>
      <td class="neg">${fmtDol(x.indirectTot)}</td>
      <td>${fmtDol(x.mckTot)}</td>
      <td class="neg">${fmtDol(gap)}</td>
      <td>${x.fid.toFixed(1)}%</td>
      <td class="${chgCls}">${chgStr}</td>
      <td class="${glCls}">${glLbl}</td>
    </tr>`;
  }).join('');

  $el('fid-overlay-body').innerHTML = `
    <div class="fid-lag-notice">⏱ Fidelity data sourced from IQVIA — latest available month: <strong>${FID_LAG_LABEL}</strong>. Reflects <strong>Previous FY (PY – ${PREV_FY_LBL})</strong> and <strong>FYTD (Current FY – ${CUR_FY_LBL})</strong>.</div>
    <div class="fov-header-row">
      <div class="fov-title">📊 Fidelity — ${store.name}</div>
      <div class="fov-time-btns">
        <button class="time-btn ${w===3?'active':''}" onclick="setFidW(${store.id},3)">3M</button>
        <button class="time-btn ${w===6?'active':''}" onclick="setFidW(${store.id},6)">6M</button>
        <button class="time-btn ${w===12?'active':''}" onclick="setFidW(${store.id},12)">12M</button>
      </div>
    </div>

    <div class="fov-kpi-strip">
      <div class="fov-kpi">
        <div class="lbl">Latest Fidelity (as of ${FID_LAG_LABEL})</div>
        <div class="val ${latestFid>=93?'pos':latestFid>=85?'warn':'neg'}">${latestFid.toFixed(1)}%</div>
      </div>
      <div class="fov-kpi">
        <div class="lbl">Fidelity – Last 3 Months<br><span class="kpi-sub">${cur3Start} – ${cur3End}</span></div>
        <div class="val ${fidL3M>=93?'pos':fidL3M>=85?'warn':'neg'}">${fidL3M.toFixed(1)}%</div>
      </div>
      <div class="fov-kpi">
        <div class="lbl">Fidelity – Prior 3 Months<br><span class="kpi-sub">${prior3Start} – ${prior3End}</span></div>
        <div class="val">${fidPrior3 != null ? fidPrior3.toFixed(1)+'%' : 'N/A'}</div>
      </div>
      <div class="fov-kpi">
        <div class="lbl">Fidelity Change (L3M vs Prior 3M)</div>
        <div class="val ${fidChg3M!=null&&fidChg3M>=0?'pos':fidChg3M!=null&&fidChg3M<0?'neg':''}">${
          fidChg3M != null ? (fidChg3M>=0?'+':'')+fidChg3M.toFixed(1)+'%' : 'N/A'
        }</div>
      </div>
      <div class="fov-kpi">
        <div class="lbl">${gl3Lbl} – Last 3 Months vs Prior 3 Months</div>
        <div class="val ${gl3Cls}">${gl3Val}</div>
      </div>
      <div class="fov-kpi fov-kpi--sep">
        <div class="lbl">Total Customer Sales – L12M<br><span class="kpi-sub">Source: IQVIA</span></div>
        <div class="val">${fmtDol(l12Iqvia)}</div>
      </div>
      <div class="fov-kpi" title="Direct purchases are orders placed directly with manufacturers (e.g. Apotex) and delivered straight to the pharmacy. This channel is often driven by manufacturer programs or product availability and may be less directly controllable by sales reps.">
        <div class="lbl">Direct (IQVIA) – L12M <span class="th-info">ℹ</span></div>
        <div class="val">${fmtDol(tf.L12M.directTot)}</div>
      </div>
      <div class="fov-kpi" title="Indirect purchases represent volume sourced from other wholesale distributors (McKesson competitors). This is typically the most actionable form of leakage for sales reps.">
        <div class="lbl">Indirect (IQVIA) – L12M <span class="th-info">ℹ</span></div>
        <div class="val neg">${fmtDol(tf.L12M.indirectTot)}</div>
      </div>
      <div class="fov-kpi">
        <div class="lbl">McKesson Sales (IQVIA) – L12M</div>
        <div class="val">${fmtDol(l12Mck)}</div>
      </div>
    </div>

    <div class="fov-content">
      <div class="fov-chart-col">
        <div class="fov-chart-wrap"><canvas id="fid-canvas"></canvas></div>
      </div>
      <div class="fov-table-col">
        <div class="fov-section-title">Fidelity by Timeframe &nbsp;<span style="font-weight:400;text-transform:none;font-size:10px">All periods use rolling windows from ${FID_LAG_LABEL}</span></div>
        <div style="overflow-x:auto">
          <table class="tf-table">
            <thead>
              <tr>
                <th>Period</th>
                <th>Total Sales (IQVIA)</th>
                <th title="Direct purchases are orders placed directly with manufacturers (e.g. Apotex) and delivered straight to the pharmacy. This channel is often driven by manufacturer programs or product availability and may be less directly controllable by sales reps.">Direct (IQVIA) <span class="th-info">ℹ</span></th>
                <th title="Indirect purchases represent volume sourced from other wholesale distributors (McKesson competitors). This is typically the most actionable form of leakage for sales reps.">Indirect (IQVIA) <span class="th-info">ℹ</span></th>
                <th>McKesson Sales (IQVIA)</th>
                <th>Gap (Total − McK)</th>
                <th>Fidelity %</th>
                <th>Fidelity Chg</th>
                <th>Gain / Leakage ($)</th>
              </tr>
            </thead>
            <tbody>${tfRows}</tbody>
          </table>
        </div>
      </div>
    </div>`;

  requestAnimationFrame(() => drawFidChart(hist));
}

function drawFidChart(hist) {
  if (ST.fidChart) { ST.fidChart.destroy(); ST.fidChart = null; }
  const ctx = $el('fid-canvas');
  if (!ctx || typeof Chart === 'undefined') return;
  ST.fidChart = new Chart(ctx, {
    type:'bar',
    data:{
      labels: hist.map(m=>m.month),
      datasets:[
        {type:'bar', label:'McKesson', data:hist.map(m=>m.mckesson), backgroundColor:'rgba(0,87,184,0.72)', borderRadius:3, yAxisID:'y'},
        {type:'bar', label:'IQVIA Total', data:hist.map(m=>m.iqvia), backgroundColor:'rgba(0,87,184,0.18)', borderRadius:3, yAxisID:'y'},
        {type:'line', label:'Fidelity %', data:hist.map(m=>+(m.fidelity*100).toFixed(1)),
          borderColor:'#1A7A4A', backgroundColor:'rgba(26,122,74,0.06)',
          borderWidth:2, pointRadius:3, tension:0.35, fill:true, yAxisID:'y2'}
      ]
    },
    options:{
      responsive:true, maintainAspectRatio:false,
      plugins:{
        legend:{position:'top', labels:{font:{size:10}, usePointStyle:true}},
        tooltip:{callbacks:{label(c){return c.dataset.yAxisID==='y2'
          ? c.dataset.label+': '+c.parsed.y+'%'
          : c.dataset.label+': '+fmtDol(c.parsed.y);}}}
      },
      scales:{
        y:  {position:'left',  ticks:{callback:v=>fmtDol(v), font:{size:9}}, grid:{color:'rgba(0,0,0,0.04)'}},
        y2: {position:'right', min:35, max:105, ticks:{callback:v=>v+'%', font:{size:9}}, grid:{drawOnChartArea:false}},
        x:  {ticks:{font:{size:9}}, grid:{color:'rgba(0,0,0,0.03)'}}
      }
    }
  });
}

// ── Product Trend Overlay ─────────────────────────────────────────────────────

// Palette for up to 15 products (consistent per product name hash)
const PROD_PALETTE = [
  '#4472C4','#ED7D31','#A9D18E','#FFC000','#5B9BD5',
  '#70AD47','#FF0000','#7030A0','#9DC3E6','#F4B183',
  '#00B0F0','#92D050','#FF7C80','#FFFF00','#BDD7EE',
];
function prodColor(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xFFFFFF;
  return PROD_PALETTE[Math.abs(h) % PROD_PALETTE.length];
}

// Week-ending date labels for last 6 weeks relative to WEEK_LATEST
function getLast6Labels() {
  const out = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(WEEK_LATEST);
    d.setDate(d.getDate() - i * 7);
    out.push(d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' }));
  }
  return out;
}

function openProductTrend(storeId, tab) {
  ST.prodStoreId = storeId;
  ST.prodTab     = tab;
  ST.povRxOtc    = ST.rxotc; // inherit global RX/OTC slicer
  // Sync pov buttons
  document.querySelectorAll('[data-provrxotc]').forEach(b =>
    b.classList.toggle('active', b.dataset.provrxotc === ST.povRxOtc));

  const store     = dbFor(tab).find(d => d.id === storeId);
  const isPrimary = tab.startsWith('primary');

  $el('pov-title').textContent =
    `${store.id} — ${store.name}  ·  ${store.city}  ·  ${store.rep}`;
  const fidBtn = $el('pov-fid-btn');
  if (fidBtn) fidBtn.style.display = isPrimary ? '' : 'none';

  $el('prod-overlay').classList.add('visible');
  renderProductOverlay(store, tab);
}

function closeProductTrend() {
  if (ST.prodChart) { ST.prodChart.destroy(); ST.prodChart = null; }
  if (ST.sparkChart) { ST.sparkChart.destroy(); ST.sparkChart = null; }
  $el('prod-overlay').classList.remove('visible');
  ST.prodStoreId = null;
  ST.prodTab     = null;
}

function openFidelityFromProd() {
  if (!ST.prodStoreId) return;
  openFidelity(ST.prodStoreId);
}

function setPovRxOtc(v) {
  ST.povRxOtc = v;
  document.querySelectorAll('[data-provrxotc]').forEach(b =>
    b.classList.toggle('active', b.dataset.provrxotc === v));
  const store = ST.prodStoreId && ST.prodTab ? dbFor(ST.prodTab).find(d => d.id === ST.prodStoreId) : null;
  if (store) renderProductOverlay(store, ST.prodTab);
}

function renderProductOverlay(store, tab) {
  // Kill old charts
  if (ST.prodChart)  { ST.prodChart.destroy();  ST.prodChart  = null; }
  if (ST.sparkChart) { ST.sparkChart.destroy(); ST.sparkChart = null; }

  const pw      = getPW();
  const rxFilter = ST.povRxOtc;
  const isLeak  = tab.endsWith('-leak');
  const drivers = getDrivers(store, pw, rxFilter);
  const top5    = drivers.slice(0, 5);

  const modeLabel = isLeak
    ? `Top 5 Drivers of Sales <em>*LEAKAGE*</em> in Last ${pw === 2 ? '2' : pw === 3 ? '2' : '2'} Consecutive ${ST.persistence === 'p2' ? '2' : ST.persistence === 'p3' ? '3' : '4'}-Week Windows`
    : `Top 5 Drivers of Sales <em>*OPPORTUNITY*</em> in Last 2 Consecutive ${ST.persistence === 'p2' ? '2' : ST.persistence === 'p3' ? '3' : '4'}-Week Windows`;

  $el('prod-overlay-body').innerHTML = `
    <div class="pov-quadrants">
      <div class="pov-card">
        <div class="pov-card-title">Last 53 Weeks of Overall Sales</div>
        <div class="pov-chart-wrap"><canvas id="pov-trend-canvas"></canvas></div>
      </div>
      <div class="pov-card">
        <div class="pov-card-title">${modeLabel}</div>
        <div class="pov-chart-wrap"><canvas id="pov-prod-canvas"></canvas></div>
      </div>
    </div>
    <div class="prod-table-card">
      <div class="prod-table-title">
        Top ${Math.min(drivers.length, 5)} Drivers of Sales
        <em>${isLeak ? '*LEAKAGE*' : '*OPPORTUNITY*'}</em>
        in Last ${pw} ${pw === 1 ? 'Week' : 'Weeks'}
        (${((top5.reduce((a,d)=>a+Math.abs(d.diffSales),0) / Math.max(1, Math.abs(store.signals[ST.persistence].delta))) * 100).toFixed(1)}% of
        ${drivers.length} Products)
      </div>
      <div class="prod-table-wrap">
        ${buildDriverTable(drivers, isLeak)}
      </div>
    </div>`;

  requestAnimationFrame(() => {
    // Left quadrant: reuse store 53-week trend chart
    const tCanvas = $el('pov-trend-canvas');
    if (tCanvas) {
      // Temporarily redirect to pov-trend-canvas
      const origId = tCanvas.id;
      drawTrendChartOnCanvas(store, tCanvas);
    }
    // Right quadrant: product bar chart
    drawProductBars(top5, isLeak);
  });
}

// Draw trend chart onto any given canvas element
function drawTrendChartOnCanvas(store, canvas) {
  if (!canvas || typeof Chart === 'undefined') return;
  const pw     = getPW();
  const w      = store.weekly;
  const stats  = computeStats(w);
  const sorted = [...w].sort((a,b)=>a-b);
  const winData = w.map((v, i) => i >= 53 - pw ? v : null);
  const ptRadius = w.map((v, i) => i >= 53 - pw ? 4 : 0);

  // Store chart ref on canvas so we can destroy it
  if (canvas._chart) { canvas._chart.destroy(); }
  canvas._chart = new Chart(canvas, {
    data: {
      labels: WEEK_LABELS,
      datasets: [
        { type:'bar', label:'Sales In Window', data:winData, backgroundColor:'rgba(26,26,128,0.75)', borderRadius:2, order:1, yAxisID:'y' },
        { type:'line', label:'Actual Sales', data:w, borderColor:'#0057B8', backgroundColor:'rgba(0,87,184,0.10)', borderWidth:2, pointRadius:ptRadius, tension:0.25, fill:'origin', order:2, yAxisID:'y' },
        { type:'line', label:'Weekly Average', data:Array(53).fill(stats.mean), borderColor:'#555', borderDash:[7,4], borderWidth:1.5, pointRadius:0, fill:false, order:3, yAxisID:'y' },
        { type:'line', label:'Upper Threshold', data:Array(53).fill(stats.upper), borderColor:'#1A7A4A', borderDash:[4,3], borderWidth:1.2, pointRadius:0, fill:false, order:4, yAxisID:'y' },
        { type:'line', label:'Lower Threshold', data:Array(53).fill(stats.lower), borderColor:'#C0392B', borderDash:[4,3], borderWidth:1.2, pointRadius:0, fill:false, order:5, yAxisID:'y' },
      ]
    },
    options: {
      responsive:true, maintainAspectRatio:false, animation:false,
      interaction:{ mode:'index', intersect:false },
      plugins:{
        legend:{ position:'top', labels:{ font:{size:9}, usePointStyle:true, boxWidth:8 }},
        tooltip:{ backgroundColor:'rgba(255,255,255,0.97)', borderColor:'#ccc', borderWidth:1,
          titleColor:'#1A1F36', bodyColor:'#1A1F36', titleFont:{weight:'700',size:11}, bodyFont:{size:10}, padding:8,
          callbacks:{
            title(items){ return 'Week ending  '+items[0].label; },
            label(item){ if (item.dataset.label==='Actual Sales'){ const v=item.parsed.y; return ['  Actual Sales  '+fmtDol(v),'  Avg  '+fmtDol(stats.mean),'  Pctile  '+getPercentileRank([...w].sort((a,b)=>a-b),v)]; } return null; },
            filter(item){ return item.dataset.label==='Actual Sales'; }
          }
        }
      },
      scales:{
        y:{ ticks:{callback:v=>fmtDol(v),font:{size:8}}, grid:{color:'rgba(0,0,0,0.04)'}, beginAtZero:true },
        x:{ ticks:{callback(v,i){return TICK_LABELS[i];},font:{size:8},maxRotation:0}, grid:{color:'rgba(0,0,0,0.03)'} }
      }
    }
  });
  // Also store on ST so it can be destroyed
  ST.sparkChart = canvas._chart;
}

function drawProductBars(top5, isLeak) {
  const canvas = $el('pov-prod-canvas');
  if (!canvas || typeof Chart === 'undefined' || !top5.length) return;
  if (ST.prodChart) { ST.prodChart.destroy(); ST.prodChart = null; }

  const wkLabels = getLast6Labels();

  ST.prodChart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: wkLabels,
      datasets: top5.map(d => ({
        label: d.name.length > 22 ? d.name.slice(0,20)+'…' : d.name,
        data:  d.recentWeeks,
        backgroundColor: prodColor(d.name),
        borderRadius: 2,
      }))
    },
    options: {
      responsive: true, maintainAspectRatio: false, animation: false,
      plugins: {
        legend: { position:'top', labels:{ font:{size:9}, usePointStyle:true, boxWidth:8 }},
        tooltip: {
          backgroundColor:'rgba(255,255,255,0.97)', borderColor:'#ccc', borderWidth:1,
          titleColor:'#1A1F36', bodyColor:'#1A1F36', titleFont:{weight:'700',size:11}, bodyFont:{size:10}, padding:8,
          callbacks:{ label(c){ return '  '+c.dataset.label+':  '+fmtDol(c.parsed.y); } }
        }
      },
      scales: {
        x: { ticks:{ font:{size:9} }, grid:{ color:'rgba(0,0,0,0.03)' } },
        y: { ticks:{ callback:v=>fmtDol(v), font:{size:9} }, grid:{ color:'rgba(0,0,0,0.04)' }, beginAtZero:true }
      }
    }
  });
}

function buildDriverTable(drivers, isLeak) {
  const top5 = drivers.slice(0, 5);
  const totWindow = top5.reduce((a,d) => a + d.salesWindow, 0);
  const totDiff   = top5.reduce((a,d) => a + d.diffSales, 0);
  const totPct    = drivers.reduce((a,d) => a + d.salesWindow, 0) > 0
    ? totWindow / drivers.reduce((a,d) => a + d.salesWindow, 0) * 100 : 0;

  const fmtDiff = v => v < 0 ? `<span class="neg-val">(${fmtDol(Math.abs(v))})</span>` : `<span style="color:var(--green);font-weight:600">${fmtDol(v)}</span>`;
  const fmtPctChg = v => {
    if (v === 0) return '–';
    const cls = v < 0 ? 'neg-pct' : 'pos-pct';
    return `<span class="${cls}">${v > 0 ? '+' : ''}${v.toFixed(1)}%</span>`;
  };

  const rows = top5.map(d => `
    <tr>
      <td><button class="prod-expand-btn">⊕</button>
          <span class="prod-name-cell">${d.name}</span>
          <span class="rxotc-badge ${d.rxotc.toLowerCase()}">${d.rxotc}</span>
      </td>
      <td>${fmtDol(d.salesWindow)}</td>
      <td>${(d.pctSales * 100).toFixed(1)}%</td>
      <td>${fmtDiff(d.diffSales)}</td>
      <td>${fmtPctChg(d.diffStore)}</td>
      <td>${fmtPctChg(d.diffCity)}</td>
      <td>${fmtPctChg(d.diffBan)}</td>
      <td>${fmtPctChg(d.diffMck)}</td>
    </tr>`).join('');

  const totalRow = `
    <tr class="total-row">
      <td><strong>Total</strong></td>
      <td><strong>${fmtDol(totWindow)}</strong></td>
      <td><strong>${totPct.toFixed(1)}%</strong></td>
      <td>${fmtDiff(totDiff)}</td>
      <td></td><td></td><td></td><td></td>
    </tr>`;

  return `<table class="prod-table">
    <thead>
      <tr>
        <th style="min-width:260px">Product Description / Dosage</th>
        <th onclick="sortProdTable('salesWindow')">Sales Window</th>
        <th onclick="sortProdTable('pctSales')">% Sales</th>
        <th onclick="sortProdTable('diffSales')" class="sort-desc">Diff. Sales ▼</th>
        <th onclick="sortProdTable('diffStore')">%Diff. @Store</th>
        <th onclick="sortProdTable('diffCity')">%Diff. @City</th>
        <th onclick="sortProdTable('diffBan')">%Diff. @Banner</th>
        <th onclick="sortProdTable('diffMck')">%Diff. @McK</th>
      </tr>
    </thead>
    <tbody>${rows}${totalRow}</tbody>
  </table>`;
}

function sortProdTable(col) {
  ST.prodSortCol = col;
  ST.prodSortDir = ST.prodSortDir === 'asc' ? 'desc' : 'asc';
  const store = ST.prodStoreId && ST.prodTab ? dbFor(ST.prodTab).find(d => d.id === ST.prodStoreId) : null;
  if (!store) return;
  const isLeak  = ST.prodTab.endsWith('-leak');
  const pw      = getPW();
  let drivers   = getDrivers(store, pw, ST.povRxOtc);
  const dir     = ST.prodSortDir === 'asc' ? 1 : -1;
  drivers.sort((a,b) => (a[col] - b[col]) * dir);

  // Update only table portion
  const wrap = document.querySelector('.prod-table-wrap');
  if (wrap) wrap.innerHTML = buildDriverTable(drivers, isLeak);
}

// ── Boot ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const sel = $el('rep-select');
  if (sel) {
    const reps = [...new Set([...DB_PRIMARY,...DB_SECONDARY].map(d=>d.rep))].sort();
    reps.forEach(r => { const o=document.createElement('option'); o.value=r; o.textContent=r; sel.appendChild(o); });
  }
  TABS.forEach(t => { refilter(t); initObserver(t); });

  // Handle return from action_update.html
  const urlParams = new URLSearchParams(location.search);
  const returnTab = urlParams.get('return_tab') || 'primary-opp';
  if (urlParams.get('status_updated') === '1') {
    const updatedStore = urlParams.get('store_name') || 'Store';
    history.replaceState({}, '', 'index.html');
    switchTab(returnTab);
    showToast('✓ Action status saved for ' + updatedStore);
  } else if (urlParams.get('return_tab')) {
    history.replaceState({}, '', 'index.html');
    switchTab(returnTab);
  } else {
    switchTab('primary-opp');
  }

  // Apply initial worklist body class + fix sticky nav positions
  document.body.classList.toggle('worklist-to-review', ST.worklist === 'to-review');
  requestAnimationFrame(fixStickyTops);
  window.addEventListener('resize', fixStickyTops);
});
