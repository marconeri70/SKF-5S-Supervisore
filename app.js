// ===============================
// SKF 5S — Supervisor v2.4.8 (Smart Link & Auto-Scroll Ritardi)
// ===============================

const $  = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));
const onReady = fn => (document.readyState === 'loading')
  ? document.addEventListener('DOMContentLoaded', fn, {once:true})
  : fn();

const store = {
  KEY: 'skf5s:data',
  load(){
    try {
      const raw = localStorage.getItem(this.KEY);
      if (raw) return JSON.parse(raw);
    } catch(e){}
    if (Array.isArray(window.SKFDATA)) return window.SKFDATA;
    return [];
  }
};

const fmtPercent = v => (v==null ? '0%' : (Math.round(Number(v)) + '%'));
const mean = p => ((Number(p.s1||0)+Number(p.s2||0)+Number(p.s3||0)+Number(p.s4||0)+Number(p.s5||0))/5);

// ===============================
// HOME
// ===============================
function renderHome(){
  const wrap = $('#board-all');
  if (!wrap) return;

  const data = store.load();
  const activeType = $('.segmented .seg.on')?.dataset.type || 'all';
  const filt = r => activeType==='all' ? true : (r.area === activeType || r.area?.toUpperCase() === activeType?.toUpperCase());

  const byCh = new Map();
  for (const r of data.filter(filt)){
    const areaKey = (r.area || '').toUpperCase();
    const chKey = r.channel || r.ch || r.name || 'CH ?';
    const k = areaKey + '|' + chKey; 
    if (!byCh.has(k)) byCh.set(k, []);
    byCh.get(k).push(r);
  }

  wrap.innerHTML = '';
  const groups = Array.from(byCh.entries()).sort((a,b)=> String(a[0]).localeCompare(String(b[0])));

  for (const [key, arr] of groups){
    const last = arr.sort((a,b)=> new Date(a.date) - new Date(b.date)).slice(-1)[0] || {};
    const ch = last.channel || last.ch || last.name || 'CH ?';
    const area = last.area || '';
    const p = last.points || {s1:0,s2:0,s3:0,s4:0,s5:0};

    let delayedS = [];
    if (last.dates) {
      const now = new Date();
      for (let i=1; i<=5; i++) {
         if (last.dates[`s${i}`]) {
            const diff = now - new Date(last.dates[`s${i}`]);
            if (diff > 7 * 24 * 60 * 60 * 1000) delayedS.push(i);
         }
      }
    }
    const delayPct = (delayedS.length / 5) * 100;
    
    // SMART LINK: Passa l'array dei ritardi nell'URL (openS=1,2)
    const delayBtn = delayedS.length > 0 
        ? `<a href="notes.html?hlCh=${encodeURIComponent(ch)}&hlArea=${encodeURIComponent(area)}&openS=${delayedS.join(',')}" class="delay-btn">⚠️ ${delayedS.map(s=>s+'S').join(', ')} in ritardo (Apri)</a>`
        : '';

    const card = document.createElement('div');
    card.className = 'mini-card';
    card.innerHTML = `
      <h5>${ch} <span class="area">${area.toUpperCase()}</span></h5>
      <div class="mini-bars">
        <div class="mini-bar" style="--h:${p.s1||0}%;--c:#e11d48"></div>
        <div class="mini-bar" style="--h:${p.s2||0}%;--c:#f59e0b"></div>
        <div class="mini-bar" style="--h:${p.s3||0}%;--c:#10b981"></div>
        <div class="mini-bar" style="--h:${p.s4||0}%;--c:#0ea5e9"></div>
        <div class="mini-bar" style="--h:${p.s5||0}%;--c:#6366f1"></div>
        <div class="mini-bar delay-bar" style="--h:${delayPct}%;--c:#ef4444;background:#fee2e2"></div>
      </div>
      <div class="mini-scale"><span>1S</span><span>2S</span><span>3S</span><span>4S</span><span>5S</span><span>Ritardi</span></div>
      ${delayBtn}
      <a href="checklist.html#${encodeURIComponent(ch)}" class="open-link">Apri scheda</a>
    `;
    wrap.appendChild(card);
  }

  $$('.segmented .seg').forEach(b=>{
    b.onclick = () => {
      $$('.segmented .seg').forEach(x=>x.classList.remove('on'));
      b.classList.add('on');
      renderHome();
    };
  });
}

// ===============================
// CHECKLIST
// ===============================
function renderChecklist(){
  const listMount = $('#cards');
  if (!listMount) return;

  const data = store.load();
  const byCh = new Map();
  for (const r of data){
    const areaKey = (r.area || '').toUpperCase();
    const chKey = r.channel || r.ch || r.name || 'CH ?';
    const k = areaKey + '|' + chKey;
    if (!byCh.has(k)) byCh.set(k, []);
    byCh.get(k).push(r);
  }

  listMount.innerHTML = '';
  const entries = Array.from(byCh.entries()).sort((a,b)=> String(a[0]).localeCompare(String(b[0])));

  for (const [key, arr] of entries){
    const last = arr.sort((a,b)=> new Date(a.date) - new Date(b.date)).slice(-1)[0] || {};
    const ch = last.channel || last.ch || last.name || 'CH ?';
    const area = last.area || '';
    const p = last.points || {s1:0,s2:0,s3:0,s4:0,s5:0};

    let delayedS = [];
    if (last.dates) {
      const now = new Date();
      for (let i=1; i<=5; i++) {
         if (last.dates[`s${i}`]) {
            const diff = now - new Date(last.dates[`s${i}`]);
            if (diff > 7 * 24 * 60 * 60 * 1000) delayedS.push(i);
         }
      }
    }
    const delayPct = (delayedS.length / 5) * 100;
    
    // SMART LINK anche nella checklist
    const delayBtn = delayedS.length > 0 
        ? `<div style="text-align:center; margin-top:10px;"><a href="notes.html?hlCh=${encodeURIComponent(ch)}&hlArea=${encodeURIComponent(area)}&openS=${delayedS.join(',')}" class="delay-btn">⚠️ Vedi note ritardo (${delayedS.map(s=>s+'S').join(', ')})</a></div>`
        : '';

    const card = document.createElement('section');
    card.className = 'card-line';
    card.id = `CH-${ch}`;

    card.innerHTML = `
      <div class="top">
        <div>
          <div class="ttl"><strong>${ch}</strong></div>
          <div class="muted">${area.toUpperCase()} • Ultimo: ${last.date || '-'}</div>
        </div>
        <div class="pills">
          <span class="pill s1">S1 ${fmtPercent(p.s1)}</span>
          <span class="pill s2">S2 ${fmtPercent(p.s2)}</span>
          <span class="pill s3">S3 ${fmtPercent(p.s3)}</span>
          <span class="pill s4">S4 ${fmtPercent(p.s4)}</span>
          <span class="pill s5">S5 ${fmtPercent(p.s5)}</span>
          <span class="pill avg">Media ${fmtPercent(mean(p))}</span>
        </div>
        <div class="btns">
          <button class="btn outline btn-print">Stampa PDF</button>
          <button class="btn outline btn-toggle">Comprimi/Espandi</button>
          <a class="btn ghost" href="notes.html?hlCh=${encodeURIComponent(ch)}&hlArea=${encodeURIComponent(area)}">Vedi note</a>
        </div>
      </div>
      <div class="mini-bars sheet-graph">
        <div class="mini-bar" style="--h:${p.s1||0}%;--c:#e11d48"></div>
        <div class="mini-bar" style="--h:${p.s2||0}%;--c:#f59e0b"></div>
        <div class="mini-bar" style="--h:${p.s3||0}%;--c:#10b981"></div>
        <div class="mini-bar" style="--h:${p.s4||0}%;--c:#0ea5e9"></div>
        <div class="mini-bar" style="--h:${p.s5||0}%;--c:#6366f1"></div>
        <div class="mini-bar delay-bar" style="--h:${delayPct}%;--c:#ef4444;background:#fee2e2"></div>
      </div>
      <div class="mini-scale"><span>1S</span><span>2S</span><span>3S</span><span>4S</span><span>5S</span><span>Ritardi</span></div>
      ${delayBtn}
    `;

    listMount.appendChild(card);

    const tgl = card.querySelector('.btn-toggle');
    if (tgl){
      let compact = false;
      tgl.onclick = () => {
        compact = !compact;
        card.classList.toggle('compact', compact);
      };
    }
  }

  const hlCh = new URL(location.href).searchParams.get('hlCh');
  if (hlCh){
    const el = document.getElementById(`CH-${hlCh}`);
    if (el){
      el.classList.add('hl-delay');
      el.scrollIntoView({behavior:'smooth', block:'center'});
    }
  }
}

// ===============================
// IMPORTAZIONE JSON
// ===============================
function setupImport() {
  const btnImports = document.querySelectorAll('#btn-import');
  const inputImports = document.querySelectorAll('#import-input');

  if (btnImports.length === 0 || inputImports.length === 0) return;

  btnImports.forEach((btn, index) => {
    const input = inputImports[index];
    if(input) {
      btn.addEventListener('click', () => input.click());
      
      input.addEventListener('change', async (event) => {
        const files = event.target.files;
        if (!files || files.length === 0) return;

        let existingData = store.load();
        let newRecordsAdded = 0;

        for (const file of files) {
          try {
            const text = await file.text();
            const importedData = JSON.parse(text);
            const records = Array.isArray(importedData) ? importedData : [importedData];

            records.forEach(record => {
              if (record && (record.ch || record.channel || record.name)) {
                const isDuplicate = existingData.some(ex => 
                  (ex.ch === record.ch || ex.channel === record.channel || ex.name === record.name) &&
                  (ex.area === record.area) && 
                  (ex.date === record.date)
                );

                if (!isDuplicate) {
                  existingData.push(record);
                  newRecordsAdded++;
                }
              }
            });
          } catch (err) {
            console.error("Errore JSON nel file:", file.name, err);
            alert(`Errore nella lettura di ${file.name}. Il file potrebbe essere corrotto.`);
          }
        }

        localStorage.setItem(store.KEY, JSON.stringify(existingData));
        input.value = '';

        if (newRecordsAdded > 0) {
          alert(`✅ Importazione completata! Sono stati aggiunti ${newRecordsAdded} nuovi controlli.`);
          const page = (document.body.dataset.page || '').toLowerCase();
          if (page === 'home') renderHome();
          else if (location.pathname.includes('checklist')) renderChecklist();
        } else {
          alert("ℹ️ Nessun nuovo dato aggiunto. I file importati erano già presenti nel sistema.");
        }
      });
    }
  });
}

// ===============================
// NOTE (Apertura e Scroll Automatico)
// ===============================
function renderNotes() {
  const list = $('#notes-list');
  const counter = $('#notes-counter');
  const countSpan = $('#notes-count');
  
  const fType = $('#f-type');
  const fFrom = $('#f-from');
  const fTo = $('#f-to');
  const fCh = $('#f-ch');
  const btnApply = $('#f-apply');
  const btnClear = $('#f-clear');

  if (!list) return;

  const urlParams = new URLSearchParams(window.location.search);
  const urlCh = urlParams.get('hlCh');
  const urlArea = urlParams.get('hlArea');
  const openS = urlParams.get('openS'); 
  const openSArr = openS ? openS.split(',') : []; // Array con i numeri in ritardo es. ["1", "3"]

  if (urlCh && fCh) fCh.value = urlCh;
  if (urlArea && fType) {
    Array.from(fType.options).forEach(opt => {
      if (opt.value.toUpperCase() === urlArea.toUpperCase()) {
        fType.value = opt.value;
      }
    });
  }

  function updateNotes() {
    const data = store.load();
    const typeVal = fType ? fType.value : 'all';
    const fromVal = (fFrom && fFrom.value) ? new Date(fFrom.value) : null;
    const toVal = (fTo && fTo.value) ? new Date(fTo.value) : null;
    const chVal = (fCh && fCh.value) ? fCh.value.trim().toLowerCase() : '';

    const withNotes = data.filter(r => {
      let hasText = false;
      if (typeof r.notes === 'string' && r.notes.trim()) hasText = true;
      if (typeof r.notes === 'object' && r.notes !== null) {
        if (Object.values(r.notes).some(v => v && String(v).trim())) hasText = true;
      }
      return hasText;
    });

    const filtered = withNotes.filter(r => {
      if (typeVal !== 'all' && (r.area || '').toUpperCase() !== typeVal.toUpperCase()) return false;
      if (chVal) {
        const rCh = String(r.ch || r.channel || r.name || '').toLowerCase();
        if (!rCh.includes(chVal)) return false;
      }
      if (fromVal || toVal) {
        const rDate = new Date(r.date);
        rDate.setHours(0,0,0,0);
        if (fromVal) {
            const f = new Date(fromVal); f.setHours(0,0,0,0);
            if (rDate < f) return false;
        }
        if (toVal) {
            const t = new Date(toVal); t.setHours(0,0,0,0);
            if (rDate > t) return false;
        }
      }
      return true;
    });

    filtered.sort((a,b) => new Date(b.date) - new Date(a.date));
    list.innerHTML = '';
    
    filtered.forEach(r => {
      const nomeCH = r.ch || r.channel || r.name || 'CH ?';
      const rArea = (r.area || '').toUpperCase();
      
      // Controlla se questa è la scheda specifica su cui ha cliccato l'utente per il ritardo
      const isTargetCard = (urlCh && urlArea && nomeCH.toLowerCase() === urlCh.toLowerCase() && rArea === urlArea.toUpperCase());
      
      let notesHtml = '';
      
      if (typeof r.notes === 'string') {
        let formattedText = r.notes.replace(/(⬜0|⬜ 0)/g, '<br><br>$1');
        if(formattedText.startsWith('<br><br>')) formattedText = formattedText.substring(8);
        notesHtml = `
          <details style="margin-bottom: 8px;">
            <summary style="font-weight: bold; cursor: pointer; padding: 12px; background: #fff; border-radius: 6px; border: 1px solid #dfe6f4; list-style: none;">
              ▶ Dettagli nota generica
            </summary>
            <div style="max-height: 250px; overflow-y: auto; padding: 12px; font-size: 0.9rem; background: #fff; border: 1px solid #dfe6f4; border-top: none; border-radius: 0 0 6px 6px; line-height: 1.6;">
              ${formattedText}
            </div>
          </details>`;
      } else if (typeof r.notes === 'object') {
        for (const [k, v] of Object.entries(r.notes)) {
          if (v && String(v).trim()) {
            const sNum = k.replace('s', ''); // Estrae "1", "2", ecc.
            const isDelayedS = (isTargetCard && openSArr.includes(sNum)); // Vero se questa voce è in ritardo
            
            const sColor = `var(--${k.toLowerCase()}, #0d63d6)`;
            let formattedText = v.replace(/(⬜0|⬜ 0)/g, '<br><br>$1');
            if(formattedText.startsWith('<br><br>')) formattedText = formattedText.substring(8);

            // Se è in ritardo, la apre in automatico (open) e le dà uno sfondo rosso chiaro
            notesHtml += `
              <details style="margin-bottom: 8px;" ${isDelayedS ? 'open' : ''}>
                <summary style="color: ${sColor}; font-weight: bold; cursor: pointer; padding: 12px; background: ${isDelayedS ? '#fee2e2' : '#fff'}; border-radius: 6px; border: 1px solid ${isDelayedS ? '#ef4444' : '#dfe6f4'}; list-style: none; user-select: none;">
                  ▶ ${k.toUpperCase()} — Clicca per espandere ${isDelayedS ? ' — ⚠️ IN RITARDO' : ''}
                </summary>
                <div style="max-height: 250px; overflow-y: auto; padding: 14px; font-size: 0.95rem; background: #fff; border: 1px solid #dfe6f4; border-top: none; border-radius: 0 0 6px 6px; line-height: 1.6; color: #334155;">
                  ${formattedText}
                </div>
              </details>
            `;
          }
        }
      }

      const dataFormat = new Date(r.date);
      const dataStringa = !isNaN(dataFormat.getTime()) ? dataFormat.toLocaleString('it-IT', {dateStyle: 'short', timeStyle: 'short'}) : r.date;

      const masterDetails = document.createElement('details');
      masterDetails.className = 'master-details';
      
      // Se questa è la scheda cliccata e ci sono ritardi da mostrare, aprila automaticamente!
      if (isTargetCard && openSArr.length > 0) {
          masterDetails.open = true;
          masterDetails.id = 'target-note-card'; // Diamo un ID per lo scorrimento automatico
      }
      
      masterDetails.innerHTML = `
        <summary class="master-summary">
          <div style="display:flex; flex-direction:column; gap:2px;">
            <span style="font-size:1.15rem; font-weight:800; color:var(--ink);">${nomeCH}</span>
            <span style="font-size:0.85rem; font-weight:600; color:var(--muted); letter-spacing:0.5px;">${rArea} • ${dataStringa}</span>
          </div>
          <span style="font-size:1.5rem; color:#cbd5e1; font-weight:bold;">${masterDetails.open ? '−' : '+'}</span>
        </summary>
        <div class="master-body">
          ${notesHtml}
        </div>
      `;

      masterDetails.addEventListener('toggle', (e) => {
        const iconSpan = e.target.querySelector('summary span:last-child');
        if(iconSpan) iconSpan.textContent = masterDetails.open ? '−' : '+';
      });

      list.appendChild(masterDetails);
    });

    if(counter) counter.textContent = `(${filtered.length})`;
    if(countSpan) countSpan.textContent = `(${filtered.length})`;

    // AUTO-SCROLL verso la nota aperta
    setTimeout(() => {
        const target = document.getElementById('target-note-card');
        if (target) {
            target.scrollIntoView({behavior: 'smooth', block: 'start'});
            target.classList.add('flash-target'); // Colora l'intestazione di rosso temporaneamente
        }
    }, 400); // Leggero ritardo per permettere il rendering del DOM
  }

  if (btnApply) btnApply.onclick = updateNotes;
  if (btnClear) {
    btnClear.onclick = () => {
      if(fType) fType.value = 'all';
      if(fFrom) fFrom.value = '';
      if(fTo) fTo.value = '';
      if(fCh) fCh.value = '';
      updateNotes();
    };
  }

  updateNotes();
}

// ===============================
// Avvio
// ===============================
onReady(()=>{
  if (typeof setupImport === 'function') setupImport();

  const page = (document.body.dataset.page || '').toLowerCase();
  if (page === 'home') renderHome();
  else if (page === 'notes') renderNotes();
  else if (location.pathname.includes('checklist')) renderChecklist();
});
