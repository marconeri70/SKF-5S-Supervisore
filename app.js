// SKF 5S Supervisor — v2.5.0 (stabile)
(() => {
  const STORAGE_KEY = 'skf5s:supervisor:data';
  const PIN_KEY     = 'skf5s:pin';
  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
  const qs = new URLSearchParams(location.search);

  // -------- Storage --------
  const store = {
    load(){ try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
            catch(e){ console.warn('[store.load]', e); return []; } },
    save(arr){ localStorage.setItem(STORAGE_KEY, JSON.stringify(arr)); }
  };

  // -------- Helpers --------
  const fmtP = v => `${Math.round(Number(v)||0)}%`;
  const mean = p => Math.round(((+p.s1||0)+(+p.s2||0)+(+p.s3||0)+(+p.s4||0)+(+p.s5||0))/5);

  function parseNotesFlexible(src, fallbackDate){
    const out = [];
    if (!src) return out;
    if (Array.isArray(src)){
      for (const n of src){
        if (!n) continue;
        out.push({ s: n.s||n.S||n.type||'', text: n.text||n.note||'', date: n.date||fallbackDate });
      }
      return out;
    }
    if (typeof src === 'object'){
      for (const k of Object.keys(src)){
        const v = src[k];
        if (typeof v === 'string' && v.trim()){
          for (const line of v.split(/\n+/)){ const t=line.trim(); if (t) out.push({s:k, text:t, date:fallbackDate}); }
        } else if (Array.isArray(v)){
          for (const line of v){ const t=String(line||'').trim(); if (t) out.push({s:k, text:t, date:fallbackDate}); }
        }
      }
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
    for (const k of Object.keys(obj||{})){
      if (/^S[1-5]$/i.test(k) && Array.isArray(obj[k])){
        for (const line of obj[k]){ const t=String(line||'').trim(); if (t) rec.notes.push({s:k, text:t, date:rec.date}); }
      }
    }
    return rec;
  }

  // -------- Import / Export / PIN --------
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
        alert('PIN aggiornato.'); paint();
      } else {
        const n1 = prompt('Imposta PIN (demo 1234):'); if (!n1) return;
        localStorage.setItem(PIN_KEY, n1); paint();
      }
    };
  }

  // -------- Grafico (colonne verticali) --------
  function chart5sHTML(p){
    const c = (k,lab)=>`
      <div class="col">
        <div class="colbar ${k}" style="height:${Math.max(3, Number(p[k])||0)}%"></div>
        <div class="colcap"><span>${lab}</span>${fmtP(p[k])}</div>
      </div>`;
    return `<div class="chart5s">${c('s1','1S')}${c('s2','2S')}${c('s3','3S')}${c('s4','4S')}${c('s5','5S')}</div>`;
  }

  // -------- HOME --------
  function renderHome(){
    if (document.body.dataset.page !== 'home') return;
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

    // Ritardi
    const delaysBox = $('#delay-section');
    if (delaysBox){
      const late = [];
      const now = Date.now();
      for (const [ch, arr] of byCh.entries()){
        const last = arr.sort((a,b)=> new Date(a.date)-new Date(b.date)).slice(-1)[0];
        if (!last) continue;
        const days = Math.floor((now - new Date(last.date).getTime())/86400000);
        if (days > 7){ late.push({ch, last, days}); }
      }
      if (late.length){
        delaysBox.style.display = 'block';
        const list = delaysBox.querySelector('.delay-list');
        list.innerHTML = '';
        for (const it of late.sort((a,b)=> b.days-a.days)){
          const li = document.createElement('li');
          li.innerHTML = `
            <strong>${it.ch}</strong>
            <span class="chip">${it.last.area||''}</span>
            <span class="muted">${it.days} giorni di ritardo</span>
            <div class="inline-actions">
              <button class="btn tiny" data-go="card" data-ch="${encodeURIComponent(it.ch)}" data-date="${encodeURIComponent(it.last.date)}">Vai alla scheda</button>
              <button class="btn tiny" data-go="notes" data-ch="${encodeURIComponent(it.ch)}" data-date="${encodeURIComponent(it.last.date)}">Vedi note</button>
            </div>`;
          list.appendChild(li);
        }
        list.querySelectorAll('button[data-go="card"]').forEach(b=>{
          b.onclick = () => {
            const ch  = b.getAttribute('data-ch');
            const dt  = b.getAttribute('data-date');
            location.href = `checklist.html?hlCh=${ch}&hlDate=${dt}&only=1`;
          };
        });
        list.querySelectorAll('button[data-go="notes"]').forEach(b=>{
          b.onclick = () => {
            const ch  = b.getAttribute('data-ch');
            const dt  = b.getAttribute('data-date');
            location.href = `notes.html?hlCh=${ch}&hlDate=${dt}&only=1`;
          };
        });
      } else delaysBox.style.display = 'none';
    }

    for (const [ch, arr] of Array.from(byCh.entries()).sort()){
      const last = arr.sort((a,b)=> new Date(a.date)-new Date(b.date)).slice(-1)[0];
      const p = last?.points || {s1:0,s2:0,s3:0,s4:0,s5:0};

      const card = document.createElement('div');
      card.className = 'board-mini';
      card.innerHTML = `
        <div class="bm-top">
          <div class="bm-title">CH ${ch.replace(/^CH\\s*/,'')}</div>
          <div class="muted">${last?.area||''}</div>
        </div>
        ${chart5sHTML(p)}
        <div class="bm-actions">
          <button class="btn link" onclick="location.href='checklist.html#${encodeURIComponent(ch)}'">Apri scheda</button>
        </div>`;
      wrap.appendChild(card);

      const chip = document.createElement('button');
      chip.className = 'chip';
      chip.textContent = ch;
      chip.onclick = () => location.href = 'checklist.html#' + encodeURIComponent(ch);
      chips?.appendChild(chip);
    }

    $$('.segmented .seg').forEach(b=>{
      b.onclick = () => { $$('.segmented .seg').forEach(x=>x.classList.remove('on')); b.classList.add('on'); renderHome(); };
    });
  }

  // -------- CHECKLIST --------
  function printCard(card){
    const w = window.open('', '_blank');
    w.document.write(`<title>Stampa CH</title><style>
      body{font-family:Arial,sans-serif;margin:20px}
      .pill{display:inline-block;margin-right:6px;padding:4px 8px;border-radius:12px;color:#fff;font-weight:bold}
      .s1{background:#e11d48}.s2{background:#f59e0b}.s3{background:#10b981}.s4{background:#0ea5e9}.s5{background:#6366f1}
      .bar{height:14px;border-radius:7px;background:#eee;margin:10px 0;position:relative}
      .bar i{position:absolute;left:0;top:0;height:100%;border-radius:7px}
    </style>`);
    w.document.write(card.innerHTML.replaceAll('chart5s','').replaceAll('colbar','bar').replaceAll('colcap',''));
    w.document.close(); w.focus(); w.print(); setTimeout(()=>w.close(),100);
  }

  function renderChecklist(){
    if (document.body.dataset.page !== 'checklist') return;
    const wrap = $('#cards'); if (!wrap) return;
    const data = store.load();
    wrap.innerHTML = '';

    const byCh = new Map();
    for (const r of data){
      const key = r.channel || 'CH?';
      (byCh.get(key) || byCh.set(key, []).get(key)).push(r);
    }

    const hlCh   = qs.get('hlCh') ? decodeURIComponent(qs.get('hlCh')) : '';
    const hlDate = qs.get('hlDate') ? decodeURIComponent(qs.get('hlDate')) : '';
    const only   = qs.get('only') === '1';

    for (const [ch, arr] of Array.from(byCh.entries()).sort()){
      if (only && ch !== hlCh) continue;

      const last = arr.sort((a,b)=> new Date(a.date)-new Date(b.date)).slice(-1)[0];
      const p = last?.points || {s1:0,s2:0,s3:0,s4:0,s5:0};

      const card = document.createElement('article');
      card.className = 'card-line';
      card.id = `CH-${CSS.escape(ch)}`;
      if (hlCh === ch) card.classList.add('hl');

      card.innerHTML = `
        <div class="top">
          <div>
            <div class="cl-title">CH ${ch.replace(/^CH\\s*/,'')}</div>
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
          <div class="btns">
            <button class="btn outline btn-print">Stampa PDF</button>
            <button class="btn" data-toggle>Comprimi/Espandi</button>
            <button class="btn" data-notes>Vedi note</button>
          </div>
        </div>
        ${chart5sHTML(p)}
      `;
      wrap.appendChild(card);

      card.querySelector('.btn-print').onclick = () => printCard(card);
      card.querySelector('[data-toggle]').onclick = () => card.classList.toggle('compact');
      card.querySelector('[data-notes]').onclick = () => {
        location.href = `notes.html?hlCh=${encodeURIComponent(ch)}&hlDate=${encodeURIComponent(last?.date||'')}&only=1`;
      };

      if (hlCh === ch){
        setTimeout(()=> card.scrollIntoView({behavior:'smooth', block:'center'}), 80);
      }
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

  // -------- NOTE --------
  function renderNotes(){
    if (document.body.dataset.page !== 'notes') return;
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

    let list = rows
      .filter(r => (typeVal==='all' ? true : r.area===typeVal))
      .filter(r => (!chVal ? true : ((''+r.ch).toLowerCase().includes(chVal))))
      .filter(r => inRange(r.date))
      .sort((a,b)=> new Date(b.date) - new Date(a.date));

    const only = qs.get('only') === '1';
    const qCh  = qs.get('hlCh') ? decodeURIComponent(qs.get('hlCh')) : '';
    const qDt  = qs.get('hlDate') ? decodeURIComponent(qs.get('hlDate')) : '';
    if (only && qCh){
      list = list.filter(r => (r.ch === qCh) && (!qDt || r.date === qDt));
    }

    box.innerHTML = '';
    $('#notes-counter')?.textContent = `${list.length} note`;

    if (!list.length){
      box.innerHTML = '<div class="muted">Nessuna nota con i filtri selezionati.</div>';
      return;
    }

    const byS = {S1:[],S2:[],S3:[],S4:[],S5:[]};
    for (const n of list){ const key = (String(n.s).match(/[1-5]/)?.[0] || '1'); byS['S'+key].push(n); }

    for (const key of ['S1','S2','S3','S4','S5']){
      if (!byS[key].length) continue;
      const block = document.createElement('div');
      block.className = 'note';
      block.innerHTML = `<div class="pill s${key[1]}">${key}</div>`;
      for (const n of byS[key]){
        const row = document.createElement('div');
        row.style.marginTop = '.45rem';
        row.innerHTML = `
          <div class="muted" style="display:flex;gap:.5rem;flex-wrap:wrap">
            <strong>${n.ch}</strong> <span class="chip">${n.area||''}</span> <span>${n.date}</span>
          </div>
          <div style="white-space:pre-wrap;margin-top:.25rem">${n.text||''}</div>`;
        block.appendChild(row);
      }
      box.appendChild(block);
    }
  }

  // -------- Bind comuni --------
  function initCommon(){
    $('#btn-import')?.addEventListener('click', () => $('#import-input')?.click());
    $('#import-input')?.addEventListener('change', e => handleImport(e.target.files));
    $('#btn-export')?.addEventListener('click', exportAll);
    $('#btn-export-supervisor')?.addEventListener('click', exportAll);
    $('#f-apply')?.addEventListener('click', renderNotes);
    $('#f-clear')?.addEventListener('click', () => {
      if ($('#f-type')) $('#f-type').value = 'all';
      if ($('#f-from')) $('#f-from').value = '';
      if ($('#f-to'))   $('#f-to').value   = '';
      if ($('#f-ch'))   $('#f-ch').value   = '';
      renderNotes();
    });
  }

  // -------- Render dispatcher --------
  function render(){
    renderHome();
    renderChecklist();
    renderNotes();
  }

  // -------- Boot --------
  window.addEventListener('DOMContentLoaded', () => {
    initCommon();
    initLock();
    render();
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js?v=2.5.0').catch(err => console.warn('[SW]', err));
    }
  });
})();
