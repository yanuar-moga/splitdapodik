// script.js - Dapodik Mapper (PROSES manual)
// Dependensi: xlsx.full.min.js, jQuery, DataTables

let originalRows = [];   // raw rows read from sheet (objects)
let mappedRows = [];     // mapped to our fields (Nama, NIS_NISN, ...)
let currentDisplayed = []; // last output after PROSES (filtered)
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

function normalizeHeader(h) {
  return String(h || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function findHeaderByKeywords(headers, keywords) {
  const kws = keywords.map(k => k.toLowerCase());
  // exact
  for (let k of kws) {
    for (let h of headers) if (normalizeHeader(h) === k) return h;
  }
  // contains
  for (let k of kws) {
    for (let h of headers) if (normalizeHeader(h).includes(k)) return h;
  }
  // fuzzy (remove punctuation)
  for (let k of kws) {
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
  originalRows = [];
  mappedRows = [];
  currentDisplayed = [];
  detectedHeaders = [];
  if (currentTable) { currentTable.destroy(); currentTable = null; }
  document.getElementById('rombel-col-select').innerHTML = '<option>(belum ada file)</option>';
  document.getElementById('kelas-col-select').innerHTML = '<option>(belum ada file)</option>';
  document.getElementById('filter-rombel').innerHTML = '<option>(belum ada file)</option>';
  document.getElementById('filter-kelas').innerHTML = '<option>(belum ada file)</option>';
  document.getElementById('table-head-row').innerHTML = '';
  document.getElementById('table-body').innerHTML = '';
  document.getElementById('notice-text').textContent = 'Belum ada file di-upload.';
}

function initDataTable() {
  if (currentTable) { currentTable.destroy(); currentTable = null; }
  currentTable = $('#students-table').DataTable({
    paging: true,
    searching: true,
    info: true,
    ordering: true,
    autoWidth: false,
    columnDefs: [{ targets: '_all', className: 'dt-left' }],
    destroy: true
  });
}

// file input handling
document.getElementById('file-input').addEventListener('change', (evt) => {
  const f = evt.target.files[0];
  if (!f) return;
  showLoading(true);
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      // IMPORTANT: start reading from row-5 (skip 4 rows) so header is at row 5
      const json = XLSX.utils.sheet_to_json(worksheet, { defval: '', range: 4 });
      if (!json || json.length === 0) {
        alert('Sheet kosong atau tidak terbaca. Pastikan header tabel berada pada baris ke-5.');
        showLoading(false);
        return;
      }
      originalRows = json.slice(); // keep original
      detectedHeaders = Object.keys(json[0]);
      buildHeaderSelectors(detectedHeaders);
      document.getElementById('notice-text').textContent = `File ter-load (${json.length} baris). Pilih rombel/kelas → klik PROSES.`;
    } catch (err) {
      console.error(err);
      alert('Gagal membaca file: ' + err.message);
    } finally {
      showLoading(false);
    }
  };
  reader.readAsArrayBuffer(f);
});

function buildHeaderSelectors(headers) {
  const rombelSelect = document.getElementById('rombel-col-select');
  const kelasSelect = document.getElementById('kelas-col-select');
  rombelSelect.innerHTML = '';
  kelasSelect.innerHTML = '';

  headers.forEach(h => {
    const o1 = document.createElement('option'); o1.value = h; o1.textContent = h;
    rombelSelect.appendChild(o1);
    const o2 = document.createElement('option'); o2.value = h; o2.textContent = h;
    kelasSelect.appendChild(o2);
  });

  // auto-select best candidate
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

// map a row using header map
function mapRow(row, headerMap) {
  return {
    Nama: row[headerMap.name] || '',
    'NIS / NISN': row[headerMap.nis] || '',
    'Jenis Kelamin': row[headerMap.gender] || '',
    Rombel: row[headerMap.rombel] || '',
    Kelas: row[headerMap.kelas] || '',
    'Tanggal Lahir': row[headerMap.birth] || '',
    Alamat: row[headerMap.alamat] || '',
    _raw: row
  };
}

// PROCESS button: map rows and apply filter selections, then render table
document.getElementById('process-btn').addEventListener('click', () => {
  if (!originalRows || originalRows.length === 0) { alert('Belum ada file. Silakan upload Excel dulu.'); return; }

  // build header map (respect manual selects)
  const headers = detectedHeaders.slice();
  const headerMap = {};
  requiredKeys.forEach(req => {
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
    headerMap[req.key] = findHeaderByKeywords(headers, req.keywords);
  });

  // map all originalRows
  mappedRows = originalRows.map(r => mapRow(r, headerMap));

  // build rombel & kelas lists
  const rombels = Array.from(new Set(mappedRows.map(r => (r.Rombel||'').toString().trim()).filter(x => x !== ''))).sort();
  const kelases = Array.from(new Set(mappedRows.map(r => (r.Kelas||'').toString().trim()).filter(x => x !== ''))).sort();

  populateSelect(document.getElementById('filter-rombel'), rombels, true);
  populateSelect(document.getElementById('filter-kelas'), kelases, true);

  // apply current selected filters (if any)
  const rombelSel = document.getElementById('filter-rombel').value;
  const kelasSel = document.getElementById('filter-kelas').value;
  const filtered = mappedRows.filter(r => {
    if (rombelSel && (r.Rombel||'').toString().trim() !== rombelSel) return false;
    if (kelasSel && (r.Kelas||'').toString().trim() !== kelasSel) return false;
    return true;
  });

  currentDisplayed = filtered;
  renderTable(currentDisplayed);
  document.getElementById('notice-text').textContent = `Hasil PROSES: ${currentDisplayed.length} baris tampil.`;
});

// render table helper
function renderTable(rows) {
  // table header
  const headers = ['Nama', 'NIS / NISN', 'Jenis Kelamin', 'Rombel', 'Kelas', 'Tanggal Lahir', 'Alamat'];
  const headRow = document.getElementById('table-head-row');
  headRow.innerHTML = '';
  headers.forEach(h => {
    const th = document.createElement('th');
    th.textContent = h;
    headRow.appendChild(th);
  });

  const tbody = document.getElementById('table-body');
  tbody.innerHTML = '';
  rows.forEach(r => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(r.Nama)}</td>
      <td>${escapeHtml(r['NIS / NISN'])}</td>
      <td>${escapeHtml(r['Jenis Kelamin'])}</td>
      <td>${escapeHtml(r.Rombel)}</td>
      <td>${escapeHtml(r.Kelas)}</td>
      <td>${escapeHtml(r['Tanggal Lahir'])}</td>
      <td>${escapeHtml(r.Alamat)}</td>
    `;
    tbody.appendChild(tr);
  });

  initDataTable();
}

function escapeHtml(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// download behavior - uses currentDisplayed if available; otherwise confirm
document.getElementById('download-rombel-btn').addEventListener('click', () => {
  const rombelSel = document.getElementById('filter-rombel').value;
  if (!originalRows || originalRows.length === 0) { alert('Belum ada file.'); return; }
  if (currentDisplayed && currentDisplayed.length > 0 && rombelSel) {
    downloadFromRows(currentDisplayed, `rombel_${sanitizeFilename(rombelSel)}.xlsx`);
    return;
  }
  if (!rombelSel) {
    if (!confirm('Belum memilih rombel. Generate file terpisah untuk setiap rombel? OK = ya')) return;
    generateGrouped('Rombel');
    return;
  }
  const arr = (mappedRows && mappedRows.length) ? mappedRows.filter(r => (r.Rombel||'').toString().trim() === rombelSel) : [];
  if (arr.length) downloadFromRows(arr, `rombel_${sanitizeFilename(rombelSel)}.xlsx`);
  else alert('Tidak ada data untuk rombel terpilih. Lakukan PROSES terlebih dahulu.');
});

document.getElementById('download-kelas-btn').addEventListener('click', () => {
  const kelasSel = document.getElementById('filter-kelas').value;
  if (!originalRows || originalRows.length === 0) { alert('Belum ada file.'); return; }
  if (currentDisplayed && currentDisplayed.length > 0 && kelasSel) {
    downloadFromRows(currentDisplayed, `kelas_${sanitizeFilename(kelasSel)}.xlsx`);
    return;
  }
  if (!kelasSel) {
    if (!confirm('Belum memilih kelas. Generate file terpisah untuk setiap kelas? OK = ya')) return;
    generateGrouped('Kelas');
    return;
  }
  const arr = (mappedRows && mappedRows.length) ? mappedRows.filter(r => (r.Kelas||'').toString().trim() === kelasSel) : [];
  if (arr.length) downloadFromRows(arr, `kelas_${sanitizeFilename(kelasSel)}.xlsx`);
  else alert('Tidak ada data untuk kelas terpilih. Lakukan PROSES terlebih dahulu.');
});

function downloadFromRows(rows, filename) {
  if (!rows || rows.length === 0) { alert('Data kosong.'); return; }
  const wsData = rows.map(r => ({
    'Nama Peserta Didik': r.Nama,
    'NIS / NISN': r['NIS / NISN'],
    'Jenis Kelamin': r['Jenis Kelamin'],
    'Rombel': r.Rombel,
    'Kelas': r.Kelas,
    'Tanggal Lahir': r['Tanggal Lahir'],
    'Alamat': r.Alamat
  }));
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(wsData);
  XLSX.utils.book_append_sheet(wb, ws, 'Data');
  XLSX.writeFile(wb, filen
