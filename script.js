// script.js - Dapodik Mapper with multi-filter toolbar (UI A)
// dependencies: xlsx.full.min.js, jQuery, DataTables

let originalRows = [];    // raw rows read (after range:4)
let mappedRows = [];      // normalized rows used for rendering/export
let currentDisplayed = []; // rows currently shown (after PROSES + applied filters)
let currentTable = null;
let detectedHeaders = []; // headers from sheet_to_json keys

// standard detection keywords
const requiredKeys = [
  { key: 'name', keywords: ['nama peserta didik', 'nama', 'nama lengkap'] },
  { key: 'nis', keywords: ['nis', 'nisn', 'nipd'] },
  { key: 'gender', keywords: ['jenis kelamin', 'jk', 'gender'] },
  { key: 'rombel', keywords: ['rombel saat ini_unnamed: 42_level_1', 'rombel saat ini', 'rombel', 'romongan belajar'] },
  { key: 'birth', keywords: ['tanggal lahir', 'ttl'] },
  { key: 'alamat', keywords: ['alamat', 'alamat lengkap'] },
];

function normalizeHeader(h){
  return String(h||'').trim().toLowerCase().replace(/\s+/g,' ');
}
function findHeaderByKeywords(headers, keywords){
  const kws = keywords.map(k=>k.toLowerCase());
  for(const k of kws) for(const h of headers) if(normalizeHeader(h)===k) return h;
  for(const k of kws) for(const h of headers) if(normalizeHeader(h).includes(k)) return h;
  for(const k of kws) for(const h of headers){
    if(normalizeHeader(h).replace(/[^a-z0-9]/g,'').includes(k.replace(/[^a-z0-9]/g,''))) return h;
  }
  return null;
}

function populateSelect(selectEl, options, includeAll=true){
  selectEl.innerHTML = '';
  if(includeAll){
    const opt = document.createElement('option'); opt.value=''; opt.textContent='-- Semua --'; selectEl.appendChild(opt);
  }
  options.forEach(o=>{
    const opt = document.createElement('option'); opt.value=o; opt.textContent=o; selectEl.appendChild(opt);
  });
}

function resetApp(){
  originalRows = []; mappedRows = []; currentDisplayed = []; detectedHeaders = [];
  if(currentTable){ currentTable.destroy(); currentTable = null; }
  document.getElementById('filter-rombel').innerHTML = '<option>(belum ada file)</option>';
  document.getElementById('table-head-row').innerHTML = ''; document.getElementById('table-body').innerHTML = '';
  document.getElementById('notice-text').textContent = 'Belum ada file di-upload.';
  clearAllFilterRows();
}

function initDataTable(){
  if(currentTable){ currentTable.destroy(); currentTable = null; }
  currentTable = $('#students-table').DataTable({
    paging: true, searching: true, info: true, ordering: true, autoWidth: false,
    columnDefs: [{ targets: '_all', className: 'dt-left' }], destroy: true
  });
}

// --- FILE UPLOAD: sheet1, skip first 4 rows (header at row 5) ---
document.getElementById('file-input').addEventListener('change', (evt)=>{
  const f = evt.target.files[0];
  if(!f) return;
  showLoading(true);
  const reader = new FileReader();
  reader.onload = (e)=>{
    try{
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      // IMPORTANT: skip 4 rows (baris 1-4), header at baris 5
      const json = XLSX.utils.sheet_to_json(worksheet, { defval: '', range: 4 });
      if(!json || json.length === 0){
        alert('Sheet kosong atau tidak terbaca. Pastikan header tabel berada pada baris ke-5.');
        showLoading(false); return;
      }
      originalRows = json.slice();
      detectedHeaders = Object.keys(json[0]);
      buildInitialRombelSelect();
      document.getElementById('notice-text').textContent = `File ter-load (${json.length} baris). Pilih rombel → klik PROSES.`;
    }catch(err){
      console.error(err); alert('Gagal membaca file: '+err.message);
    }finally{ showLoading(false); }
  };
  reader.readAsArrayBuffer(f);
});

function buildInitialRombelSelect(){
  // try to detect rombel header first; then populate rombel values
  const rombelHeader = findHeaderByKeywords(detectedHeaders, requiredKeys.find(k=>k.key==='rombel').keywords);
  if(rombelHeader){
    const rombels = Array.from(new Set(originalRows.map(r => (r[rombelHeader]||'').toString().trim()).filter(x=>x!=='')).sort());
    populateSelect(document.getElementById('filter-rombel'), rombels, true);
    if(rombels.length===0){
      // fallback: maybe rombel header exists but values empty; show headers so user knows
      populateSelect(document.getElementById('filter-rombel'), detectedHeaders.map(h=>`[Kolom] ${h}`), true);
      document.getElementById('notice-text').textContent = 'Pilih kolom Rombel jika nilai rombel tidak muncul otomatis.';
    }
  } else {
    // no rombel header found -> let user pick which header column contains rombel values: show headers
    populateSelect(document.getElementById('filter-rombel'), detectedHeaders.map(h=>`[Kolom] ${h}`), true);
    document.getElementById('notice-text').textContent = 'Pilih header kolom Rombel dari dropdown (diawali [Kolom]).';
  }
}

// --- PROCESS: map rows and render initial/currentDisplayed ---
document.getElementById('process-btn').addEventListener('click', ()=>{
  if(!originalRows || originalRows.length===0){ alert('Belum ada file. Silakan upload Excel dulu.'); return; }

  const headers = detectedHeaders.slice();
  const rombelHeaderCandidate = findHeaderByKeywords(headers, requiredKeys.find(k=>k.key==='rombel').keywords);

  // if user selected a "[Kolom] ..." (fallback) use it to determine rombel header
  const rombelSelectVal = document.getElementById('filter-rombel').value;
  let rombelHeaderToUse = rombelHeaderCandidate;
  if(rombelSelectVal && rombelSelectVal.startsWith('[Kolom] ')) rombelHeaderToUse = rombelSelectVal.replace('[Kolom] ', '');

  // build mappedRows (normalize some common fields), but keep _raw for arbitrary columns
  mappedRows = originalRows.map(r => {
    return {
      Nama: r[ findHeaderByKeywords(headers, requiredKeys.find(k=>k.key==='name').keywords) ] || r['Nama'] || '',
      'NIS / NISN': r[ findHeaderByKeywords(headers, requiredKeys.find(k=>k.key==='nis').keywords) ] || '',
      'Jenis Kelamin': r[ findHeaderByKeywords(headers, requiredKeys.find(k=>k.key==='gender').keywords) ] || '',
      Rombel: rombelHeaderToUse ? (r[rombelHeaderToUse] || '') : (r['Rombel'] || ''),
      'Tanggal Lahir': r[ findHeaderByKeywords(headers, requiredKeys.find(k=>k.key==='birth').keywords) ] || '',
      Alamat: r[ findHeaderByKeywords(headers, requiredKeys.find(k=>k.key==='alamat').keywords) ] || '',
      _raw: r
    };
  });

  // after mapping, produce rombel list derived from mappedRows (defensive)
  const rombels = Array.from(new Set(mappedRows.map(x => (x.Rombel||'').toString().trim()).filter(x=>x!=='')).sort());
  if(rombels.length) populateSelect(document.getElementById('filter-rombel'), rombels, true);
  // set currentDisplayed initially to either selected rombel or all
  const chosen = document.getElementById('filter-rombel').value;
  currentDisplayed = chosen ? mappedRows.filter(r => (r.Rombel||'').toString().trim() === chosen) : mappedRows.slice();

  // initial render
  renderTable(currentDisplayed);
  document.getElementById('notice-text').textContent = `Hasil PROSES: ${currentDisplayed.length} baris tampil.`;
  // also prepare filters dropdown columns list (all available headers)
  prepareFilterColumns();
});

// --- Render table ---
function renderTable(rows){
  const headers = ['Nama', 'NIS / NISN', 'Jenis Kelamin', 'Rombel', 'Tanggal Lahir', 'Alamat'];
  const headRow = document.getElementById('table-head-row'); headRow.innerHTML = '';
  headers.forEach(h => { const th = document.createElement('th'); th.textContent = h; headRow.appendChild(th); });

  const tbody = document.getElementById('table-body'); tbody.innerHTML = '';
  rows.forEach(r => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(r.Nama)}</td>
      <td>${escapeHtml(r['NIS / NISN'])}</td>
      <td>${escapeHtml(r['Jenis Kelamin'])}</td>
      <td>${escapeHtml(r.Rombel)}</td>
      <td>${escapeHtml(r['Tanggal Lahir'])}</td>
      <td>${escapeHtml(r.Alamat)}</td>
    `;
    tbody.appendChild(tr);
  });
  initDataTable();
}

function escapeHtml(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

// --- FILTER TOOLBAR: dynamic rows ---
function prepareFilterColumns(){
  // columns user can choose from = detectedHeaders (raw sheet headers)
  // We'll also include an option to search in mapped friendly columns (Nama, Rombel,...)
  // Build list once
  // No action here besides allowing add-filter to read detectedHeaders
}

function clearAllFilterRows(){
  const cont = document.getElementById('filters-container'); cont.innerHTML = '';
}

// add filter row
document.getElementById('add-filter-btn').addEventListener('click', ()=>{
  addFilterRow();
});

function addFilterRow(){
  const cont = document.getElementById('filters-container');
  const row = document.createElement('div'); row.className = 'flex gap-2 items-center';

  // column select
  const sel = document.createElement('select'); sel.className = 'border rounded px-2 py-1 w-64';
  // populate options: include friendly mapped fields first
  const friendly = ['Nama','NIS / NISN','Jenis Kelamin','Rombel','Tanggal Lahir','Alamat'];
  sel.appendChild(new Option('-- Pilih Kolom --',''));
  friendly.forEach(f => sel.appendChild(new Option(f,f)));
  detectedHeaders.forEach(h => {
    // avoid duplicate if header equals friendly label
    if(!friendly.includes(h)) sel.appendChild(new Option(h,h));
  });

  // input field (text)
  const input = document.createElement('input'); input.type='text'; input.className='border rounded px-2 py-1 flex-1'; input.placeholder='Masukkan nilai filter (contains)';

  // remove button
  const rem = document.createElement('button'); rem.type='button'; rem.className='px-2 py-1 rounded border bg-white'; rem.textContent='Hapus';
  rem.addEventListener('click', ()=> { row.remove(); });

  row.appendChild(sel); row.appendChild(input); row.appendChild(rem);
  cont.appendChild(row);
}

// apply filters: read all filter rows and apply to currentDisplayed (which was from PROSES)
document.getElementById('apply-filters-btn').addEventListener('click', ()=>{
  if(!mappedRows || mappedRows.length===0){ alert('Belum ada data ter-proses. Klik PROSES terlebih dahulu.'); return; }
  // gather filters
  const cont = document.getElementById('filters-container');
  const rows = Array.from(cont.children);
  const filters = [];
  for(const r of rows){
    const sel = r.querySelector('select');
    const inp = r.querySelector('input');
    if(!sel || !inp) continue;
    const col = sel.value.trim();
    const val = inp.value.trim();
    if(col && val) filters.push({col, val});
  }
  // if no filters -> reset to PROSES result (no extra filter)
  // baseData = mappedRows filtered by chosen rombel (what PROSES produced)
  // Easiest: re-run PROSES selection: currentDisplayedInitial = mappedRows filtered by rombel selection
  const rombelChosen = document.getElementById('filter-rombel').value;
  const base = rombelChosen ? mappedRows.filter(r => (r.Rombel||'').toString().trim()===rombelChosen) : mappedRows.slice();

  if(filters.length===0){
    currentDisplayed = base;
    renderTable(currentDisplayed);
    document.getElementById('notice-text').textContent = `Filter dibersihkan. ${currentDisplayed.length} baris tampil.`;
    return;
  }

  // apply filters sequentially (AND)
  let filtered = base.slice();
  filters.forEach(f => {
    const key = f.col;
    const q = f.val.toLowerCase();
    filtered = filtered.filter(row => {
      // support friendly mapped keys first
      if(['Nama','NIS / NISN','Jenis Kelamin','Rombel','Tanggal Lahir','Alamat'].includes(key)){
        const v = (row[key]||'').toString().toLowerCase();
        return v.indexOf(q) !== -1;
      }
      // otherwise check raw _raw object with exact header key
      const rawVal = (row._raw && row._raw[key]) ? row._raw[key].toString().toLowerCase() : '';
      return rawVal.indexOf(q) !== -1;
    });
  });

  currentDisplayed = filtered;
  renderTable(currentDisplayed);
  document.getElementById('notice-text').textContent = `Hasil Filter: ${currentDisplayed.length} baris tampil.`;
});

// clear filters
document.getElementById('clear-filters-btn').addEventListener('click', ()=>{
  clearAllFilterRows();
  // reset to PROSES result (recompute base)
  const rombelChosen = document.getElementById('filter-rombel').value;
  currentDisplayed = rombelChosen ? mappedRows.filter(r => (r.Rombel||'').toString().trim()===rombelChosen) : mappedRows.slice();
  renderTable(currentDisplayed);
  document.getElementById('notice-text').textContent = `Filter dibersihkan. ${currentDisplayed.length} baris tampil.`;
});

// download filtered results
document.getElementById('download-filtered-btn').addEventListener('click', ()=>{
  if(!currentDisplayed || currentDisplayed.length===0){ alert('Tidak ada data untuk didownload (terapkan PROSES dan filter dulu).'); return; }
  downloadFromRows(currentDisplayed, `hasil_filter_${new Date().toISOString().slice(0,10)}.xlsx`);
});

// download per rombel (selected rombel)
document.getElementById('download-rombel-btn').addEventListener('click', ()=>{
  const sel = document.getElementById('filter-rombel').value;
  if(!sel){ alert('Pilih rombel dulu (atau gunakan PROSES lalu pilih rombel).'); return; }
  const rows = mappedRows.filter(r => (r.Rombel||'').toString().trim()===sel);
  if(!rows.length){ alert('Tidak ada data untuk rombel ini. Pastikan Anda sudah PROSES.'); return; }
  downloadFromRows(rows, `rombel_${sanitizeFilename(sel)}.xlsx`);
});

function downloadFromRows(rows, filename){
  if(!rows || rows.length===0){ alert('Data kosong.'); return; }
  // try to include many common columns if present; otherwise include _raw keys
  const sample = rows[0];
  // build headers: prefer these names if available, else fallback to raw keys
  const preferred = ['Nama Peserta Didik','NIS / NISN','Jenis Kelamin','Rombel','Tanggal Lahir','Alamat'];
  const wsData = rows.map(r => {
    const obj = {};
    // include preferred (map from mapped row)
    obj['Nama Peserta Didik'] = r.Nama || '';
    obj['NIS / NISN'] = r['NIS / NISN'] || '';
    obj['Jenis Kelamin'] = r['Jenis Kelamin'] || '';
    obj['Rombel'] = r.Rombel || '';
    obj['Tanggal Lahir'] = r['Tanggal Lahir'] || '';
    obj['Alamat'] = r.Alamat || '';
    // also append all raw fields (to preserve other columns)
    if(r._raw){
      Object.keys(r._raw).forEach(k => {
        if(!Object.prototype.hasOwnProperty.call(obj,k)) obj[k] = r._raw[k];
      });
    }
    return obj;
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(wsData);
  XLSX.utils.book_append_sheet(wb, ws, 'Data');
  XLSX.writeFile(wb, filename);
}

function sanitizeFilename(s){ return s.replace(/[\/\\?%*:|"<>]/g,'_').replace(/\s+/g,'_').slice(0,120); }

function showLoading(flag){ const st = document.getElementById('load-status'); if(flag) st.classList.remove('hidden'); else st.classList.add('hidden'); }

// reset button
document.getElementById('reset-btn').addEventListener('click', resetApp);

// init
(function init(){ resetApp(); })();
