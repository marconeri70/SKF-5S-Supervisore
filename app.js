// app.js — v2.3.15
(() => {
  console.log('SKF 5S Supervisor app.js v2.3.15');

  const STORAGE_KEY = 'skf5s:supervisor:data';
  const PIN_KEY     = 'skf5s:pin';
  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));

  // Storage
  const store = {
    load(){ try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch(e){ return []; } },
    save(a){ localStorage.setItem(STORAGE_KEY, JSON.stringify(a)); }
  };

  // Helpers
  const fmtP = v => `${Math.round(Number(v)||0)}%`;
  const mean = p => Math.round(((+p.s1||0)+(+p.s2||0)+(+p.s3||0)+(+p.s4||0)+(+p.s5||0))/5);

  // Parser record (accetta i tuoi JSON Rettifica/MONTAGGIO)
  function parseRec(o){
    const r = {
      area:    o.area || '',
      channel: o.channel || o.CH || o.ch || '',
      date:    o.date || o.timestamp || new Date().toISOString(),
      points:  o.points || {}
    };
    r.points = {
      s1: +((r.points.s1 ?? r.points.S1 ?? r.points['1S']) || 0),
      s2: +((r.points.s2 ?? r.points.S2 ?? r.points['2S']) || 0),
      s3: +((r.points.s3 ?? r.points.S3 ?? r.points['3S']) || 0),
      s4: +((r.points.s4 ?? r.points.S4 ?? r.points['4S']) || 0),
      s5: +((r.points.s5 ?? r.points.S5 ?? r.points['5S']) || 0),
    };
    // note (se presenti)
    r.notes = Array.isArray(o.notes) ? o.notes.map(n=>({
      s: n.s || n.S || n.type || '',
      text: n.text || n.note || '',
      date: n.date || r.date
    })) : [];
    return r;
  }

  // Import multiplo
  async function handleImport(files){
    if (!files?.length) return;
    const curr = store.load();
    const byKey = new Map(curr.map(x => [x.area+'|'+x.channel+'|'+x.date, x]));
    for (const f of files){
      try{
        const obj = JSON.parse(await f.text());
        const rec = parseRec(obj);
        if (!rec.channel) throw new Error('CH mancante');
        byKey.set(rec.area+'|'+rec.channel+'|'+rec.date, rec);
      }catch(e){
        console.error('Errore import', f.name, e);
        alert('Errore nel file: ' + f.name);
      }
    }
    const merged = Array.from(byKey.values()).sort((a,b)=>new Date(a.date)-new Date(b.date));
    store.save(merged);
    renderAll();
  }

  // Export con PIN
  function exportAll(){
    const saved = localStorage.getItem(PIN_KEY);
    const ask = prompt('Inserisci PIN (demo 1234):','');
    if ((saved && ask !== saved) || (!saved && ask !== '1234')) {
      alert('PIN errato'); return;
    }
    const blob = new Blob([JSON.stringify(store.load(), null, 2)], {type:'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'SKF-5S-supervisor-archive.json';
    a.click();
  }

  // PIN/Lucchetto
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
        const chk = prompt('Inserisci PIN attuale:'); if (chk !== old){ alert('PIN errato'); return; }
        const n1 = prompt('Nuovo PIN (4-10 cifre):'); if (!n1) return;
        const n2 = prompt('Conferma nuovo PIN:'); if (n2 !== n1){ alert('Non coincide'); return; }
        localStorage.setItem(PIN_KEY, n1); alert('PIN aggiornato.'); paint();
      } else {
        const n1 = prompt('Imposta PIN (demo 1234):'); if (!n1) return;
        localStorage.setItem(PIN_KEY, n1); paint();
      }
    };
  }

  // HOME
  function renderDelays(){
    const box = $('#delay-section'); if (!box) return;
    const ul  = $('#delay-list'); ul.innerHTML = '';
    const data = store.load();
    const lastByCH = new Map();
    for (const r of data){
      const k = r.channel;
      const arr = lastByCH.get(k) || [];
      arr.push(r); lastByCH.set(k, arr);
    }
    const rows = [];
    const now = Date.now();
    for (const [ch, arr] of lastByCH){
      const last = arr.sort((a,b)=>new Date(a.date)-new Date(b.date)).slice(-1)[0];
      const days = Math.floor((now - new Date(last.date).getTime())/86400000);
      if (days > 7){
        rows.push({ch, days, last});
      }
    }
    if (!rows.length){ box.hidden = true; return; }
    box.hidden = false;
    for (const r of rows.sort((a,b)=>b.days-a.days)){
      const li = document.createElement('li');
      li.className = 'delay-item';
      li.innerHTML = `<strong>${r.ch}</strong> — ${r.days} giorni di ritardo <span class="chip">${r.last.area||''}</span>
        <small class="muted">(ultimo: ${r.last.date.slice(0,10)})</small>
        <a class="btn tiny outline" href="notes.html?v=2315#hlCh=${encodeURIComponent(r.ch)}&hlDate=${encodeURIComponent(r.last.date)}">Vedi note</a>`;
      ul.appendChild(li);
    }
  }

  function renderHome(){
    const wrap = $('#board-all'); if (!wrap) return;
    const chips = $('#chip-strip'); if (chips) chips.innerHTML = '';
    const activeType = $('#segmented-type .seg.on')?.dataset.type || 'all';
    const filt = r => activeType==='all' ? true : (r.area===activeType);
    const data = store.load().filter(filt);

    const byCh = new Map();
    for (const r of data){
      const k = r.channel || 'CH?';
      (byCh.get(k) || byCh.set(k, []).get(k)).push(r);
    }

    wrap.innerHTML = '';
    for (const [ch, arr] of Array.from(byCh.entries()).sort()){
      const last = arr.sort((a,b)=>new Date(a.date)-new Date(b.date)).slice(-1)[0];
      const p = last?.points || {s1:0,s2:0,s3:0,s4:0,s5:0};
      const card = document.createElement('div');
      card.className = 'board';
      card.innerHTML = `
        <h4>${ch} <small class="muted">${last?.area||''}</small></h4>
        <div class="hbars">
          <div class="hbar"><i class="l1" style="width:${p.s1}%"></i><span class="pct">1S ${fmtP(p.s1)}</span></div>
          <div class="hbar"><i class="l2" style="width:${p.s2}%"></i><span class="pct">2S ${fmtP(p.s2)}</span></div>
          <div class="hbar"><i class="l3" style="width:${p.s3}%"></i><span class="pct">3S ${fmtP(p.s3)}</span></div>
          <div class="hbar"><i class="l4" style="width:${p.s4}%"></i><span class="pct">4S ${fmtP(p.s4)}</span></div>
          <div class="hbar"><i class="l5" style="width:${p.s5}%"></i><span class="pct">5S ${fmtP(p.s5)}</span></div>
        </div>`;
      wrap.appendChild(card);

      const chip = document.createElement('button');
      chip.className = 'btn chip'; chip.textContent = ch;
      chip.onclick = () => location.href = 'checklist.html?v=2315#'+encodeURIComponent(ch);
      chips?.appendChild(chip);
    }
  }

  // CHECKLIST
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
    w.document.close(); w.print(); setTimeout(()=>w.close(),100);
  }

  function renderChecklist(){
    const wrap = $('#cards'); if (!wrap) return;
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
      card.innerHTML = `
        <div class="top" style="display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap">
          <div>
            <div style="font-weight:800">CH ${ch.replace(/^CH\\s*/,'')}</div>
            <div class="muted" style="font-size:.9rem">${last?.area||''} • Ultimo: ${last?.date||'-'}</div>
          </div>
          <div class="pills">
            <span class="pill s1">S1 ${fmtP(p.s1)}</span>
            <span class="pill s2">S2 ${fmtP(p.s2)}</span>
            <span class="pill s3">S3 ${fmtP(p.s3)}</span>
            <span class="pill s4">S4 ${fmtP(p.s4)}</span>
            <span class="pill s5">S5 ${fmtP(p.s5)}</span>
            <span class="pill" style="background:#eef5ff;color:#0b3b8f">Voto medio ${fmtP(mean(p))}</span>
          </div>
          <div style="display:flex;gap:8px">
            <button class="btn outline btn-print">Stampa PDF</button>
            <button class="btn outline btn-toggle-one" data-state="expanded">Comprimi</button>
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

      card.querySelector('.btn-print').onclick = () => printCard(card);
      card.querySelector('.btn-toggle-one').onclick = (e) => {
        card.classList.toggle('compact');
        const st = card.classList.contains('compact') ? 'collapsed' : 'expanded';
        e.currentTarget.textContent = st==='collapsed' ? 'Espandi' : 'Comprimi';
      };
    }

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

  // NOTE (già ok nella tua versione)
  function renderNotes(){
    const box = $('#notes-list'); if (!box) return;
    const rows = [];
    for (const r of store.load()){
      for (const n of (r.notes || [])){
        rows.push({ ch:r.channel, area:r.area, s:n.s, text:n.text, date:n.date || r.date });
      }
    }
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

    // evidenziazione da hash
    const url = new URL(location.href);
    const hlCh = url.hash.match(/hlCh=([^&]+)/)?.[1] ? decodeURIComponent(url.hash.match(/hlCh=([^&]+)/)[1]) : null;

    const list = rows
      .filter(r => (typeVal==='all' ? true : r.area===typeVal))
      .filter(r => (!chVal ? true : ((''+r.ch).toLowerCase().includes(chVal))))
      .filter(r => inRange(r.date))
      .sort((a,b)=> new Date(b.date) - new Date(a.date));

    box.innerHTML = '';
    $('#notes-count')?.textContent = `(${list.length})`;

    if (!list.length){
      box.innerHTML = '<div class="muted">Nessuna nota con i filtri selezionati.</div>';
      return;
    }

    let lastHeader = '';
    for (const n of list){
      const header = `${n.ch} • ${n.area}`;
      if (header !== lastHeader){
        const h = document.createElement('h3');
        h.textContent = header;
        box.appendChild(h);
        lastHeader = header;
      }
      const sNum = (n.s||'').toString().match(/[1-5]/)?.[0] || '1';
      const el = document.createElement('div');
      el.className = 'note';
      if (hlCh && (''+n.ch)===hlCh) el.style.outline = '3px solid #ff8a8a';
      el.innerHTML = `
        <div style="display:flex;justify-content:space-between;gap:.5rem;flex-wrap:wrap">
          <div><span class="pill s${sNum}">S${sNum}</span></div>
          <div class="muted">${n.date||''}</div>
        </div>
        <div style="margin-top:.45rem;white-space:pre-wrap">${n.text||''}</div>`;
      box.appendChild(el);
    }
  }

  // Event binding robusto
  function bindCommon(){
    // Import
    $('#btn-import')?.addEventListener('click', () => $('#import-input')?.click());
    $('#import-input')?.addEventListener('change', (e) => handleImport(e.target.files));

    // Export
    $('#btn-export')?.addEventListener('click', exportAll);
    $('#btn-export-supervisor')?.addEventListener('click', exportAll);

    // Note
    $('#btn-notes')?.addEventListener('click', () => location.href = 'notes.html?v=2315');

    // Filtri note
    $('#f-apply')?.addEventListener('click', renderNotes);
    $('#f-clear')?.addEventListener('click', () => {
      if ($('#f-type')) $('#f-type').value = 'all';
      if ($('#f-from')) $('#f-from').value = '';
      if ($('#f-to'))   $('#f-to').value   = '';
      if ($('#f-ch'))   $('#f-ch').value   = '';
      renderNotes();
    });

    // Toggle tipo (Tutti/Rettifica/MONTAGGIO) con delega
    $('#segmented-type')?.addEventListener('click', (e) => {
      const b = e.target.closest('.seg'); if (!b) return;
      $$('#segmented-type .seg').forEach(x=>x.classList.remove('on'));
      b.classList.add('on');
      renderHome();
    });
  }

  function renderAll(){
    renderDelays();
    renderHome();
    renderChecklist();
    renderNotes();
  }

  // Boot
  window.addEventListener('DOMContentLoaded', () => {
    bindCommon();
    initLock();
    renderAll();

    // registra SW “safe”
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js?v=2315').catch(()=>{});
    }
  });
})();
