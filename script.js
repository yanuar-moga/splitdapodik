// script.js
// Dapodik Mapper - client-side
// Requirements: xlsx.full.min.js, jQuery, DataTables

let rawData = []; // array of objects from sheet
let currentTable = null;
let detectedHeaders = [];

const requiredKeys = [
  { key: 'name', keywords: ['nama peserta didik', 'nama', 'nama lengkap'] },
  { key: 'nis', keywords: ['nis', 'nisn', 'nis / nisn', 'nis_nisn'] },
  { key: 'gender', keywords: ['jenis kelamin', 'jk', 'gender'] },
  { key: 'rombel', keywords: ['rombel saat ini_unnamed: 42_level_1', 'rombel saat ini', 'rombel', 'romongan belajar'] },
  { key: 'kelas', keywords: ['kelas', 'tingkat'] },
  { key: 'birth', keywords: ['tanggal lahir', 'ttl', 't_lahir'] },
  { key: 'alamat', keywords: ['alamat', 'alamat lengkap'] },
];

// helpers
function normalizeHeader(h) {
  return String(h || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function findHeaderByKeywords(headers, keywords) {
  keywords = keywords.map(k => k.toLowerCase());
  // 1) exact match attempts
  for (let k of keywords) {
    for (let h of headers) {
      if (normalizeHeader(h) === k) return h;
    }
  }
  // 2) contains match
  for (let k of keywords) {
    for (let h of headers) {
      if (normalizeHeader(h).includes(k)) return h;
    }
  }
  // 3) fuzzy: allow removing punctuation
  for (let k of keywords) {
    for (let h of headers) {
      if (normalizeHeader(h).replace(/[^a-z0-9]/g,'').includes(k.replace(/[^a-z0-9]/g,''))) return h;
    }
  }
  return null;
}

function populateSelect(selectEl, options, includeAll = true) {
  selectEl.innerHTML = '';
  if (includeAll) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = '-- Semua --';
    selectEl.appendChild(opt);
  }
  options.forEach(o => {
    const opt = document.createElement('option');
    opt.value = o;
    opt.textContent = o;
    selectEl.appendChild(opt);
  });
}

function resetApp() {
  rawData = [];
  detectedHeaders = [];
  if (currentTable) {
    currentTable.destroy();
    currentTable = null;
  }
  document.getElementById('rombel-col-select').innerHTML = '';
  document.getElementById('kelas-col-select').innerHTML = '';
  document.getElementById('filter-rombel').innerHTML = '';
  document.getElementById('filter-kelas').innerHTML = '';
  document.getElementById('table-head-row').innerHTML = '';
  document.getElementById('table-body').innerHTML = '';
}

function initDataTable() {
  // destroy if exists
  if (currentTable) {
    currentTable.destroy();
    currentTable = null;
  }
  // initialize DataTable
  currentTable = $('#students-table').DataTable({
    paging: true,
    searching: true,
    info: true,
    ordering: true,
    autoWidth: false,
    columnDefs: [{ targets: '_all', className: 'dt-left' }],
    // keep existing DOM table data
  });
}

// read file
document.getElementById('file-input').addEventListener('change', (evt) => {
  const f = evt.target.files[0];
  if (!f) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const data = new Uint8Array(e.target.result);
    const workbook = XLSX.read(data, { type: 'array' });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    const json = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
    if (!json || json.length === 0) {
      alert('Sheet kosong atau tidak terbaca.');
      return;
    }
    rawData = json;
    detectedHeaders = Object.keys(json[0]);
    buildHeaderSelectors(detectedHeaders);
    processAndRender();
  };
  reader.readAsArrayBuffer(f);
});

function buildHeaderSelectors(headers) {
  // fill rombel select choices with headers (for manual override)
  const rombelSelect = document.getElementById('rombel-col-select');
  const kelasSelect = document.getElementById('kelas-col-select');
  rombelSelect.innerHTML = '';
  kelasSelect.innerHTML = '';

  headers.forEach(h => {
    const o1 = document.createElement('option');
    o1.value = h; o1.textContent = h;
    rombelSelect.appendChild(o1);
    const o2 = document.createElement('option');
    o2.value = h; o2.textContent = h;
    kelasSelect.appendChild(o2);
  });

  // auto-select detected best candidates
  requiredKeys.forEach(req => {
    if (req.key === 'rombel') {
      const found = findHeaderByKeywords(headers, req.keywords);
      if (found) rombelSelect.value = found;
    }
    if (req.key === 'kelas') {
      const found = findHeaderByKeywords(headers, req.keywords);
      if (found) kelasSelect.value = found;
    }
  });
}

document.getElementById('rombel-col-select').addEventListener('change', processAndRender);
document.getElementById('kelas-col-select').addEventListener('change', processAndRender);
document.getElementById('reset-btn').addEventListener('click', resetApp);

function mapRowToModel(row, headerMap) {
  return {
    Nama: row[headerMap.name] || '',
    NIS_NISN: row[headerMap.nis] || '',
    Jenis_Kelamin: row[headerMap.gender] || '',
    Rombel: row[headerMap.rombel] || '',
    Kelas: row[headerMap.kelas] || '',
    Tanggal_Lahir: row[headerMap.birth] || '',
    Alamat: row[headerMap.alamat] || '',
    // include raw for export if needed
    _raw: row
  };
}

function processAndRender() {
  if (!rawData || rawData.length === 0) return;

  const headers = detectedHeaders.slice();
  // determine header mapping
  const headerMap = {};
  requiredKeys.forEach(req => {
    // if user selected manual override for rombel/kelas
    if (req.key === 'rombel') {
      const sel = document.getElementById('rombel-col-select').value;
      headerMap.rombel = sel || findHeaderByKeywords(headers, req.keywords);
      return;
    }
    if (req.key === 'kelas') {
      const sel = document.getElementById('kelas-col-select').value;
      headerMap.kelas = sel || findHeaderByKeywords(headers, req.keywords);
      return;
    }
    const found = findHeaderByKeywords(headers, req.keywords);
    headerMap[req.key] = found;
  });

  // check required mapped minimal columns
  if (!headerMap.name || !headerMap.rombel) {
    // still allow but warn
    console.warn('Kolom Nama atau Rombel tidak terdeteksi otomatis. Silakan pilih manual di dropdown.');
    // continue
  }

  // map all rows
  const mapped = rawData.map(r => mapRowToModel(r, headerMap));
  // store
  rawData = mapped;

  // build rombel & kelas lists
  const rombels = Array.from(new Set(mapped.map(r => (r.Rombel||'').toString().trim()).filter(x => x !== ''))).sort();
  const kelases = Array.from(new Set(mapped.map(r => (r.Kelas||'').toString().trim()).filter(x => x !== ''))).sort();

  populateSelect(document.getElementById('filter-rombel'), rombels, true);
  populateSelect(document.getElementById('filter-kelas'), kelases, true);

  // render full table initially
  renderTable(mapped);
}

function renderTable(dataRows) {
  // build header row
  const headers = ['Nama', 'NIS/NISN', 'Jenis Kelamin', 'Rombel', 'Kelas', 'Tanggal Lahir', 'Alamat'];
  const headRow = document.getElementById('table-head-row');
  headRow.innerHTML = '';
  headers.forEach(h => {
    const th = document.createElement('th');
    th.textContent = h;
    headRow.appendChild(th);
  });

  const tbody = document.getElementById('table-body');
  tbody.innerHTML = '';
  dataRows.forEach(r => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(r.Nama)}</td>
      <td>${escapeHtml(r.NIS_NISN)}</td>
      <td>${escapeHtml(r.Jenis_Kelamin)}</td>
      <td>${escapeHtml(r.Rombel)}</td>
      <td>${escapeHtml(r.Kelas)}</td>
      <td>${escapeHtml(r.Tanggal_Lahir)}</td>
      <td>${escapeHtml(r.Alamat)}</td>
    `;
    tbody.appendChild(tr);
  });

  initDataTable();
}

function escapeHtml(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// filter events
document.getElementById('filter-rombel').addEventListener('change', () => {
  const v = document.getElementById('filter-rombel').value;
  filterAndShow();
});
document.getElementById('filter-kelas').addEventListener('change', () => {
  filterAndShow();
});

function filterAndShow() {
  const rombel = document.getElementById('filter-rombel').value;
  const kelas = document.getElementById('filter-kelas').value;
  const filtered = rawData.filter(r => {
    if (rombel && (r.Rombel || '').toString().trim() !== rombel) return false;
    if (kelas && (r.Kelas || '').toString().trim() !== kelas) return false;
    return true;
  });
  renderTable(filtered);
}

// download per rombel/kelas
document.getElementById('download-rombel-btn').addEventListener('click', () => {
  const rombel = document.getElementById('filter-rombel').value;
  if (!rombel) {
    // ask user to choose or download all grouped
    if (!confirm('Belum memilih rombel. Ingin men-generate file Excel terpisah untuk setiap rombel? (OK = ya, Cancel = batal)')) return;
    downloadGroupedBy('Rombel');
  } else {
    downloadFilteredAsExcel(r => (r.Rombel||'').toString().trim() === rombel, `rombel_${sanitizeFilename(rombel)}.xlsx`);
  }
});

document.getElementById('download-kelas-btn').addEventListener('click', () => {
  const kelas = document.getElementById('filter-kelas').value;
  if (!kelas) {
    if (!confirm('Belum memilih kelas. Ingin men-generate file Excel terpisah untuk setiap kelas? (OK = ya, Cancel = batal)')) return;
    downloadGroupedBy('Kelas');
  } else {
    downloadFilteredAsExcel(r => (r.Kelas||'').toString().trim() === kelas, `kelas_${sanitizeFilename(kelas)}.xlsx`);
  }
});

function downloadFilteredAsExcel(filterFn, filename) {
  const rows = rawData.filter(filterFn);
  if (!rows.length) { alert('Data kosong untuk kriteria ini.'); return; }
  // prepare worksheet data: array of objects with header names
  const wsData = rows.map(r => ({
    'Nama Peserta Didik': r.Nama,
    'NIS / NISN': r.NIS_NISN,
    'Jenis Kelamin': r.Jenis_Kelamin,
    'Rombel': r.Rombel,
    'Kelas': r.Kelas,
    'Tanggal Lahir': r.Tanggal_Lahir,
    'Alamat': r.Alamat
  }));
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(wsData);
  XLSX.utils.book_append_sheet(wb, ws, 'Data');
  XLSX.writeFile(wb, filename);
}

function downloadGroupedBy(field) {
  // group into multiple workbooks separated by field value, pack as multiple downloads one-by-one
  const groups = {};
  rawData.forEach(r => {
    const k = (r[field] || '').toString().trim() || '(kosong)';
    if (!groups[k]) groups[k] = [];
    groups[k].push(r);
  });
  // iterate and trigger download for each
  for (const [k, arr] of Object.entries(groups)) {
    const fname = `${field.toLowerCase()}_${sanitizeFilename(k)}.xlsx`;
    const wsData = arr.map(r => ({
      'Nama Peserta Didik': r.Nama,
      'NIS / NISN': r.NIS_NISN,
      'Jenis Kelamin': r.Jenis_Kelamin,
      'Rombel': r.Rombel,
      'Kelas': r.Kelas,
      'Tanggal Lahir': r.Tanggal_Lahir,
      'Alamat': r.Alamat
    }));
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, 'Data');
    XLSX.writeFile(wb, fname);
  }
  alert(`Selesai men-generate ${Object.keys(groups).length} file (satu per ${field.toLowerCase()}).`);
}

function sanitizeFilename(s) {
  return s.replace(/[\/\\?%*:|"<>]/g, '_').replace(/\s+/g,'_').slice(0,120);
}

// basic init
(function init(){
  // set placeholder select states
  document.getElementById('rombel-col-select').innerHTML = '<option value="">(belum ada file)</option>';
  document.getElementById('kelas-col-select').innerHTML = '<option value="">(belum ada file)</option>';
})();
