// ===============================
// SKF 5S — Supervisor (v2.6)
// Grafici verticali in Home + Checklist
// ===============================

const $  = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));
const onReady = fn => (document.readyState === 'loading')
  ? document.addEventListener('DOMContentLoaded', fn, {once:true})
  : fn();

const store = {
  KEY: 'skf5s:data',
  load(){
    try {
      const raw = localStorage.getItem(this.KEY);
      if (raw) return JSON.parse(raw);
    } catch(e){}
    if (Array.isArray(window.SKFDATA)) return window.SKFDATA;
    return [];
  }
};

const fmtPercent = v => (v==null ? '0%' : (Math.round(Number(v)) + '%'));
const mean = p => ((Number(p.s1||0)+Number(p.s2||0)+Number(p.s3||0)+Number(p.s4||0)+Number(p.s5||0))/5);

// ===============================
// HOME
// ===============================
function renderHome(){
  const wrap = $('#board-all');
  if (!wrap) return;

  const data = store.load();
  const activeType = $('.segmented .seg.on')?.dataset.type || 'all';
  const filt = r => activeType==='all' ? true : (r.area === activeType || r.area?.toUpperCase() === activeType?.toUpperCase());

  const byCh = new Map();
  for (const r of data.filter(filt)){
    const k = r.channel || r.ch || r.name || 'CH ?';
    if (!byCh.has(k)) byCh.set(k, []);
    byCh.get(k).push(r);
  }

  wrap.innerHTML = '';
  const chips = $('#chip-strip'); if (chips) chips.innerHTML = '';

  const groups = Array.from(byCh.entries()).sort((a,b)=> String(a[0]).localeCompare(String(b[0])));

  for (const [ch, arr] of groups){
    const last = arr.sort((a,b)=> new Date(a.date) - new Date(b.date)).slice(-1)[0] || {};
    const p = last.points || {s1:0,s2:0,s3:0,s4:0,s5:0};

    const card = document.createElement('div');
    card.className = 'card-micro';
    card.innerHTML = `
      <h5>${ch} <span class="area">${last.area || ''}</span></h5>
      <div class="vbars" role="img" aria-label="Andamento 5S per ${ch}">
        <div class="vbar"><i class="l1" style="height:${p.s1||0}%"></i><span class="lbl">1S ${fmtPercent(p.s1)}</span></div>
        <div class="vbar"><i class="l2" style="height:${p.s2||0}%"></i><span class="lbl">2S ${fmtPercent(p.s2)}</span></div>
        <div class="vbar"><i class="l3" style="height:${p.s3||0}%"></i><span class="lbl">3S ${fmtPercent(p.s3)}</span></div>
        <div class="vbar"><i class="l4" style="height:${p.s4||0}%"></i><span class="lbl">4S ${fmtPercent(p.s4)}</span></div>
        <div class="vbar"><i class="l5" style="height:${p.s5||0}%"></i><span class="lbl">5S ${fmtPercent(p.s5)}</span></div>
      </div>`;
    wrap.appendChild(card);

    if (chips){
      const chip = document.createElement('button');
      chip.className = 'chip';
      chip.textContent = ch;
      chip.onclick = () => location.href = 'checklist.html#' + encodeURIComponent(ch);
      chips.appendChild(chip);
    }
  }

  $$('.segmented .seg').forEach(b=>{
    b.onclick = () => {
      $$('.segmented .seg').forEach(x=>x.classList.remove('on'));
      b.classList.add('on');
      renderHome();
    };
  });
}

// ===============================
// CHECKLIST
// ===============================
function renderChecklist(){
  const listMount = $('#cards');
  if (!listMount) return;

  const data = store.load();
  const byCh = new Map();
  for (const r of data){
    const k = r.channel || r.ch || r.name || 'CH ?';
    if (!byCh.has(k)) byCh.set(k, []);
    byCh.get(k).push(r);
  }

  listMount.innerHTML = '';
  const entries = Array.from(byCh.entries()).sort((a,b)=> String(a[0]).localeCompare(String(b[0])));

  for (const [ch, arr] of entries){
    const last = arr.sort((a,b)=> new Date(a.date) - new Date(b.date)).slice(-1)[0] || {};
    const p = last.points || {s1:0,s2:0,s3:0,s4:0,s5:0};

    const card = document.createElement('section');
    card.className = 'card-line';
    card.id = `CH-${ch}`;

    card.innerHTML = `
      <div class="top">
        <div>
          <div class="ttl"><strong>${ch}</strong></div>
          <div class="muted">${(last.area||'').toUpperCase()} • Ultimo: ${last.date || '-'}</div>
        </div>
        <div class="pills">
          <span class="pill s1">S1 ${fmtPercent(p.s1)}</span>
          <span class="pill s2">S2 ${fmtPercent(p.s2)}</span>
          <span class="pill s3">S3 ${fmtPercent(p.s3)}</span>
          <span class="pill s4">S4 ${fmtPercent(p.s4)}</span>
          <span class="pill s5">S5 ${fmtPercent(p.s5)}</span>
          <span class="pill avg">Media ${fmtPercent(mean(p))}</span>
        </div>
        <div class="btns">
          <button class="btn outline btn-print">Stampa PDF</button>
          <button class="btn outline btn-toggle">Comprimi/Espandi</button>
          <a class="btn ghost" href="notes.html?hlCh=${encodeURIComponent(ch)}&hlDate=${encodeURIComponent(last.date||'')}">Vedi note</a>
        </div>
      </div>

      <div class="vbars">
        <div class="vbar"><i class="l1" style="height:${p.s1||0}%"></i><span class="lbl">1S ${fmtPercent(p.s1)}</span></div>
        <div class="vbar"><i class="l2" style="height:${p.s2||0}%"></i><span class="lbl">2S ${fmtPercent(p.s2)}</span></div>
        <div class="vbar"><i class="l3" style="height:${p.s3||0}%"></i><span class="lbl">3S ${fmtPercent(p.s3)}</span></div>
        <div class="vbar"><i class="l4" style="height:${p.s4||0}%"></i><span class="lbl">4S ${fmtPercent(p.s4)}</span></div>
        <div class="vbar"><i class="l5" style="height:${p.s5||0}%"></i><span class="lbl">5S ${fmtPercent(p.s5)}</span></div>
      </div>
    `;

    listMount.appendChild(card);

    const tgl = card.querySelector('.btn-toggle');
    if (tgl){
      let compact = false;
      tgl.onclick = () => {
        compact = !compact;
        card.classList.toggle('compact', compact);
      };
    }
  }

  const hlCh = new URL(location.href).searchParams.get('hlCh');
  if (hlCh){
    const el = document.getElementById(`CH-${hlCh}`);
    if (el){
      el.classList.add('hl-delay');
      el.scrollIntoView({behavior:'smooth', block:'center'});
    }
  }
}

// ===============================
// Avvio
// ===============================
onReady(()=>{
  const page = (document.body.dataset.page || '').toLowerCase();
  if (page === 'home') renderHome();
  else if (location.pathname.includes('checklist')) renderChecklist();
});
