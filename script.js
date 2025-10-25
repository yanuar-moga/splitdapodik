// script.js (safe final)
// Dependencies: XLSX, jQuery, DataTables
// runs after DOM (defer)

let originalRows = [];
let mappedRows = [];
let currentDisplayed = [];
let currentTable = null;
let detectedHeaders = [];

const rombelHeaderKeywords = ['rombel saat ini_unnamed: 42_level_1','rombel saat ini','rombel','romongan belajar'];

function normalizeHeader(h){ return String(h||'').trim().toLowerCase().replace(/\s+/g,' '); }
function findHeader(headers, keywords){
  const kws = keywords.map(k=>k.toLowerCase());
  for(const k of kws) for(const h of headers) if(normalizeHeader(h)===k) return h;
  for(const k of kws) for(const h of headers) if(normalizeHeader(h).includes(k)) return h;
  for(const k of kws) for(const h of headers) {
    if(normalizeHeader(h).replace(/[^a-z0-9]/g,'').includes(k.replace(/[^a-z0-9]/g,''))) return h;
  }
  return null;
}
function $id(id){ return document.getElementById(id) ?? null; }

function showLoading(flag){
  const st = $id('load-status'); if(!st) return; st.classList.toggle('hidden', !flag);
}
function sanitizeFilename(s){ return String(s||'').replace(/[\/\\?%*:|"<>]/g,'_').replace(/\s+/g,'_').slice(0,120); }
function escapeHtml(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function resetApp(){
  originalRows = []; mappedRows = []; currentDisplayed = []; detectedHeaders = [];
  if(currentTable){ currentTable.destroy(); currentTable = null; }
  const rom = $id('filter-rombel'); if(rom) { rom.innerHTML = '<option>(belum ada file)</option>'; }
  const colsCont = $id('columns-container'); if(colsCont) colsCont.innerHTML = '';
  if($id('table-head-row')) $id('table-head-row').innerHTML = '';
  if($id('table-body')) $id('table-body').innerHTML = '';
  if($id('notice-text')) $id('notice-text').textContent = 'Belum ada file di-upload.';
}

// DataTable init (destroy safe)
function initDataTable(){
  if(currentTable){ try{ currentTable.destroy(); }catch(e){} currentTable = null; }
  if (window.jQuery && $.fn.dataTable) {
    currentTable = $('#students-table').DataTable({
      paging: true, searching: true, info: true, ordering: true, autoWidth:false, destroy:true
    });
  }
}

// FILE UPLOAD: safe wiring
const fileInput = $id('file-input');
if(fileInput) fileInput.addEventListener('change', (evt)=>{
  const f = evt.target.files[0];
  if(!f) return;
  showLoading(true);
  const reader = new FileReader();
  reader.onload = (e)=>{
    try{
      const data = new Uint8Array(e.target.result);
      const wb = XLSX.read(data, { type: 'array' });
      const first = wb.SheetNames[0];
      const ws = wb.Sheets[first];
      // skip 4 rows (header report), header row is row 5
      const json = XLSX.utils.sheet_to_json(ws, { defval: '', range: 4 });
      if(!json || json.length===0){
        alert('Sheet kosong atau header tidak di baris ke-5. Periksa file Anda.');
        showLoading(false);
        return;
      }
      originalRows = json.slice();
      detectedHeaders = Object.keys(json[0]);
      buildRombelSelectAndColumns();
      if($id('notice-text')) $id('notice-text').textContent = `File ter-load (${json.length} baris). Pilih rombel → PROSES.`;
    } catch(err){
      console.error(err);
      alert('Gagal membaca file: ' + (err && err.message ? err.message : err));
    } finally {
      showLoading(false);
    }
  };
  reader.readAsArrayBuffer(f);
});

// build rombel select and checkbox columns (safe DOM ops)
function buildRombelSelectAndColumns(){
  const romHeader = findHeader(detectedHeaders, rombelHeaderKeywords);
  const romSel = $id('filter-rombel');
  if(romSel){
    romSel.innerHTML = '';
    const optAll = document.createElement('option'); optAll.value=''; optAll.textContent='-- Semua --'; romSel.appendChild(optAll);
    if(romHeader){
      const rombels = Array.from(new Set(originalRows.map(r=> (r[romHeader]||'').toString().trim()).filter(x=>x!=='')).sort());
      if(rombels.length){
        rombels.forEach(r => { const o=document.createElement('option'); o.value=r; o.textContent=r; romSel.appendChild(o); });
      } else {
        detectedHeaders.forEach(h => { const o = document.createElement('option'); o.value='[Kolom] '+h; o.textContent='[Kolom] '+h; romSel.appendChild(o); });
        if($id('notice-text')) $id('notice-text').textContent = 'Pilih kolom rombel jika nilai rombel tidak muncul otomatis.';
      }
    } else {
      detectedHeaders.forEach(h => { const o = document.createElement('option'); o.value='[Kolom] '+h; o.textContent='[Kolom] '+h; romSel.appendChild(o); });
      if($id('notice-text')) $id('notice-text').textContent = 'Pilih header kolom Rombel dari dropdown (diawali [Kolom]).';
    }
  }

  // columns checklist (safe)
  const cont = $id('columns-container');
  if(!cont) return;
  cont.innerHTML = '';
  // preferred ordering
  const preferred = [
    'Nama Peserta Didik','Nama','NIS / NISN','NISN','NIPD','JK','Jenis Kelamin',
    'Tempat Lahir','Tanggal Lahir','NIK','Agama','Alamat','RT','RW','Dusun',
    'Kelurahan','Kecamatan','Kode Pos','Rombel Saat Ini_Unnamed: 42_level_1','Rombel'
  ];
  const ordered = [];
  preferred.forEach(p=>{ const found = detectedHeaders.find(h => normalizeHeader(h)===normalizeHeader(p)); if(found && !ordered.includes(found)) ordered.push(found); });
  detectedHeaders.forEach(h => { if(!ordered.includes(h)) ordered.push(h); });

  ordered.forEach(h=>{
    const id = 'colchk-'+Math.random().toString(36).slice(2,9);
    const label = document.createElement('label');
    label.className = 'flex items-center gap-2 p-1 rounded hover:bg-slate-50';
    const chk = document.createElement('input');
    chk.type = 'checkbox';
    chk.id = id;
    chk.setAttribute('data-col', h);
    chk.className = 'col-checkbox';
    const span = document.createElement('span');
    span.className = 'text-xs';
    span.textContent = h;
    label.appendChild(chk);
    label.appendChild(span);
    cont.appendChild(label);
  });
}

// select-all / clear-all (safe)
const selectAllBtn = $id('select-all-cols');
if(selectAllBtn) selectAllBtn.addEventListener('click', ()=> { document.querySelectorAll('.col-checkbox').forEach(c=> c.checked = true); });
const clearAllBtn = $id('clear-all-cols');
if(clearAllBtn) clearAllBtn.addEventListener('click', ()=> { document.querySelectorAll('.col-checkbox').forEach(c=> c.checked = false); });

// PROCESS button safe
const processBtn = $id('process-btn');
if(processBtn) processBtn.addEventListener('click', ()=>{
  if(!originalRows || originalRows.length===0){ alert('Belum ada file. Upload dulu.'); return; }
  const headers = detectedHeaders.slice();
  const rombelHeaderCandidate = findHeader(headers, rombelHeaderKeywords);
  const romSelVal = $id('filter-rombel') ? $id('filter-rombel').value : '';
  let rombelHeaderToUse = rombelHeaderCandidate;
  if(romSelVal && romSelVal.startsWith('[Kolom] ')) rombelHeaderToUse = romSelVal.replace('[Kolom] ','');
  // build mappedRows
  mappedRows = originalRows.map(r=>{
    return {
      _raw: r,
      Nama: r['Nama Peserta Didik'] || r['Nama'] || r['name'] || '',
      'NIS / NISN': r['NIS'] || r['NISN'] || r['NIPD'] || r['NIS / NISN'] || '',
      'Jenis Kelamin': r['JK'] || r['Jenis Kelamin'] || '',
      Rombel: rombelHeaderToUse ? (r[rombelHeaderToUse]||'') : (r['Rombel']||''),
      'Tanggal Lahir': r['Tanggal Lahir'] || r['TTL'] || ''
    };
  });

  // update rombel dropdown with actual values if possible
  const rombels = Array.from(new Set(mappedRows.map(x=> (x.Rombel||'').toString().trim()).filter(x=>x!=='')).sort());
  if(rombels.length && $id('filter-rombel')){
    $id('filter-rombel').innerHTML = '';
    const all = document.createElement('option'); all.value=''; all.textContent='-- Semua --'; $id('filter-rombel').appendChild(all);
    rombels.forEach(r=> $id('filter-rombel').appendChild(new Option(r,r)));
  }

  const chosen = $id('filter-rombel') ? $id('filter-rombel').value : '';
  currentDisplayed = chosen ? mappedRows.filter(r => (r.Rombel||'').toString().trim() === chosen) : mappedRows.slice();

  renderTableWithSelectedColumns(currentDisplayed);
  if($id('notice-text')) $id('notice-text').textContent = `Hasil PROSES: ${currentDisplayed.length} baris tampil.`;
});

// get selected columns preserving DOM order
function getSelectedColumns(){
  const checks = Array.from(document.querySelectorAll('.col-checkbox'));
  return checks.filter(c=>c.checked).map(c=> c.getAttribute('data-col'));
}

// render table with selected columns (safe DOM)
function renderTableWithSelectedColumns(rows){
  const cols = getSelectedColumns();
  const contHead = $id('table-head-row');
  const contBody = $id('table-body');
  if(!contHead || !contBody) return;
  // fallback defaults
  let useCols = cols && cols.length ? cols.slice() : ['Nama Peserta Didik','Nama','NIS / NISN','NISN','JK','Jenis Kelamin','Rombel'];
  // if default names not present in detectedHeaders, try friendly mapped keys
  if(useCols.length === 0) useCols = detectedHeaders.slice(0,6);

  contHead.innerHTML = '';
  useCols.forEach(c => { const th = document.createElement('th'); th.textContent = c; contHead.appendChild(th); });

  contBody.innerHTML = '';
  rows.forEach(r=>{
    const tr = document.createElement('tr');
    const cells = useCols.map(c=>{
      let v = '';
      if(r._raw && Object.prototype.hasOwnProperty.call(r._raw, c)) v = r._raw[c];
      else if(c === 'Nama Peserta Didik' || c === 'Nama') v = r.Nama || r._raw['Nama'] || r._raw['Nama Peserta Didik'] || '';
      else if(c === 'NIS / NISN' || c === 'NISN' || c === 'NIPD') v = r['NIS / NISN'] || r._raw[c] || '';
      else if(c === 'Jenis Kelamin' || c === 'JK') v = r['Jenis Kelamin'] || r._raw[c] || '';
      else if(c.toLowerCase().includes('rombel')) v = r.Rombel || r._raw[c] || '';
      else v = (r._raw && r._raw[c]) ? r._raw[c] : '';
      return `<td>${escapeHtml(v)}</td>`;
    }).join('');
    tr.innerHTML = cells;
    contBody.appendChild(tr);
  });

  initDataTable();
}

// download helpers
function downloadRowsWithCols(rows, cols, filename){
  if(!cols || cols.length===0) cols = detectedHeaders;
  const wsData = rows.map(r=>{
    const obj = {};
    cols.forEach(c=>{
      let v = '';
      if(r._raw && Object.prototype.hasOwnProperty.call(r._raw, c)) v = r._raw[c];
      else if(c === 'Nama Peserta Didik' || c === 'Nama') v = r.Nama || '';
      else if(c === 'NIS / NISN' || c === 'NISN' || c === 'NIPD') v = r['NIS / NISN'] || '';
      else if(c.toLowerCase().includes('rombel')) v = r.Rombel || '';
      else v = (r._raw && r._raw[c]) ? r._raw[c] : '';
      obj[c] = v;
    });
    return obj;
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(wsData);
  XLSX.utils.book_append_sheet(wb, ws, 'Data');
  XLSX.writeFile(wb, filename);
}

// download events (safe)
const downloadFilteredBtn = $id('download-filtered-btn');
if(downloadFilteredBtn) downloadFilteredBtn.addEventListener('click', ()=>{
  if(!currentDisplayed || currentDisplayed.length===0){ alert('Tidak ada data untuk didownload (lakukan PROSES dulu).'); return; }
  const cols = getSelectedColumns();
  if(!cols || cols.length===0){
    if(!confirm('Belum memilih kolom. Download semua kolom terdeteksi? OK = ya')) return;
  }
  downloadRowsWithCols(currentDisplayed, cols.length?cols:detectedHeaders, `hasil_filter_${new Date().toISOString().slice(0,10)}.xlsx`);
});
const downloadRombelBtn = $id('download-rombel-btn');
if(downloadRombelBtn) downloadRombelBtn.addEventListener('click', ()=>{
  const sel = $id('filter-rombel') ? $id('filter-rombel').value : '';
  if(!sel){ alert('Pilih rombel dulu.'); return; }
  const rows = mappedRows.filter(r => (r.Rombel||'').toString().trim() === sel);
  if(!rows.length){ alert('Tidak ada data untuk rombel ini. Lakukan PROSES terlebih dahulu.'); return; }
  const cols = getSelectedColumns();
  downloadRowsWithCols(rows, cols.length?cols:detectedHeaders, `rombel_${sanitizeFilename(sel)}.xlsx`);
});

// reset
const resetBtn = $id('reset-btn');
if(resetBtn) resetBtn.addEventListener('click', resetApp);

// initial
resetApp();
