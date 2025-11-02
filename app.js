// SKF 5S Supervisor — v2.4.1 (FIX NOTE + tasto Note robusto)
// Nessun cambiamento grafico. Solo:
// - parser note molto più flessibile (supporto: notes, note, Notes, NOTE, S1..S5, campi *nota*, oggetti/array, stringhe con \n)
// - tasto Note funzionante anche come <button id="btn-notes"> o <a href="notes.html">

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

  // ---- NOTE PARSER ULTRA-ROBUSTO ----
  // Accetta:
  //  A) notes (array di {s|S|type, text|note, date?})
  //  B) note/Notes/NOTE
  //  C) oggetto {s1:"riga1\nriga2", s2:[...], ...}
  //  D) root con S1..S5 (array/stringhe)
  //  E) qualsiasi campo che contenga "note" o "nota" (anche "note1S", "notaS3" ecc.) -> prova a capire la S dal nome
  function parseNotesFlexibleAny(obj, fallbackDate){
    const out = [];
    const pushItem = (sTag, txt) => {
      const s = (sTag || '').toString();
      const S = s.match(/[1-5]/)?.[0] ? ('S' + s.match(/[1-5]/)[0]) : (s.toUpperCase().startsWith('S') ? s.toUpperCase() : '');
      const text = String(txt||'').trim();
      if (text) out.push({ s: S || sTag || '', text, date: fallbackDate });
    };

    const feedValue = (key, val) => {
      // prova a capire la S dal nome chiave (es: "noteS3", "nota_1S", "S4_note")
      const m = String(key).match(/[1-5]/);
      const sHint = m ? 'S' + m[0] : '';
      if (typeof val === 'string'){
        val.split(/\n+/).forEach(line => pushItem(sHint, line));
      } else if (Array.isArray(val)){
        val.forEach(v => pushItem(sHint, v));
      } else if (val && typeof val === 'object'){
        // oggetto annidato: estrai stringhe/array
        Object.entries(val).forEach(([k,v]) => feedValue(k, v));
      }
    };

    // A/B: cerca campi "notes"/"note"
    const candKeys = Object.keys(obj||{});
    const firstNotesKey = candKeys.find(k => /^notes?$/i.test(k));
    if (firstNotesKey){
      const src = obj[firstNotesKey];
      if (Array.isArray(src)){
        for (const n of src){
          if (!n) continue;
          const sTag = n.s || n.S || n.type || n.sezione || '';
          const text = n.text || n.note || n.nota || '';
          const date = n.date || fallbackDate;
          if (String(text||'').trim()) out.push({ s: sTag, text: String(text), date });
        }
      } else if (src && typeof src === 'object'){
        Object.entries(src).forEach(([k,v]) => feedValue(k, v));
      } else if (typeof src === 'string'){
        src.split(/\n+/).forEach(line => pushItem('', line));
      }
    }

    // C/D: supporto S1..S5 su root
    ['S1','S2','S3','S4','S5','s1','s2','s3','s4','s5','1S','2S','3S','4S','5S'].forEach(k=>{
      if (obj[k] !== undefined) feedValue(k, obj[k]);
    });

    // E: qualsiasi campo che contenga "note" o "nota"
    candKeys
      .filter(k => /note|nota/i.test(k))
      .forEach(k => {
        if (k === firstNotesKey) return; // già gestito
        feedValue(k, obj[k]);
      });

    return out;
  }

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

    // NOTE: parser completo
    rec.notes = parseNotesFlexibleAny(obj, rec.date);

    return rec;
  }

  // ---------------- Import / Export / PIN ----------------
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
    render(); // aggiorna pagina corrente (home/checklist/notes)
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

  // ---------------- HOME (come tua versione) ----------------
  function renderHome(){
    const wrap = $('#board-all'); if (!wrap) return;

    renderDelays();

    const data = store.load();
    const activeType = $('.segmented .seg.on')?.dataset.type || 'all';
    const filt = (r) => activeType==='all' ? true : (r.area===activeType);

    const byCh = new Map();
    for (const r of data.filter(filt)){
      const k = r.channel || 'CH?';
      (byCh.get(k) || byCh.set(k, []).get(k)).push(r);
    }

    wrap.innerHTML = '';
    for (const [ch, arr] of Array.from(byCh.entries()).sort()){
      const last = arr.sort((a,b)=> new Date(a.date)-new Date(b.date)).slice(-1)[0];
      const p = last?.points || {s1:0,s2:0,s3:0,s4:0,s5:0};

      const card = document.createElement('div');
      card.className = 'board';
      card.innerHTML = `
        <h4 style="margin:0 0 6px 0;display:flex;justify-content:space-between;gap:8px">
          <span>${ch}</span><span class="muted">${last?.area||''}</span>
        </h4>
        <div class="vbars">
          <div class="vbar l1"><i style="height:${p.s1}%"></i><span class="pct">${fmtPercent(p.s1)}</span></div>
          <div class="vbar l2"><i style="height:${p.s2}%"></i><span class="pct">${fmtPercent(p.s2)}</span></div>
          <div class="vbar l3"><i style="height:${p.s3}%"></i><span class="pct">${fmtPercent(p.s3)}</span></div>
          <div class="vbar l4"><i style="height:${p.s4}%"></i><span class="pct">${fmtPercent(p.s4)}</span></div>
          <div class="vbar l5"><i style="height:${p.s5}%"></i><span class="pct">${fmtPercent(p.s5)}</span></div>
        </div>
        <div class="vlabel">1S • 2S • 3S • 4S • 5S</div>
        <button class="btn big" style="margin-top:8px"
          onclick="location.href='checklist.html?hlCh=${encodeURIComponent(ch)}#${encodeURIComponent(ch)}'">
          Apri scheda
        </button>
      `;
      wrap.appendChild(card);
    }

    $$('.segmented .seg').forEach(b=>{
      b.onclick = () => { $$('.segmented .seg').forEach(x=>x.classList.remove('on')); b.classList.add('on'); renderHome(); };
    });
  }

  // ---------------- Ritardi ----------------
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
      const qs = new URLSearchParams({ hlCh: d.ch, hlDate: d.last });
      li.innerHTML = `
        <strong>${d.ch}</strong> — <span class="chip">${d.area||''}</span>
        <span class="muted">${d.days} giorni di ritardo</span>
        <button class="btn tiny outline" onclick="location.href='checklist.html?${qs.toString()}#${encodeURIComponent(d.ch)}'">Vai alla scheda</button>
        <button class="btn tiny" onclick="location.href='notes.html?${qs.toString()}'">Vedi note</button>
      `;
      list.appendChild(li);
    }
  }

  // ---------------- Stampa scheda singola ----------------
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
    w.document.write(card.innerHTML.replaceAll('vbars','').replaceAll('vbar','bar'));
    w.document.close(); w.focus(); w.print(); setTimeout(()=>w.close(),100);
  }

  // ---------------- Checklist ----------------
  function renderChecklist(){
    const wrap = $('#cards'); if (!wrap) return;

    const data = store.load();
    wrap.innerHTML = '';

    const qs = new URLSearchParams(location.search);
    const hlCh = qs.get('hlCh') ? decodeURIComponent(qs.get('hlCh')) : '';
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
            <button class="btn" data-note="${encodeURIComponent(ch)}">Vedi note</button>
          </div>
        </div>
        <div class="bars">
          <div class="bar"><i class="l1" style="width:${p.s1}%"></i><span class="lbl">1S</span></div>
          <div class="bar"><i class="l2" style="width:${p.s2}%"></i><span class="lbl">2S</span></div>
          <div class="bar"><i class="l3" style="width:${p.s3}%"></i><span class="lbl">3S</span></div>
          <div class="bar"><i class="l4" style="width:${p.s4}%"></i><span class="lbl">4S</span></div>
          <div class="bar"><i class="l5" style="width:${p.s5}%"></i><span class="lbl">5S</span></div>
        </div>`;
      wrap.appendChild(card);

      // bind pulsanti card
      card.querySelector('.btn-print').onclick  = () => printCard(card);
      card.querySelector('.btn-toggle').onclick = () => card.classList.toggle('compact');
      card.querySelector('[data-note]')?.addEventListener('click', (e)=>{
        const chEnc = e.currentTarget.getAttribute('data-note');
        const params = new URLSearchParams({ hlCh: chEnc });
        location.href = `notes.html?${params.toString()}`;
      });

      // highlight se richiesto
      if (hlCh && ch === hlCh){
        card.classList.add('hl');
        setTimeout(()=> card.scrollIntoView({behavior:'smooth', block:'center'}), 50);
      }
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

  // ---------------- Notes (solo evidenziazione da query) ----------------
  function renderNotes(){
    const box = $('#notes-list'); if (!box) return;
    // La pagina notes.html che già hai deve leggere localStorage e popolare #notes-list.
    // Qui gestiamo solo l’evidenziazione quando arrivi con ?hlCh=...
    const qs = new URLSearchParams(location.search);
    const hlCh = qs.get('hlCh') ? decodeURIComponent(qs.get('hlCh')) : '';
    if (!hlCh) return;

    setTimeout(()=>{
      $$('#notes-list .note').forEach(n=>{
        if (n.textContent.includes(hlCh)){
          n.style.boxShadow = '0 0 0 3px rgba(255,0,0,.35) inset';
        }
      });
    }, 120);
  }

  // ---------------- Binder comune ----------------
  function initCommon(){
    // Import
    $('#btn-import')?.addEventListener('click', () => $('#import-input')?.click());
    $('#import-input')?.addEventListener('change', (e) => handleImport(e.target.files));

    // Export
    $('#btn-export')?.addEventListener('click', exportAll);
    $('#btn-export-supervisor')?.addEventListener('click', exportAll);

    // Tasto Note (robusto: se è un <button id="btn-notes">, forzo navigazione)
    const btnNotes = $('#btn-notes');
    if (btnNotes && btnNotes.tagName !== 'A'){
      btnNotes.addEventListener('click', () => { location.href = 'notes.html'; });
    }
  }

  // ---------------- Dispatcher ----------------
  function render(){
    renderHome();
    renderChecklist();
    renderNotes();
  }

  // ---------------- Boot ----------------
  window.addEventListener('DOMContentLoaded', () => {
    initCommon();
    initLock();
    render();
    if ('serviceWorker' in navigator){
      navigator.serviceWorker.register('sw.js').catch(()=>{});
    }
  });
})();
