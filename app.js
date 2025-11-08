/* =========================
   SKF 5S Supervisor — core
   ========================= */
(() => {
  const STORAGE_KEY = 'skf5s:supervisor:data';
  const PIN_KEY     = 'skf5s:pin';

  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
  const qs = new URLSearchParams(location.search);
  const getParam = (k) => { const v = qs.get(k); return v===null?null:decodeURIComponent(v); };

  /* ---------- Local storage ---------- */
  const store = {
    load(){ try{ return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }catch{ return []; } },
    save(v){ localStorage.setItem(STORAGE_KEY, JSON.stringify(v)); }
  };

  /* ---------- Utils ---------- */
  const fmtPercent = v => `${Math.round(Number(v)||0)}%`;
  const mean = p => Math.round(((+p.s1||0)+(+p.s2||0)+(+p.s3||0)+(+p.s4||0)+(+p.s5||0))/5);

  /* ---------- Import ----------
     accetta più JSON con struttura flessibile                       */
  async function handleImport(files){
    if (!files?.length) return;
    const current = store.load();
    const byKey = new Map(current.map(r => [r.area+'|'+r.channel+'|'+r.date, r]));

    for (const f of files){
      try{
        const obj = JSON.parse(await f.text());
        const rec = parseRec(obj);
        if (!rec.channel) throw new Error('CH mancante');
        byKey.set(rec.area+'|'+rec.channel+'|'+rec.date, rec);
      }catch(e){
        console.error('[import]', f.name, e);
        alert('Errore file: '+f.name);
      }
    }
    const merged = Array.from(byKey.values()).sort((a,b)=> new Date(a.date)-new Date(b.date));
    store.save(merged);
    render();
  }

  function parseNotesFlexible(src, fallbackDate){
    const out = [];
    if (!src) return out;
    if (Array.isArray(src)){
      for (const n of src) out.push({ s:n.s||n.S||n.type||'', text:n.text||n.note||'', date:n.date||fallbackDate });
      return out;
    }
    if (typeof src==='object'){
      for (const k of Object.keys(src)){
        const val = src[k];
        if (typeof val==='string'){
          for (const line of val.split(/\n+/)) if (line.trim()) out.push({ s:k, text:line.trim(), date:fallbackDate });
        } else if (Array.isArray(val)){
          for (const t of val){ const s = String(t||'').trim(); if (s) out.push({ s:k, text:s, date:fallbackDate }); }
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
      s1:Number(rec.points.s1||rec.points.S1||rec.points['1S']||0),
      s2:Number(rec.points.s2||rec.points.S2||rec.points['2S']||0),
      s3:Number(rec.points.s3||rec.points.S3||rec.points['3S']||0),
      s4:Number(rec.points.s4||rec.points.S4||rec.points['4S']||0),
      s5:Number(rec.points.s5||rec.points.S5||rec.points['5S']||0),
    };
    rec.notes = parseNotesFlexible(obj.notes, rec.date);
    for (const k of Object.keys(obj||{})){
      if (/^S[1-5]$/i.test(k) && Array.isArray(obj[k])){
        for (const line of obj[k]){ const t = String(line||'').trim(); if (t) rec.notes.push({ s:k, text:t, date:rec.date }); }
      }
    }
    return rec;
  }

  /* ---------- HOME ---------- */
  function makeCol(cls, val, label){
    const v = Math.max(2, Math.min(100, Number(val)||0));
    return `
      <div class="col">
        <div class="colbar ${cls}" style="height:${v}%"></div>
        <div class="colcap">${label} <strong>${fmtPercent(val)}</strong></div>
      </div>`;
  }

  function renderHome(){
    if (document.body.dataset.page!=='home') return;

    const strip = $('#boards-strip'); if (!strip) return;
    strip.innerHTML = '';

    const data = store.load();
    const activeType = $('.segmented .seg.on')?.dataset.type || 'all';

    // raggruppa per CH e prendi ultimo record
    const byCh = new Map();
    for (const r of data){
      if (activeType!=='all' && r.area!==activeType) continue;
      const k = r.channel || 'CH?';
      (byCh.get(k) || byCh.set(k, []).get(k)).push(r);
    }

    const chips = $('#chip-strip'); if (chips) chips.innerHTML = '';
    for (const [ch, arr] of Array.from(byCh.entries()).sort()){
      const last = arr.sort((a,b)=> new Date(a.date)-new Date(b.date)).slice(-1)[0];
      const p = last?.points || {s1:0,s2:0,s3:0,s4:0,s5:0};

      const card = document.createElement('div');
      card.className = 'board';
      card.innerHTML = `
        <h4>${ch} <span class="muted">${last?.area||''}</span></h4>
        <div class="chart5s">
          ${makeCol('l1', p.s1, '1S')}
          ${makeCol('l2', p.s2, '2S')}
          ${makeCol('l3', p.s3, '3S')}
          ${makeCol('l4', p.s4, '4S')}
          ${makeCol('l5', p.s5, '5S')}
        </div>`;
      strip.appendChild(card);

      const chip = document.createElement('button');
      chip.className = 'chip';
      chip.textContent = ch;
      chip.onclick = () => location.href = 'checklist.html#' + encodeURIComponent(ch);
      chips?.appendChild(chip);
    }

    // toggle tipo (tutti/rettifica/montaggio)
    $$('.segmented .seg').forEach(b=>{
      b.onclick = () => { $$('.segmented .seg').forEach(x=>x.classList.remove('on')); b.classList.add('on'); renderHome(); renderDelays(); };
    });

    renderDelays();
  }

  /* ---------- RITARDI ---------- */
  function renderDelays(){
    const box = $('#delay-section'); if (!box) return;
    const list = $('#delay-list');   if (!list) return;

    const data = store.load();
    const activeType = $('.segmented .seg.on')?.dataset.type || 'all';
    const now = Date.now();
    const LIMIT = 7 * 86400000; // 7 giorni

    // ultimo record per CH
    const lastByCh = new Map();
    for (const r of data){
      if (activeType!=='all' && r.area!==activeType) continue;
      const k = r.channel || 'CH?';
      if (!lastByCh.has(k) || new Date(r.date) > new Date(lastByCh.get(k).date)){
        lastByCh.set(k, r);
      }
    }

    const delays = [];
    for (const [ch, rec] of lastByCh.entries()){
      const delta = now - new Date(rec.date).getTime();
      if (delta > LIMIT){
        delays.push({
          ch, area: rec.area, days: Math.floor(delta/86400000),
          date: rec.date
        });
      }
    }
    delays.sort((a,b)=> b.days - a.days);

    if (!delays.length){
      box.classList.add('hidden');
      list.innerHTML = '';
      return;
    }

    box.classList.remove('hidden');
    list.innerHTML = '';
    for (const d of delays){
      const li = document.createElement('li');
      li.innerHTML = `
        <div><strong>${d.ch}</strong> — <span class="chip">${d.area||''}</span> — <span class="muted">${d.days} giorni di ritardo</span></div>
        <div><a class="btn tiny outline" href="checklist.html?only=1&hlCh=${encodeURIComponent(d.ch)}&hlDate=${encodeURIComponent(d.date)}">Vai alla scheda</a></div>
        <div><a class="btn tiny ghost" href="notes.html?only=1&hlCh=${encodeURIComponent(d.ch)}&hlDate=${encodeURIComponent(d.date)}">Vedi note</a></div>
      `;
      list.appendChild(li);
    }
  }

  /* ---------- CHECKLIST (solo rendering dei grafici e bottoni scheda) ---------- */
  function renderChecklist(){
    if (!/checklist\.html$/i.test(location.pathname)) return;
    const wrap = $('#cards'); if (!wrap) {
      // crea dinamicamente i contenitori se non presenti (compatibile con tua pagina)
      const main = document.querySelector('main') || document.body;
      const sec = document.createElement('section');
      sec.className = 'container';
      sec.innerHTML = `
        <header class="card">
          <a href="index.html" class="btn ghost">← Home</a>
          <button id="btn-toggle-all" class="btn outline" style="margin-left:8px">Comprimi/Espandi TUTTI</button>
          <button id="btn-print-all" class="btn outline" style="margin-left:8px">Stampa tutti</button>
        </header>
        <div id="cards"></div>`;
      main.prepend(sec);
    }
    const cardsBox = $('#cards'); cardsBox.innerHTML = '';

    const data = store.load();
    const byCh = new Map();
    for (const r of data){
      const k = r.channel || 'CH?';
      (byCh.get(k) || byCh.set(k, []).get(k)).push(r);
    }

    const onlyCh   = getParam('only')==='1' ? (getParam('hlCh') || '') : '';
    const onlyDate = getParam('only')==='1' ? (getParam('hlDate') || '') : '';
    const hashCh   = decodeURIComponent(location.hash.slice(1) || '');

    const wantCh = onlyCh || hashCh;

    for (const [ch, arr] of Array.from(byCh.entries()).sort()){
      if (wantCh && ch !== wantCh) continue;

      const last = arr.sort((a,b)=> new Date(a.date)-new Date(b.date)).slice(-1)[0];
      const p = last?.points || {s1:0,s2:0,s3:0,s4:0,s5:0};

      const card = document.createElement('article');
      card.className = 'card board';
      card.id = `CH-${CSS.escape(ch)}`;
      if (onlyCh && onlyDate && last?.date?.startsWith(onlyDate)) card.classList.add('hl');

      card.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
          <div>
            <div style="font-weight:800">CH ${ch.replace(/^CH\\s*/,'')}</div>
            <div class="muted" style="font-size:.9rem">${last?.area||''} • Ultimo: ${last?.date||'-'}</div>
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            <span class="chip s1">S1 ${fmtPercent(p.s1)}</span>
            <span class="chip s2">S2 ${fmtPercent(p.s2)}</span>
            <span class="chip s3">S3 ${fmtPercent(p.s3)}</span>
            <span class="chip s4">S4 ${fmtPercent(p.s4)}</span>
            <span class="chip s5">S5 ${fmtPercent(p.s5)}</span>
            <span class="chip">Voto medio ${fmtPercent(mean(p))}</span>
            <button class="btn outline btn-print">Stampa PDF</button>
            <button class="btn outline btn-toggle">Comprimi/Espandi</button>
            <a class="btn ghost" href="notes.html?hlCh=${encodeURIComponent(ch)}&hlDate=${encodeURIComponent(last?.date||'')}">Vedi note</a>
          </div>
        </div>

        <div class="chart5s" style="margin-top:8px">
          ${makeCol('l1', p.s1, '1S')}
          ${makeCol('l2', p.s2, '2S')}
          ${makeCol('l3', p.s3, '3S')}
          ${makeCol('l4', p.s4, '4S')}
          ${makeCol('l5', p.s5, '5S')}
        </div>
      `;
      cardsBox.appendChild(card);

      card.querySelector('.btn-toggle').onclick = () => card.classList.toggle('compact');
      card.querySelector('.btn-print').onclick  = () => window.print();
    }

    let compact=false;
    $('#btn-toggle-all')?.addEventListener('click', ()=>{
      compact=!compact; $$('.card.board').forEach(c=>c.classList.toggle('compact', compact));
    });
    $('#btn-print-all')?.addEventListener('click', ()=>window.print());
  }

  /* ---------- NOTE ---------- */
  function renderNotes(){
    if (!/notes\.html$/i.test(location.pathname)) return;
    const box = $('#notes-list'); if (!box) return;

    const rows = [];
    for (const r of store.load()){
      for (const n of (r.notes||[])){
        rows.push({ ch:r.channel, area:r.area, s:n.s, text:n.text, date:n.date||r.date });
      }
    }

    const hlCh   = getParam('hlCh') || '';
    const hlDate = getParam('hlDate') || '';
    const only   = getParam('only')==='1';

    const typeVal = $('#f-type')?.value || 'all';
    const fromVal = $('#f-from')?.value || '';
    const toVal   = $('#f-to')?.value || '';
    const chVal   = ($('#f-ch')?.value||'').trim().toLowerCase();

    const inRange = (d) => {
      const t = new Date(d).getTime();
      if (fromVal && t < new Date(fromVal).getTime()) return false;
      if (toVal   && t > new Date(toVal).getTime()+86400000-1) return false;
      return true;
    };

    let list = rows
      .filter(r => (typeVal==='all'?true:r.area===typeVal))
      .filter(r => (!chVal?true:String(r.ch).toLowerCase().includes(chVal)))
      .filter(r => inRange(r.date));

    if (only && hlCh){
      let strict = list.filter(r => r.ch===hlCh && (hlDate ? r.date?.startsWith(hlDate) : true));
      if (!strict.length) strict = list.filter(r => r.ch===hlCh);
      list = strict;
    }

    box.innerHTML = '';
    if (!list.length){ box.innerHTML='<div class="muted">Nessuna nota.</div>'; return; }

    for (const n of list.sort((a,b)=> new Date(b.date)-new Date(a.date))){
      const S = (n.s||'').toString().match(/[1-5]/)?.[0] || '1';
      const el = document.createElement('div');
      el.className = 'note';
      if (hlCh && n.ch===hlCh && (!hlDate || n.date?.startsWith(hlDate))) el.classList.add('hl');
      el.innerHTML = `
        <div class="note-head" style="display:flex;justify-content:space-between;gap:8px">
          <div><strong>${n.ch}</strong> • <span class="chip s${S}">S${S}</span> <span class="chip">${n.area||''}</span></div>
          <div class="muted">${n.date||''}</div>
        </div>
        <div class="note-body" style="white-space:pre-wrap">${n.text||''}</div>`;
      box.appendChild(el);
    }
  }

  /* ---------- Export/Lock/Bind ---------- */
  function exportAll(){
    const pinSaved = localStorage.getItem(PIN_KEY);
    const ask = prompt('Inserisci PIN (demo 1234):','');
    if ((pinSaved && ask!==pinSaved) || (!pinSaved && ask!=='1234')){ alert('PIN errato'); return; }
    const blob = new Blob([JSON.stringify(store.load(),null,2)],{type:'application/json'});
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download='SKF-5S-supervisor-archive.json'; a.click();
  }

  function initLock(){
    const btn = $('#btn-lock'); if (!btn) return;
    const paint=()=>{ const pin=localStorage.getItem(PIN_KEY); btn.textContent= pin?'🔓':'🔒'; };
    paint();
    btn.onclick=()=>{
      const old=localStorage.getItem(PIN_KEY);
      if (old){
        const chk=prompt('PIN attuale:'); if (chk!==old) return alert('PIN errato');
        const n1=prompt('Nuovo PIN:'); if(!n1) return; localStorage.setItem(PIN_KEY,n1); paint();
      }else{
        const n1=prompt('Imposta PIN (demo 1234):'); if(!n1) return; localStorage.setItem(PIN_KEY,n1); paint();
      }
    };
  }

  function initCommon(){
    $('#btn-import')?.addEventListener('click',()=>$('#import-input')?.click());
    $('#import-input')?.addEventListener('change',(e)=>handleImport(e.target.files));
    $('#btn-export')?.addEventListener('click',exportAll);
    $('#btn-export-supervisor')?.addEventListener('click',exportAll);
    $('#btn-notes')?.addEventListener('click',()=>location.href='notes.html');

    // filtri note
    $('#f-apply')?.addEventListener('click',renderNotes);
    $('#f-clear')?.addEventListener('click',()=>{ if($('#f-type'))$('#f-type').value='all'; if($('#f-from'))$('#f-from').value=''; if($('#f-to'))$('#f-to').value=''; if($('#f-ch'))$('#f-ch').value=''; renderNotes(); });
  }

  function render(){
    renderHome();
    renderChecklist();
    renderNotes();
  }

  window.addEventListener('DOMContentLoaded', ()=>{
    initCommon();
    initLock();
    render();
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(()=>{});
  });
})();
