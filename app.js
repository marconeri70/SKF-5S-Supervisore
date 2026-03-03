// ===============================
// SKF 5S — Supervisor v2.5.0 (Allerte, Percentuali & Ordinamento)
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

// Funzioni di calcolo basate su punteggio massimo 5
const toPct = v => Math.round((Number(v||0) / 5) * 100);
const meanPct = p => {
  const tot = Number(p.s1||0)+Number(p.s2||0)+Number(p.s3||0)+Number(p.s4||0)+Number(p.s5||0);
  return Math.round((tot / 25) * 100);
};

// Funzione per raggruppare i dati ordinando prima per Canale e poi per Area
function getGroupedAndSortedData(dataFilter) {
  const byCh = new Map();
  for (const r of dataFilter){
    const areaKey = (r.area || '').toUpperCase();
    const chKey = r.channel || r.ch || r.name || 'CH ?';
    const k = areaKey + '|' + chKey; 
    if (!byCh.has(k)) byCh.set(k, []);
    byCh.get(k).push(r);
  }
  return Array.from(byCh.entries()).sort((a, b) => {
    const [areaA, chA] = a[0].split('|');
    const [areaB, chB] = b[0].split('|');
    const compCh = chA.localeCompare(chB, undefined, {numeric: true, sensitivity: 'base'});
    if (compCh !== 0) return compCh;
    return areaA.localeCompare(areaB);
  });
}

// ===============================
// HOME
// ===============================
function renderHome(){
  const wrap = $('#board-all');
  if (!wrap) return;

  const data = store.load();
  const activeType = $('.segmented .seg.on')?.dataset.type || 'all';
  const filt = r => activeType==='all' ? true : (r.area === activeType || r.area?.toUpperCase() === activeType?.toUpperCase());

  const groups = getGroupedAndSortedData(data.filter(filt));
  wrap.innerHTML = '';

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
    
    const delayBtn = delayedS.length > 0 
        ? `<a href="notes.html?hlCh=${encodeURIComponent(ch)}&hlArea=${encodeURIComponent(area)}&openS=${delayedS.join(',')}" class="delay-btn">⚠️ ${delayedS.map(s=>s+'S').join(', ')} in ritardo (Apri)</a>`
        : '';

    const card = document.createElement('div');
    card.className = 'mini-card';
    card.innerHTML = `
      <h5>${ch} <span class="area">${area.toUpperCase()}</span></h5>
      <div class="mini-bars">
        <div class="mini-bar" style="--h:${toPct(p.s1)}%;--c:#e11d48" data-val="${toPct(p.s1)}%"></div>
        <div class="mini-bar" style="--h:${toPct(p.s2)}%;--c:#f59e0b" data-val="${toPct(p.s2)}%"></div>
        <div class="mini-bar" style="--h:${toPct(p.s3)}%;--c:#10b981" data-val="${toPct(p.s3)}%"></div>
        <div class="mini-bar" style="--h:${toPct(p.s4)}%;--c:#0ea5e9" data-val="${toPct(p.s4)}%"></div>
        <div class="mini-bar" style="--h:${toPct(p.s5)}%;--c:#6366f1" data-val="${toPct(p.s5)}%"></div>
        <div class="mini-bar delay-bar" style="--h:${delayPct}%;--c:#ef4444;background:#fee2e2" data-val="${delayedS.length}"></div>
      </div>
      <div class="mini-scale"><span>1S</span><span>2S</span><span>3S</span><span>4S</span><span>5S</span><span>Ritardi</span></div>
      <div style="text-align:center">${delayBtn}</div>
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
  const entries = getGroupedAndSortedData(data);
  listMount.innerHTML = '';

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
          <span class="pill s1">S1 ${toPct(p.s1)}%</span>
          <span class="pill s2">S2 ${toPct(p.s2)}%</span>
          <span class="pill s3">S3 ${toPct(p.s3)}%</span>
          <span class="pill s4">S4 ${toPct(p.s4)}%</span>
          <span class="pill s5">S5 ${toPct(p.s5)}%</span>
          <span class="pill avg">Media ${meanPct(p)}%</span>
        </div>
        <div class="btns">
          <button class="btn outline btn-print">Stampa PDF</button>
          <button class="btn outline btn-toggle">Comprimi/Espandi</button>
          <a class="btn ghost" href="notes.html?hlCh=${encodeURIComponent(ch)}&hlArea=${encodeURIComponent(area)}">Vedi note</a>
        </div>
      </div>
      <div class="mini-bars sheet-graph">
        <div class="mini-bar" style="--h:${toPct(p.s1)}%;--c:#e11d48" data-val="${toPct(p.s1)}%"></div>
        <div class="mini-bar" style="--h:${toPct(p.s2)}%;--c:#f59e0b" data-val="${toPct(p.s2)}%"></div>
        <div class="mini-bar" style="--h:${toPct(p.s3)}%;--c:#10b981" data-val="${toPct(p.s3)}%"></div>
        <div class="mini-bar" style="--h:${toPct(p.s4)}%;--c:#0ea5e9" data-val="${toPct(p.s4)}%"></div>
        <div class="mini-bar" style="--h:${toPct(p.s5)}%;--c:#6366f1" data-val="${toPct(p.s5)}%"></div>
        <div class="mini-bar delay-bar" style="--h:${delayPct}%;--c:#ef4444;background:#fee2e2" data-val="${delayedS.length}"></div>
      </div>
      <div class="mini-scale"><span>1S</span><span>2S</span><span>3S</span><span>4S</span><span>5S</span><span>Ritardi</span></div>
      ${delayBtn}
    `;

    listMount.appendChild(card);

    const tgl = card.querySelector('.btn-toggle');
    if (tgl) tgl.onclick = () => card.classList.toggle('compact');

    const btnPrint = card.querySelector('.btn-print');
    if (btnPrint) {
      btnPrint.onclick = () => {
        document.body.classList.add('print-single');
        card.classList.add('print-target');
        window.print();
        setTimeout(() => {
          document.body.classList.remove('print-single');
          card.classList.remove('print-target');
        }, 500);
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
            console.error("Errore JSON:", err);
            alert(`Errore lettura file.`);
          }
        }

        localStorage.setItem(store.KEY, JSON.stringify(existingData));
        input.value = '';

        if (newRecordsAdded > 0) {
          alert(`✅ Importazione completata! Aggiunti ${newRecordsAdded} controlli.`);
          location.reload();
        } else {
          alert("ℹ️ Nessun nuovo dato. File già presenti.");
        }
      });
    }
  });
}

// ===============================
// PANNELLO ALLERTE (< 100%)
// ===============================
function renderAlerts() {
  const list = $('#alerts-list');
  const counter = $('#alerts-count');
  const fType = $('#f-type');
  const fCh = $('#f-ch');
  const btnApply = $('#f-apply');
  if (!list) return;

  function updateAlerts() {
    const data = store.load();
    const typeVal = fType ? fType.value : 'all';
    const chVal = (fCh && fCh.value) ? fCh.value.trim().toLowerCase() : '';

    // Prende solo le schede più recenti di ogni CH
    const entries = getGroupedAndSortedData(data);
    const alertCards = [];

    entries.forEach(([key, arr]) => {
      const last = arr.sort((a,b)=> new Date(a.date) - new Date(b.date)).slice(-1)[0] || {};
      const ch = last.channel || last.ch || last.name || 'CH ?';
      const area = (last.area || '').toUpperCase();

      if (typeVal !== 'all' && area !== typeVal.toUpperCase()) return;
      if (chVal && !ch.toLowerCase().includes(chVal)) return;

      const p = last.points || {s1:5, s2:5, s3:5, s4:5, s5:5};
      
      let alertsForCh = [];
      const now = new Date();
      
      for (let i=1; i<=5; i++) {
        const score = Number(p[`s${i}`] || 0);
        const dateS = (last.dates && last.dates[`s${i}`]) ? new Date(last.dates[`s${i}`]) : null;
        const isDelayed = dateS && ((now - dateS) > 7 * 24 * 60 * 60 * 1000);
        
        if (score < 5 || isDelayed) {
          alertsForCh.push({ s: i, score, isDelayed });
        }
      }

      if (alertsForCh.length > 0) {
        alertCards.push({ ch, area, alerts: alertsForCh, raw: last });
      }
    });

    list.innerHTML = '';
    alertCards.forEach(card => {
      const openSParams = card.alerts.map(a => a.s).join(',');
      const sBadges = card.alerts.map(a => {
        let msg = a.isDelayed ? `⏱️ Ritardo S${a.s}` : `📉 S${a.s} (${a.score}/5)`;
        return `<span style="display:inline-block; background:#fee2e2; color:#b91c1c; padding:4px 8px; border-radius:4px; font-size:0.8rem; font-weight:bold; margin: 4px 4px 0 0; border:1px solid #f87171;">${msg}</span>`;
      }).join('');

      const div = document.createElement('div');
      div.className = 'card-line';
      div.style.borderColor = '#ef4444';
      div.style.background = '#fffafa';
      div.innerHTML = `
        <div class="top">
          <div>
            <div class="ttl" style="color:#b91c1c;"><strong>${card.ch}</strong></div>
            <div class="muted">${card.area} • Ultimo Controllo: ${card.raw.date || '-'}</div>
            <div style="margin-top:6px;">${sBadges}</div>
          </div>
          <a class="btn primary" href="notes.html?hlCh=${encodeURIComponent(card.ch)}&hlArea=${encodeURIComponent(card.area)}&openS=${openSParams}" style="background:#ef4444; border:none; color:#fff;">Vai al Dettaglio →</a>
        </div>
      `;
      list.appendChild(div);
    });

    if(counter) counter.textContent = `(${alertCards.length} CH)`;
  }

  if (btnApply) btnApply.onclick = updateAlerts;
  updateAlerts();
}

// ===============================
// NOTE (Con Classi Rosse per Allerte)
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
  const openSArr = openS ? openS.split(',') : [];

  if (urlCh && fCh) fCh.value = urlCh;
  if (urlArea && fType) {
    Array.from(fType.options).forEach(opt => {
      if (opt.value.toUpperCase() === urlArea.toUpperCase()) fType.value = opt.value;
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
      if (chVal && !String(r.ch || r.channel || r.name || '').toLowerCase().includes(chVal)) return false;
      if (fromVal || toVal) {
        const rDate = new Date(r.date); rDate.setHours(0,0,0,0);
        if (fromVal && rDate < new Date(fromVal).setHours(0,0,0,0)) return false;
        if (toVal && rDate > new Date(toVal).setHours(0,0,0,0)) return false;
      }
      return true;
    });

    filtered.sort((a,b) => new Date(b.date) - new Date(a.date));
    list.innerHTML = '';
    
    filtered.forEach(r => {
      const nomeCH = r.ch || r.channel || r.name || 'CH ?';
      const rArea = (r.area || '').toUpperCase();
      const isTargetCard = (urlCh && urlArea && nomeCH.toLowerCase() === urlCh.toLowerCase() && rArea === urlArea.toUpperCase());
      
      let notesHtml = '';
      
      if (typeof r.notes === 'object') {
        for (const [k, v] of Object.entries(r.notes)) {
          if (v && String(v).trim()) {
            const sNum = k.replace('s', ''); 
            
            // Analisi Punteggi e Ritardi per l'allerta rossa
            const pScore = r.points && r.points[k] !== undefined ? Number(r.points[k]) : 5;
            const sDate = r.dates && r.dates[k] ? new Date(r.dates[k]) : null;
            const isDelayed = sDate && ((new Date() - sDate) > 7 * 24 * 60 * 60 * 1000);
            const isSub100 = pScore < 5;
            const isAlert = isDelayed || isSub100;
            const isOpen = isAlert || (isTargetCard && openSArr.includes(sNum));

            let alertReasonHtml = '';
            if (isDelayed) alertReasonHtml += `<div class="alert-reason">⏱️ Ritardo compilazione (Più di 7 giorni)</div>`;
            if (isSub100) alertReasonHtml += `<div class="alert-reason">📉 Punteggio non pieno: ${pScore}/5</div>`;

            const sColor = `var(--${k.toLowerCase()}, #0d63d6)`;
            let formattedText = v.replace(/(⬜0|⬜ 0)/g, '<br><br>$1');
            if(formattedText.startsWith('<br><br>')) formattedText = formattedText.substring(8);

            notesHtml += `
              <details class="${isAlert ? 'alert-box' : ''}" style="margin-bottom: 8px;" ${isOpen ? 'open' : ''}>
                <summary style="color: ${sColor}; font-weight: bold; cursor: pointer; padding: 12px; background: #fff; border-radius: 6px; border: 1px solid #dfe6f4; list-style: none; user-select: none;">
                  ▶ ${k.toUpperCase()} — Clicca per espandere ${isAlert ? ' — ⚠️ DA VERIFICARE' : ''}
                </summary>
                <div style="max-height: 250px; overflow-y: auto; padding: 14px; font-size: 0.95rem; background: #fff; border: 1px solid #dfe6f4; border-top: none; border-radius: 0 0 6px 6px; line-height: 1.6; color: #334155;">
                  ${alertReasonHtml}
                  ${formattedText}
                </div>
              </details>
            `;
          }
        }
      }

      const dataStringa = !isNaN(new Date(r.date).getTime()) ? new Date(r.date).toLocaleString('it-IT', {dateStyle: 'short', timeStyle: 'short'}) : r.date;
      const masterDetails = document.createElement('details');
      masterDetails.className = 'master-details';
      
      if (isTargetCard && openSArr.length > 0) {
          masterDetails.open = true;
          masterDetails.id = 'target-note-card'; 
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

      if(notesHtml) list.appendChild(masterDetails);
    });

    if(counter) counter.textContent = `(${filtered.length})`;
    if(countSpan) countSpan.textContent = `(${filtered.length})`;

    // Auto-scroll
    setTimeout(() => {
        const target = document.getElementById('target-note-card');
        if (target) {
            target.scrollIntoView({behavior: 'smooth', block: 'start'});
            target.classList.add('flash-target'); 
        }
    }, 400); 
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

  const printAllBtn = document.getElementById('btn-print-all');
  if (printAllBtn) printAllBtn.onclick = () => window.print();

  const page = (document.body.dataset.page || '').toLowerCase();
  if (page === 'home') renderHome();
  else if (page === 'alerts') renderAlerts();
  else if (page === 'notes') renderNotes();
  else if (location.pathname.includes('checklist')) renderChecklist();
});
