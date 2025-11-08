/* =========================
   SKF 5S Supervisor — core
   ========================= */

(() => {
  const STORAGE_KEY = 'skf5s:supervisor:data';
  const PIN_KEY     = 'skf5s:pin';

  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));

  const qs = new URLSearchParams(location.search);
  const getParam = (k) => {
    const v = qs.get(k);
    return v === null ? null : decodeURIComponent(v);
  };

  /* ---------- Storage ---------- */
  const store = {
    load(){
      try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
      catch(e){ console.warn('[store.load]', e); return []; }
    },
    save(arr){ localStorage.setItem(STORAGE_KEY, JSON.stringify(arr)); }
  };

  /* ---------- Helpers ---------- */
  const fmtPercent = v => `${Math.round(Number(v)||0)}%`;
  const mean = p => Math.round(((+p.s1||0)+(+p.s2||0)+(+p.s3||0)+(+p.s4||0)+(+p.s5||0))/5);

  /* ---------- Import JSON (invariato) ---------- */
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
    render();
  }

  /* ---------- Record parser robusto (supporto notes) ---------- */
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
    rec.notes = parseNotesFlexible(obj.notes, rec.date);

    // eventuali S1..S5 come array direttamente su root
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

  /* ---------- HOME ---------- */
  function renderHome(){
    const wrap = $('#board-all'); if (!wrap) return;
    const data = store.load();

    const activeType = $('.segmented .seg.on')?.dataset.type || 'all';
    const filt = (r) => activeType==='all' ? true : (r.area===activeType);

    const byCh = new Map();
    for (const r of data.filter(filt)){
      const k = r.channel || 'CH?';
      (byCh.get(k) || byCh.set(k, []).get(k)).push(r);
    }

    wrap.innerHTML = '';
    const chips = $('#chip-strip'); if (chips) chips.innerHTML = '';

    for (const [ch, arr] of Array.from(byCh.entries()).sort()){
      const last = arr.sort((a,b)=> new Date(a.date)-new Date(b.date)).slice(-1)[0];
      const p = last?.points || {s1:0,s2:0,s3:0,s4:0,s5:0};

      const card = document.createElement('div');
      card.className = 'board';
      card.innerHTML = `
        <h4>${ch} <small class="muted">${last?.area||''}</small></h4>
        <div class="chart5s">
          ${makeCol('l1', p.s1, '1S')}
          ${makeCol('l2', p.s2, '2S')}
          ${makeCol('l3', p.s3, '3S')}
          ${makeCol('l4', p.s4, '4S')}
          ${makeCol('l5', p.s5, '5S')}
        </div>`;
      wrap.appendChild(card);

      const chip = document.createElement('button');
      chip.className = 'chip';
      chip.textContent = ch;
      chip.onclick = () => location.href = 'checklist.html#' + encodeURIComponent(ch);
      chips?.appendChild(chip);
    }

    // toggle tipo
    $$('.segmented .seg').forEach(b=>{
      b.onclick = () => { $$('.segmented .seg').forEach(x=>x.classList.remove('on')); b.classList.add('on'); renderHome(); };
    });
  }

  function makeCol(cls, val, label){
    const v = Math.max(2, Math.min(100, Number(val)||0));
    return `
      <div class="col">
        <div class="colbar ${cls}" style="height:${v}%"></div>
        <div class="colcap">${label} <strong>${fmtPercent(val)}</strong></div>
      </div>`;
  }

  /* ---------- CHECKLIST ---------- */
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

    const onlyCh = getParam('only') === '1' ? (getParam('hlCh') || '') : '';
    const onlyDate = getParam('only') === '1' ? (getParam('hlDate') || '') : '';

    for (const [ch, arr] of Array.from(byCh.entries()).sort()){
      if (hash && ch !== hash) continue;
      if (onlyCh && ch !== onlyCh) continue;

      const last = arr.sort((a,b)=> new Date(a.date)-new Date(b.date)).slice(-1)[0];
      const p = last?.points || {s1:0,s2:0,s3:0,s4:0,s5:0};

      const card = document.createElement('article');
      card.className = 'card-line';
      card.id = `CH-${CSS.escape(ch)}`;

      // evidenzia se arrivo da "Vai alla scheda" con data
      if (onlyCh && onlyDate && last?.date?.startsWith(onlyDate)) {
        card.classList.add('hl');
      }

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
          <div class="btns">
            <button class="btn outline btn-print">Stampa PDF</button>
            <button class="btn outline btn-toggle">Comprimi/Espandi</button>
            <a class="btn ghost" href="notes.html?hlCh=${encodeURIComponent(ch)}&hlDate=${encodeURIComponent(last?.date||'')}">Vedi note</a>
          </div>
        </div>

        <div class="chart5s">
          ${makeCol('l1', p.s1, '1S')}
          ${makeCol('l2', p.s2, '2S')}
          ${makeCol('l3', p.s3, '3S')}
          ${makeCol('l4', p.s4, '4S')}
          ${makeCol('l5', p.s5, '5S')}
        </div>
      `;
      wrap.appendChild(card);

      card.querySelector('.btn-print').onclick = () => printCard(card);
      card.querySelector('.btn-toggle').onclick = () => card.classList.toggle('compact');
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

  /* ---------- NOTE (fix filtro + evidenza + fallback) ---------- */
  function renderNotes(){
    const box = $('#notes-list'); if (!box) return;

    // Costruisci tutte le note
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

    // Parametri di “deep link”
    const hlCh   = getParam('hlCh')   || '';
    const hlDate = getParam('hlDate') || '';
    const only   = getParam('only')   === '1';

    // Filtri UI
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

    // 1) Applica filtri base UI
    let list = rows
      .filter(r => (typeVal==='all' ? true : r.area===typeVal))
      .filter(r => (!chVal ? true : ((''+r.ch).toLowerCase().includes(chVal))))
      .filter(r => inRange(r.date));

    // 2) Se arrivo con only=1, restringi a quel CH (sempre),
    //    e prova prima con data esatta, altrimenti fallback a tutto il CH
    if (only && hlCh){
      let strict = list.filter(r => r.ch === hlCh && (hlDate ? r.date?.startsWith(hlDate) : true));
      if (!strict.length){
        strict = list.filter(r => r.ch === hlCh);
      }
      list = strict;
    }

    // Render
    box.innerHTML = '';
    if ($('#notes-count'))   $('#notes-count').textContent   = `(${list.length})`;
    if ($('#notes-counter')) $('#notes-counter').textContent = `${list.length} note`;

    if (!list.length){
      box.innerHTML = '<div class="muted">Nessuna nota con i filtri selezionati.</div>';
      return;
    }

    for (const n of list.sort((a,b)=> new Date(b.date) - new Date(a.date))){
      const S = (n.s||'').toString().match(/[1-5]/)?.[0] || '1';
      const el = document.createElement('div');
      el.className = 'note';
      if (hlCh && n.ch === hlCh && (!hlDate || n.date?.startsWith(hlDate))){
        el.classList.add('hl'); // bordo evidenziato
      }
      el.innerHTML = `
        <div class="note-head">
          <div><strong>${n.ch}</strong> • <span class="pill s${S}">S${S}</span> <span class="chip">${n.area||''}</span></div>
          <div class="muted">${n.date||''}</div>
        </div>
        <div class="note-body" style="white-space:pre-wrap">${n.text||''}</div>`;
      box.appendChild(el);
    }
  }

  /* ---------- Export (PIN) ---------- */
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

  /* ---------- Lock PIN ---------- */
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

  /* ---------- Bind comuni ---------- */
  function initCommon(){
    // Import multiplo
    $('#btn-import')?.addEventListener('click', () => $('#import-input')?.click());
    $('#import-input')?.addEventListener('change', (e) => handleImport(e.target.files));

    // Export (PIN)
    $('#btn-export')?.addEventListener('click', exportAll);
    $('#btn-export-supervisor')?.addEventListener('click', exportAll);

    // NOTE: ora naviga alla pagina note
    $('#btn-notes')?.addEventListener('click', () => {
      location.href = 'notes.html';
    });

    // Filtri note (se presenti in pagina)
    $('#f-apply')?.addEventListener('click', renderNotes);
    $('#f-clear')?.addEventListener('click', () => {
      if ($('#f-type')) $('#f-type').value = 'all';
      if ($('#f-from')) $('#f-from').value = '';
      if ($('#f-to'))   $('#f-to').value   = '';
      if ($('#f-ch'))   $('#f-ch').value   = '';
      renderNotes();
    });
  }

  /* ---------- Dispatcher ---------- */
  function render(){
    renderHome();
    renderChecklist();
    renderNotes();
  }

  /* ---------- Boot ---------- */
  window.addEventListener('DOMContentLoaded', () => {
    initCommon();
    initLock();
    render();

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(err => console.warn('[SW register]', err));
    }
  });
})();
