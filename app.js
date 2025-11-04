// SKF 5S Supervisor — v2.4.9
(() => {
  const STORAGE_KEY = 'skf5s:supervisor:data';
  const PIN_KEY     = 'skf5s:pin';
  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));

  /* -------------------- Storage -------------------- */
  const store = {
    load(){
      try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
      catch(e){ console.warn('[store.load]', e); return []; }
    },
    save(arr){ localStorage.setItem(STORAGE_KEY, JSON.stringify(arr)); }
  };

  /* -------------------- Utils -------------------- */
  const pct   = v => `${Math.round(Number(v)||0)}%`;
  const mean  = p => Math.round(((+p.s1||0)+(+p.s2||0)+(+p.s3||0)+(+p.s4||0)+(+p.s5||0))/5);
  const by    = (arr, key) => arr.reduce((m, x) => (m.get(x[key])?.push(x) || m.set(x[key],[x]), m), new Map());
  const last  = arr => arr.slice().sort((a,b)=> new Date(a.date)-new Date(b.date)).at(-1);

  /* -------------------- Import/Export & PIN -------------------- */
  async function handleImport(files){
    if (!files || !files.length) return;
    const current = store.load();
    const map = new Map(current.map(r => [`${r.area}|${r.channel}|${r.date}`, r]));
    for (const f of files){
      try{
        const obj = JSON.parse(await f.text());
        const rec = parseRecord(obj);
        if (!rec.channel) throw new Error('CH mancante');
        map.set(`${rec.area}|${rec.channel}|${rec.date}`, rec);
      }catch(e){
        alert('Errore file: ' + f.name);
        console.error(e);
      }
    }
    store.save([...map.values()].sort((a,b)=> new Date(a.date)-new Date(b.date)));
    render();
  }

  function exportAll(){
    const saved = localStorage.getItem(PIN_KEY);
    const ask   = prompt('Inserisci PIN (demo 1234):', '');
    if ((saved && ask !== saved) || (!saved && ask !== '1234')){
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
    const paint = () => { btn.textContent = localStorage.getItem(PIN_KEY) ? '🔓' : '🔒'; };
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

  /* -------------------- Parsing record/notes -------------------- */
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
        const v = src[k];
        if (typeof v === 'string'){
          for (const line of v.split(/\n+/)) {
            const t = line.trim(); if (t) out.push({ s:k, text:t, date:fallbackDate });
          }
        } else if (Array.isArray(v)){
          for (const line of v){
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

  /* -------------------- HOME: ritardi + mini board -------------------- */
  function renderDelays(){
    const box = $('#delay-section'); if (!box) return;
    const data = store.load();
    const groups = by(data, 'channel');
    const now = Date.now();
    const delays = [];

    for (const [ch, arr] of groups.entries()){
      const L = last(arr);
      const days = Math.floor((now - new Date(L.date).getTime())/86400000);
      if (days > 7) delays.push({ ch, area:L.area, date:L.date, days });
    }

    if (!delays.length){ box.style.display='none'; return; }
    box.style.display='block';
    box.querySelector('.delay-list').innerHTML = delays
      .sort((a,b)=>b.days-a.days)
      .map(d => `
        <li>
          <strong>${d.ch}</strong> · <span class="chip">${d.area||''}</span>
          <span class="muted">${d.days} giorni di ritardo</span>
          <span class="btn tiny outline go-card" data-ch="${d.ch}">Vai alla scheda</span>
          <span class="btn tiny go-notes" data-ch="${d.ch}" data-date="${d.date}">Vedi note</span>
        </li>
      `).join('');

    // Vai alla scheda → mostra SOLO quel CH
    $$('.go-card', box).forEach(b=>{
      b.onclick = () => location.href = `checklist.html?hlCh=${encodeURIComponent(b.dataset.ch)}`;
    });

    // Vedi note → mostra SOLO le note del CH (evidenziando la data)
    $$('.go-notes', box).forEach(b=>{
      b.onclick = () => {
        const ch = b.dataset.ch;
        const date = b.dataset.date || '';
        location.href = `notes.html?hlCh=${encodeURIComponent(ch)}${date?`&hlDate=${encodeURIComponent(date)}`:''}&back=delay`;
      };
    });
  }

  function renderHomeBoards(){
    const wrap = $('#board-all'); if (!wrap) return;
    const data = store.load();
    const typeFilter = $('.seg.on')?.dataset?.type || 'all'; // all | Rettifica | MONTAGGIO
    const groups = by(data, 'channel');
    const cards = [];

    for (const [ch, arr] of groups.entries()){
      const L = last(arr);
      if (typeFilter !== 'all' && (L.area||'').toLowerCase() !== typeFilter.toLowerCase()) continue;
      const p = L.points || {s1:0,s2:0,s3:0,s4:0,s5:0};

      cards.push(`
        <div class="board-mini">
          <div class="bm-top">
            <div>
              <div class="bm-title">CH ${ch.replace(/^CH\s*/,'')}</div>
              <div class="muted" style="font-size:.9rem">${L.area||''}</div>
            </div>
            <div class="muted" style="font-size:.85rem">${L.date||''}</div>
          </div>

          <div class="chart5s" style="margin-top:8px">
            ${[['1S','l1','s1'],['2S','l2','s2'],['3S','l3','s3'],['4S','l4','s4'],['5S','l5','s5']]
              .map(([lbl,cls,key]) => `
                <div class="col">
                  <div class="colbar ${cls}" style="height:${Number(p[key])||0}%"></div>
                  <div class="colcap">${lbl}<span>${pct(p[key])}</span></div>
                </div>`).join('')}
          </div>

          <div class="bm-actions">
            <button class="btn link open-card" data-ch="${ch}">Apri scheda</button>
          </div>
        </div>
      `);
    }

    wrap.innerHTML = cards.join('') || '<div class="muted" style="padding:8px">Nessun dato importato.</div>';

    // Bind
    $$('.open-card', wrap).forEach(b=>{
      b.onclick = () => location.href = `checklist.html?hlCh=${encodeURIComponent(b.dataset.ch)}`;
    });

    // Toggle filtro “Tutti / Rettifica / Montaggio”
    $$('.seg').forEach(seg=>{
      seg.onclick = () => {
        $$('.seg').forEach(s=>s.classList.remove('on'));
        seg.classList.add('on');
        renderHomeBoards();
      };
    });
  }

  /* -------------------- CHECKLIST: carte, grafico, toggle -------------------- */
  function renderChecklist(){
    const wrap = $('#cards'); if (!wrap) return;
    const onlyCh = new URLSearchParams(location.search).get('hlCh');
    const data   = store.load();
    const groups = by(data, 'channel');

    wrap.innerHTML = '';

    for (const [ch, arr] of [...groups.entries()].sort()){
      if (onlyCh && ch !== onlyCh) continue;

      const L = last(arr);
      const p = L?.points || {s1:0,s2:0,s3:0,s4:0,s5:0};

      const card = document.createElement('article');
      card.className = 'card card-line';
      card.id = `CH-${CSS.escape(ch)}`;

      card.innerHTML = `
        <div class="top" style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start;flex-wrap:wrap">
          <div>
            <div class="bm-title">CH ${ch.replace(/^CH\\s*/,'')}</div>
            <div class="muted" style="font-size:.9rem">${L?.area||''} · Ultimo: ${L?.date||'-'}</div>
          </div>

          <div class="pills" style="display:flex;gap:6px;flex-wrap:wrap">
            <span class="pill s1">S1 ${pct(p.s1)}</span>
            <span class="pill s2">S2 ${pct(p.s2)}</span>
            <span class="pill s3">S3 ${pct(p.s3)}</span>
            <span class="pill s4">S4 ${pct(p.s4)}</span>
            <span class="pill s5">S5 ${pct(p.s5)}</span>
            <span class="pill" style="background:#eef5ff;color:#0b3b8f">Voto medio ${pct(mean(p))}</span>
          </div>

          <div class="buttons" style="display:flex;gap:8px">
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
                <div class="colcap">${lbl}<span>${pct(p[key])}</span></div>
              </div>`).join('')}
        </div>
      `;
      wrap.appendChild(card);

      // Per-card: toggle + note
      const content = card.querySelector('.chart5s');
      card.querySelector('.btn-toggle').onclick = () => content.classList.toggle('is-collapsed');
      card.querySelector('.btn-notes').onclick  = () => {
        const ld = L?.date || '';
        location.href = `notes.html?hlCh=${encodeURIComponent(ch)}${ld?`&hlDate=${encodeURIComponent(ld)}`:''}&back=checklist`;
      };
    }

    // Evidenzia CH richiesto e scorri
    if (onlyCh){
      const el = document.getElementById(`CH-${onlyCh}`);
      if (el){ el.classList.add('hl'); el.scrollIntoView({behavior:'smooth', block:'start'}); }
    }

    // Toggle TUTTI (se presente il bottone)
    const btnAll = $('#btn-toggle-all');
    if (btnAll){
      btnAll.onclick = () => {
        const anyOpen = $$('.chart5s', wrap).some(x => !x.classList.contains('is-collapsed'));
        $$('.chart5s', wrap).forEach(x => x.classList.toggle('is-collapsed', anyOpen));
      };
    }
  }

  /* -------------------- NOTE: elenco, filtro CH, highlight data -------------------- */
  function renderNotes(){
    const box = $('#notes-list'); if (!box) return;

    const qp   = new URLSearchParams(location.search);
    const wantCh   = qp.get('hlCh') || '';
    const wantDate = qp.get('hlDate') || '';

    // Flatten
    const rows = [];
    for (const r of store.load()){
      for (const n of (r.notes || [])){
        rows.push({ ch:r.channel, area:r.area, s:n.s, text:n.text, date:n.date||r.date });
      }
    }

    // Filtro CH se richiesto
    const list = rows
      .filter(n => !wantCh || n.ch === wantCh)
      .sort((a,b)=> new Date(b.date)-new Date(a.date));

    box.innerHTML = '';

    for (const n of list){
      const S = (n.s||'').toString().match(/[1-5]/)?.[0] || '1';
      const el = document.createElement('div');
      el.className = 'note';
      el.dataset.date = n.date || '';
      el.innerHTML = `
        <div style="display:flex;justify-content:space-between;flex-wrap:wrap">
          <div><strong>${n.ch}</strong> · <span class="pill s${S}">S${S}</span> <span class="chip">${n.area||''}</span></div>
          <div class="muted">${n.date||''}</div>
        </div>
        <div style="margin-top:.45rem;white-space:pre-wrap">${n.text||''}</div>
      `;
      el.onclick = () => location.href = `checklist.html?hlCh=${encodeURIComponent(n.ch)}`;
      box.appendChild(el);
    }

    // Evidenzia CH e, se presente, la data specifica
    if (wantCh){
      const firstNote = [...box.children][0];
      firstNote?.classList.add('highlight');
      if (wantDate){
        const byDate = [...box.children].find(x => (x.dataset.date||'') === wantDate);
        (byDate || firstNote)?.classList.add('highlight');
        (byDate || firstNote)?.scrollIntoView({behavior:'smooth', block:'start'});
      } else {
        firstNote?.scrollIntoView({behavior:'smooth', block:'start'});
      }
    }
  }

  /* -------------------- Dispatcher -------------------- */
  function renderHome(){ renderDelays(); renderHomeBoards(); }
  function render(){ renderHome(); renderChecklist(); renderNotes(); }

  /* -------------------- Init: bind comuni -------------------- */
  function initCommon(){
    $('#btn-import')?.addEventListener('click', () => $('#import-input')?.click());
    $('#import-input')?.addEventListener('change', e => handleImport(e.target.files));
    $('#btn-export')?.addEventListener('click', exportAll);
    $('#btn-export-supervisor')?.addEventListener('click', exportAll);
    // Navigazione “Note” in header (se presente)
    $('#btn-notes')?.addEventListener('click', () => location.href = 'notes.html');
  }

  /* -------------------- Boot -------------------- */
  window.addEventListener('DOMContentLoaded', () => {
    initCommon();
    initLock();
    render();
  });
})();
