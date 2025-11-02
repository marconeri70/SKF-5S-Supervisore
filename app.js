// SKF 5S Supervisor — v2.3.16 (Home con grafici a torta orizzontali)
(() => {
  const STORAGE_KEY = 'skf5s:supervisor:data';
  const PIN_KEY     = 'skf5s:pin';

  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));

  const store = {
    load(){
      try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
      catch(e){ console.warn('[store.load]', e); return []; }
    },
    save(arr){ localStorage.setItem(STORAGE_KEY, JSON.stringify(arr)); }
  };

  // ---------- utils
  const fmtPercent = v => `${Math.round(Number(v)||0)}%`;

  // ---------- import multiplo (invariato)
  async function handleImport(files){
    if (!files || !files.length) return;
    const current = store.load();
    const byKey = new Map(current.map(r => [r.area + '|' + r.channel + '|' + r.date, r]));

    for (const f of files){
      try{
        const txt = await f.text();
        const obj = JSON.parse(txt);
        const rec = parseRec(obj);
        if (!rec.channel) throw new Error('CH mancante');
        byKey.set(rec.area + '|' + rec.channel + '|' + rec.date, rec);
      }catch(e){
        console.error('[import]', f.name, e);
        alert('Errore file: ' + f.name);
      }
    }
    const merged = Array.from(byKey.values()).sort((a,b)=> new Date(a.date)-new Date(b.date));
    store.save(merged);
    renderHome(); // refresh
  }

  function parseRec(obj){
    const rec = {
      area:    obj.area || '',
      channel: obj.channel || obj.CH || obj.ch || '',
      date:    obj.date || obj.timestamp || new Date().toISOString(),
      points:  obj.points || obj.kpi || {},
      notes:   obj.notes || []
    };
    rec.points = {
      s1: Number(rec.points.s1 || rec.points.S1 || rec.points['1S'] || 0),
      s2: Number(rec.points.s2 || rec.points.S2 || rec.points['2S'] || 0),
      s3: Number(rec.points.s3 || rec.points.S3 || rec.points['3S'] || 0),
      s4: Number(rec.points.s4 || rec.points.S4 || rec.points['4S'] || 0),
      s5: Number(rec.points.s5 || rec.points.S5 || rec.points['5S'] || 0)
    };
    return rec;
  }

  function exportAll(){
    const pinSaved = localStorage.getItem(PIN_KEY);
    const ask = prompt('Inserisci PIN (demo 1234):', '');
    if ((pinSaved && ask !== pinSaved) || (!pinSaved && ask !== '1234')){
      alert('PIN errato'); return;
    }
    const blob = new Blob([JSON.stringify(store.load(), null, 2)], { type:'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'SKF-5S-supervisor-archive.json';
    a.click();
  }

  function initLock(){
    const btn = $('#btn-lock'); if (!btn) return;
    const paint = () => {
      const pin = localStorage.getItem(PIN_KEY);
      btn.textContent = pin ? '🔓' : '🔒';
      btn.title = pin ? 'PIN impostato — clic per cambiare' : 'Imposta PIN';
    };
    paint();
    btn.onclick = () => {
      const old = localStorage.getItem(PIN_KEY);
      if (old){
        const chk = prompt('Inserisci PIN attuale:');
        if (chk !== old){ alert('PIN errato'); return; }
        const n1 = prompt('Nuovo PIN (4-10 cifre):'); if (!n1) return;
        const n2 = prompt('Conferma nuovo PIN:');     if (n2 !== n1){ alert('Non coincide'); return; }
        localStorage.setItem(PIN_KEY, n1);
        alert('PIN aggiornato.');
        paint();
      } else {
        const n1 = prompt('Imposta PIN (demo 1234):'); if (!n1) return;
        localStorage.setItem(PIN_KEY, n1);
        paint();
      }
    };
  }

  // ---------- pie SVG (donut)
  function pieSvg(values, colors, size=220, inner=90){
    const total = values.reduce((a,b)=>a+Math.max(0,b),0) || 1;
    const cx = size/2, cy=size/2, r=size/2;
    let cur = -Math.PI/2;
    const segs = [];
    values.forEach((v,i)=>{
      const ang = (v/total)*Math.PI*2;
      const x1 = cx + r*Math.cos(cur);
      const y1 = cy + r*Math.sin(cur);
      const x2 = cx + r*Math.cos(cur+ang);
      const y2 = cy + r*Math.sin(cur+ang);
      const large = ang > Math.PI ? 1 : 0;
      const d = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
      segs.push(`<path d="${d}" fill="${colors[i]}" />`);
      cur += ang;
    });
    const hole = `<circle cx="${cx}" cy="${cy}" r="${inner}" fill="#fff"/>`;
    return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" aria-hidden="true">${segs.join('')}${hole}</svg>`;
  }

  // ---------- sezione ritardi (link alle note con evidenziazione gestita in notes.html già esistente)
  function renderDelays(){
    const box = $('#delay-section'); if (!box) return;
    const list = $('#delay-list');
    const data = store.load();
    const today = Date.now();
    const delayed = [];

    const byCh = new Map();
    for (const r of data){
      const k = r.channel || 'CH?';
      (byCh.get(k) || byCh.set(k, []).get(k)).push(r);
    }
    for (const [ch, arr] of byCh){
      const last = arr.sort((a,b)=> new Date(a.date)-new Date(b.date)).slice(-1)[0];
      const days = Math.floor((today - new Date(last.date).getTime())/86400000);
      if (days > 7) delayed.push({ch, area:last.area||'', days, last:last.date});
    }

    if (!delayed.length){ box.hidden = true; return; }
    box.hidden = false;
    list.innerHTML = '';
    for (const d of delayed.sort((a,b)=> b.days-a.days)){
      const li = document.createElement('li');
      li.innerHTML = `<strong>${d.ch}</strong> — <span class="chip">${d.area||''}</span> — <span class="muted">${d.days} giorni di ritardo</span>
        <button class="btn tiny outline" data-go="notes" data-ch="${encodeURIComponent(d.ch)}" data-date="${d.last}">Vedi note</button>`;
      list.appendChild(li);
    }
    list.querySelectorAll('button[data-go="notes"]').forEach(b=>{
      b.addEventListener('click', () => {
        const params = new URLSearchParams({ hlCh: b.dataset.ch, hlDate: b.dataset.date });
        location.href = `notes.html?${params.toString()}`;
      });
    });
  }

  // ---------- home a torta orizzontale
  function renderHome(){
    renderDelays();

    const wrap = $('#pie-strip'); if (!wrap) return;
    const data = store.load();
    const activeType = $('.segmented .seg.on')?.dataset.type || 'all';
    const filt = (r) => activeType==='all' ? true : (r.area===activeType);

    // ultima misura per CH
    const byCh = new Map();
    for (const r of data.filter(filt)){
      const k = r.channel || 'CH?';
      (byCh.get(k) || byCh.set(k, []).get(k)).push(r);
    }

    wrap.innerHTML = '';
    const cs = getComputedStyle(document.documentElement);
    const colors = [
      cs.getPropertyValue('--s1').trim()||'#6c63ff',
      cs.getPropertyValue('--s2').trim()||'#ff5a5a',
      cs.getPropertyValue('--s3').trim()||'#f6b93b',
      cs.getPropertyValue('--s4').trim()||'#27ae60',
      cs.getPropertyValue('--s5').trim()||'#2e86de'
    ];

    for (const [ch, arr] of Array.from(byCh.entries()).sort()){
      const last = arr.sort((a,b)=> new Date(a.date)-new Date(b.date)).slice(-1)[0];
      const p = last?.points || {s1:0,s2:0,s3:0,s4:0,s5:0};
      const card = document.createElement('div');
      card.className = 'piecard';
      card.innerHTML = `
        <h4><span>${ch}</span><span class="muted">${last?.area||''}</span></h4>
        <div class="piewrap">${pieSvg([p.s1,p.s2,p.s3,p.s4,p.s5], colors, 220, 90)}</div>
        <div class="pielegend">
          <span class="dot s1"></span><span>1S</span><span>${fmtPercent(p.s1)}</span>
          <span class="dot s2"></span><span>2S</span><span>${fmtPercent(p.s2)}</span>
          <span class="dot s3"></span><span>3S</span><span>${fmtPercent(p.s3)}</span>
          <span class="dot s4"></span><span>4S</span><span>${fmtPercent(p.s4)}</span>
          <span class="dot s5"></span><span>5S</span><span>${fmtPercent(p.s5)}</span>
        </div>
        <button class="btn big" style="margin-top:6px" onclick="location.href='checklist.html#${encodeURIComponent(ch)}'">Apri scheda</button>
      `;
      wrap.appendChild(card);
    }

    // switch filtro
    $$('.segmented .seg').forEach(b=>{
      b.onclick = () => { $$('.segmented .seg').forEach(x=>x.classList.remove('on')); b.classList.add('on'); renderHome(); };
    });
  }

  // ---------- bind comuni
  function initCommon(){
    $('#btn-import')?.addEventListener('click', () => $('#import-input')?.click());
    $('#import-input')?.addEventListener('change', (e) => handleImport(e.target.files));
    $('#btn-export')?.addEventListener('click', exportAll);
    $('#btn-export-supervisor')?.addEventListener('click', exportAll);
  }

  // ---------- boot
  window.addEventListener('DOMContentLoaded', () => {
    initCommon();
    initLock();
    renderHome();
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(()=>{});
    }
  });
})();
