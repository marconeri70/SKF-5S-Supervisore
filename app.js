// ===============================
// SKF 5S — Supervisor v3.2 (Super Fix Edtion)
// ===============================

const $  = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));
const onReady = fn => (document.readyState === 'loading') ? document.addEventListener('DOMContentLoaded', fn, {once:true}) : fn();

const store = {
  KEY: 'skf5s:data',
  load(){
    try { const raw = localStorage.getItem(this.KEY); if (raw) return JSON.parse(raw); } catch(e){}
    if (Array.isArray(window.SKFDATA)) return window.SKFDATA;
    return [];
  }
};

const toPct = v => Math.round((Number(v||0) / 5) * 100);
const meanPct = p => Math.round(((Number(p.s1||0)+Number(p.s2||0)+Number(p.s3||0)+Number(p.s4||0)+Number(p.s5||0)) / 25) * 100);

// Nomi Completi delle S
const S_TITLES = {
  s1: "1S - Selezionare (Eliminare il superfluo)",
  s2: "2S - Sistemare (Un posto per tutto)",
  s3: "3S - Splendere (Pulire e prevenire)",
  s4: "4S - Standardizzare (Regole visive)",
  s5: "5S - Sostenere (Abitudine e miglioramento)"
};

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

function formatNoteText(text) {
  if (!text) return '';
  return text.split('\n').filter(l => l.trim()).map(line => {
    const isBad = line.includes('🟦0') || line.includes('🟦 0') || line.includes('🟦1') || line.includes('🟦 1') || line.includes('🟦3') || line.includes('🟦 3');
    return `<div class="note-line ${isBad ? 'bad-score' : ''}">${line}</div>`;
  }).join('');
}

// ===============================
// RENDER HOME
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
            if (now - new Date(last.dates[`s${i}`]) > 7 * 24 * 60 * 60 * 1000) delayedS.push(i);
         }
      }
    }
    const delayPct = (delayedS.length / 5) * 100;
    const delayBtn = delayedS.length > 0 ? `<a href="notes.html?hlCh=${encodeURIComponent(ch)}&hlArea=${encodeURIComponent(area)}&openS=${delayedS.join(',')}" class="delay-btn">⚠️ S${delayedS.join(', S')} in ritardo (Apri)</a>` : '';

    const card = document.createElement('div');
    card.className = 'mini-card';
    card.innerHTML = `
      <h5>${ch} <div style="display:flex; gap:6px; align-items:center;"><span style="font-size:0.75rem; background:#eef5ff; color:#0b3b8f; padding:2px 6px; border-radius:6px; font-weight:700;">Media ${meanPct(p)}%</span><span class="area">${area.toUpperCase()}</span></div></h5>
      <div class="mini-bars">
        <div class="mini-bar" style="--h:${toPct(p.s1)}%;--c:#e11d48"></div><div class="mini-bar" style="--h:${toPct(p.s2)}%;--c:#f59e0b"></div><div class="mini-bar" style="--h:${toPct(p.s3)}%;--c:#10b981"></div><div class="mini-bar" style="--h:${toPct(p.s4)}%;--c:#0ea5e9"></div><div class="mini-bar" style="--h:${toPct(p.s5)}%;--c:#6366f1"></div><div class="mini-bar delay-bar" style="--h:${delayPct}%;--c:#ef4444;background:#fee2e2"></div>
      </div>
      <div class="mini-scale"><span>1S</span><span>2S</span><span>3S</span><span>4S</span><span>5S</span><span>Ritardi</span></div>
      <div style="text-align:center">${delayBtn}</div>
      <a href="checklist.html#${encodeURIComponent(ch)}" class="open-link">Apri scheda</a>
    `;
    wrap.appendChild(card);
  }

  $$('.segmented .seg').forEach(b=>{
    b.onclick = () => { $$('.segmented .seg').forEach(x=>x.classList.remove('on')); b.classList.add('on'); renderHome(); };
  });
}

// ===============================
// RENDER CHECKLIST
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
    const operator = last.operator ? `<div class="muted">👤 Operatore: ${last.operator}</div>` : '';
    const p = last.points || {s1:0,s2:0,s3:0,s4:0,s5:0};

    let delayedS = [];
    if (last.dates) {
      const now = new Date();
      for (let i=1; i<=5; i++) {
         if (last.dates[`s${i}`]) {
            if (now - new Date(last.dates[`s${i}`]) > 7 * 24 * 60 * 60 * 1000) delayedS.push(i);
         }
      }
    }
    const delayPct = (delayedS.length / 5) * 100;
    const delayBtn = delayedS.length > 0 ? `<div style="text-align:center; margin-top:10px;"><a href="notes.html?hlCh=${encodeURIComponent(ch)}&hlArea=${encodeURIComponent(area)}&openS=${delayedS.join(',')}" class="delay-btn">⚠️ Vedi note ritardo (S${delayedS.join(', S')})</a></div>` : '';

    let notesHtml = '';
    if (typeof last.notes === 'object') {
      for (let i = 1; i <= 5; i++) {
        const k = `s${i}`;
        const v = last.notes[k];
        if (v && String(v).trim()) {
           const pScore = p[k] !== undefined ? Number(p[k]) : 5;
           const sDate = last.dates && last.dates[k] ? new Date(last.dates[k]) : null;
           const isDelayed = sDate && ((new Date() - sDate) > 7 * 24 * 60 * 60 * 1000);
           const isAlert = isDelayed || pScore < 5;
           
           let alertBadge = '';
           if(isDelayed) alertBadge += `<span style="background:#ef4444; color:#fff; padding:2px 8px; border-radius:12px; font-size:0.75rem; margin-left:8px; font-weight:bold;">⏱️ RITARDO</span>`;
           if(pScore < 5) alertBadge += `<span style="background:#f59e0b; color:#fff; padding:2px 8px; border-radius:12px; font-size:0.75rem; margin-left:8px; font-weight:bold;">⚠️ Punteggio: ${pScore}/5</span>`;

           notesHtml += `
             <div style="margin-top: 12px; padding: 14px; border: 2px solid ${isAlert ? '#fca5a5' : '#e2e8f0'}; border-radius: 12px; background: ${isAlert ? '#fef2f2' : '#f8fafc'}; page-break-inside: avoid;">
               <div style="font-weight: 800; color: ${isAlert ? '#ef4444' : '#0a57d5'}; border-bottom: 2px solid ${isAlert ? '#fecaca' : '#e2e8f0'}; padding-bottom: 8px; margin-bottom: 10px; display:flex; align-items:center; font-size: 1.1rem;">
                 ${S_TITLES[k] || k.toUpperCase()} ${alertBadge}
               </div>
               <div style="font-size: 0.95rem; color: #334155; line-height: 1.6;">${formatNoteText(v)}</div>
             </div>
           `;
        }
      }
    }

    const card = document.createElement('section');
    card.className = 'card-line';
    card.id = `CH-${ch}`;

    card.innerHTML = `
      <div class="top">
        <div>
          <div class="ttl"><strong>${ch}</strong></div>
          <div class="muted">${area.toUpperCase()} • Ultimo Controllo: ${new Date(last.date).toLocaleDateString('it-IT')}</div>
          ${operator}
        </div>
        <div class="pills">
          <span class="pill s1">S1 ${toPct(p.s1)}%</span><span class="pill s2">S2 ${toPct(p.s2)}%</span><span class="pill s3">S3 ${toPct(p.s3)}%</span><span class="pill s4">S4 ${toPct(p.s4)}%</span><span class="pill s5">S5 ${toPct(p.s5)}%</span><span class="pill avg">Media ${meanPct(p)}%</span>
        </div>
        <div class="btns">
          <button class="btn outline btn-print" style="border-color: #0a57d5; color: #0a57d5; font-weight: bold;">🖨️ Stampa PDF</button>
          <button class="btn outline btn-toggle">Mostra Note</button>
        </div>
      </div>
      <div class="mini-bars sheet-graph">
        <div class="mini-bar" style="--h:${toPct(p.s1)}%;--c:#e11d48"></div><div class="mini-bar" style="--h:${toPct(p.s2)}%;--c:#f59e0b"></div><div class="mini-bar" style="--h:${toPct(p.s3)}%;--c:#10b981"></div><div class="mini-bar" style="--h:${toPct(p.s4)}%;--c:#0ea5e9"></div><div class="mini-bar" style="--h:${toPct(p.s5)}%;--c:#6366f1"></div><div class="mini-bar delay-bar" style="--h:${delayPct}%;--c:#ef4444;background:#fee2e2"></div>
      </div>
      <div class="mini-scale"><span>1S</span><span>2S</span><span>3S</span><span>4S</span><span>5S</span><span>Ritardi</span></div>
      ${delayBtn}
      <div class="ch-detailed-notes" style="display: none; margin-top: 24px; border-top: 2px dashed #cbd5e1; padding-top: 16px;">
        <h4 style="margin:0 0 10px 0; color:var(--ink); font-size: 1.2rem;">📝 Dettaglio Note ed Evidenze</h4>
        ${notesHtml || '<div class="muted" style="padding: 10px; background: #f8fafc; border-radius: 8px;">Nessuna nota compilata.</div>'}
      </div>
    `;
    listMount.appendChild(card);

    const tgl = card.querySelector('.btn-toggle');
    const notesDiv = card.querySelector('.ch-detailed-notes');
    if (tgl) {
      tgl.onclick = () => { card.classList.toggle('compact'); if (notesDiv) notesDiv.style.display = notesDiv.style.display === 'none' ? 'block' : 'none'; };
    }

    const btnPrint = card.querySelector('.btn-print');
    if (btnPrint) {
      btnPrint.onclick = () => {
        document.body.dataset.printMode = 'single';
        document.querySelectorAll('.card-line').forEach(c => c.classList.remove('print-target'));
        card.classList.add('print-target');
        card.classList.remove('compact');
        if (notesDiv) notesDiv.style.display = 'block';
        setTimeout(() => window.print(), 300);
      };
    }
  }
}

// ===============================
// PANNELLO ALLERTE (Risolto link e stampa)
// ===============================
function renderAlerts() {
  const list = $('#alerts-list');
  const counter = $('#alerts-count');
  const fType = $('#f-type');
  const fCh = $('#f-ch');
  const btnApply = $('#f-apply');
  const btnPrintAll = $('#btn-print-alerts-all'); // Tasto Stampa Totale
  if (!list) return;

  function updateAlerts() {
    const data = store.load();
    const typeVal = fType ? fType.value : 'all';
    const chVal = (fCh && fCh.value) ? fCh.value.trim().toLowerCase() : '';

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
        if (score < 5 || isDelayed) alertsForCh.push({ s: i, score, isDelayed });
      }

      if (alertsForCh.length > 0) alertCards.push({ ch, area, alerts: alertsForCh, raw: last });
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
            <div class="muted">${card.area} • Ultimo: ${new Date(card.raw.date).toLocaleDateString('it-IT')}</div>
            <div style="margin-top:8px;">${sBadges}</div>
          </div>
          <div style="display:flex; flex-direction:column; gap:8px;">
            <a class="btn primary" href="notes.html?hlCh=${encodeURIComponent(card.ch)}&hlArea=${encodeURIComponent(card.area)}&openS=${openSParams}" style="background:#ef4444; border:none; color:#fff; text-decoration:none; text-align:center;">🔍 Dettaglio Note</a>
            <button class="btn outline btn-print-alert" style="border-color:#ef4444; color:#ef4444;">🖨️ Stampa CH</button>
          </div>
        </div>
      `;
      list.appendChild(div);

      // Logica Stampa Singola per pagina Allerte
      const btnPrint = div.querySelector('.btn-print-alert');
      if (btnPrint) {
        btnPrint.onclick = () => {
          document.body.dataset.printMode = 'single';
          document.querySelectorAll('.card-line').forEach(c => c.classList.remove('print-target'));
          div.classList.add('print-target');
          setTimeout(() => window.print(), 300);
        };
      }
    });
    if(counter) counter.textContent = `(${alertCards.length} CH)`;
  }
  
  if (btnApply) btnApply.onclick = updateAlerts;
  
  // Logica Stampa Totale Allerte
  if (btnPrintAll) {
    btnPrintAll.onclick = () => {
      document.body.dataset.printMode = 'all';
      setTimeout(() => window.print(), 300);
    };
  }
  updateAlerts();
}

// ===============================
// PANNELLO NOTE (Risolto Autoscroll e Titoli S)
// ===============================
function renderNotes() {
  const list = $('#notes-list');
  const counter = $('#notes-count');
  const fType = $('#f-type'), fFrom = $('#f-from'), fTo = $('#f-to'), fCh = $('#f-ch');
  const btnApply = $('#f-apply'), btnClear = $('#f-clear');
  if (!list) return;

  const urlParams = new URLSearchParams(window.location.search);
  const urlCh = urlParams.get('hlCh');
  const urlArea = urlParams.get('hlArea');
  const openSArr = (urlParams.get('openS') || '').split(',');

  if (urlCh && fCh) fCh.value = urlCh;
  if (urlArea && fType) Array.from(fType.options).forEach(opt => { if (opt.value.toUpperCase() === urlArea.toUpperCase()) fType.value = opt.value; });

  function updateNotes() {
    const data = store.load();
    const typeVal = fType ? fType.value : 'all';
    const fromVal = (fFrom && fFrom.value) ? new Date(fFrom.value) : null;
    const toVal = (fTo && fTo.value) ? new Date(fTo.value) : null;
    const chVal = (fCh && fCh.value) ? fCh.value.trim().toLowerCase() : '';

    const withNotes = data.filter(r => {
      if (typeof r.notes === 'string' && r.notes.trim()) return true;
      if (typeof r.notes === 'object' && r.notes !== null) return Object.values(r.notes).some(v => v && String(v).trim());
      return false;
    }).filter(r => {
      if (typeVal !== 'all' && (r.area || '').toUpperCase() !== typeVal.toUpperCase()) return false;
      if (chVal && !String(r.ch || r.channel || r.name || '').toLowerCase().includes(chVal)) return false;
      if (fromVal || toVal) {
        const rDate = new Date(r.date); rDate.setHours(0,0,0,0);
        if (fromVal && rDate < new Date(fromVal).setHours(0,0,0,0)) return false;
        if (toVal && rDate > new Date(toVal).setHours(0,0,0,0)) return false;
      }
      return true;
    }).sort((a,b) => new Date(b.date) - new Date(a.date));

    list.innerHTML = '';
    
    withNotes.forEach(r => {
      const nomeCH = r.ch || r.channel || r.name || 'CH ?';
      const rArea = (r.area || '').toUpperCase();
      const isTargetCard = (urlCh && urlArea && nomeCH.toLowerCase() === urlCh.toLowerCase() && rArea === urlArea.toUpperCase());
      let notesHtml = '';
      
      if (typeof r.notes === 'object') {
        for (const [k, v] of Object.entries(r.notes)) {
          if (v && String(v).trim()) {
            const pScore = r.points && r.points[k] !== undefined ? Number(r.points[k]) : 5;
            const sDate = r.dates && r.dates[k] ? new Date(r.dates[k]) : null;
            const isAlert = (sDate && ((new Date() - sDate) > 7 * 24 * 60 * 60 * 1000)) || pScore < 5;
            
            // Fix logica di apertura: estrae il numero dalla S (es: "s1" diventa "1")
            const isOpen = isAlert || (isTargetCard && openSArr.includes(k.replace('s', '')));
            
            // Fix colori e titoli esatti
            const sColor = `var(--${k.toLowerCase()}, #0d63d6)`;
            const titleS = S_TITLES[k] || k.toUpperCase();

            notesHtml += `
              <details class="${isAlert ? 'alert-box' : ''}" style="margin-bottom: 8px;" ${isOpen ? 'open' : ''}>
                <summary style="color: ${sColor}; font-weight: bold; cursor: pointer; padding: 12px; background: #fff; border-radius: 6px; border: 1px solid #dfe6f4; user-select: none;">
                  ▶ ${titleS} ${isAlert ? ' — ⚠️ DA VERIFICARE' : ''}
                </summary>
                <div style="max-height: 350px; overflow-y: auto; padding: 14px; background: #fff; border: 1px solid #dfe6f4; border-top: none; border-radius: 0 0 6px 6px; line-height: 1.6; color: #334155;">
                  ${formatNoteText(v)}
                </div>
              </details>`;
          }
        }
      }

      const masterDetails = document.createElement('details');
      masterDetails.className = 'master-details';
      if (isTargetCard) { masterDetails.open = true; masterDetails.id = 'target-note-card'; }
      
      masterDetails.innerHTML = `
        <summary class="master-summary">
          <div style="display:flex; flex-direction:column; gap:2px;">
            <span style="font-size:1.15rem; font-weight:800; color:var(--ink);">${nomeCH}</span>
            <span style="font-size:0.85rem; font-weight:600; color:var(--muted);">${rArea} • ${new Date(r.date).toLocaleString('it-IT', {dateStyle: 'short', timeStyle: 'short'})}</span>
          </div>
        </summary>
        <div class="master-body">${notesHtml}</div>
      `;
      if(notesHtml) list.appendChild(masterDetails);
    });

    if(counter) counter.textContent = `(${withNotes.length})`;

    // MAGIC FIX: Scroll automatico e lampeggio quando vieni da un'altra pagina!
    setTimeout(() => {
      const target = document.getElementById('target-note-card');
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        target.classList.add('flash-target');
      }
    }, 300);
  }

  if (btnApply) btnApply.onclick = updateNotes;
  if (btnClear) btnClear.onclick = () => { if(fType) fType.value = 'all'; if(fFrom) fFrom.value = ''; if(fTo) fTo.value = ''; if(fCh) fCh.value = ''; updateNotes(); };
  updateNotes();
}

// ===============================
// IMPORTAZIONE JSON E MENU AZIONI
// ===============================
function setupActionMenu() {
  const menu = document.getElementById('actionMenu');
  const openBtn = document.getElementById('btn-open-menu');
  const closeBtn = document.getElementById('btn-close-menu');

  if(openBtn && menu) openBtn.onclick = () => menu.showModal();
  if(closeBtn && menu) closeBtn.onclick = () => menu.close();

  if(menu) {
    menu.addEventListener('click', (e) => {
      const box = menu.querySelector('.sheet-box');
      if (box) {
        const rect = box.getBoundingClientRect();
        if (!(rect.top <= e.clientY && e.clientY <= rect.top + rect.height && rect.left <= e.clientX && e.clientX <= rect.left + rect.width)) menu.close();
      }
    });
  }

  const toggleAllBtn = document.getElementById('btn-toggle-all');
  if (toggleAllBtn) {
    let allExpanded = false;
    toggleAllBtn.onclick = () => {
      if(menu) menu.close();
      allExpanded = !allExpanded;
      document.querySelectorAll('.card-line').forEach(c => {
        const notesDiv = c.querySelector('.ch-detailed-notes');
        if (allExpanded) { c.classList.remove('compact'); if(notesDiv) notesDiv.style.display = 'block'; }
        else { c.classList.add('compact'); if(notesDiv) notesDiv.style.display = 'none'; }
      });
    };
  }

  const printAllBtn = document.getElementById('btn-print-all');
  if (printAllBtn) {
    printAllBtn.onclick = () => {
      if(menu) menu.close();
      document.body.dataset.printMode = 'all';
      document.querySelectorAll('.card-line').forEach(el => {
        el.style.display = '';
        el.classList.remove('compact');
        const notesDiv = el.querySelector('.ch-detailed-notes');
        if (notesDiv) notesDiv.style.display = 'block';
      });
      setTimeout(() => window.print(), 300);
    };
  }

  // 📊 GENERATORE SLIDE PRESENTAZIONE (FIX per Mobile Android)
  const presBtn = document.getElementById('btn-presentation');
  if (presBtn) {
    presBtn.onclick = () => {
      if(menu) menu.close();
      alert("💡 CONSIGLIO: Se usi il tablet Android, ricordati di impostare l'orientamento su 'ORIZZONTALE' nelle opzioni di stampa per una presentazione perfetta!");
      
      document.body.dataset.printMode = 'all'; 
      const slideStyle = document.createElement('style');
      slideStyle.id = 'slide-style-temp';
      // CSS potenziato per forzare l'aspetto "Slide" anche se il tablet prova a stampare in verticale
      slideStyle.innerHTML = `
        @media print {
          @page { size: landscape; margin: 10mm; }
          body { background: #fff !important; }
          .appbar, .safe-bottom, .action-sheet { display: none !important; }
          .card-line {
            page-break-after: always; break-after: page;
            border: none !important; box-shadow: none !important;
            height: 95vh !important; 
            display: flex; flex-direction: column; justify-content: center;
            margin: 0 !important; padding: 0 10px !important;
          }
          .ttl strong { font-size: 4rem !important; color: #0a57d5 !important; line-height: 1.1; }
          .muted { font-size: 1.5rem !important; margin-bottom: 20px; }
          .pills { transform: scale(1.5); transform-origin: left center; margin: 40px 0 !important; }
          .mini-bars { height: 250px !important; margin-top: 50px !important; }
          .mini-scale span { font-size: 1.5rem !important; font-weight: 800; }
          .ch-detailed-notes { margin-top: 50px !important; border-top: 4px solid #0a57d5 !important; padding-top: 20px !important; }
          .ch-detailed-notes h4 { font-size: 1.8rem !important; }
          .note-line { font-size: 1.3rem !important; }
        }
      `;
      document.head.appendChild(slideStyle);

      document.querySelectorAll('.card-line').forEach(el => {
        el.style.display = '';
        el.classList.remove('compact');
        const notesDiv = el.querySelector('.ch-detailed-notes');
        if (notesDiv) notesDiv.style.display = 'block';
      });

      setTimeout(() => window.print(), 500);
    };
  }
}

function setupImport() {
  let fileInput = document.getElementById('global-import-input');
  if (!fileInput) {
    fileInput = document.createElement('input');
    fileInput.id = 'global-import-input';
    fileInput.type = 'file';
    fileInput.accept = 'application/json,.json';
    fileInput.multiple = true;
    fileInput.style.display = 'none';
    document.body.appendChild(fileInput);
  }

  document.querySelectorAll('#btn-import').forEach(btn => {
    btn.onclick = (e) => {
      e.preventDefault();
      const menu = document.getElementById('actionMenu');
      if(menu) menu.close();
      fileInput.click();
    };
  });

  fileInput.addEventListener('change', async (event) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    let existingData = store.load();
    let newRecordsAdded = 0;

    for (const file of files) {
      try {
        const text = await file.text();
        const records = Array.isArray(JSON.parse(text)) ? JSON.parse(text) : [JSON.parse(text)];
        records.forEach(record => {
          if (record && (record.ch || record.channel || record.name)) {
            const isDuplicate = existingData.some(ex => (ex.ch === record.ch || ex.channel === record.channel || ex.name === record.name) && (ex.area === record.area) && (ex.date === record.date));
            if (!isDuplicate) { existingData.push(record); newRecordsAdded++; }
          }
        });
      } catch (err) { alert(`Errore lettura file ${file.name}.`); }
    }
    localStorage.setItem(store.KEY, JSON.stringify(existingData));
    fileInput.value = '';
    if (newRecordsAdded > 0) { alert(`✅ Aggiunti ${newRecordsAdded} controlli.`); location.reload(); }
    else { alert("ℹ️ Nessun nuovo dato. I file erano già presenti."); }
  });
}

function setupSecurity() {
  const pinDialog = document.getElementById('pinDialog');
  const pinInput = document.getElementById('pinInput');
  const btnCancelPin = document.getElementById('btn-cancel-pin');
  const btnConfirmPin = document.getElementById('btn-confirm-pin');
  
  let pendingAction = null;
  function openPinDialog(action) {
    const menu = document.getElementById('actionMenu');
    if(menu) menu.close();
    if (!pinDialog) return;
    pendingAction = action;
    if (pinInput) pinInput.value = '';
    pinDialog.showModal();
  }

  document.querySelectorAll('#btn-lock').forEach(btn => btn.onclick = () => openPinDialog(() => alert("✅ Area sbloccata!")));

  function exportData() {
    const data = store.load();
    if (data.length === 0) return alert("ℹ️ Nessun dato da esportare.");
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SKF_5S_Backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  document.querySelectorAll('#btn-export, #btn-export-supervisor').forEach(btn => btn.onclick = () => openPinDialog(exportData));

  if (btnCancelPin) btnCancelPin.onclick = (e) => { e.preventDefault(); pinDialog.close(); pendingAction = null; };
  if (btnConfirmPin) btnConfirmPin.onclick = (e) => {
    e.preventDefault();
    if (pinInput && pinInput.value === '6170') {
      pinDialog.close();
      if (pinInput) pinInput.value = '';
      if (pendingAction) { pendingAction(); pendingAction = null; }
    } else { alert("❌ PIN Errato! Riprova."); if (pinInput) pinInput.value = ''; }
  };
}

// ===============================
// Avvio
// ===============================
onReady(()=>{
  setupImport();
  setupSecurity();
  setupActionMenu();

  const printStyle = document.createElement('style');
  printStyle.innerHTML = `@media print { body[data-print-mode="single"] .card-line:not(.print-target) { display: none !important; } }`;
  document.head.appendChild(printStyle);

  window.addEventListener('afterprint', () => {
    const slideStyle = document.getElementById('slide-style-temp');
    if (slideStyle) slideStyle.remove();
  });

  const page = (document.body.dataset.page || '').toLowerCase();
  if (page === 'home') renderHome();
  else if (page === 'alerts') renderAlerts();
  else if (page === 'notes') renderNotes();
  else if (location.pathname.includes('checklist')) renderChecklist();
});
