// SKF 5S Supervisor — v2.4.5 (grafici visibili + evidenziazione CH collegata)
(() => {
  const STORAGE_KEY = 'skf5s:supervisor:data';
  const PIN_KEY     = 'skf5s:pin';
  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));

  const store = {
    load(){ try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
            catch(e){ console.warn('[store.load]', e); return []; } },
    save(arr){ localStorage.setItem(STORAGE_KEY, JSON.stringify(arr)); }
  };

  const fmtPct = v => `${Math.round(Number(v)||0)}%`;
  const mean   = p => Math.round(((+p.s1||0)+(+p.s2||0)+(+p.s3||0)+(+p.s4||0)+(+p.s5||0))/5);

  function parseNotesFlexible(src, fallbackDate){
    const out = [];
    if (!src) return out;
    if (Array.isArray(src)){
      for (const n of src){
        if (!n) continue;
        out.push({ s:n.s||n.S||n.type||'', text:n.text||n.note||'', date:n.date||fallbackDate });
      }
      return out;
    }
    if (typeof src === 'object'){
      for (const k of Object.keys(src)){
        const val = src[k];
        if (typeof val === 'string' && val.trim()){
          for (const line of val.split(/\n+/)){
            const t = line.trim(); if (t) out.push({ s:k, text:t, date:fallbackDate });
          }
        } else if (Array.isArray(val)){
          for (const line of val){
            const t = String(line||'').trim(); if (t) out.push({ s:k, text:t, date:fallbackDate });
          }
        }
      }
    }
    return out;
  }

  function parseRecord(obj){
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
        for (const line of obj[k]){
          const t = String(line||'').trim();
          if (t) rec.notes.push({ s:k, text:t, date:rec.date });
        }
      }
    }
    return rec;
  }

  async function handleImport(files){
    if (!files || !files.length) return;
    const current = store.load();
    const byKey = new Map(current.map(r => [r.area + '|' + r.channel + '|' + r.date, r]));
    for (const f of files){
      try{
        const txt = await f.text();
        const obj = JSON.parse(txt);
        const rec = parseRecord(obj);
        if (!rec.channel) throw new Error('CH mancante');
        byKey.set(rec.area + '|' + rec.channel + '|' + rec.date, rec);
      }catch(e){ alert('Errore file: ' + f.name); }
    }
    const merged = Array.from(byKey.values()).sort((a,b)=> new Date(a.date)-new Date(b.date));
    store.save(merged);
    render();
  }

  function exportAll(){
    const pinSaved = localStorage.getItem(PIN_KEY);
    const ask = prompt('Inserisci PIN (demo 1234):', '');
    if ((pinSaved && ask !== pinSaved) || (!pinSaved && ask !== '1234')){ alert('PIN errato'); return; }
    const blob = new Blob([JSON.stringify(store.load(), null, 2)], { type:'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'SKF-5S-supervisor-archive.json';
    a.click();
  }

  function initLock(){
    const btn = $('#btn-lock'); if (!btn) return;
    const paint = () => { const pin = localStorage.getItem(PIN_KEY);
      btn.textContent = pin ? '🔓' : '🔒'; };
    paint();
    btn.onclick = () => {
      const old = localStorage.getItem(PIN_KEY);
      if (old){
        const chk = prompt('Inserisci PIN attuale:'); if (chk !== old){ alert('PIN errato'); return; }
        const n1 = prompt('Nuovo PIN:'); if (!n1) return;
        const n2 = prompt('Conferma nuovo PIN:'); if (n2 !== n1){ alert('Non coincide'); return; }
        localStorage.setItem(PIN_KEY, n1); paint();
      } else {
        const n1 = prompt('Imposta PIN (demo 1234):'); if (!n1) return;
        localStorage.setItem(PIN_KEY, n1); paint();
      }
    };
  }

  // --- CH in ritardo ---
  function renderDelays(){
    const box = $('#delay-section'); if (!box) return;
    const data = store.load();
    const lastByCh = new Map();
    for (const r of data){ (lastByCh.get(r.channel)||lastByCh.set(r.channel,[]).get(r.channel)).push(r); }
    const now = Date.now(), delays = [];
    for (const [ch, list] of lastByCh.entries()){
      const last = list.sort((a,b)=> new Date(a.date)-new Date(b.date)).slice(-1)[0];
      const days = Math.floor((now - new Date(last.date).getTime()) / 86400000);
      if (days > 7){ delays.push({ ch, area:last.area, date:last.date, days }); }
    }
    if (!delays.length){ box.style.display='none'; return; }
    box.style.display='block';
    box.querySelector('.delay-list').innerHTML = delays.sort((a,b)=> b.days - a.days).map(d => `
      <li>
        <strong>${d.ch}</strong> • <span class="chip">${d.area||''}</span>
        <span class="muted">${d.days} giorni di ritardo</span>
        <button class="btn tiny outline go-card" data-ch="${d.ch}">Vai alla scheda</button>
        <button class="btn tiny go-notes" data-ch="${d.ch}" data-date="${d.date}">Vedi note</button>
      </li>`).join('');

    // Vai alla scheda → evidenzia CH
    $$('.go-card', box).forEach(b=>{
      b.onclick = () => location.href = `checklist.html?hlCh=${encodeURIComponent(b.dataset.ch)}`;
    });

    // Vedi note → evidenzia CH e note
    $$('.go-notes', box).forEach(b=>{
      b.onclick = () => {
        const ch = b.dataset.ch;
        const date = b.dataset.date || '';
        location.href = `notes.html?hlCh=${encodeURIComponent(ch)}${date?`&hlDate=${encodeURIComponent(date)}`:''}&back=delay`;
      };
    });
  }

  // --- Checklist grafici + evidenziazione ---
  function renderChecklist(){
    const wrap = $('#cards'); if (!wrap) return;
    const data = store.load(); wrap.innerHTML = '';
    const onlyCh = new URLSearchParams(location.search).get('hlCh');
    const hash   = decodeURIComponent(location.hash.slice(1) || '');
    const byCh = new Map();
    for (const r of data){ const key = r.channel || 'CH?'; (byCh.get(key)||byCh.set(key,[]).get(key)).push(r); }

    for (const [ch, arr] of Array.from(byCh.entries()).sort()){
      if (onlyCh && ch !== onlyCh) continue;
      if (hash   && ch !== hash)   continue;
      const last = arr.sort((a,b)=> new Date(a.date)-new Date(b.date)).slice(-1)[0];
      const p = last?.points || {s1:0,s2:0,s3:0,s4:0,s5:0};

      const card = document.createElement('article');
      card.className = 'card-line'; card.id = `CH-${CSS.escape(ch)}`;
      card.innerHTML = `
        <div class="top">
          <div>
            <div class="cl-title">CH ${ch.replace(/^CH\\s*/,'')}</div>
            <div class="muted" style="font-size:.9rem">${last?.area||''} • Ultimo: ${last?.date||'-'}</div>
          </div>
          <div class="pills">
            <span class="pill s1">S1 ${fmtPct(p.s1)}</span>
            <span class="pill s2">S2 ${fmtPct(p.s2)}</span>
            <span class="pill s3">S3 ${fmtPct(p.s3)}</span>
            <span class="pill s4">S4 ${fmtPct(p.s4)}</span>
            <span class="pill s5">S5 ${fmtPct(p.s5)}</span>
            <span class="pill" style="background:#eef5ff;color:#0b3b8f">Voto medio ${fmtPct(mean(p))}</span>
          </div>
          <div class="buttons">
            <button class="btn outline btn-print">Stampa PDF</button>
            <button class="btn outline btn-toggle">Comprimi/Espandi</button>
            <button class="btn link btn-notes">Vedi note</button>
          </div>
        </div>
        <div class="chart5s mt">
          ${[['1S','l1','s1'],['2S','l2','s2'],['3S','l3','s3'],['4S','l4','s4'],['5S','l5','s5']]
            .map(([lbl,cls,key]) => `
              <div class="col">
                <div class="colbar ${cls}" style="height:${Number(p[key])||0}%"></div>
                <div class="colcap">${lbl} <span>${fmtPct(p[key])}</span></div>
              </div>`).join('')}
        </div>`;
      wrap.appendChild(card);

      card.querySelector('.btn-notes').onclick = () => {
        const lastDate = last?.date || '';
        location.href = `notes.html?hlCh=${encodeURIComponent(ch)}${lastDate?`&hlDate=${encodeURIComponent(lastDate)}`:''}&back=checklist`;
      };
    }

    // evidenzia CH selezionato
    const qp = new URLSearchParams(location.search);
    const hlCh = qp.get('hlCh');
    if (hlCh){ const el = document.getElementById(`CH-${hlCh}`); if (el) el.classList.add('hl'); el?.scrollIntoView({behavior:'smooth'}); }
  }

  // --- Note + ritorno alla scheda ---
  function renderNotes(){
    const box = $('#notes-list'); if (!box) return;
    const rows = [];
    for (const r of store.load()){ for (const n of (r.notes || [])){
      rows.push({ ch:r.channel, area:r.area, s:n.s, text:n.text, date:n.date||r.date });
    }}
    const list = rows.sort((a,b)=> new Date(b.date)-new Date(a.date));
    box.innerHTML = '';
    for (const n of list){
      const S = (n.s||'').toString().match(/[1-5]/)?.[0] || '1';
      const el = document.createElement('div');
      el.className = 'note';
      el.innerHTML = `
        <div style="display:flex;justify-content:space-between;flex-wrap:wrap">
          <div><strong>${n.ch}</strong> • <span class="pill s${S}">S${S}</span> <span class="chip">${n.area||''}</span></div>
          <div class="muted">${n.date||''}</div>
        </div>
        <div style="margin-top:.45rem;white-space:pre-wrap">${n.text||''}</div>`;
      el.onclick = () => location.href = `checklist.html?hlCh=${encodeURIComponent(n.ch)}`;
      box.appendChild(el);
    }

    // evidenzia se proveniente da ritardo
    const qp = new URLSearchParams(location.search);
    const hlCh = qp.get('hlCh');
    if (hlCh){ const el = [...box.children].find(x => x.textContent.includes(hlCh)); if (el) el.classList.add('highlight'); el?.scrollIntoView({behavior:'smooth'}); }
  }

  function renderHome(){ renderDelays(); }
  function render(){ renderHome(); renderChecklist(); renderNotes(); }

  window.addEventListener('DOMContentLoaded', () => { initLock(); render(); });
})();
