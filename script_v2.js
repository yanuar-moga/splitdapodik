// script_v2.js - handles loading Excel/CSV with header row selection, rendering, filtering, sorting, exporting
let rawData = [];
let selectedCols = [];
let filteredData = [];
let currentSort = {col: null, asc: true};

function setStatus(msg){ document.getElementById('status').textContent = msg; }

async function loadDefault(){
  try{
    const res = await fetch('data.json');
    rawData = await res.json();
    if(rawData.length) populateColumnCheckboxes(Object.keys(rawData[0]));
    setStatus(rawData.length + ' baris dimuat (default).');
  }catch(e){
    console.warn('No default data.json found.');
    setStatus('Belum ada data default. Silakan upload file.');
  }
}

function populateColumnCheckboxes(cols){
  const container = document.getElementById('columnsCheckboxes');
  container.innerHTML = '';
  cols.forEach((c, idx) => {
    const id = 'col_'+idx;
    const div = document.createElement('div');
    div.className = 'form-check';
    div.innerHTML = `<input class="form-check-input col-check" type="checkbox" value="${c}" id="${id}" ${idx<3? 'checked' : ''}>
                     <label class="form-check-label" for="${id}">${c}</label>`;
    container.appendChild(div);
  });
  // show number of columns loaded
  setStatus('Kolom tersedia: ' + cols.length);
}

// File load handling
document.getElementById('loadFileBtn').addEventListener('click', () => {
  const f = document.getElementById('fileInput').files[0];
  if(!f){ alert('Pilih file terlebih dahulu.'); return; }
  const headerRowInput = parseInt(document.getElementById('headerRow').value || '1', 10);
  const fname = f.name.toLowerCase();
  if(fname.endsWith('.csv')){
    const reader = new FileReader();
    reader.onload = function(e){
      const text = e.target.result;
      const parsed = Papa.parse(text, {skipEmptyLines:true});
      handleParsedArray(parsed.data, headerRowInput);
    };
    reader.readAsText(f, 'utf-8');
  } else if(fname.endsWith('.xls') || fname.endsWith('.xlsx')){
    const reader = new FileReader();
    reader.onload = function(e){
      const data = new Uint8Array(e.target.result);
      const wb = XLSX.read(data, {type:'array'});
      const firstSheetName = wb.SheetNames[0];
      const ws = wb.Sheets[firstSheetName];
      // convert to array of arrays
      const aoa = XLSX.utils.sheet_to_json(ws, {header:1, raw:false, defval:''});
      handleParsedArray(aoa, headerRowInput);
    };
    reader.readAsArrayBuffer(f);
  } else {
    alert('Format file tidak didukung. Pilih .xlsx, .xls atau .csv');
  }
});

function handleParsedArray(aoa, headerRow){
  // aoa: array of arrays (rows)
  // headerRow: 1-based index of row that contains headers
  const hrIndex = Math.max(1, headerRow) - 1;
  if(hrIndex >= aoa.length){ alert('Nomor baris header melebihi jumlah baris.'); return; }
  const headers = aoa[hrIndex].map(h => String(h).trim());
  // build records from rows after header row
  const records = [];
  for(let i = hrIndex+1; i < aoa.length; i++){
    const row = aoa[i];
    // skip fully empty rows
    const allEmpty = row.every(cell => (cell === null || cell === undefined || String(cell).trim()===''));
    if(allEmpty) continue;
    const obj = {};
    for(let c=0;c<headers.length;c++){
      obj[headers[c] || ('col'+c)] = row[c] === undefined ? '' : row[c];
    }
    records.push(obj);
  }
  rawData = records;
  if(rawData.length === 0){ alert('Tidak ada data setelah baris header.'); return; }
  populateColumnCheckboxes(Object.keys(rawData[0]));
  setStatus('File dimuat: ' + rawData.length + ' baris. Header di baris ke-' + (hrIndex+1));
  // auto select first few cols
  selectedCols = Object.keys(rawData[0]).slice(0,3);
  applyFilterAndRender();
}

// Process button
document.getElementById('processBtn').addEventListener('click', () => {
  const checks = Array.from(document.querySelectorAll('.col-check:checked')).map(i=>i.value);
  if(checks.length === 0){
    alert('Pilih minimal 1 kolom.');
    return;
  }
  selectedCols = checks;
  applyFilterAndRender();
  toggleToolbar();
});

document.getElementById('resetBtn').addEventListener('click', () => {
  Array.from(document.querySelectorAll('.col-check')).forEach(ch => ch.checked = false);
  document.getElementById('resultHead').innerHTML = '';
  document.getElementById('resultBody').innerHTML = '';
  document.getElementById('status').textContent = '';
  document.getElementById('toolbar').style.display = 'none';
  document.getElementById('downloadFilteredBtn').style.display = 'none';
});

// Search columns helper
document.getElementById('searchCols').addEventListener('input', (e) => {
  const q = e.target.value.toLowerCase();
  Array.from(document.querySelectorAll('#columnsCheckboxes .form-check')).forEach(div => {
    const lbl = div.innerText.toLowerCase();
    div.style.display = lbl.includes(q) ? '' : 'none';
  });
});

// toolbar controls / global search
function toggleToolbar(){
  const enabled = document.getElementById('enableSearch').checked;
  document.getElementById('toolbar').style.display = enabled ? '' : 'none';
  document.getElementById('downloadFilteredBtn').style.display = document.getElementById('enableExport').checked ? '' : 'none';
}

// apply filter & render
function applyFilterAndRender(){
  // build filteredData with only selectedCols
  filteredData = rawData.map(row => {
    const out = {};
    selectedCols.forEach(c => out[c] = row[c] ?? '');
    return out;
  });
  renderTable(filteredData);
  document.getElementById('status').textContent = 'Menampilkan ' + filteredData.length + ' baris — kolom: ' + selectedCols.join(', ');
  // Prepare download link
  prepareDownload(filteredData);
}

function renderTable(data){
  const thead = document.getElementById('resultHead');
  const tbody = document.getElementById('resultBody');
  thead.innerHTML = '';
  tbody.innerHTML = '';

  // header
  const tr = document.createElement('tr');
  selectedCols.forEach(c => {
    const th = document.createElement('th');
    th.textContent = c;
    th.style.cursor = 'pointer';
    th.addEventListener('click', () => {
      if(!document.getElementById('enableSort').checked) return;
      sortByColumn(c);
    });
    tr.appendChild(th);
  });
  thead.appendChild(tr);

  // body (show max 5000 rows for performance)
  const maxRows = 5000;
  const len = Math.min(data.length, maxRows);
  for(let i=0;i<len;i++){
    const r = data[i];
    const trb = document.createElement('tr');
    selectedCols.forEach(c => {
      const td = document.createElement('td');
      td.textContent = r[c] ?? '';
      trb.appendChild(td);
    });
    tbody.appendChild(trb);
  }
}

function sortByColumn(col){
  if(currentSort.col === col) currentSort.asc = !currentSort.asc;
  else { currentSort.col = col; currentSort.asc = true; }
  filteredData.sort((a,b) => {
    const va = (a[col] ?? '').toString();
    const vb = (b[col] ?? '').toString();
    return currentSort.asc ? va.localeCompare(vb, undefined, {numeric:true}) : vb.localeCompare(va, undefined, {numeric:true});
  });
  renderTable(filteredData);
}

function prepareDownload(data){
  const csv = toCSV(data);
  const blob = new Blob([csv], {type: 'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const btn = document.getElementById('downloadFilteredBtn');
  btn.href = url;
  btn.download = 'filtered_data.csv';
  btn.style.display = document.getElementById('enableExport').checked ? '' : 'none';
}

// convert JSON array to CSV
function toCSV(arr){
  if(!arr || arr.length===0) return '';
  const cols = Object.keys(arr[0]);
  const lines = [];
  lines.push(cols.map(c => '"' + c.replace(/"/g,'""') + '"').join(','));
  arr.forEach(r => {
    lines.push(cols.map(c => '"' + String(r[c] ?? '').replace(/"/g,'""') + '"').join(','));
  });
  return lines.join('\n');
}

// global search
document.getElementById('globalSearch').addEventListener('input', (e) => {
  const q = e.target.value.toLowerCase();
  if(q === '') { renderTable(filteredData); return; }
  const subset = filteredData.filter(r => {
    return Object.values(r).some(v => String(v).toLowerCase().includes(q));
  });
  renderTable(subset);
});

document.getElementById('clearSearch').addEventListener('click', () => {
  document.getElementById('globalSearch').value = '';
  renderTable(filteredData);
});

// initial load
loadDefault();
