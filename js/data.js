// SDFG v2.1 — Synthetic Database
// All data generated at runtime in data.js (static prototype; production would fetch from API).

const _r  = (a,b) => Math.random()*(b-a)+a;
const _ri = (a,b) => Math.floor(_r(a,b+0.9999));
const _f  = n => Math.round(n);

const REPS = ["Halle Barrett","Danilo Budalic","Laura Mckinley","Mili Vincent",
  "Ranvir Sapra","Selvi Rubio Naranjo","Barry Carter","Alex Cowman",
  "Dan Deschenes","Vasant Ramah","Adam Howarth","Carly Mercer",
  "Catherine Lacoste","Antonio Garcia","Priya Nair","James Osei",
  "Fatima Zaidi","Luc Tremblay","Mei-Ling Chan","Roberto Ferreira"];

const CITIES = ["Toronto","Mississauga","Hamilton","Brampton","Ottawa","London",
  "Kitchener","Windsor","Sudbury","Burlington","Oakville","Markham",
  "Richmond Hill","Barrie","Kingston","Guelph","Oshawa","Ajax","Pickering",
  "Whitby","Scarborough","Niagara Falls","Norwood","Hagersville","Dundas",
  "Woodbridge","Stratford","Brantford","Peterborough","Cornwall","Belleville",
  "Sault Ste Marie","Thunder Bay","Timmins","North Bay"];

const BANNERS = ["IDA","Pharmasave","Rexall","Independent","Guardian",
  "Remedy's Rx","PharmaChoice","Medical Pharmacies","Costco Pharmacy","Shoppers"];

const PH_PRE = ["ROYAL","CITY","VILLAGE","HIGHLAND","VALLEY","LAKE","RIDGE",
  "GROVE","PARK","CENTRAL","NORTH","SOUTH","EAST","WEST","METRO","PLAZA",
  "MARKET","CORNER","HERITAGE","SUMMIT","MAPLE","CEDAR","PINE","BIRCH",
  "OAK","ELM","MAIN","QUEEN","KING","UNION","FRONT","BAY","HARBOUR",
  "RIVERSIDE","LAKEVIEW","HILLTOP"];

const PH_SUF = ["PHARMACY","DRUG MART","DISPENSARY","HEALTH CENTRE","DRUGS",
  "RX","APOTHECARY","PHARMCHOICE","IDA PHARMACY","PHARMASAVE","COMPOUNDING"];

// Product catalog — each entry: [name, rxotc]
const PRODUCT_CATALOG = [
  // ── Specialty RX (oncology / biologics / injectable)
  ["TIRZEPATIDE PEN INJCTR",     "RX"],
  ["SEMAGLUTIDE PEN INJCTR",     "RX"],
  ["DUPILUMAB PEN INJCTR",       "RX"],
  ["RISANKIZUMAB PEN INJCTR",    "RX"],
  ["GUSELKUMAB AUTO INJCT",      "RX"],
  ["IXEKIZUMAB AUTO INJCT",      "RX"],
  ["ADALIMUMAB AUTO INJCT",      "RX"],
  ["USTEKINUMAB IV SOLN",        "RX"],
  ["SECUKINUMAB PEN INJCTR",     "RX"],
  ["TEZEPELUMAB PEN INJCTR",     "RX"],
  ["DAROLUTAMIDE TABLET",        "RX"],
  ["ABEMACICLIB TABLET",         "RX"],
  ["RIBOCICLIB SUCCINATE TAB",   "RX"],
  ["DASATINIB TABLET",           "RX"],
  ["RUXOLITINIB PHOS TABLET",    "RX"],
  ["PALBOCICLIB CAPSULE",        "RX"],
  ["VENETOCLAX TABLET",          "RX"],
  ["LENALIDOMIDE CAPSULE",       "RX"],
  // ── Oral RX (primary care)
  ["ATORVASTATIN TABLET",        "RX"],
  ["ROSUVASTATIN TABLET",        "RX"],
  ["METFORMIN TABLET",           "RX"],
  ["AMLODIPINE TABLET",          "RX"],
  ["LISINOPRIL TABLET",          "RX"],
  ["RAMIPRIL CAPSULE",           "RX"],
  ["METOPROLOL TABLET",          "RX"],
  ["PANTOPRAZOLE TABLET",        "RX"],
  ["ESCITALOPRAM TABLET",        "RX"],
  ["SERTRALINE TABLET",          "RX"],
  ["LEVOTHYROXINE TABLET",       "RX"],
  ["TADALAFIL TABLET",           "RX"],
  // ── OTC
  ["ADVIL TABLET 200MG",         "OTC"],
  ["TYLENOL EXTRA STR TAB",      "OTC"],
  ["REACTINE TABLET 10MG",       "OTC"],
  ["BENADRYL TABLET 25MG",       "OTC"],
  ["GAVISCON LIQUID",            "OTC"],
  ["VOLTAREN GEL 1%",            "OTC"],
  ["POLYSPORIN OINT 30G",        "OTC"],
  ["CENTRUM ADULT TAB",          "OTC"],
  ["JAMIESON VIT D 1000IU",      "OTC"],
  ["OMEGA-3 SOFTGELS",           "OTC"],
  ["LOSEC OTC TABLET 20MG",      "OTC"],
  ["CLARITIN TABLET 10MG",       "OTC"],
  ["NICORETTE GUM 2MG",          "OTC"],
  ["PREPARATION H OINT",         "OTC"],
  ["BIO-K+ PROBIOTIC",           "OTC"],
];

// Lookup: product name → rxotc
const PROD_TYPE = Object.fromEntries(PRODUCT_CATALOG.map(([n,t]) => [n,t]));

// Scenario codes for fidelity:
// A = signal up + fidelity up     B = signal up + fidelity down
// C = signal down + fidelity stable  D = signal down + fidelity down
const FID_SCENARIOS = { 'up': ['A','B'], 'down': ['C','D'] };

function pname() {
  return PH_PRE[_ri(0,PH_PRE.length-1)] + " " + PH_SUF[_ri(0,PH_SUF.length-1)];
}

function genWeekly(bw, direction) {
  const w = [];
  for (let i = 0; i < 53; i++) {
    let s = bw * _r(0.85, 1.15);
    if (direction === 'up')  { if (i >= 50) s *= _r(2.0, 4.5); }
    else                     { if (i >= 50) s *= _r(0.15, 0.45); }
    w.push(_f(Math.max(50, s)));
  }
  return w;
}

function computeSignal(w, pw) {
  const rec = w.slice(-pw).reduce((a,b)=>a+b,0);
  const pri = w.slice(-(pw*2),-pw).reduce((a,b)=>a+b,0);
  const delta = rec - pri;
  const pct   = pri > 0 ? (delta/pri)*100 : 0;
  return { recentWindow:_f(rec), priorWindow:_f(pri), delta:_f(delta), pct:+pct.toFixed(1) };
}

function buildTrends(w) {
  const w3=w.slice(-3).reduce((a,b)=>a+b,0);
  const p3=w.slice(-6,-3).reduce((a,b)=>a+b,0);
  const w6=w.slice(-6).reduce((a,b)=>a+b,0);
  const p6=w.slice(-12,-6).reduce((a,b)=>a+b,0);
  const w12=w.slice(-12).reduce((a,b)=>a+b,0);
  const p12=w.slice(-24,-12).reduce((a,b)=>a+b,0);
  return {
    w3:_f(w3),w6:_f(w6),w12:_f(w12),
    p3:_f(p3),p6:_f(p6),p12:_f(p12),
    delta3:_f(w3-p3), pct3:p3>0?+((w3-p3)/p3*100).toFixed(1):0,
    delta6:_f(w6-p6), pct6:p6>0?+((w6-p6)/p6*100).toFixed(1):0,
    delta12:_f(w12-p12), pct12:p12>0?+((w12-p12)/p12*100).toFixed(1):0,
  };
}

// Fidelity (IQVIA-sourced) has a ~2-month reporting lag.
// Current date: May 2026 → latest available fidelity month: March 2026.
const FID_LAG_LABEL = 'Mar 2026';
const FID_LAG_END   = new Date(2026, 2, 1); // March 2026

// Generate monthly fidelity history (12 months ending Mar 2026)
// fidScenario determines whether fidelity trends up, flat, or down
function genFidHistory(baseFid, baseMckMon, fidScenario) {
  const months = [];
  const ref = FID_LAG_END; // March 2026 — last available IQVIA data month
  // Drift direction
  const drift = fidScenario === 'A' ? 0.002
               : fidScenario === 'B' ? -0.003
               : fidScenario === 'C' ? 0.0005
               : -0.002; // D

  for (let i = 11; i >= 0; i--) {
    const d = new Date(ref.getFullYear(), ref.getMonth()-i, 1);
    const lbl = d.toLocaleString('en-CA',{month:'short',year:'numeric'});
    const mck = baseMckMon * _r(0.88, 1.12);
    // Fidelity drifts with scenario, plus noise
    const fid = Math.min(0.99, Math.max(0.38, baseFid + drift*(11-i) + _r(-0.015, 0.015)));
    const iqvia = mck / fid;
    // Leakage varies independently: random multiplier unrelated to signal
    const leakageExtra = _r(0.8, 1.4);
    // ── Channel split: gap = iqvia − mckesson split into Indirect + Direct ─────
    // Integrity constraint: indirect + direct = gap (so mckesson + indirect + direct = iqvia)
    // Indirect (competitor wholesalers) is the most actionable leakage — higher when fidelity is low.
    // Direct (manufacturer → pharmacy) can occur even in compliant stores.
    const gap = _f(iqvia) - _f(mck);
    const indirectShare = Math.min(0.90, Math.max(0.30, _r(0.40, 0.72) + (1 - fid) * 0.22));
    const indirect = _f(Math.max(0, gap * indirectShare));
    const direct   = Math.max(0, gap - indirect);   // remainder of gap; never negative
    months.push({
      month: lbl,
      mckesson: _f(mck),
      iqvia: _f(iqvia),
      fidelity: +fid.toFixed(4),
      leakage: _f((iqvia - mck) * leakageExtra),
      direct:   _f(direct),
      indirect: indirect,
    });
  }
  return months;
}

// Compute fidelity summaries by timeframe: L1M, L3M, L6M, L12M
function computeFidTimeframes(hist) {
  function avgFid(slice) {
    return slice.reduce((a,m)=>a+m.fidelity,0) / slice.length;
  }
  function totalLeak(slice)     { return slice.reduce((a,m)=>a+m.leakage,0); }
  function totalIqvia(slice)    { return _f(slice.reduce((a,m)=>a+m.iqvia,0)); }
  function totalMck(slice)      { return _f(slice.reduce((a,m)=>a+m.mckesson,0)); }
  function totalDirect(slice)   { return _f(slice.reduce((a,m)=>a+(m.direct||0),0)); }
  function totalIndirect(slice) { return _f(slice.reduce((a,m)=>a+(m.indirect||0),0)); }

  const l1  = hist.slice(-1);
  const l3  = hist.slice(-3);
  const l6  = hist.slice(-6);
  const l12 = hist.slice(-12);

  // Fidelity change = current avg vs prior avg of same window length
  function fidChg(slice) {
    if (hist.length < slice.length * 2) return 0;
    const prev = hist.slice(-slice.length*2, -slice.length);
    return +(avgFid(slice)*100 - avgFid(prev)*100).toFixed(1);
  }

  // Dollar gain/leakage = McKesson sales change vs prior same-length window
  // Positive = Gain (McK grew), Negative = Leakage (McK shrank)
  function gainLeak(slice) {
    if (hist.length < slice.length * 2) return null; // not enough history
    const prev = hist.slice(-slice.length*2, -slice.length);
    return _f(totalMck(slice) - totalMck(prev));
  }

  return {
    L1M:  { fid: +(avgFid(l1)*100).toFixed(1),  chg: fidChg(l1),  leakage: totalLeak(l1),  iqviaTot: totalIqvia(l1),  mckTot: totalMck(l1),  gainLeak: gainLeak(l1),  directTot: totalDirect(l1),  indirectTot: totalIndirect(l1)  },
    L3M:  { fid: +(avgFid(l3)*100).toFixed(1),  chg: fidChg(l3),  leakage: totalLeak(l3),  iqviaTot: totalIqvia(l3),  mckTot: totalMck(l3),  gainLeak: gainLeak(l3),  directTot: totalDirect(l3),  indirectTot: totalIndirect(l3)  },
    L6M:  { fid: +(avgFid(l6)*100).toFixed(1),  chg: fidChg(l6),  leakage: totalLeak(l6),  iqviaTot: totalIqvia(l6),  mckTot: totalMck(l6),  gainLeak: gainLeak(l6),  directTot: totalDirect(l6),  indirectTot: totalIndirect(l6)  },
    L12M: { fid: +(avgFid(l12)*100).toFixed(1), chg: fidChg(l12), leakage: totalLeak(l12), iqviaTot: totalIqvia(l12), mckTot: totalMck(l12), gainLeak: gainLeak(l12), directTot: totalDirect(l12), indirectTot: totalIndirect(l12) },
  };
}

// Generate 8-20 products for a store, each with 53 weekly values.
// Products are drawn from PRODUCT_CATALOG. Each has a dominant share multiplier
// so a small subset drives most of the total (realistic skew).
function genProducts(storeWeekly) {
  const nProds = _ri(8, 20);
  const picks = [], used = new Set();
  while (picks.length < nProds) {
    const i = _ri(0, PRODUCT_CATALOG.length - 1);
    if (!used.has(i)) { used.add(i); picks.push(PRODUCT_CATALOG[i]); }
  }
  // Sort: first pick is the dominant product (~30-55% of store sales)
  const shares = picks.map((_, k) => {
    if (k === 0) return _r(0.30, 0.55);
    if (k === 1) return _r(0.12, 0.22);
    return _r(0.01, 0.09);
  });
  // Normalise so product weeks sum close to store weekly total
  const shareSum = shares.reduce((a,b)=>a+b,0);
  return picks.map(([name, rxotc], k) => ({
    name, rxotc,
    // Each week = store total × share × noise
    weeks: storeWeekly.map(v => _f(v * (shares[k]/shareSum) * _r(0.75, 1.25)))
  }));
}

function randOverride() {
  const r = Math.random();
  return r < 0.15 ? 'new' : r < 0.65 ? 'active' : 'paused';
}

function buildPrimary(id, direction) {
  const ann = _r(300000, 6000000);
  const w   = genWeekly(ann/52, direction);

  // Fidelity scenario: NOT perfectly correlated with signal direction
  const scenarios = FID_SCENARIOS[direction];
  const fidScenario = scenarios[Math.random() < 0.5 ? 0 : 1];

  // Base fidelity depends on scenario
  let baseFid;
  if (fidScenario === 'A') baseFid = _r(0.78, 0.96); // up signal, improving fidelity
  else if (fidScenario === 'B') baseFid = _r(0.62, 0.85); // up signal, declining fidelity
  else if (fidScenario === 'C') baseFid = _r(0.80, 0.95); // down signal, stable fidelity
  else baseFid = _r(0.52, 0.78); // down signal, declining fidelity

  const avgMon = ann / 12;
  const fidHist = genFidHistory(baseFid, avgMon, fidScenario);
  const leakage = fidHist[fidHist.length-1].leakage; // use most recent month
  const fidTF   = computeFidTimeframes(fidHist);

  // Latest fidelity from history
  const latestFid = fidHist[fidHist.length-1].fidelity;

  return {
    id: 500000+id, type:'primary', name:pname(),
    rep:REPS[_ri(0,REPS.length-1)], city:CITIES[_ri(0,CITIES.length-1)],
    banner:BANNERS[_ri(0,BANNERS.length-1)], override:randOverride(),
    direction, fidScenario,
    annualSales:_f(ann), priorFYSales:_f(ann*_r(0.82,1.18)),
    priorFYGrowth:+_r(-0.06,0.22).toFixed(4),
    fytdSales:_f(ann*_r(0.28,0.62)), fytdGrowth:+_r(-0.09,0.28).toFixed(4),
    fidelity:+latestFid.toFixed(4), leakage,
    trends: buildTrends(w),
    signals: { p2:computeSignal(w,2), p3:computeSignal(w,3), p4:computeSignal(w,4) },
    weekly: w,
    products: genProducts(w),
    fidelityHistory: fidHist,
    fidTimeframes: fidTF,
  };
}

function buildSecondary(id, direction) {
  const ann = _r(60000, 1500000);
  const w   = genWeekly(ann/52, direction);
  return {
    id: 200000+id, type:'secondary', name:pname(),
    rep:REPS[_ri(0,REPS.length-1)], city:CITIES[_ri(0,CITIES.length-1)],
    banner:BANNERS[_ri(0,BANNERS.length-1)], override:randOverride(),
    direction,
    annualSales:_f(ann), priorFYSales:_f(ann*_r(0.82,1.18)),
    priorFYGrowth:+_r(-0.06,0.22).toFixed(4),
    fytdSales:_f(ann*_r(0.28,0.62)), fytdGrowth:+_r(-0.09,0.28).toFixed(4),
    trends: buildTrends(w),
    signals: { p2:computeSignal(w,2), p3:computeSignal(w,3), p4:computeSignal(w,4) },
    weekly: w,
    products: genProducts(w),
  };
}

const DB = {
  'primary-opp':   [],
  'primary-leak':  [],
  'secondary-opp': [],
  'secondary-leak':[],
  'primary-opp2':  [],
};

for (let i = 0; i < 300; i++) DB['primary-opp'].push(buildPrimary(i+1,   'up'));
for (let i = 0; i < 220; i++) DB['primary-leak'].push(buildPrimary(i+301, 'down'));
for (let i = 0; i < 180; i++) DB['secondary-opp'].push(buildSecondary(i+1,   'up'));
for (let i = 0; i < 150; i++) DB['secondary-leak'].push(buildSecondary(i+181, 'down'));

const DB_PRIMARY   = [...DB['primary-opp'],  ...DB['primary-leak']];
const DB_SECONDARY = [...DB['secondary-opp'],...DB['secondary-leak']];
const DB_ALL       = [...DB_PRIMARY, ...DB_SECONDARY];

// ── Benchmark aggregations (computed once after all stores are built) ────────────────
// BENCH.city[city][prodName]   = [53 weekly sums across all stores in city]
// BENCH.banner[banner][prodName] = [53 weekly sums across all stores in banner]
// BENCH.mck[prodName]          = [53 weekly sums across ALL stores]

function _vecAdd(target, src) {
  for (let i = 0; i < src.length; i++) target[i] = (target[i] || 0) + src[i];
}

const BENCH = { city: {}, banner: {}, mck: {} };
for (const store of DB_ALL) {
  if (!BENCH.city[store.city])     BENCH.city[store.city]     = {};
  if (!BENCH.banner[store.banner]) BENCH.banner[store.banner] = {};
  for (const prod of store.products) {
    const n = prod.name, w = prod.weeks;
    if (!BENCH.city[store.city][n])    BENCH.city[store.city][n]    = new Array(53).fill(0);
    if (!BENCH.banner[store.banner][n]) BENCH.banner[store.banner][n] = new Array(53).fill(0);
    if (!BENCH.mck[n])                  BENCH.mck[n]                  = new Array(53).fill(0);
    _vecAdd(BENCH.city[store.city][n],    w);
    _vecAdd(BENCH.banner[store.banner][n], w);
    _vecAdd(BENCH.mck[n], w);
  }
}

// Helper: compute window sum from a 53-element weekly array
function winSum(arr, pw, prior) {
  if (!arr) return 0;
  if (prior) return arr.slice(-(pw*2), -pw).reduce((a,b)=>a+b,0);
  return arr.slice(-pw).reduce((a,b)=>a+b,0);
}

// Compute product driver metrics for a store, given persistence window and RX/OTC filter
function getDrivers(store, pw, rxFilter) {
  const totalCur  = store.products.reduce((a,p) => a + winSum(p.weeks, pw, false), 0);
  const totalPri  = store.products.reduce((a,p) => a + winSum(p.weeks, pw, true),  0);

  return store.products
    .filter(p => rxFilter === 'all' || p.rxotc === rxFilter)
    .map(p => {
      const cur  = winSum(p.weeks, pw, false);
      const pri  = winSum(p.weeks, pw, true);
      const diff = cur - pri;
      const pctSales = totalCur > 0 ? cur / totalCur : 0;

      // Store-level % diff
      const diffStore = pri > 0 ? diff/pri*100 : (diff !== 0 ? 999 : 0);

      // City benchmark
      const cityCur = winSum(BENCH.city[store.city]?.[p.name], pw, false);
      const cityPri = winSum(BENCH.city[store.city]?.[p.name], pw, true);
      const diffCity = cityPri > 0 ? (cityCur-cityPri)/cityPri*100 : 0;

      // Banner benchmark
      const banCur = winSum(BENCH.banner[store.banner]?.[p.name], pw, false);
      const banPri = winSum(BENCH.banner[store.banner]?.[p.name], pw, true);
      const diffBan = banPri > 0 ? (banCur-banPri)/banPri*100 : 0;

      // McKesson benchmark
      const mckCur = winSum(BENCH.mck[p.name], pw, false);
      const mckPri = winSum(BENCH.mck[p.name], pw, true);
      const diffMck = mckPri > 0 ? (mckCur-mckPri)/mckPri*100 : 0;

      return {
        name: p.name, rxotc: p.rxotc,
        salesWindow: cur, pctSales,
        diffSales: diff, diffStore, diffCity, diffBan, diffMck,
        // Per-week data for bar chart (last 6 weeks individual)
        recentWeeks: p.weeks.slice(-6),
      };
    })
    .sort((a,b) => Math.abs(b.diffSales) - Math.abs(a.diffSales));
}

// ══════════════════════════════════════════════════════════════════════════════
// KPI RANKING TAB — Primary Opportunity 2
// Extended primary stores with province, size tier, and KPI diagnostics.
// These are a SEPARATE pool from the original primary-opp stores.
// ══════════════════════════════════════════════════════════════════════════════

// Province distribution: majority Ontario, some QC/BC/AB for peer contrast.
const PROVINCE_DIST = ['ON','ON','ON','ON','ON','ON','QC','QC','BC','AB'];

const KPI_EXTRA_CITIES = {
  'QC': ['Montreal','Quebec City','Laval','Gatineau','Longueuil','Sherbrooke','Saguenay','Trois-Rivières'],
  'BC': ['Vancouver','Surrey','Burnaby','Richmond','Kelowna','Abbotsford','Victoria','Kamloops'],
  'AB': ['Calgary','Edmonton','Red Deer','Lethbridge','Medicine Hat','Grande Prairie'],
};

// Map existing Ontario cities → province (they are all ON)
const CITY_PROVINCE = {};
CITIES.forEach(c => { CITY_PROVINCE[c] = 'ON'; });
Object.entries(KPI_EXTRA_CITIES).forEach(([prov, cities]) =>
  cities.forEach(c => { CITY_PROVINCE[c] = prov; }));

// ── KPI store weekly generator (distribution-based) ─────────────────────────
//
// SYNTHETIC REALISM CONSTRAINT:
//   genWeekly() applies a uniform 2–4.5× spike to all stores causing every
//   store to look like a top-tier extreme opportunity.  KPI stores instead use
//   a skewed distribution so the ranked list contains genuine contrast.
//
// Signal tier distribution (approximate):
//   65% small (±5–25%)  |  25% moderate (±25–75%)  |  8% large (±75–150%)  |  2% extreme (>150%)
// Direction distribution: 60% up, 25% down, 15% flat (filtered out by sensitivity threshold)
// Dollar impact scales with store size naturally — large bw × moderate % > small bw × extreme %.
function genWeeklyKPI(bw) {
  // Direction draw
  const dirRoll = Math.random();
  const direction = dirRoll < 0.60 ? 'up' : dirRoll < 0.85 ? 'down' : 'flat';

  // Magnitude tier draw (used for non-flat only)
  let signalMult;
  if (direction === 'flat') {
    signalMult = _r(0.97, 1.03);   // ±3% — effectively noise, filtered by sensitivity
  } else {
    const tierRoll = Math.random();
    let magnitude;
    if      (tierRoll < 0.65) magnitude = _r(0.05, 0.25);   // small:    ±5–25%
    else if (tierRoll < 0.90) magnitude = _r(0.25, 0.75);   // moderate: ±25–75%
    else if (tierRoll < 0.98) magnitude = _r(0.75, 1.50);   // large:    ±75–150%
    else                      magnitude = _r(1.50, 3.50);   // extreme:  >150% (rare)
    signalMult = direction === 'up' ? 1 + magnitude : Math.max(0.05, 1 - magnitude);
  }

  // 53-week series: stable baseline for weeks 1–50, signal applied in weeks 51–53
  // (weeks 51–53 = indices 50–52 = the pw=3 recent window used by computeSignal)
  const w = [];
  for (let i = 0; i < 50; i++) {
    w.push(_f(Math.max(50, bw * _r(0.88, 1.12))));
  }
  const priorAvg = (w[47] + w[48] + w[49]) / 3;   // stable prior-window average
  for (let i = 50; i < 53; i++) {
    w.push(_f(Math.max(50, priorAvg * signalMult * _r(0.93, 1.07))));
  }
  return { w, direction: direction === 'flat' ? 'up' : direction };
}

function buildPrimaryKPI(id) {
  // Store size: skewed log-uniform so small stores dominate count, few large ones
  // This ensures $ deltas vary meaningfully (many $10K–$75K, some $75K–$250K, few >$250K)
  const ann       = Math.exp(_r(Math.log(80000), Math.log(4000000)));
  const { w, direction } = genWeeklyKPI(ann / 52);

  const avgMon      = (ann / 52) * 4.33;
  const baseFid     = _r(0.55, 0.96);
  const fidScenario = FID_SCENARIOS[direction][_ri(0, 1)];
  const fidHist     = genFidHistory(baseFid, avgMon, fidScenario);
  const fidTF       = computeFidTimeframes(fidHist);
  const leakage     = _f(ann * _r(0.02, 0.18));
  const latestFid   = fidHist[fidHist.length - 1].fidelity;

  // Province + city
  const prov = PROVINCE_DIST[_ri(0, PROVINCE_DIST.length - 1)];
  const city = prov === 'ON'
    ? CITIES[_ri(0, CITIES.length - 1)]
    : KPI_EXTRA_CITIES[prov][_ri(0, KPI_EXTRA_CITIES[prov].length - 1)];

  return {
    id: 700000 + id, type: 'primary', name: pname(),
    rep: REPS[_ri(0, REPS.length - 1)], city, province: prov,
    banner: BANNERS[_ri(0, BANNERS.length - 1)], override: randOverride(),
    direction, fidScenario,
    annualSales:   _f(ann),
    priorFYSales:  _f(ann * _r(0.82, 1.18)),
    priorFYGrowth: +_r(-0.06, 0.22).toFixed(4),
    fytdSales:     _f(ann * _r(0.28, 0.62)),
    fytdGrowth:    +_r(-0.09, 0.28).toFixed(4),
    fidelity:      +latestFid.toFixed(4), leakage,
    trends:        buildTrends(w),
    signals:       { p2: computeSignal(w, 2), p3: computeSignal(w, 3), p4: computeSignal(w, 4) },
    weekly:        w,
    products:      genProducts(w),
    fidelityHistory: fidHist,
    fidTimeframes:   fidTF,
    l12m: _f(w.reduce((a, b) => a + b, 0)),   // L12M proxy for size tier
  };
}

// Generate 520 KPI stores
for (let i = 0; i < 520; i++) DB['primary-opp2'].push(buildPrimaryKPI(i + 1));

// Extend DB_PRIMARY so openFidelity() and rep selectors can find KPI-tab stores
// (DB_PRIMARY is const but arrays are mutable — push is safe here)
DB_PRIMARY.push(...DB['primary-opp2']);

// Size tier: tercile split by L12M across all KPI stores
(function assignSizeTiers() {
  const stores = DB['primary-opp2'];
  const sorted = [...stores].sort((a, b) => a.l12m - b.l12m);
  const n  = sorted.length;
  const t1 = sorted[Math.floor(n / 3)].l12m;
  const t2 = sorted[Math.floor(2 * n / 3)].l12m;
  for (const s of stores) {
    s.sizeTier = s.l12m <= t1 ? 'S' : s.l12m <= t2 ? 'M' : 'L';
  }
})();

// ── KPI_BENCH: independent peer-market weekly series (53 weeks) ───────────────
//
// SYNTHETIC REALISM CONSTRAINT (not a business rule):
//   Peer / market signals are generated INDEPENDENTLY of store data.
//   Markets drive expected store behaviour; stores deviate from markets — not
//   the other way around.  If we derived KPI_BENCH by aggregating store weeklies
//   the sum would inherit all store-level spikes and produce unrealistically
//   high banner/province/McK % swings, causing most stores to be labelled
//   "Underperforming" relative to peers that never exist in reality.
//
// VOLATILITY CAPS enforced here (per-window % change caps for pw ∈ {2,3,4}):
//   Banner:   typical −5% to +10%, hard cap −10% to +15%
//   Province: typical −3% to +7%,  hard cap −5%  to +10%  (must be < banner)
//   McK:      typical −1% to +3%,  hard cap −3%  to +5%   (least volatile)
//
// IMPLEMENTATION:
//   For a 53-week linear-trend series, pctChg(pw) ≈ SLOPE_pct × pw/52.
//   So to target a pw=4 typical max of X%, choose SLOPE ≤ X × (52/4) = X × 13.
//   This guarantees all pw ∈ {2,3,4} stay within bounds (smaller pw → smaller %).

// ── Peer series generator (independent of store data) ────────────────────────
//
// SYNTHETIC REALISM — two regimes:
//
// NORMAL (~97% of series):
//   Smooth linear trend within volatility caps.  Markets are stable by default.
//   Peer movements are never derived from aggregating volatile store data.
//
// SHOCK (~3% of series):
//   Rare market events — competitor closure, supply disruption, large promo.
//   Applied only to the recent-window weeks (indices 50–52) to be detectable
//   by computeKPIDiagnostics / computeRelativeImpact.
//   Hard caps per tier are enforced — shocks are exceptional, not dominant.
//   When a shock is active, affected stores moving less than peers are
//   legitimately "Underperforming" without being business anomalies.
//
// shockCap: maximum fractional shock magnitude for this tier (0 = no shocks).
// shockProb: probability this particular series experiences a shock.
function _genPeerSeries(slopeMin, slopeMax, noiseRange, shockCap, shockProb) {
  const slope = slopeMin + Math.random() * (slopeMax - slopeMin);
  const base  = 1e6;   // arbitrary scale — only ratios matter for pctChg

  // Shock: rare uplift applied to recent window only (weeks 51–53, indices 50–52)
  const hasShock  = shockCap > 0 && shockProb > 0 && Math.random() < shockProb;
  // Shock magnitude: lower half of cap range → avoids extreme values dominating
  const shockMult = hasShock ? (1 + _r(shockCap * 0.5, shockCap)) : 1;

  const arr = [];
  for (let k = 0; k < 53; k++) {
    const trend  = 1 + slope * (k / 52);
    const jitter = 1 + (Math.random() - 0.5) * 2 * noiseRange;
    const shock  = (hasShock && k >= 50) ? shockMult : 1;
    arr.push(base * trend * jitter * shock);
  }
  return arr;
}

// Collect unique banners and provinces from KPI stores
const _kpiBanners   = [...new Set(DB['primary-opp2'].map(s => s.banner))];
const _kpiProvinces = [...new Set(DB['primary-opp2'].map(s => s.province))];

const KPI_BENCH = { banner: {}, province: {} };

// Banner series: typical pw=4 range −5% to +10%  → full-series slope: −0.65 to +1.30
// Hard cap pw=4: −10% to +15%  → full-series slope: −1.30 to +1.95
// Shock: 3% probability, hard cap +30% (competitor closure, large promo)
for (const b of _kpiBanners) {
  KPI_BENCH.banner[b] = _genPeerSeries(-0.65, 1.30, 0.02, 0.30, 0.03);
}

// Province series: typical pw=4 range −3% to +7%  → full-series slope: −0.39 to +0.91
// Province volatility must be smaller than banner → tighter bounds confirmed above
// Shock: 3% probability, hard cap +20%
for (const p of _kpiProvinces) {
  KPI_BENCH.province[p] = _genPeerSeries(-0.39, 0.91, 0.015, 0.20, 0.03);
}

// McK overall series: typical pw=4 range −1% to +3%  → full-series slope: −0.13 to +0.39
// Least volatile reference; shocks are extremely rare (≤1%), hard cap +10%
KPI_BENCH.mck = _genPeerSeries(-0.13, 0.39, 0.01, 0.10, 0.01);

// ── Controlled variance calibration pass ──────────────────────────────────────
//
// SYNTHETIC REALISM — classification distribution (not a business rule):
//   genWeeklyKPI generates random signals. Without calibration, nearly all stores
//   would be Store-Led because even a "small" store signal of +20% dwarfs a peer
//   at +6%, satisfying the K=3.0 magnitude-dominance threshold.
//
//   This calibration reshapes the recent window (indices 50–52) of a controlled
//   subset of stores to intentionally produce Market-Driven and Mixed/Unclear
//   cases, so that classification logic is visibly exercised across the dataset.
//
//   Purpose: validate and demonstrate the classification rules in demos/reviews.
//   Real production data is expected to vary differently from this synthetic set.
//
// Target outcome (approximate):
//   ~60–70% → Store-Led (large magnitude or directional divergence) — untouched
//   ~20–22% → Market-Driven (store pct ≈ peer pct, same direction)
//   ~8–10%  → Mixed / Unclear (store in ambiguous [2×, 3×] peer zone)
//   remaining stores in 'store-led' bucket naturally via existing generation
//
// Classification math at K=3.0 (pw=3):
//   Store-Led:     storePct ≥ 3.0 × maxPeerPct  OR  store opposes both peers
//   Market-Driven: sameDir AND storePct < 2 × maxPeerPct
//   Mixed:         sameDir AND storePct in [2×, 3×) maxPeerPct  (falls through to Step 4)
(function calibrateKPIStores() {
  // Inline pctChg for pw=3 (avoids dependency on computeKPIDiagnostics)
  function pct3(arr) {
    const cur = arr[50] + arr[51] + arr[52];
    const pri = arr[47] + arr[48] + arr[49];
    return pri > 0 ? (cur - pri) / pri * 100 : 0;
  }

  // Assign calibration mode to each store.
  // Uses Math.random() — distribution approximates targets across 520 stores.
  // 'untouched': large store signal stays as-is → Store-Led naturally
  // 'market':    reshape to storePct ≈ [0.8×, 1.7×] maxPeerPct → Market-Driven
  // 'mixed':     reshape to storePct ≈ [2.1×, 2.8×] maxPeerPct → Mixed / Unclear
  // 'opposite':  reshape to go opposite majority peer direction → Store-Led (Opposite)
  function pickMode() {
    const r = Math.random();
    if (r < 0.62) return 'untouched';   // 62% → Store-Led (leave large signals alone)
    if (r < 0.84) return 'market';      // 22% → Market-Driven
    if (r < 0.93) return 'mixed';       //  9% → Mixed / Unclear
    return 'opposite';                  //  7% → Store-Led (Opposite to Market)
  }

  for (const store of DB['primary-opp2']) {
    const mode = pickMode();
    if (mode === 'untouched') continue;

    const bPct = pct3(KPI_BENCH.banner[store.banner]);
    const pPct = pct3(KPI_BENCH.province[store.province]);
    const mPct = pct3(KPI_BENCH.mck);
    const maxP = Math.max(Math.abs(bPct), Math.abs(pPct), Math.abs(mPct));

    // Prior window average — anchors the reshaped recent weeks to the store's own scale
    const priorAvg = (store.weekly[47] + store.weekly[48] + store.weekly[49]) / 3 || 100;

    // Majority peer direction (banner + province count, McK as tiebreak)
    const upVotes = (bPct >= 0 ? 1 : 0) + (pPct >= 0 ? 1 : 0) + (mPct >= 0 ? 1 : 0);
    const majorityUp = upVotes >= 2;

    let mult;
    if (mode === 'market') {
      // Target storePct ≈ [0.8×, 1.7×] maxPeerPct, same direction as majority
      // Guarantees: sameDir && storePct < 2×maxPeer → Market-Driven
      const targetPct = _r(0.80, 1.65) * Math.max(maxP, 2.5); // floor 2.5% for visibility
      mult = majorityUp ? 1 + targetPct / 100 : Math.max(0.10, 1 - targetPct / 100);
    } else if (mode === 'mixed') {
      // Target storePct ≈ [2.1×, 2.8×] maxPeerPct, same direction as majority
      // Guarantees: sameDir BUT storePct ≥ 2×maxPeer → fails Step 3 → falls to Mixed
      const targetPct = _r(2.1, 2.75) * Math.max(maxP, 2.5);
      mult = majorityUp ? 1 + targetPct / 100 : Math.max(0.10, 1 - targetPct / 100);
    } else { // 'opposite'
      // Target: store moves opposite to peer majority, clear magnitude
      // Guarantees: oppBoth for at least two peers → Store-Led (Opposite to Market)
      const targetPct = _r(0.20, 0.55); // 20–55% change in opposing direction
      mult = majorityUp ? Math.max(0.05, 1 - targetPct) : 1 + targetPct;
    }

    // Reshape recent window (pw=3 window, indices 50–52)
    const oldWeeks = [store.weekly[50], store.weekly[51], store.weekly[52]];
    for (let k = 50; k < 53; k++) {
      store.weekly[k] = _f(Math.max(50, priorAvg * mult * _r(0.95, 1.05)));
    }

    // Scale product weeks proportionally at reshaped indices
    for (const prod of store.products) {
      for (let k = 50; k < 53; k++) {
        const ratio = oldWeeks[k - 50] > 0 ? store.weekly[k] / oldWeeks[k - 50] : 1;
        prod.weeks[k] = _f(Math.max(1, prod.weeks[k] * ratio));
      }
    }

    // Recompute derived fields after reshape
    store.signals = {
      p2: computeSignal(store.weekly, 2),
      p3: computeSignal(store.weekly, 3),
      p4: computeSignal(store.weekly, 4)
    };
    store.trends = buildTrends(store.weekly);
    store.l12m   = _f(store.weekly.reduce((a, b) => a + b, 0));
  }

  // Re-run size tier assignment since l12m values may have shifted
  const stores = DB['primary-opp2'];
  const sorted = [...stores].sort((a, b) => a.l12m - b.l12m);
  const n  = sorted.length;
  const t1 = sorted[Math.floor(n / 3)].l12m;
  const t2 = sorted[Math.floor(2 * n / 3)].l12m;
  for (const s of stores) {
    s.sizeTier = s.l12m <= t1 ? 'S' : s.l12m <= t2 ? 'M' : 'L';
  }
})();

// ── KPI Diagnostics (computed at filter/render time, pw-dependent) ────────────
// Returns all 7 KPIs for a store given the current persistence window (pw).
function computeKPIDiagnostics(store, pw) {
  const pw2 = pw * 2;

  // Rolling % change for any 53-element weekly array
  function pctChg(arr) {
    if (!arr || arr.length < pw2) return 0;
    const cur = arr.slice(-pw).reduce((a, b) => a + b, 0);
    const pri = arr.slice(-pw2, -pw).reduce((a, b) => a + b, 0);
    return pri > 0 ? +((cur - pri) / pri * 100).toFixed(1) : 0;
  }

  // KPI 1-4: store / banner / province / McK % change
  const storePct  = pctChg(store.weekly);
  const bannerPct = pctChg(KPI_BENCH.banner[store.banner]);
  const provPct   = pctChg(KPI_BENCH.province[store.province]);
  const mckPct    = pctChg(KPI_BENCH.mck);

  // KPI 5: Divergence classification
  const storeUp  = storePct >= 0;
  const bannerUp = bannerPct >= 0;
  const provUp   = provPct >= 0;
  let divergence;
  if (storeUp !== bannerUp && storeUp !== provUp) {
    // Store goes opposite to BOTH banner and province → clearly signal-driven
    divergence = 'Diverging';
  } else {
    // Within ±20 pp of both peers → likely market-driven (macro lift/drop)
    const nearBanner = Math.abs(storePct - bannerPct) <= 20;
    const nearProv   = Math.abs(storePct - provPct)   <= 20;
    divergence = (nearBanner && nearProv) ? 'Market-driven' : 'Aligned';
  }

  // KPI 7: Concentration — does a single product drive >70% of store delta?
  const storeWinCur = store.weekly.slice(-pw).reduce((a, b) => a + b, 0);
  const storeWinPri = store.weekly.slice(-pw2, -pw).reduce((a, b) => a + b, 0);
  const storeDeltaAbs = Math.abs(storeWinCur - storeWinPri) || 1;
  const topProdDelta  = store.products.reduce((max, p) => {
    const c = p.weeks.slice(-pw).reduce((a, b) => a + b, 0);
    const r = p.weeks.slice(-pw2, -pw).reduce((a, b) => a + b, 0);
    return Math.max(max, Math.abs(c - r));
  }, 0);
  const concentration = (topProdDelta / storeDeltaAbs) > 0.70 ? 'Single' : 'Distributed';

  return { storePct, bannerPct, provPct, mckPct, divergence, concentration };
}

// ── Relative Impact (Option 2 — Primary Opp 3) ───────────────────────────────
// For each reference group (banner, province, McK overall):
//   expected_delta = store_share_of_group_L12M × group_delta_for_window
//   relative_impact = actual_delta − expected_delta
// We use the average of the three expected deltas as the blended expectation.
// Threshold for Peer Context = 10% of store's average weekly sales × pw.
function computeRelativeImpact(store, pw) {
  const pw2    = pw * 2;
  const actual = store.weekly.slice(-pw).reduce((a, b) => a + b, 0) -
                 store.weekly.slice(-pw2, -pw).reduce((a, b) => a + b, 0);

  function groupDelta(arr) {
    if (!arr) return 0;
    return arr.slice(-pw).reduce((a, b) => a + b, 0) -
           arr.slice(-pw2, -pw).reduce((a, b) => a + b, 0);
  }
  function groupL12(arr) {
    if (!arr) return 1;
    return arr.reduce((a, b) => a + b, 0) || 1;
  }

  const storeL12 = store.l12m || 1;

  // Banner expectation
  const banArr   = KPI_BENCH.banner[store.banner];
  const banShare = storeL12 / groupL12(banArr);
  const banExp   = banShare * groupDelta(banArr);

  // Province expectation
  const prvArr   = KPI_BENCH.province[store.province];
  const prvShare = storeL12 / groupL12(prvArr);
  const prvExp   = prvShare * groupDelta(prvArr);

  // McK overall expectation
  const mckShare = storeL12 / groupL12(KPI_BENCH.mck);
  const mckExp   = mckShare * groupDelta(KPI_BENCH.mck);

  // Blended expected = average across three reference groups
  const expectedDelta  = (banExp + prvExp + mckExp) / 3;
  const relativeImpact = _f(actual - expectedDelta);

  // Peer context threshold: 10% of store's mean weekly sales × pw
  const meanWeekly = storeL12 / 53;
  const threshold  = meanWeekly * pw * 0.10;

  const peerContext =
    relativeImpact >  threshold ? 'Outperforming' :
    relativeImpact < -threshold ? 'Underperforming' : 'In-line';

  // Concentration (same logic as opp2)
  const actualAbs  = Math.abs(actual) || 1;
  const topProd    = store.products.reduce((max, p) => {
    const c = p.weeks.slice(-pw).reduce((a, b) => a + b, 0);
    const r = p.weeks.slice(-pw2, -pw).reduce((a, b) => a + b, 0);
    return Math.max(max, Math.abs(c - r));
  }, 0);
  const concentration = (topProd / actualAbs) > 0.70 ? 'Single' : 'Distributed';

  // Tooltip context (for tooltips only — not shown as raw columns)
  const bannerPct = banArr
    ? +(groupDelta(banArr) / (groupL12(banArr) / 53 / pw * pw || 1) * 100).toFixed(1)
    : 0;

  return {
    actual: _f(actual),
    expectedDelta: _f(expectedDelta),
    relativeImpact,
    peerContext,
    concentration,
    // tooltip-only context
    bannerPct: +(banShare * 100).toFixed(2),  // store's % share of banner volume
    provPct:   +(prvShare * 100).toFixed(2),
    mckPct:    +(mckShare * 100).toFixed(2),
  };
}
