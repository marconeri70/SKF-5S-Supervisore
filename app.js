// SKF 5S Supervisor — build 2.3.16-full
// Home: grafici a torta orizzontali + ritardi
// Checklist: card CH con stampa singola + comprimi/espandi
// Note: elenco con filtri (tipo/CH/data)
// Import multiplo JSON, Export con PIN, PIN/lucchetto

(() => {
  const STORAGE_KEY = 'skf5s:supervisor:data';
  const PIN_KEY     = 'skf5s:pin';

  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));

  // ---------------- Storage ----------------
  const store = {
    load(){
      try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
      catch(e){ console.warn('[store.load]', e); return []; }
    },
    save(arr){ localStorage.setItem(STORAGE_KEY, JSON.stringify(arr)); }
  };

  // ---------------- Utils ----------------
  const fmtPercent = v => `${Math.round(Number(v)||0)}%`;
  const mean = p => Math.round(((+p.s1||0)+(+p.s2||0)+(+p.s3||0)+(+p.s4||0)+(+p.s5||0))/5);

  // Parser robusto NOTE (accetta array o oggetto s1..s5)
  function parseNotesFlexible(src, fallbackDate){
    const out = [];
    if (!src) return out;

    if (Array.isArray(src)){
      for (const n of src){
        if (!n) continue;
        out.push({
          s:    n.s || n.S || n.type || '',
          text: n.text || n.note || '',
          date: n.date || fallbackDate
        });
      }
      return out;
    }
    if (typeof src === 'object'){
      for (const k of Object.keys(src)){
        const val = src[k];
        if (typeof val === 'string' && val.trim()){
          for (const line of val.split(/\n+/)){
            const t = line.trim();
            if (t) out.push({ s:k, text:t, date:fallbackDate });
          }
        } else if (Array.isArray(val)){
          for (const line of val){
            const t = String(line||'').trim();
            if (t) out.push({ s:k, text:t, date:fallbackDate });
          }
        }
      }
      return out;
    }
    return out;
  }

  // Record parser (area, channel, date, points, notes)
  function parseRec(obj){
    const rec = {
      area:    obj.area || '',
      channel: obj.channel || obj.CH || obj.ch || '',
      date:    obj.date || obj.timestamp || new Date().toISOString(),
      points:  obj.points || obj.kpi || {},
      notes:   []
    };
    rec.points = {
      s1: Number(rec.points.s1 || rec.points.S1 || rec.points['1S'] || 0),
      s2: Number(rec.points.s2 || rec.points.S2 || rec.points['2S'] || 0),
      s3: Number(rec.points.s3 || rec.points.S3 || rec.points['3S'] || 0),
      s4: Number(rec.points.s4 || rec.points.S4 || rec.points['4S'] || 0),
      s5: Number(rec.points.s5 || rec.points.S5 || rec.points['5S'] || 0)
    };

    // note flessibili
    rec.notes = parseNotesFlexible(obj.notes, rec.date);
    // supporto eventuali S1..S5 array su root
    for (const k of Object.keys(obj||{})){
      if (/^S[1-5]$/i.test(k) && Array.isArray(obj[k])){
        for (const line of obj[k]){
          const t = String(line||'').trim();
          if (t) rec.notes.push({ s:k, text:t, date:rec.date });
        }
      }
    }
    return rec;
  }

  // ---------------- Import / Export ----------------
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
    render(); // aggiorna tutte le viste della pagina corrente
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

  // ---------------- PIN / Lucchetto ----------------
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

  // ---------------- PIE (donut) per la home ----------------
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

  // ---------------- Ritardi (home) ----------------
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

  // ---------------- Home (index) ----------------
  function renderHome(){
    const wrap = $('#pie-strip'); // presente solo in index.html
    if (!wrap) return; // siamo su altre pagine
    renderDelays();

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

  // ---------------- Stampa singola card (checklist) ----------------
  function printCard(card){
    const w = window.open('', '_blank');
    w.document.write(`<title>Stampa CH</title><style>
      body{font-family:Arial,sans-serif;margin:20px}
      .pill{display:inline-block;margin-right:6px;padding:4px 8px;border-radius:12px;color:#fff;font-weight:bold}
      .s1{background:${getComputedStyle(document.documentElement).getPropertyValue('--s1')}}
      .s2{background:${getComputedStyle(document.documentElement).getPropertyValue('--s2')}}
      .s3{background:${getComputedStyle(document.documentElement).getPropertyValue('--s3')}}
      .s4{background:${getComputedStyle(document.documentElement).getPropertyValue('--s4')}}
      .s5{background:${getComputedStyle(document.documentElement).getPropertyValue('--s5')}}
      .bar{height:14px;border-radius:7px;background:#eee;margin:10px 0;position:relative}
      .bar i{position:absolute;left:0;top:0;height:100%;border-radius:7px}
    </style>`);
    w.document.write(card.innerHTML.replaceAll('hbars','').replaceAll('hbar','bar'));
    w.document.close(); w.focus(); w.print(); setTimeout(()=>w.close(),100);
  }

  // ---------------- Checklist (checklist.html) ----------------
  function renderChecklist(){
    const wrap = $('#cards'); if (!wrap) return; // non siamo in checklist
    const data = store.load();
    wrap.innerHTML = '';

    const hash = decodeURIComponent(location.hash.slice(1) || '');
    const byCh = new Map();
    for (const r of data){
      const key = r.channel || 'CH?';
      (byCh.get(key) || byCh.set(key, []).get(key)).push(r);
    }

    for (const [ch, arr] of Array.from(byCh.entries()).sort()){
      if (hash && ch !== hash) continue;
      const last = arr.sort((a,b)=> new Date(a.date)-new Date(b.date)).slice(-1)[0];
      const p = last?.points || {s1:0,s2:0,s3:0,s4:0,s5:0};

      const card = document.createElement('article');
      card.className = 'card-line';
      card.id = `CH-${CSS.escape(ch)}`;
      card.innerHTML = `
        <div class="top">
          <div>
            <div style="font-weight:800">CH ${ch.replace(/^CH\\s*/,'')}</div>
            <div class="muted" style="font-size:.9rem">${last?.area||''} • Ultimo: ${last?.date||'-'}</div>
          </div>
          <div class="pills">
            <span class="pill s1">S1 ${fmtPercent(p.s1)}</span>
            <span class="pill s2">S2 ${fmtPercent(p.s2)}</span>
            <span class="pill s3">S3 ${fmtPercent(p.s3)}</span>
            <span class="pill s4">S4 ${fmtPercent(p.s4)}</span>
            <span class="pill s5">S5 ${fmtPercent(p.s5)}</span>
            <span class="pill" style="background:#eef5ff;color:#0b3b8f">Voto medio ${fmtPercent(mean(p))}</span>
          </div>
          <div style="display:flex;gap:.5rem;align-items:center">
            <button class="btn outline btn-print">Stampa PDF</button>
            <button class="btn outline btn-toggle">Comprimi/Espandi</button>
          </div>
        </div>
        <div class="bars">
          <div class="bar"><i class="l1" style="width:${p.s1}%"></i></div>
          <div class="bar"><i class="l2" style="width:${p.s2}%"></i></div>
          <div class="bar"><i class="l3" style="width:${p.s3}%"></i></div>
          <div class="bar"><i class="l4" style="width:${p.s4}%"></i></div>
          <div class="bar"><i class="l5" style="width:${p.s5}%"></i></div>
        </div>`;
      wrap.appendChild(card);

      card.querySelector('.btn-print').onclick  = () => printCard(card);
      card.querySelector('.btn-toggle').onclick = () => card.classList.toggle('compact');
    }

    // comprimi/espandi TUTTI
    const toggleAll = $('#btn-toggle-all');
    if (toggleAll){
      let compact = false;
      toggleAll.onclick = () => {
        compact = !compact;
        $$('.card-line').forEach(c => c.classList.toggle('compact', compact));
      };
    }

    $('#btn-print-all')?.addEventListener('click', () => window.print());
  }

  // ---------------- Note (notes.html) ----------------
  function renderNotes(){
    const box = $('#notes-list'); if (!box) return;
    const rows = [];
    for (const r of store.load()){
      for (const n of (r.notes || [])){
        rows.push({
          ch:   r.channel,
          area: r.area,
          s:    n.s,
          text: n.text,
          date: n.date || r.date
        });
      }
    }

    const qs = new URLSearchParams(location.search);
    const typeVal = $('#f-type')?.value || 'all';
    const fromVal = $('#f-from')?.value || '';
    const toVal   = $('#f-to')?.value   || '';
    const chVal   = ($('#f-ch')?.value  || '').trim().toLowerCase();
    const inRange = (d) => {
      const t = new Date(d).getTime();
      if (fromVal && t < new Date(fromVal).getTime()) return false;
      if (toVal   && t > new Date(toVal).getTime()+86400000-1) return false;
      return true;
    };

    const list = rows
      .filter(r => (typeVal==='all' ? true : r.area===typeVal))
      .filter(r => (!chVal ? true : ((''+r.ch).toLowerCase().includes(chVal))))
      .filter(r => inRange(r.date))
      .sort((a,b)=> new Date(b.date) - new Date(a.date));

    box.innerHTML = '';
    if ($('#notes-count'))   $('#notes-count').textContent   = `(${list.length})`;
    if ($('#notes-counter')) $('#notes-counter').textContent = `${list.length} note`;

    if (!list.length){
      box.innerHTML = '<div class="muted">Nessuna nota con i filtri selezionati.</div>';
      return;
    }

    for (const n of list){
      const S = (n.s||'').toString().match(/[1-5]/)?.[0] || '1';
      const el = document.createElement('div');
      el.className = 'note';
      el.innerHTML = `
        <div style="display:flex;justify-content:space-between;gap:.5rem;flex-wrap:wrap">
          <div><strong>${n.ch}</strong> • <span class="pill s${S}">S${S}</span> <span class="chip">${n.area||''}</span></div>
          <div class="muted">${n.date||''}</div>
        </div>
        <div style="margin-top:.45rem;white-space:pre-wrap">${n.text||''}</div>`;
      box.appendChild(el);
    }

    // evidenziazione da link "ritardi" (se presente)
    const hlCh   = qs.get('hlCh');
    const hlDate = qs.get('hlDate');
    if (hlCh){
      const nodes = $$('.note', box).filter(n => n.textContent.includes(decodeURIComponent(hlCh)));
      nodes.forEach(n => n.style.boxShadow = '0 0 0 3px rgba(255,0,0,.35) inset');
    }
  }

  // ---------------- Bind comuni ----------------
  function initCommon(){
    $('#btn-import')?.addEventListener('click', () => $('#import-input')?.click());
    $('#import-input')?.addEventListener('change', (e) => handleImport(e.target.files));
    $('#btn-export')?.addEventListener('click', exportAll);
    $('#btn-export-supervisor')?.addEventListener('click', exportAll);

    // Note page: pulsanti filtro
    $('#f-apply')?.addEventListener('click', renderNotes);
    $('#f-clear')?.addEventListener('click', () => {
      if ($('#f-type')) $('#f-type').value = 'all';
      if ($('#f-from')) $('#f-from').value = '';
      if ($('#f-to'))   $('#f-to').value   = '';
      if ($('#f-ch'))   $('#f-ch').value   = '';
      renderNotes();
    });
  }

  // ---------------- Render dispatcher ----------------
  function render(){
    // chiama i renderer solo se gli elementi sono presenti nella pagina corrente
    renderHome();       // index.html (ignora se #pie-strip non c'è)
    renderChecklist();  // checklist.html (ignora se #cards non c'è)
    renderNotes();      // notes.html (ignora se #notes-list non c'è)
  }

  // ---------------- Boot ----------------
  window.addEventListener('DOMContentLoaded', () => {
    initCommon();
    initLock();
    render();

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(()=>{});
    }
  });
})();
