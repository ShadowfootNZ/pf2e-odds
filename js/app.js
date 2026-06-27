// ===== Skin toggle =====
(function () {
  const html = document.documentElement;
  const buttons = document.querySelectorAll('.skin-btn');

  const titles = { pf: 'Pathfinder Odds Calculator', sf: 'Starfinder Odds Calculator' };

  function applySkin(skin) {
    html.dataset.skin = skin;
    localStorage.setItem('pf2e-skin', skin);
    buttons.forEach(b => b.classList.toggle('active', b.dataset.skin === skin));
    document.title = titles[skin] ?? titles.pf;
  }

  // Sync button state and page title with whatever the inline script already set
  buttons.forEach(b => {
    b.classList.toggle('active', b.dataset.skin === html.dataset.skin);
    b.addEventListener('click', () => applySkin(b.dataset.skin));
  });
  document.title = titles[html.dataset.skin] ?? titles.pf;
}());

// ===== Calculator =====
document.addEventListener('DOMContentLoaded', () => {
  // Utility formatters
  const pct0 = x => `${Math.round(x * 100)}%`;
  const pct1 = x => `${(x * 100).toFixed(1)}%`;
  const round1 = x => Math.round(x * 10) / 10;

  // Clamp helpers
  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

  // Elements
  const els = {
    taskDC:        document.getElementById('taskDC'),
    taskMod:       document.getElementById('taskMod'),
    dcOut:         document.getElementById('dcOut'),
    skill:         document.getElementById('skill'),
    skillMod:      document.getElementById('skillMod'),
    sbOut:         document.getElementById('sbOut'),
    needed:        document.getElementById('needed'),
    expectedRolls: document.getElementById('expectedRolls'),
    barAch:        document.getElementById('barAch'),
    barCat:        document.getElementById('barCat'),
    achLbl:        document.getElementById('achLbl'),
    catLbl:        document.getElementById('catLbl'),
    anyPct:        document.getElementById('anyPct'),
    p2Pct:         document.getElementById('p2Pct'),
    p1Pct:         document.getElementById('p1Pct'),
    pfPct:         document.getElementById('pfPct'),
    pcPct:         document.getElementById('pcPct'),
  };

  function setPill(el, prob) {
    el.textContent = pct0(prob);
    el.closest('.pill').style.setProperty('--fill', `${(prob * 100).toFixed(1)}%`);
  }

  function validateAndCoerce() {
    let tdc    = clamp(parseInt(els.taskDC.value  || 0, 10), 0,   60);
    let tmod   = clamp(parseInt(els.taskMod.value || 0, 10), -20, 20);
    let skill  = clamp(parseInt(els.skill.value   || 0, 10), 0,   60);
    let smod   = clamp(parseInt(els.skillMod.value|| 0, 10), -20, 20);
    let needed = parseInt(els.needed.value || 1, 10);

    if (!Number.isInteger(needed) || needed < 1 || needed > 20) {
      needed = clamp(isNaN(needed) ? 1 : Math.round(needed), 1, 20);
      els.needed.value = needed;
    }

    // Reflect clamped values
    els.taskDC.value = tdc;  els.taskMod.value = tmod;
    els.skill.value  = skill; els.skillMod.value = smod;

    return { tdc, tmod, skill, smod, needed };
  }

  // Compute per-roll probabilities with PF2e nat-1/nat-20 rules
  function perRoll(dc, bonus) {
    let counts = { p2: 0, p1: 0, pf: 0, pc: 0 };
    for (let r = 1; r <= 20; r++) {
      const total = r + bonus;
      // Use linear encoding 3=CritSuccess 2=Success 1=Fail 0=CritFail
      // so ±1 adjustments cross the Success/Fail boundary correctly.
      let deg;
      if      (total >= dc + 10) deg = 3;
      else if (total >= dc)      deg = 2;
      else if (total <= dc - 10) deg = 0;
      else                       deg = 1;

      if (r === 20) deg = Math.min(3, deg + 1);
      if (r === 1)  deg = Math.max(0, deg - 1);

      if      (deg === 3) counts.p2++;
      else if (deg === 2) counts.p1++;
      else if (deg === 1) counts.pf++;
      else                counts.pc++;
    }
    const toProb = x => x / 20;
    return { p2: toProb(counts.p2), p1: toProb(counts.p1), pf: toProb(counts.pf), pc: toProb(counts.pc) };
  }

  // Build transition matrix for S successes target
  function buildT(S, p) {
    // States: 0..S-1, SUCCESS=S, CATA=S+1
    const dim = S + 2;
    const SUCCESS = S, CATA = S + 1;
    const T = Array.from({ length: dim }, () => Array(dim).fill(0));

    T[SUCCESS][SUCCESS] = 1;
    T[CATA][CATA]       = 1;

    for (let k = 0; k <= S - 1; k++) {
      T[k][CATA] += p.pc;
      T[k][k]    += p.pf;

      if (k === S - 1) T[k][SUCCESS]     += p.p1;
      else             T[k][k + 1]       += p.p1;

      if (k >= S - 2)  T[k][SUCCESS]     += p.p2;
      else             T[k][k + 2]       += p.p2;
    }
    return T;
  }

  function mmultVec(v, T) {
    const out = Array(T.length).fill(0);
    for (let j = 0; j < T.length; j++) {
      let s = 0;
      for (let i = 0; i < v.length; i++) s += v[i] * T[i][j];
      out[j] = s;
    }
    return out;
  }

  function compute() {
    const { tdc, tmod, skill, smod, needed } = validateAndCoerce();

    const DC = tdc + tmod;
    const SB = skill + smod;
    els.dcOut.textContent = DC.toString();
    els.sbOut.textContent = (SB >= 0 ? `+${SB}` : `${SB}`);

    const pr  = perRoll(DC, SB);
    const any = pr.p1 + pr.p2;

    const gain = pr.p1 + 2 * pr.p2;
    let expRollsDisplay = 'No chance';
    let N = 0;
    if (gain > 0) {
      const exp = needed / gain;
      expRollsDisplay = round1(exp).toFixed(1);
      N = Math.ceil(exp);
    }
    els.expectedRolls.textContent = expRollsDisplay;

    let catWithinN = 1;
    if (N > 0) {
      const T    = buildT(needed, pr);
      let v      = Array(needed + 2).fill(0);
      v[0]       = 1;
      const CATA = needed + 1;
      for (let step = 0; step < N; step++) v = mmultVec(v, T);
      catWithinN = v[CATA];
    }

    const ach = 1 - catWithinN;

    els.barAch.style.width = `${Math.max(0, Math.min(100, ach * 100))}%`;
    els.barCat.style.width = `${Math.max(0, Math.min(100, catWithinN * 100))}%`;
    els.achLbl.textContent = `Fulfilment ${pct1(ach)}`;
    els.catLbl.textContent = `Breach ${pct1(catWithinN)}`;

    setPill(els.anyPct, any);
    setPill(els.p2Pct,  pr.p2);
    setPill(els.p1Pct,  pr.p1);
    setPill(els.pfPct,  pr.pf);
    setPill(els.pcPct,  pr.pc);
  }

  ['taskDC', 'taskMod', 'skill', 'skillMod', 'needed'].forEach(id => {
    els[id].addEventListener('change', compute);
  });

  compute();
});
