// ===============================
// SKF 5S — Supervisor v2.4.5 (Finale)
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
    const k = r.channel || r.ch || r.name || 'CH ?';
    if (!byCh.has(k)) byCh.set(k, []);
    byCh.get(k).push(r);
  }

  wrap.innerHTML = '';
  const groups = Array.from(byCh.entries()).sort((a,b)=> String(a[0]).localeCompare(String(b[0])));

  for (const [ch, arr] of groups){
    const last = arr.sort((a,b)=> new Date(a.date) - new Date(b.date)).slice(-1)[0] || {};
    const p = last.points || {s1:0,s2:0,s3:0,s4:0,s5:0};

    const card = document.createElement('div');
    card.className = 'mini-card';
    card.innerHTML = `
      <h5>${ch} <span class="area">${last.area || ''}</span></h5>
      <div class="mini-bars">
        <div class="mini-bar" style="--h:${p.s1||0}%;--c:#e11d48"></div>
        <div class="mini-bar" style="--h:${p.s2||0}%;--c:#f59e0b"></div>
        <div class="mini-bar" style="--h:${p.s3||0}%;--c:#10b981"></div>
        <div class="mini-bar" style="--h:${p.s4||0}%;--c:#0ea5e9"></div>
        <div class="mini-bar" style="--h:${p.s5||0}%;--c:#6366f1"></div>
      </div>
      <div class="mini-scale"><span>1S</span><span>2S</span><span>3S</span><span>4S</span><span>5S</span></div>
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
    const k = r.channel || r.ch || r.name || 'CH ?';
    if (!byCh.has(k)) byCh.set(k, []);
    byCh.get(k).push(r);
  }

  listMount.innerHTML = '';
  const entries = Array.from(byCh.entries()).sort((a,b)=> String(a[0]).localeCompare(String(b[0])));

  for (const [ch, arr] of entries){
    const last = arr.sort((a,b)=> new Date(a.date) - new Date(b.date)).slice(-1)[0] || {};
    const p = last.points || {s1:0,s2:0,s3:0,s4:0,s5:0};

    const card = document.createElement('section');
    card.className = 'card-line';
    card.id = `CH-${ch}`;

    card.innerHTML = `
      <div class="top">
        <div>
          <div class="ttl"><strong>${ch}</strong></div>
          <div class="muted">${(last.area||'').toUpperCase()} • Ultimo: ${last.date || '-'}</div>
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
          <a class="btn ghost" href="notes.html?hlCh=${encodeURIComponent(ch)}&hlDate=${encodeURIComponent(last.date||'')}">Vedi note</a>
        </div>
      </div>
      <div class="mini-bars sheet-graph">
        <div class="mini-bar" style="--h:${p.s1||0}%;--c:#e11d48"></div>
        <div class="mini-bar" style="--h:${p.s2||0}%;--c:#f59e0b"></div>
        <div class="mini-bar" style="--h:${p.s3||0}%;--c:#10b981"></div>
        <div class="mini-bar" style="--h:${p.s4||0}%;--c:#0ea5e9"></div>
        <div class="mini-bar" style="--h:${p.s5||0}%;--c:#6366f1"></div>
      </div>
      <div class="mini-scale"><span>1S</span><span>2S</span><span>3S</span><span>4S</span><span>5S</span></div>
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
// NOTE
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
  if (urlCh) {
    if(fCh) fCh.value = urlCh;
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
      const div = document.createElement('div');
      div.className = 'card-line'; 
      
      let notesHtml = '';
      if (typeof r.notes === 'string') {
        let formattedText = r.notes.replace(/(⬜0|⬜ 0)/g, '<br><br>$1');
        if(formattedText.startsWith('<br><br>')) formattedText = formattedText.substring(8);
        notesHtml = `
          <details style="margin-bottom: 8px;">
            <summary style="font-weight: bold; cursor: pointer; padding: 10px; background: #fff; border-radius: 6px; border: 1px solid #dfe6f4;">
              Apri dettagli nota
            </summary>
            <div style="max-height: 250px; overflow-y: auto; padding: 12px; font-size: 0.9rem; background: #fff; border: 1px solid #dfe6f4; border-top: none; border-radius: 0 0 6px 6px; line-height: 1.6;">
              ${formattedText}
            </div>
          </details>`;
      } else if (typeof r.notes === 'object') {
        for (const [k, v] of Object.entries(r.notes)) {
          if (v && String(v).trim()) {
            const sColor = `var(--${k.toLowerCase()}, #0d63d6)`;
            let formattedText = v.replace(/(⬜0|⬜ 0)/g, '<br><br>$1');
            if(formattedText.startsWith('<br><br>')) formattedText = formattedText.substring(8);

            notesHtml += `
              <details style="margin-bottom: 8px;">
                <summary style="color: ${sColor}; font-weight: bold; cursor: pointer; padding: 10px; background: #fff; border-radius: 6px; border: 1px solid #dfe6f4; user-select: none;">
                  ${k.toUpperCase()} — Clicca per espandere
                </summary>
                <div style="max-height: 250px; overflow-y: auto; padding: 12px; font-size: 0.9rem; background: #fff; border: 1px solid #dfe6f4; border-top: none; border-radius: 0 0 6px 6px; line-height: 1.6;">
                  ${formattedText}
                </div>
              </details>
            `;
          }
        }
      }

      const dataFormat = new Date(r.date);
      const dataStringa = !isNaN(dataFormat.getTime()) ? dataFormat.toLocaleString('it-IT', {dateStyle: 'short', timeStyle: 'short'}) : r.date;

      div.innerHTML = `
        <div class="top" style="margin-bottom: 12px;">
          <div>
            <div class="ttl" style="font-size: 1.1rem;"><strong>${r.ch || r.channel || r.name || 'CH ?'}</strong></div>
            <div class="muted">${(r.area || '').toUpperCase()} • ${dataStringa}</div>
          </div>
        </div>
        <div style="background: #f6f9ff; padding: 10px; border-radius: 8px; border: 1px solid #dfe6f4;">
          ${notesHtml}
        </div>
      `;
      list.appendChild(div);
    });

    if(counter) counter.textContent = `(${filtered.length})`;
    if(countSpan) countSpan.textContent = `(${filtered.length})`;
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
