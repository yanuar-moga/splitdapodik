// script_v3.js - header fixed at row 6 mapping applied, export to .xlsx (SheetJS)
const HEADER_ROW_INDEX = 5; // zero-based index => row 6
const MAPPING = {"A": "No", "B": "Nama", "C": "NIPD", "D": "JK", "E": "NISN", "F": "Tempat Lahir", "G": "Tanggal Lahir", "H": "NIK", "I": "Agama", "J": "Alamat", "K": "RT", "L": "RW", "M": "Dusun", "N": "Kelurahan", "O": "Kecamatan", "P": "Kodepos", "Q": "Jenis Tinggal", "R": "Alat Transportasi", "S": "Telepon", "T": "HP", "U": "Email", "V": "SKHUN", "W": "Penerima KPS", "X": "No KPS"};

let rawData = [];
let selectedCols = [];
let filteredData = [];
let currentSort = {col: null, asc: true};

function setStatus(msg){ document.getElementById('status').textContent = msg; }

function mapHeaders(rawHeaders){
  // replace Unnamed or empty with mapping based on position (A,B,C...)
  const result = [];
  for(let i=0;i<rawHeaders.length;i++){
    let h = rawHeaders[i] ? String(rawHeaders[i]).trim() : '';
    if(h === '' || h.toLowerCase().startsWith('unnamed')){
      // map using alphabet position
      const letter = String.fromCharCode(65 + i); // 0->A
      h = MAPPING[letter] || ('Col_'+(i+1));
    }
    result.push(h);
  }
  return result;
}

function populateColumnCheckboxes(cols){
  const container = document.getElementById('columnsCheckboxes');
  container.innerHTML = '';
  cols.forEach((c, idx) => {
    const id = 'col_'+idx;
    const div = document.createElement('div');
    div.className = 'form-check';
    div.innerHTML = '<input class="form-check-input col-check" type="checkbox" value="'+c+'" id="'+id+'" '+(idx<3? 'checked' : '')+'>\
                     <label class="form-check-label" for="'+id+'">'+c+'</label>';
    container.appendChild(div);
  });
  setStatus('Kolom tersedia: ' + cols.length);
}

// handlers
document.getElementById('loadFileBtn').addEventListener('click', () => {
  const f = document.getElementById('fileInput').files[0];
  if(!f){ alert('Pilih file terlebih dahulu.'); return; }
  const fname = f.name.toLowerCase();
  if(fname.endsWith('.csv')){
    const reader = new FileReader();
    reader.onload = function(e){
      const text = e.target.result;
      const parsed = Papa.parse(text, {skipEmptyLines:true});
      handleParsedArray(parsed.data);
    };
    reader.readAsText(f, 'utf-8');
  } else if(fname.endsWith('.xls') || fname.endsWith('.xlsx')){
    const reader = new FileReader();
    reader.onload = function(e){
      const data = new Uint8Array(e.target.result);
      const wb = XLSX.read(data, {type:'array'});
      const firstSheetName = wb.SheetNames[0];
      const ws = wb.Sheets[firstSheetName];
      const aoa = XLSX.utils.sheet_to_json(ws, {header:1, raw:false, defval:''});
      handleParsedArray(aoa);
    };
    reader.readAsArrayBuffer(f);
  } else {
    alert('Format file tidak didukung. Pilih .xlsx, .xls atau .csv');
  }
});

function handleParsedArray(aoa){
  // header row fixed at index HEADER_ROW_INDEX (0-based)
  if(HEADER_ROW_INDEX >= aoa.length){ alert('File terlalu pendek, tidak menemukan baris header ke-6.'); return; }
  const rawHeaders = aoa[HEADER_ROW_INDEX].map(h => h===null||h===undefined? '' : h);
  const headers = mapHeaders(rawHeaders);
  const records = [];
  for(let i = HEADER_ROW_INDEX+1; i < aoa.length; i++){
    const row = aoa[i];
    const allEmpty = row.every(cell => (cell === null || cell === undefined || String(cell).toString().trim()===''));
    if(allEmpty) continue;
    const obj = {};
    for(let c=0;c<headers.length;c++){
      obj[headers[c]] = row[c] === undefined ? '' : row[c];
    }
    records.push(obj);
  }
  if(records.length === 0){ alert('Tidak ada data setelah baris header.'); return; }
  rawData = records;
  populateColumnCheckboxes(Object.keys(rawData[0]));
  setStatus('File dimuat: ' + rawData.length + ' baris. Header baris ke-6 digunakan.');
  selectedCols = Object.keys(rawData[0]).slice(0,3);
  applyFilterAndRender();
}

// buttons select all / reset
document.getElementById('selectAllBtn').addEventListener('click', () => {
  document.querySelectorAll('.col-check').forEach(ch => ch.checked = true);
});
document.getElementById('deselectAllBtn').addEventListener('click', () => {
  document.querySelectorAll('.col-check').forEach(ch => ch.checked = false);
});

// clear data
document.getElementById('clearDataBtn').addEventListener('click', () => {
  rawData = []; filteredData = []; selectedCols = [];
  document.getElementById('columnsCheckboxes').innerHTML = '';
  document.getElementById('resultHead').innerHTML = '';
  document.getElementById('resultBody').innerHTML = '';
  document.getElementById('toolbar').style.display = 'none';
  document.getElementById('downloadFilteredBtn').style.display = 'none';
  setStatus('Data upload dihapus.');
});

// Process
document.getElementById('processBtn').addEventListener('click', () => {
  const checks = Array.from(document.querySelectorAll('.col-check:checked')).map(i=>i.value);
  if(checks.length === 0){ alert('Pilih minimal 1 kolom.'); return; }
  selectedCols = checks;
  applyFilterAndRender();
  toggleToolbar();
});

// search columns helper
document.getElementById('searchCols').addEventListener('input', (e) => {
  const q = e.target.value.toLowerCase();
  Array.from(document.querySelectorAll('#columnsCheckboxes .form-check')).forEach(div => {
    const lbl = div.innerText.toLowerCase();
    div.style.display = lbl.includes(q) ? '' : 'none';
  });
});

function toggleToolbar(){
  const enabled = document.getElementById('enableSearch').checked;
  document.getElementById('toolbar').style.display = enabled ? '' : 'none';
  document.getElementById('downloadFilteredBtn').style.display = document.getElementById('enableExport').checked ? '' : 'none';
}

function applyFilterAndRender(){
  filteredData = rawData.map(row => {
    const out = {}; selectedCols.forEach(c => out[c] = row[c] ?? ''); return out;
  });
  renderTable(filteredData);
  setStatus('Menampilkan ' + filteredData.length + ' baris — kolom: ' + selectedCols.join(', '));
  prepareDownload(filteredData);
}

function renderTable(data){
  const thead = document.getElementById('resultHead'); const tbody = document.getElementById('resultBody');
  thead.innerHTML = ''; tbody.innerHTML = '';
  const tr = document.createElement('tr');
  selectedCols.forEach(c => {
    const th = document.createElement('th'); th.textContent = c; th.style.cursor = 'pointer';
    th.addEventListener('click', () => { if(!document.getElementById('enableSort').checked) return; sortByColumn(c); });
    tr.appendChild(th);
  });
  thead.appendChild(tr);
  const maxRows = 5000; const len = Math.min(data.length, maxRows);
  for(let i=0;i<len;i++){ const r = data[i]; const trb = document.createElement('tr');
    selectedCols.forEach(c => { const td = document.createElement('td'); td.textContent = r[c] ?? ''; trb.appendChild(td); });
    tbody.appendChild(trb);
  }
}

function sortByColumn(col){
  if(currentSort.col === col) currentSort.asc = !currentSort.asc; else { currentSort.col = col; currentSort.asc = true; }
  filteredData.sort((a,b) => { const va = (a[col] ?? '').toString(); const vb = (b[col] ?? '').toString();
    return currentSort.asc ? va.localeCompare(vb, undefined, {numeric:true}) : vb.localeCompare(va, undefined, {numeric:true});
  });
  renderTable(filteredData);
}

// prepare XLSX download using SheetJS
function prepareDownload(data){
  const btn = document.getElementById('downloadFilteredBtn');
  if(!data || data.length===0){ btn.style.display = 'none'; return; }
  const ws_data = [];
  // header row
  ws_data.push(selectedCols);
  // data rows
  data.forEach(row => {
    const r = selectedCols.map(c => row[c] ?? '');
    ws_data.push(r);
  });
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(ws_data);
  XLSX.utils.book_append_sheet(wb, ws, 'Hasil Filter');
  const wbout = XLSX.write(wb, {bookType:'xlsx', type:'array'});
  const blob = new Blob([wbout], {type: 'application/octet-stream'});
  const url = URL.createObjectURL(blob);
  btn.href = url;
  btn.download = 'hasil_filter.xlsx';
  btn.style.display = document.getElementById('enableExport').checked ? '' : 'none';
}

// global search
document.getElementById('globalSearch').addEventListener('input', (e) => {
  const q = e.target.value.toLowerCase();
  if(q === '') { renderTable(filteredData); return; }
  const subset = filteredData.filter(r => Object.values(r).some(v => String(v).toLowerCase().includes(q)));
  renderTable(subset);
});

document.getElementById('clearSearch').addEventListener('click', () => { document.getElementById('globalSearch').value=''; renderTable(filteredData); });

// initial: try to load default data.json if exists (but header fixed at row 6 mapping only when parsing Excel)
async function loadDefault(){ try{ const res = await fetch('data.json'); const jd = await res.json(); if(jd.length){ rawData = jd; populateColumnCheckboxes(Object.keys(rawData[0])); setStatus('Data default dimuat: '+rawData.length+' baris.'); } }catch(e){ setStatus('Belum ada data default. Silakan unggah file.'); } }
loadDefault();
