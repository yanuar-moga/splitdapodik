// script.js FINAL (versi stabil untuk Dapodik Mapper)
// Dependencies: XLSX (SheetJS), jQuery, DataTables

let originalRows = [];
let mappedRows = [];
let currentDisplayed = [];
let currentTable = null;
let detectedHeaders = [];

function $id(id){ return document.getElementById(id); }
function showLoading(flag){ const st=$id('load-status'); if(st) st.classList.toggle('hidden',!flag); }
function sanitizeFilename(s){ return String(s||'').replace(/[\/\\?%*:|"<>]/g,'_').replace(/\s+/g,'_').slice(0,120); }
function escapeHtml(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function resetApp(){
  originalRows = [];
  mappedRows = [];
  currentDisplayed = [];
  detectedHeaders = [];
  if(currentTable){ currentTable.destroy(); currentTable=null; }
  $id('filter-rombel').innerHTML = '(belum ada file)';
  $id('columns-container').innerHTML = '';
  $id('table-head-row').innerHTML = '';
  $id('table-body').innerHTML = '';
  $id('notice-text').textContent = 'Belum ada file di-upload.';
}

// Init DataTable
function initDataTable(){
  if(currentTable){ try{ currentTable.destroy(); }catch{} currentTable=null; }
  if(window.jQuery && $.fn.dataTable){
    currentTable = $('#students-table').DataTable({
      paging:true, searching:true, info:true, ordering:true, autoWidth:false, destroy:true
    });
  }
}

// ===== FILE UPLOAD =====
const fileInput = $id('file-input');
if(fileInput) fileInput.addEventListener('change', (evt)=>{
  const f = evt.target.files[0];
  if(!f) return;
  showLoading(true);
  const reader = new FileReader();
  reader.onload = (e)=>{
    try{
      const data = new Uint8Array(e.target.result);
      const wb = XLSX.read(data, { type:'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];

      // Baca sheet mentah dan ambil header di baris ke-5
      const sheetData = XLSX.utils.sheet_to_json(ws, { header:1, defval:'' });
      const headers = sheetData[4]; // baris ke-5 sebagai header
      const dataRows = sheetData.slice(5);

      // Gabungkan header dan data agar kolom AQ terbaca
      const json = dataRows.map(row=>{
        const obj = {};
        headers.forEach((h,i)=> obj[h || `Kolom_${i}`] = row[i]);
        return obj;
      });

      if(!json || json.length===0){
        alert('Sheet kosong atau header tidak ditemukan di baris ke-5!');
        showLoading(false);
        return;
      }

      originalRows = json.slice();
      detectedHeaders = Object.keys(json[0]);

      buildRombelSelectAndColumns();
      $id('notice-text').textContent = `File ter-load (${json.length} baris). Pilih rombel → PROSES.`;
    }catch(err){
      console.error(err);
      alert('Gagal membaca file: ' + err.message);
    }finally{ showLoading(false); }
  };
  reader.readAsArrayBuffer(f);
});

// ===== BUILD FILTER & CHECKBOX =====
function buildRombelSelectAndColumns(){
  const romSel = $id('filter-rombel');
  romSel.innerHTML = '';
  const optAll = document.createElement('option');
  optAll.value = '';
  optAll.textContent = '-- Semua --';
  romSel.appendChild(optAll);

  // Gunakan kolom AQ sebagai kolom rombel
  const rombelHeader = 'Rombel Saat Ini_Unnamed: 42_level_1';
  const rombels = Array.from(new Set(originalRows.map(r=> (r[rombelHeader]||'').toString().trim()).filter(x=>x!=='').sort()));
  rombels.forEach(r=>{
    const o=document.createElement('option');
    o.value=r;
    o.textContent=r;
    romSel.appendChild(o);
  });

  // Checkbox kolom
  const cont = $id('columns-container');
  cont.innerHTML = '';
  const preferred = ['Nama Peserta Didik','NISN','NIPD','JK','Tanggal Lahir','Alamat',rombelHeader];
  const ordered = [...new Set([...preferred, ...detectedHeaders])];
  ordered.forEach(h=>{
    const id = 'colchk-'+Math.random().toString(36).slice(2,9);
    const label = document.createElement('label');
    label.className = 'flex items-center gap-2 p-1 rounded hover:bg-slate-50';
    const chk = document.createElement('input');
    chk.type = 'checkbox';
    chk.id = id;
    chk.setAttribute('data-col', h);
    chk.className = 'col-checkbox';
    chk.checked = preferred.includes(h); // default aktif kolom penting
    const span = document.createElement('span');
    span.className = 'text-xs';
    span.textContent = h;
    label.appendChild(chk);
    label.appendChild(span);
    cont.appendChild(label);
  });
}

// Select/Deselect all
$id('select-all-cols').addEventListener('click', ()=> {
  document.querySelectorAll('.col-checkbox').forEach(c=> c.checked=true);
});
$id('clear-all-cols').addEventListener('click', ()=> {
  document.querySelectorAll('.col-checkbox').forEach(c=> c.checked=false);
});

// ===== PROSES BUTTON =====
$id('process-btn').addEventListener('click', ()=>{
  if(!originalRows.length){ alert('Belum ada file diupload.'); return; }

  const rombelHeader = 'Rombel Saat Ini_Unnamed: 42_level_1';
  const rombelDipilih = $id('filter-rombel').value;

  mappedRows = originalRows.map(r=>({
    _raw:r,
    Nama: r['Nama Peserta Didik'] || r['Nama'] || '',
    NISN: r['NISN'] || r['NIPD'] || '',
    JK: r['JK'] || r['Jenis Kelamin'] || '',
    Tanggal_Lahir: r['Tanggal Lahir'] || '',
    Alamat: r['Alamat'] || '',
    Rombel: r[rombelHeader] || ''
  }));

  currentDisplayed = rombelDipilih 
    ? mappedRows.filter(r=>r.Rombel===rombelDipilih)
    : mappedRows.slice();

  renderTableWithSelectedColumns(currentDisplayed);
  $id('notice-text').textContent = `Menampilkan ${currentDisplayed.length} baris data.`;
});

// ===== RENDER TABLE =====
function getSelectedColumns(){
  return Array.from(document.querySelectorAll('.col-checkbox'))
    .filter(c=>c.checked)
    .map(c=>c.getAttribute('data-col'));
}

function renderTableWithSelectedColumns(rows){
  const cols = getSelectedColumns();
  const contHead = $id('table-head-row');
  const contBody = $id('table-body');
  contHead.innerHTML = '';
  contBody.innerHTML = '';

  if(!cols.length){
    contHead.innerHTML = '<th>Nama</th><th>NISN</th><th>JK</th><th>Rombel</th>';
    rows.forEach(r=>{
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${escapeHtml(r.Nama)}</td><td>${escapeHtml(r.NISN)}</td><td>${escapeHtml(r.JK)}</td><td>${escapeHtml(r.Rombel)}</td>`;
      contBody.appendChild(tr);
    });
  } else {
    cols.forEach(c=>{ const th=document.createElement('th'); th.textContent=c; contHead.appendChild(th); });
    rows.forEach(r=>{
      const tr=document.createElement('tr');
      const cells = cols.map(c=> `<td>${escapeHtml(r._raw[c]||'')}</td>`).join('');
      tr.innerHTML=cells;
      contBody.appendChild(tr);
    });
  }

  initDataTable();
}

// ===== DOWNLOAD =====
function downloadRowsWithCols(rows, cols, filename){
  if(!cols.length) cols = detectedHeaders;
  const wsData = rows.map(r=>{
    const obj={};
    cols.forEach(c=> obj[c]=r._raw[c]||'');
    return obj;
  });
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(wsData);
  XLSX.utils.book_append_sheet(wb, ws, 'Data');
  XLSX.writeFile(wb, filename);
}

$id('download-filtered-btn').addEventListener('click', ()=>{
  if(!currentDisplayed.length){ alert('Tidak ada data untuk didownload.'); return; }
  const cols = getSelectedColumns();
  downloadRowsWithCols(currentDisplayed, cols, `hasil_filter_${new Date().toISOString().slice(0,10)}.xlsx`);
});

$id('download-rombel-btn').addEventListener('click', ()=>{
  const sel = $id('filter-rombel').value;
  if(!sel){ alert('Pilih rombel dulu.'); return; }
  const rows = mappedRows.filter(r=>r.Rombel===sel);
  if(!rows.length){ alert('Tidak ada data untuk rombel ini.'); return; }
  const cols = getSelectedColumns();
  downloadRowsWithCols(rows, cols, `rombel_${sanitizeFilename(sel)}.xlsx`);
});

// ===== RESET =====
$id('reset-btn').addEventListener('click', resetApp);

// Initial reset
resetApp();
