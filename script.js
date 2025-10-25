// script.js (final) - runs after DOM (defer)
// Dependencies: XLSX, jQuery, DataTables

let originalRows = [];    // raw rows after range:4
let mappedRows = [];      // normalized (friendly fields + _raw)
let currentDisplayed = [];
let currentTable = null;
let detectedHeaders = []; // exact header names from sheet

const rombelHeaderKeywords = ['rombel saat ini_unnamed: 42_level_1','rombel saat ini','rombel','romongan belajar'];

// helper to normalize header text
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

// safe get element
function $id(id){ return document.getElementById(id); }

function showLoading(flag){
  const st = $id('load-status'); if(!st) return;
  st.classList.toggle('hidden', !flag);
}

function resetApp(){
  originalRows = []; mappedRows = []; currentDisplayed = []; detectedHeaders = [];
  if(currentTable){ currentTable.destroy(); currentTable = null; }
  const rom = $id('filter-rombel'); if(rom) rom.innerHTML = '<option>(belum ada file)</option>';
  $id('columns-container').innerHTML = '';
  $id('table-head-row').innerHTML = ''; $id('table-body').innerHTML = '';
  $id('notice-text').textContent = 'Belum ada file di-upload.';
}

// DataTable init
function initDataTable(){
  if(currentTable){ currentTable.destroy(); currentTable = null; }
  currentTable = $('#students-table').DataTable({
    paging: true, searching: true, info: true, ordering: true, destroy: true, autoWidth:false
  });
}

// read file (sheet1) skip 4 rows -> header row = baris ke-5
$id('file-input')?.addEventListener('change', (evt)=>{
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
      const json = XLSX.utils.sheet_to_json(ws, { defval: '', range: 4 }); // <- range:4
      if(!json || json.length===0){ alert('Sheet kosong atau header tidak di baris ke-5.'); showLoading(false); return; }
      originalRows = json.slice();
      detectedHeaders = Object.keys(json[0]);
      buildRombelSelectAndColumns();
      $id('notice-text').textContent = `File ter-load (${json.length} baris). Pilih rombel → PROSES.`;
    }catch(err){ console.error(err); alert('Gagal membaca file: '+err.message); }
    finally{ showLoading(false); }
  };
  reader.readAsArrayBuffer(f);
});

// populate rombel dropdown & checkbox columns
function buildRombelSelectAndColumns(){
  const romHeader = findHeader(detectedHeaders, rombelHeaderKeywords);
  const romSel = $id('filter-rombel');
  romSel.innerHTML = '';
  const optAll = document.createElement('option'); optAll.value=''; optAll.textContent='-- Semua --'; romSel.appendChild(optAll);

  if(romHeader){
    const rombels = Array.from(new Set(originalRows.map(r=> (r[romHeader]||'').toString().trim()).filter(x=>x!=='')).sort());
    rombels.forEach(r => { const o=document.createElement('option'); o.value=r; o.textContent=r; romSel.appendChild(o); });
    if(rombels.length===0){
      // no values, fall back to header list so user can pick column (handled in process)
      detectedHeaders.forEach(h => { const o=document.createElement('option'); o.value='[Kolom] '+h; o.textContent='[Kolom] '+h; romSel.appendChild(o); });
      $id('notice-text').textContent = 'Pilih kolom rombel jika nilai rombel tidak muncul otomatis.';
    }
  } else {
    // no rombel header detected: show header list prefixed so user can choose which column is rombel
    detectedHeaders.forEach(h => { const o=document.createElement('option'); o.value='[Kolom] '+h; o.textContent='[Kolom] '+h; romSel.appendChild(o); });
    $id('notice-text').textContent = 'Pilih header kolom Rombel dari dropdown (diawali [Kolom]).';
  }

  // build columns checklist from detectedHeaders (preserve exact header strings)
  const cont = $id('columns-container'); cont.innerHTML = '';
  // allow some friendly ordering: prefer common fields first if exist
  const preferred = [
    'Nama Peserta Didik','Nama','NIS / NISN','NISN','NIPD','JK','Jenis Kelamin',
    'Tempat Lahir','Tanggal Lahir','NIK','Agama','Alamat','RT','RW','Dusun',
    'Kelurahan','Kecamatan','Kode Pos','Rombel Saat Ini_Unnamed: 42_level_1','Rombel'
  ];
  // build ordered list: preferred headers that exist first, then remaining
  const ordered = [];
  preferred.forEach(p=> { const found = detectedHeaders.find(h => normalizeHeader(h)===normalizeHeader(p)); if(found && !ordered.includes(found)) ordered.push(found); });
  detectedHeaders.forEach(h=>{ if(!ordered.includes(h)) ordered.push(h); });

  ordered.forEach(h=>{
    const id = 'colchk-'+Math.random().toString(36).slice(2,9);
    const wrapper = document.createElement('label');
    wrapper.className = 'flex items-center gap-2 p-1 rounded hover:bg-slate-50';
    wrapper.innerHTML = `<input type="checkbox" id="${id}" data-col="${h}" class="col-checkbox"> <span class="text-xs">${h}</span>`;
    cont.appendChild(wrapper);
  });
}

// select-all / clear-all columns
$id('select-all-cols')?.addEventListener('click', ()=>{
  document.querySelectorAll('.col-checkbox').forEach(c=> c.checked = true);
});
$id('clear-all-cols')?.addEventListener('click', ()=>{
  document.querySelectorAll('.col-checkbox').forEach(c=> c.checked = false);
});

// PROCESS button: build mappedRows and initial currentDisplayed
$id('process-btn')?.addEventListener('click', ()=>{
  if(!originalRows || originalRows.length===0){ alert('Belum ada file. Upload dulu.'); return; }

  // determine rombel header name (if user chose [Kolom] option, extract)
  const romSelectVal = $id('filter-rombel').value;
  let rombelHeader = findHeader(detectedHeaders, rombelHeaderKeywords);
  if(romSelectVal && romSelectVal.startsWith('[Kolom] ')) rombelHeader = romSelectVal.replace('[Kolom] ', '');

  // create mappedRows preserving all raw fields
  mappedRows = originalRows.map(r=>{
    return {
      _raw: r,
      // friendly mapping attempts (not mandatory)
      Nama: r['Nama Peserta Didik'] || r['Nama'] || r['name'] || r['Nama Peserta Didik '] || '',
      'NIS / NISN': r['NIS'] || r['NISN'] || r['NIS / NISN'] || r['NIPD'] || '',
      'Jenis Kelamin': r['JK'] || r['Jenis Kelamin'] || '',
      Rombel: rombelHeader ? (r[rombelHeader]||'') : (r['Rombel']||''),
      'Tanggal Lahir': r['Tanggal Lahir'] || r['Tanggal_Lahir'] || r['TTL'] || ''
    };
  });

  // update rombel dropdown to actual values if possible
  const rombels = Array.from(new Set(mappedRows.map(x=> (x.Rombel||'').toString().trim()).filter(x=>x!=='')).sort());
  if(rombels.length){
    const sel = $id('filter-rombel'); sel.innerHTML=''; sel.appendChild(new Option('-- Semua --',''));
    rombels.forEach(r => sel.appendChild(new Option(r,r)));
  }

  // determine currentDisplayed (if rombel selected, filter)
  const chosen = $id('filter-rombel').value;
  currentDisplayed = chosen ? mappedRows.filter(r => (r.Rombel||'').toString().trim() === chosen) : mappedRows.slice();

  // render table using selected columns (if none selected, auto-select common ones)
  renderTableWithSelectedColumns(currentDisplayed);
  $id('notice-text').textContent = `Hasil PROSES: ${currentDisplayed.length} baris tampil.`;
});

// render table according to selected columns (checkbox order)
function getSelectedColumns(){
  const checks = Array.from(document.querySelectorAll('.col-checkbox'));
  // preserve DOM order, only checked
  return checks.filter(c=>c.checked).map(c=> c.getAttribute('data-col'));
}

function renderTableWithSelectedColumns(rows){
  const cols = getSelectedColumns();
  // if no selection, use default prioritised columns
  if(!cols || cols.length===0){
    const defaults = ['Nama Peserta Didik','Nama','NIS / NISN','NISN','JK','Jenis Kelamin','Rombel'];
    // pick those that exist in detectedHeaders or our mapped fields
    const pick = defaults.filter(d => {
      return detectedHeaders.includes(d) || ['Nama','NIS / NISN','Jenis Kelamin','Rombel','Tanggal Lahir','Alamat'].includes(d);
    });
    // fallback to some mapped friendly names
    if(pick.length) cols.push(...pick);
    else {
      // final fallback: use first 6 headers detected
      cols.push(...detectedHeaders.slice(0,6));
    }
  }

  // build table head
  const thead = $id('table-head-row'); thead.innerHTML = '';
  cols.forEach(c => {
    const th = document.createElement('th'); th.textContent = c; thead.appendChild(th);
  });

  // build body
  const tbody = $id('table-body'); tbody.innerHTML = '';
  rows.forEach(r => {
    const tr = document.createElement('tr');
    tr.innerHTML = cols.map(c => {
      // prefer mapped friendly fields if requested
      let v = '';
      if(c === 'Nama' || c === 'Nama Peserta Didik') v = r.Nama || r._raw['Nama'] || r._raw['Nama Peserta Didik'] || '';
      else if(c === 'NIS / NISN' || c === 'NISN' || c === 'NIPD') v = r['NIS / NISN'] || r._raw[c] || '';
      else if(c === 'Jenis Kelamin' || c === 'JK') v = r['Jenis Kelamin'] || r._raw[c] || '';
      else if(c === 'Rombel' || c.toLowerCase().includes('rombel')) v = r.Rombel || r._raw[c] || '';
      else if(r._raw && Object.prototype.hasOwnProperty.call(r._raw, c)) v = r._raw[c];
      else v = r._raw[c] || '';
      return `<td>${escapeHtml(v)}</td>`;
    }).join('');
    tbody.appendChild(tr);
  });

  initDataTable();
}

// escape HTML
function escapeHtml(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

// download currentDisplayed with selected columns (preserve order)
$id('download-filtered-btn')?.addEventListener('click', ()=>{
  if(!currentDisplayed || currentDisplayed.length===0){ alert('Tidak ada data untuk didownload (lakukan PROSES dulu).'); return; }
  const cols = getSelectedColumns();
  if(!cols || cols.length===0) { if(!confirm('Belum memilih kolom. Download semua kolom terdeteksi? OK = ya')) {
    return;
  } }
  downloadRowsWithCols(currentDisplayed, cols.length?cols:detectedHeaders, `hasil_filter_${new Date().toISOString().slice(0,10)}.xlsx`);
});

// Download per rombel (all students in selected rombel) using selected columns
$id('download-rombel-btn')?.addEventListener('click', ()=>{
  const sel = $id('filter-rombel').value;
  if(!sel){ alert('Pilih rombel dulu.'); return; }
  const rows = mappedRows.filter(r => (r.Rombel||'').toString().trim() === sel);
  if(!rows.length){ alert('Tidak ada data untuk rombel ini. Lakukan PROSES terlebih dahulu.'); return; }
  const cols = getSelectedColumns();
  downloadRowsWithCols(rows, cols.length?cols:detectedHeaders, `rombel_${sanitizeFilename(sel)}.xlsx`);
});

// utility to build worksheet only with specified column keys (in order)
function downloadRowsWithCols(rows, cols, filename){
  if(!cols || cols.length===0) cols = detectedHeaders;
  // build data objects in requested order
  const wsData = rows.map(r => {
    const obj = {};
    cols.forEach(c=>{
      // resolve value: prefer raw field if exact match; else try friendly
      let v = '';
      if(r._raw && Object.prototype.hasOwnProperty.call(r._raw, c)) v = r._raw[c];
      else if(c === 'Nama Peserta Didik' || c === 'Nama') v = r.Nama || '';
      else if(c === 'NIS / NISN' || c === 'NISN' || c === 'NIPD') v = r['NIS / NISN'] || '';
      else if(c === 'Jenis Kelamin' || c === 'JK') v = r['Jenis Kelamin'] || '';
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

function sanitizeFilename(s){ return s.replace(/[\/\\?%*:|"<>]/g,'_').replace(/\s+/g,'_').slice(0,120); }

// reset handler
$id('reset-btn')?.addEventListener('click', resetApp);

// initial reset
resetApp();
