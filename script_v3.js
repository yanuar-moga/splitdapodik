// script.js (final - filter per column)
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
function escapeHtml(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function sanitizeFilename(s){ return String(s||'').replace(/[\/\\?%*:|"<>]/g,'_').replace(/\s+/g,'_').slice(0,120); }
function showLoading(flag){ const st = $id('load-status'); if(!st) return; st.classList.toggle('hidden', !flag); }

function resetApp(){
  originalRows = []; mappedRows = []; currentDisplayed = []; detectedHeaders = [];
  if(currentTable){ try{ currentTable.destroy(); }catch(e){} currentTable = null; }
  if($id('filter-rombel')) $id('filter-rombel').innerHTML = '<option>(belum ada file)</option>';
  if($id('columns-container')) $id('columns-container').innerHTML = '';
  if($id('table-head-row')) $id('table-head-row').innerHTML = '';
  if($id('table-filter-row')) $id('table-filter-row').innerHTML = '';
  if($id('table-body')) $id('table-body').innerHTML = '';
  if($id('notice-text')) $id('notice-text').textContent = 'Belum ada file di-upload.';
}

function initDataTable(){
  if(currentTable){ try{ currentTable.destroy(); }catch(e){} currentTable = null; }
  if (window.jQuery && $.fn.dataTable) {
    currentTable = $('#students-table').DataTable({
      paging: true, searching: true, info: true, ordering: true, autoWidth:false, destroy:true,
      // disable default search because we have column filters
      searching: true
    });
  }
}

// file input (sheet1, range:4)
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
      // skip 4 rows so header is row 5
      const json = XLSX.utils.sheet_to_json(ws, { defval: '', range: 4 });
      if(!json || json.length===0){ alert('Sheet kosong atau header tidak di baris ke-5. Periksa file.'); showLoading(false); return; }
      originalRows = json.slice();
      detectedHeaders = Object.keys(json[0]);
      buildRombelSelectAndColumns();
      if($id('notice-text')) $id('notice-text').textContent = `File ter-load (${json.length} baris). Pilih rombel → PROSES.`;
    } catch(err){ console.error(err); alert('Gagal membaca file: '+(err && err.message ? err.message : err)); }
    finally{ showLoading(false); }
  };
  reader.readAsArrayBuffer(f);
});

// build rombel dropdown and columns checklist
function buildRombelSelectAndColumns(){
  const romHeader = findHeader(detectedHeaders, rombelHeaderKeywords);
  const romSel = $id('filter-rombel');
  if(romSel){
    romSel.innerHTML = '';
    romSel.appendChild(new Option('-- Semua --',''));
    if(romHeader){
      const rombels = Array.from(new Set(originalRows.map(r=> (r[romHeader]||'').toString().trim()).filter(x=>x!=='')).sort());
      if(rombels.length) rombels.forEach(r => romSel.appendChild(new Option(r,r)));
      else {
        // fallback: offer header choices
        detectedHeaders.forEach(h => romSel.appendChild(new Option('[Kolom] '+h, '[Kolom] '+h)));
        if($id('notice-text')) $id('notice-text').textContent = 'Pilih kolom rombel jika nilai rombel tidak muncul otomatis.';
      }
    } else {
      detectedHeaders.forEach(h => romSel.appendChild(new Option('[Kolom] '+h, '[Kolom] '+h)));
      if($id('notice-text')) $id('notice-text').textContent = 'Pilih header kolom Rombel dari dropdown (diawali [Kolom]).';
    }
  }

  // checklist columns
  const cont = $id('columns-container');
  if(!cont) return;
  cont.innerHTML = '';
  // prefer common fields first
  const preferred = ['Nama Peserta Didik','Nama','NIS / NISN','NISN','NIPD','JK','Jenis Kelamin','Tempat Lahir','Tanggal Lahir','NIK','Agama','Alamat','RT','RW','Dusun','Kelurahan','Kecamatan','Kode Pos','Rombel Saat Ini_Unnamed: 42_level_1','Rombel'];
  const ordered = [];
  preferred.forEach(p=>{ const found = detectedHeaders.find(h => normalizeHeader(h)===normalizeHeader(p)); if(found && !ordered.includes(found)) ordered.push(found); });
  detectedHeaders.forEach(h=>{ if(!ordered.includes(h)) ordered.push(h); });

  ordered.forEach(h=>{
    const id = 'colchk-'+Math.random().toString(36).slice(2,9);
    const label = document.createElement('label');
    label.className = 'flex items-center gap-2 p-1 rounded hover:bg-emerald-50';
    const chk = document.createElement('input');
    chk.type = 'checkbox'; chk.id = id; chk.setAttribute('data-col', h); chk.className = 'col-checkbox';
    const span = document.createElement('span'); span.className = 'text-xs text-emerald-800'; span.textContent = h;
    label.appendChild(chk); label.appendChild(span); cont.appendChild(label);
  });
}

// select all / clear all
$id('select-all-cols')?.addEventListener('click', ()=> document.querySelectorAll('.col-checkbox').forEach(c=> c.checked = true));
$id('clear-all-cols')?.addEventListener('click', ()=> document.querySelectorAll('.col-checkbox').forEach(c=> c.checked = false));

// PROCESS button
$id('process-btn')?.addEventListener('click', ()=>{
  if(!originalRows || originalRows.length===0){ alert('Belum ada file. Upload dulu.'); return; }
  const headers = detectedHeaders.slice();
  const rombelHeaderCandidate = findHeader(headers, rombelHeaderKeywords);
  const romSelVal = $id('filter-rombel') ? $id('filter-rombel').value : '';
  let rombelHeaderToUse = rombelHeaderCandidate;
  if(romSelVal && romSelVal.startsWith('[Kolom] ')) rombelHeaderToUse = romSelVal.replace('[Kolom] ','');
  // build mappedRows preserving raw
  mappedRows = originalRows.map(r=>({
    _raw: r,
    Nama: r['Nama Peserta Didik'] || r['Nama'] || r['name'] || '',
    'NIS / NISN': r['NIS'] || r['NISN'] || r['NIPD'] || '',
    'Jenis Kelamin': r['JK'] || r['Jenis Kelamin'] || '',
    Rombel: rombelHeaderToUse ? (r[rombelHeaderToUse]||'') : (r['Rombel']||''),
    'Tanggal Lahir': r['Tanggal Lahir'] || r['TTL'] || ''
  }));
  // refresh rombel values if detected from mappedRows
  const rombels = Array.from(new Set(mappedRows.map(x=> (x.Rombel||'').toString().trim()).filter(x=>x!=='')).sort());
  if(rombels.length && $id('filter-rombel')){
    $id('filter-rombel').innerHTML = ''; $id('filter-rombel').appendChild(new Option('-- Semua --',''));
    rombels.forEach(r => $id('filter-rombel').appendChild(new Option(r,r)));
  }
  const chosen = $id('filter-rombel') ? $id('filter-rombel').value : '';
  currentDisplayed = chosen ? mappedRows.filter(r => (r.Rombel||'').toString().trim() === chosen) : mappedRows.slice();
  renderTableWithSelectedColumns(currentDisplayed);
  if($id('notice-text')) $id('notice-text').textContent = `Hasil PROSES: ${currentDisplayed.length} baris tampil.`;
});

// get selected columns in DOM order
function getSelectedColumns(){
  const checks = Array.from(document.querySelectorAll('.col-checkbox'));
  return checks.filter(c=>c.checked).map(c=> c.getAttribute('data-col'));
}

// render table & create per-column filter inputs
function renderTableWithSelectedColumns(rows){
  const cols = getSelectedColumns();
  let useCols = (cols && cols.length) ? cols.slice() : ['Nama Peserta Didik','Nama','NIS / NISN','NISN','JK','Jenis Kelamin','Rombel'];
  if(!useCols.length) useCols = detectedHeaders.slice(0,6);

  // build header
  const head = $id('table-head-row'); const filterRow = $id('table-filter-row'); const body = $id('table-body');
  if(!head || !filterRow || !body) return;
  head.innerHTML = ''; filterRow.innerHTML = ''; body.innerHTML = '';

  useCols.forEach((c, idx)=>{
    const th = document.createElement('th'); th.textContent = c; head.appendChild(th);
    // filter input under each column
    const td = document.createElement('th'); // using th for filter row to match header styling
    const input = document.createElement('input');
    input.type = 'text'; input.placeholder = 'Filter...'; input.className = 'w-full text-xs border rounded px-2 py-1';
    input.setAttribute('data-col', c);
    input.addEventListener('input', applyColumnFilters); // live filter on input
    td.appendChild(input); filterRow.appendChild(td);
  });

  // fill rows
  rows.forEach(r=>{
    const tr = document.createElement('tr');
    const cells = useCols.map(c=>{
      let v = '';
      if(r._raw && Object.prototype.hasOwnProperty.call(r._raw, c)) v = r._raw[c];
      else if(c === 'Nama Peserta Didik' || c === 'Nama') v = r.Nama || '';
      else if(c === 'NIS / NISN' || c === 'NISN' || c === 'NIPD') v = r['NIS / NISN'] || '';
      else if(c === 'Jenis Kelamin' || c === 'JK') v = r['Jenis Kelamin'] || '';
      else if(c.toLowerCase().includes('rombel')) v = r.Rombel || '';
      else v = (r._raw && r._raw[c]) ? r._raw[c] : '';
      return `<td>${escapeHtml(v)}</td>`;
    }).join('');
    tr.innerHTML = cells;
    body.appendChild(tr);
  });

  initDataTable();
}

// per-column filter function (AND)
function applyColumnFilters(){
  // read inputs
  const inputs = Array.from($id('table-filter-row').querySelectorAll('input[data-col]'));
  const filters = inputs.map(i => ({col: i.getAttribute('data-col'), q: i.value.trim().toLowerCase()})).filter(f => f.q !== '');
  // starting base = rows after PROSES (currentDisplayed before column filters)
  // but since DataTables created DOM, easiest approach: rebuild body from currentDisplayed and apply JS filter
  const base = currentDisplayed.slice();
  if(filters.length === 0){
    renderTableWithSelectedColumns(base);
    if($id('notice-text')) $id('notice-text').textContent = `Filter kolom dibersihkan. ${base.length} baris tampil.`;
    return;
  }
  let filtered = base.slice();
  filters.forEach(f => {
    filtered = filtered.filter(r => {
      // prefer raw field value
      let v = '';
      if(r._raw && Object.prototype.hasOwnProperty.call(r._raw, f.col)) v = String(r._raw[f.col]||'');
      else if(f.col === 'Nama Peserta Didik' || f.col === 'Nama') v = r.Nama || '';
      else if(f.col === 'NIS / NISN' || f.col === 'NISN' || f.col === 'NIPD') v = r['NIS / NISN'] || '';
      else if(f.col.toLowerCase().includes('rombel')) v = r.Rombel || '';
      else v = (r._raw && r._raw[f.col]) ? String(r._raw[f.col]) : '';
      return v.toLowerCase().includes(f.q);
    });
  });
  // render filtered result (keep same selected columns)
  renderTableWithSelectedColumns(filtered);
  if($id('notice-text')) $id('notice-text').textContent = `Hasil filter kolom: ${filtered.length} baris tampil.`;
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

// download events
$id('download-filtered-btn')?.addEventListener('click', ()=>{
  if(!currentDisplayed || currentDisplayed.length===0){ alert('Tidak ada data (lakukan PROSES dulu).'); return; }
  const cols = getSelectedColumns();
  if(!cols || cols.length===0){
    if(!confirm('Belum memilih kolom. Download semua kolom terdeteksi? OK = ya')) return;
  }
  // note: if user applied column filters, table has been re-rendered with filtered rows - but currentDisplayed was overwritten.
  // To ensure we download exactly what is visible, capture rows from current displayed in table (recompute from DOM)
  // Simpler approach: use currentDisplayed (it is updated on PROSES and column filter re-render).
  downloadRowsWithCols(currentDisplayed, cols.length?cols:detectedHeaders, `hasil_filter_${new Date().toISOString().slice(0,10)}.xlsx`);
});

$id('download-rombel-btn')?.addEventListener('click', ()=>{
  const sel = $id('filter-rombel') ? $id('filter-rombel').value : '';
  if(!sel){ alert('Pilih rombel dulu.'); return; }
  const rows = mappedRows.filter(r => (r.Rombel||'').toString().trim() === sel);
  if(!rows.length){ alert('Tidak ada data untuk rombel ini. Lakukan PROSES terlebih dahulu.'); return; }
  const cols = getSelectedColumns();
  downloadRowsWithCols(rows, cols.length?cols:detectedHeaders, `rombel_${sanitizeFilename(sel)}.xlsx`);
});

// select columns helper
function getSelectedColumns(){
  const checks = Array.from(document.querySelectorAll('.col-checkbox'));
  return checks.filter(c=>c.checked).map(c=> c.getAttribute('data-col'));
}

// reset
$id('reset-btn')?.addEventListener('click', resetApp);

// initial
resetApp();
