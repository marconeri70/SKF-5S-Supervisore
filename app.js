/* =========================
   Utility
========================= */
const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => [...root.querySelectorAll(sel)];
const qs = (name, url=location.search) => new URLSearchParams(url).get(name);

function fmtPct(v){ return `${v}%`; }
function byId(id){ return document.getElementById(id); }

/* Dati in memoria */
let STATE = {
  chList: [],      // [{id:'CH 11', area:'Rettifica', last:'2025-09-28', scores:{s1:5,s2:5,s3:5,s4:5,s5:5}}, ...]
  notes: [],       // non usato qui
  locked: false
};

/* =========================
   Bootstrap per pagine
========================= */
document.addEventListener('DOMContentLoaded', () => {
  const page = document.body.dataset.page || 'home';
  initCommon();

  if(page === 'home') renderHome();
  if(page === 'checklist') renderChecklist();
  if(page === 'notes') renderNotes();
});

/* =========================
   Common binds
========================= */
function initCommon(){
  // bottoni header comuni (se presenti)
  $('#btn-import')?.addEventListener('click', () => $('#import-input')?.click());
  $('#import-input')?.addEventListener('change', (e) => handleImport(e.target.files));

  $('#btn-export')?.addEventListener('click', exportAll);
  $('#btn-export-supervisor')?.addEventListener('click', exportAll);
  $('#btn-lock')?.addEventListener('click', () => {
    STATE.locked = !STATE.locked;
    $('#btn-lock').textContent = STATE.locked ? '🔓' : '🔒';
  });
}

/* =========================
   Mock / Persistenza minima
========================= */
// Per questa versione uso localStorage per simulare dati già importati
function loadData(){
  const raw = localStorage.getItem('skf5s:data');
  if(raw){
    try{ STATE = {...STATE, ...JSON.parse(raw)}; } catch(e){}
  }
}
function saveData(){
  localStorage.setItem('skf5s:data', JSON.stringify(STATE));
}
function handleImport(files){
  // placeholder: qui avrai la tua logica reale di import
  alert('Import in demo. (Mantengo la tua logica attuale di progetto)');
}

/* =========================
   HOME
========================= */
function renderHome(){
  loadData();

  // Demo: se non hai popolato STATE.chList, creo 3 card di esempio
  if(!STATE.chList?.length){
    STATE.chList = [
      {id:'CH 11', area:'Rettifica', last:'2025-09-28', scores:{s1:5,s2:5,s3:5,s4:5,s5:5}},
      {id:'CH 18', area:'Rettifica', last:'2025-10-24', scores:{s1:3,s2:3,s3:3,s4:3,s5:3}},
      {id:'CH 21 Speciali', area:'MONTAGGIO', last:'2025-09-25', scores:{s1:3,s2:3,s3:5,s4:3,s5:5}},
      {id:'CH 24', area:'Rettifica', last:'2025-10-26', scores:{s1:3,s2:3,s3:3,s4:3,s5:5}},
      {id:'CH 5', area:'Rettifica', last:'2025-10-24', scores:{s1:3,s2:3,s3:3,s4:5,s5:3}},
    ];
    saveData();
  }

  // Mini board orizzontale
  const board = byId('board-all');
  if(board){
    board.innerHTML = '';
    STATE.chList.forEach(ch => {
      const el = document.createElement('div');
      el.className = 'board-mini card-line';
      el.innerHTML = miniCardHTML(ch);
      board.appendChild(el);
    });
  }

  // Ritardi (7 giorni)
  const delays = delayedCH(STATE.chList, 7);
  const box = byId('delay-section');
  if(box){
    if(!delays.length){ box.style.display='none'; }
    else{
      box.style.display='block';
      const ul = document.createElement('ul');
      ul.className = 'delay-list';
      delays.forEach(d => {
        const li = document.createElement('li');
        const dateISO = d.last.split('T')[0] || d.last; // sicurezza

        li.innerHTML = `
          <div style="min-width:180px"><strong>${d.id}</strong> — <span class="muted">${d.area||''}</span></div>
          <div class="muted">${daysBetween(d.last)} giorni di ritardo</div>
          <div class="bm-actions">
            <a class="btn tiny outline" href="checklist.html?hlCh=${encodeURIComponent(d.id)}&hlDate=${encodeURIComponent(dateISO)}&only=1">Vai alla scheda</a>
            <a class="btn tiny" href="notes.html?hlCh=${encodeURIComponent(d.id)}&hlDate=${encodeURIComponent(dateISO)}&only=1">Vedi note</a>
          </div>
        `;
        ul.appendChild(li);
      });
      box.innerHTML = `
        <h3>⚠️ CH in ritardo</h3>
      `;
      box.appendChild(ul);
    }
  }

  // Filtri “Tutti/Rettifica/Montaggio”
  $$('.segmented .seg').forEach(b=>{
    b.addEventListener('click', ()=>{
      $$('.segmented .seg').forEach(x=>x.classList.remove('on'));
      b.classList.add('on');

      const type = b.dataset.type;
      const items = STATE.chList.filter(ch=>{
        if(type==='all') return true;
        return (ch.area||'').toLowerCase() === (type||'').toLowerCase();
      });

      const board = byId('board-all');
      board.innerHTML='';
      items.forEach(ch=>{
        const el = document.createElement('div');
        el.className = 'board-mini card-line';
        el.innerHTML = miniCardHTML(ch);
        board.appendChild(el);
      });
    });
  });
}

function miniCardHTML(ch){
  const s = ch.scores||{s1:0,s2:0,s3:0,s4:0,s5:0};
  return `
    <div class="bm-top">
      <div>
        <div class="bm-title">${ch.id}</div>
        <div class="muted">${ch.area||''}</div>
      </div>
      <a class="btn tiny" href="checklist.html?hlCh=${encodeURIComponent(ch.id)}">Apri scheda</a>
    </div>

    <div class="chart5s" aria-label="Andamento ${ch.id}">
      ${col('l1',s.s1)} ${col('l2',s.s2)} ${col('l3',s.s3)} ${col('l4',s.s4)} ${col('l5',s.s5)}
    </div>

    <div class="legend5s">
      <span class="dot s1">1S</span>
      <span class="dot s2">2S</span>
      <span class="dot s3">3S</span>
      <span class="dot s4">4S</span>
      <span class="dot s5">5S</span>
    </div>
  `;
}
function col(level, v){
  const h = Math.max(2, v)*2.2; // 3→ altezza visibile
  return `
    <div class="col">
      <div class="colbar ${level}" style="height:${h}px"></div>
      <div class="colcap"><span>${v}%</span></div>
    </div>
  `;
}
function daysBetween(iso){
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime())/(1000*3600*24);
  return Math.max(0, Math.floor(diff));
}
function delayedCH(list, days=7){
  const out = [];
  list.forEach(ch=>{
    if(daysBetween(ch.last) > days) out.push(ch);
  });
  return out;
}

/* =========================
   CHECKLIST
========================= */
function renderChecklist(){
  loadData();

  const target = qs('hlCh');
  const only   = qs('only') === '1';

  const wrap = byId('cards');
  if(!wrap) return;
  wrap.innerHTML = '';

  STATE.chList.forEach(ch=>{
    const card = document.createElement('section');
    card.className = 'card-line';
    card.dataset.ch = ch.id;

    // header pill con valori e pulsanti
    card.innerHTML = `
      <div class="top">
        <div class="cl-title">${ch.id} <span class="muted">${ch.area||''}</span></div>
        <div class="pills">
          <span class="pill s1">S1 ${ch.scores?.s1||0}%</span>
          <span class="pill s2">S2 ${ch.scores?.s2||0}%</span>
          <span class="pill s3">S3 ${ch.scores?.s3||0}%</span>
          <span class="pill s4">S4 ${ch.scores?.s4||0}%</span>
          <span class="pill s5">S5 ${ch.scores?.s5||0}%</span>
        </div>
      </div>

      <div class="chart5s">
        ${col('l1', ch.scores?.s1||0)}
        ${col('l2', ch.scores?.s2||0)}
        ${col('l3', ch.scores?.s3||0)}
        ${col('l4', ch.scores?.s4||0)}
        ${col('l5', ch.scores?.s5||0)}
      </div>

      <div class="bm-actions" style="margin-top:8px">
        <button class="btn outline btn-toggle">Comprimi/Espandi</button>
        <a class="btn" href="notes.html?hlCh=${encodeURIComponent(ch.id)}">Vedi note</a>
      </div>
    `;

    // toggle compress
    card.querySelector('.btn-toggle').addEventListener('click', ()=>{
      card.classList.toggle('compact');
    });

    wrap.appendChild(card);
  });

  // MOSTRA SOLO IL CH RICHIESTO (only=1)
  if(target && only){
    $$('#cards .card-line').forEach(card=>{
      if(card.dataset.ch !== target){
        card.style.display = 'none';
      }else{
        card.classList.add('hl');
        card.scrollIntoView({behavior:'smooth', block:'start'});
      }
    });
  }else if(target){
    // solo highlight + scroll
    const hit = $(`#cards .card-line[data-ch="${CSS.escape(target)}"]`);
    if(hit){
      hit.classList.add('hl');
      hit.scrollIntoView({behavior:'smooth', block:'start'});
    }
  }

  // pulsante globale
  $('#btn-toggle-all')?.addEventListener('click', ()=>{
    const anyOpen = $$('#cards .card-line:not(.compact)').length>0;
    $$('#cards .card-line').forEach(c=>{
      c.classList.toggle('compact', anyOpen);
    });
  });
}

/* =========================
   NOTE (placeholder)
========================= */
function renderNotes(){
  // Non tocco la tua logica esistente: qui lasciamo solo eventuale highlight read-only
  const ch = qs('hlCh');
  if(ch){
    // eventualmente potresti filtrare lato server o lato tua logica già presente
  }
}

/* =========================
   Export
========================= */
function exportAll(){
  alert('Export demo (mantengo la tua logica esistente).');
}
