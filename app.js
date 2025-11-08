// ===============================
// SKF 5S — Supervisor v2.4.5
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
  const groups = Array.from(byCh.entries()).sort((a,b)=> String(a[0]).localeCompare(String(b[0])));

  for (const [ch, arr] of groups){
    const last = arr.sort((a,b)=> new Date(a.date) - new Date(b.date)).slice(-1)[0] || {};
    const p = last.points || {s1:0,s2:0,s3:0,s4:0,s5:0};

    const card = document.createElement('div');
    card.className = 'mini-card';
    card.innerHTML = `
      <h5>${ch} <span class="area">${last.area || ''}</span></h5>
      <div class="mini-bars">
        <div class="mini-bar" style="--h:${p.s1||0}%;--c:#e11d48"></div>
        <div class="mini-bar" style="--h:${p.s2||0}%;--c:#f59e0b"></div>
        <div class="mini-bar" style="--h:${p.s3||0}%;--c:#10b981"></div>
        <div class="mini-bar" style="--h:${p.s4||0}%;--c:#0ea5e9"></div>
        <div class="mini-bar" style="--h:${p.s5||0}%;--c:#6366f1"></div>
      </div>
      <div class="mini-scale"><span>1S</span><span>2S</span><span>3S</span><span>4S</span><span>5S</span></div>
      <a href="checklist.html#${encodeURIComponent(ch)}" class="open-link">Apri scheda</a>
    `;
    wrap.appendChild(card);
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
      <div class="mini-bars sheet-graph">
        <div class="mini-bar" style="--h:${p.s1||0}%;--c:#e11d48"></div>
        <div class="mini-bar" style="--h:${p.s2||0}%;--c:#f59e0b"></div>
        <div class="mini-bar" style="--h:${p.s3||0}%;--c:#10b981"></div>
        <div class="mini-bar" style="--h:${p.s4||0}%;--c:#0ea5e9"></div>
        <div class="mini-bar" style="--h:${p.s5||0}%;--c:#6366f1"></div>
      </div>
      <div class="mini-scale"><span>1S</span><span>2S</span><span>3S</span><span>4S</span><span>5S</span></div>
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
