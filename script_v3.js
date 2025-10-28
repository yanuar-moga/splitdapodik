// script_v3.js - Final (Load Kolom tunggal + header baris 5 & 6 otomatis)
const HEADER_ROW_INDEX = 5; // baris ke-6 (0-based)
const MAPPING = {
  "A": "No", "B": "Nama", "C": "NIPD", "D": "JK", "E": "NISN",
  "F": "Tempat Lahir", "G": "Tanggal Lahir", "H": "NIK",
  "I": "Agama", "J": "Alamat", "K": "RT", "L": "RW", "M": "Dusun",
  "N": "Kelurahan", "O": "Kecamatan", "P": "Kodepos",
  "Q": "Jenis Tinggal", "R": "Alat Transportasi", "S": "Telepon",
  "T": "HP", "U": "Email", "V": "SKHUN", "W": "Penerima KPS", "X": "No KPS"
};

let rawData = [];
let selectedCols = [];
let filteredData = [];
let currentSort = { col: null, asc: true };

function setStatus(msg) {
  document.getElementById("status").textContent = msg;
}

/* =====================================================
   1️⃣ Buat daftar kolom (A sampai BN)
===================================================== */
function generateColLetters() {
  const letters = [];
  for (let i = 0; i < 66; i++) {
    if (i < 26) letters.push(String.fromCharCode(65 + i));
    else {
      const first = String.fromCharCode(64 + Math.floor(i / 26));
      const second = String.fromCharCode(65 + (i % 26));
      letters.push(first + second);
    }
  }
  return letters;
}

function populateColDropdown() {
  const cols = generateColLetters();
  const colSel = document.getElementById("loadColumn");
  cols.forEach(l => {
    colSel.add(new Option("Sampai kolom " + l, l));
  });
  colSel.value = "BN";
}
populateColDropdown();

/* =====================================================
   2️⃣ Mapping header
===================================================== */
function mapHeaders(rawHeaders) {
  const result = [];
  for (let i = 0; i < rawHeaders.length; i++) {
    let h = rawHeaders[i] ? String(rawHeaders[i]).trim() : "";
    if (h === "" || h.toLowerCase().startsWith("unnamed")) {
      const letter = String.fromCharCode(65 + i);
      h = MAPPING[letter] || "Col_" + (i + 1);
    }
    result.push(h);
  }
  return result;
}

function populateColumnCheckboxes(cols) {
  const container = document.getElementById("columnsCheckboxes");
  container.innerHTML = "";
  cols.forEach((c, idx) => {
    const id = "col_" + idx;
    const div = document.createElement("div");
    div.className = "form-check";
    div.innerHTML =
      `<input class="form-check-input col-check" type="checkbox" value="${c}" id="${id}" ${(idx < 3 ? "checked" : "")}>
       <label class="form-check-label" for="${id}">${c}</label>`;
    container.appendChild(div);
  });
}

/* =====================================================
   3️⃣ Load file Excel/CSV
===================================================== */
document.getElementById("loadFileBtn").addEventListener("click", () => {
  const f = document.getElementById("fileInput").files[0];
  if (!f) return alert("Pilih file terlebih dahulu.");
  const name = f.name.toLowerCase();

  const reader = new FileReader();
  reader.onload = e => {
    if (name.endsWith(".csv")) {
      const parsed = Papa.parse(e.target.result, { skipEmptyLines: true });
      handleParsedArray(parsed.data);
    } else {
      const data = new Uint8Array(e.target.result);
      const wb = XLSX.read(data, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: "" });
      handleParsedArray(aoa);
    }
  };
  if (name.endsWith(".csv")) reader.readAsText(f, "utf-8");
  else reader.readAsArrayBuffer(f);
});

/* =====================================================
   4️⃣ Proses data
===================================================== */
function handleParsedArray(aoa) {
  const colLetters = generateColLetters();
  const endCol = document.getElementById("loadColumn").value;
  const endIndex = colLetters.indexOf(endCol);
  const range = aoa.map(r => r.slice(0, endIndex + 1));

  const prevRow = range[HEADER_ROW_INDEX - 1] || [];
  const currentRow = range[HEADER_ROW_INDEX] || [];
  const combinedHeaders = currentRow.map((val, i) => {
    const upper = prevRow[i] ? String(prevRow[i]).trim() : "";
    const lower = val ? String(val).trim() : "";
    if (upper && lower) return `${upper} - ${lower}`;
    if (upper && !lower) return upper;
    if (!upper && lower) return lower;
    return "Col_" + (i + 1);
  });

  const headers = mapHeaders(combinedHeaders);
  const records = [];
  for (let i = HEADER_ROW_INDEX + 1; i < range.length; i++) {
    const row = range[i];
    if (!row) continue;
    const obj = {};
    headers.forEach((h, j) => obj[h] = row[j] ?? "");
    records.push(obj);
  }

  rawData = records;
  populateColumnCheckboxes(Object.keys(rawData[0]));
  selectedCols = Object.keys(rawData[0]).slice(0, 3);
  setStatus(`File dimuat (${records.length} baris) — Kolom A sampai ${endCol}`);
  applyFilterAndRender();
}

/* =====================================================
   5️⃣ Fitur tabel dan tombol
===================================================== */
document.getElementById("selectAllBtn").onclick = () => {
  document.querySelectorAll(".col-check").forEach(c => c.checked = true);
};
document.getElementById("deselectAllBtn").onclick = () => {
  document.querySelectorAll(".col-check").forEach(c => c.checked = false);
};
document.getElementById("clearDataBtn").onclick = () => {
  rawData = []; filteredData = []; selectedCols = [];
  document.getElementById("columnsCheckboxes").innerHTML = "";
  document.getElementById("resultHead").innerHTML = "";
  document.getElementById("resultBody").innerHTML = "";
  document.getElementById("toolbar").style.display = "none";
  setStatus("Data dihapus.");
};
document.getElementById("processBtn").onclick = () => {
  selectedCols = Array.from(document.querySelectorAll(".col-check:checked")).map(i => i.value);
  if (selectedCols.length === 0) return alert("Pilih minimal 1 kolom.");
  applyFilterAndRender();
  toggleToolbar();
};
document.getElementById("searchCols").oninput = e => {
  const q = e.target.value.toLowerCase();
  document.querySelectorAll("#columnsCheckboxes .form-check").forEach(div => {
    div.style.display = div.innerText.toLowerCase().includes(q) ? "" : "none";
  });
};

function toggleToolbar() {
  document.getElementById("toolbar").style.display =
    document.getElementById("enableSearch").checked ? "" : "none";
}

/* =====================================================
   6️⃣ Render tabel, sort, export
===================================================== */
function applyFilterAndRender() {
  filteredData = rawData.map(r => {
    const out = {}; selectedCols.forEach(c => out[c] = r[c] ?? "");
    return out;
  });
  renderTable(filteredData);
  prepareDownload(filteredData);
  setStatus(`Menampilkan ${filteredData.length} baris`);
}

function renderTable(data) {
  const head = document.getElementById("resultHead");
  const body = document.getElementById("resultBody");
  head.innerHTML = "";
  body.innerHTML = "";

  const tr = document.createElement("tr");
  selectedCols.forEach(c => {
    const th = document.createElement("th");
    th.textContent = c;
    th.style.cursor = "pointer";
    th.onclick = () => sortByColumn(c);
    tr.appendChild(th);
  });
  head.appendChild(tr);

  data.slice(0, 5000).forEach(r => {
    const trb = document.createElement("tr");
    selectedCols.forEach(c => {
      const td = document.createElement("td");
      td.textContent = r[c] ?? "";
      trb.appendChild(td);
    });
    body.appendChild(trb);
  });
}

function sortByColumn(col) {
  if (currentSort.col === col) currentSort.asc = !currentSort.asc;
  else { currentSort.col = col; currentSort.asc = true; }
  filteredData.sort((a, b) =>
    currentSort.asc
      ? (a[col] ?? "").localeCompare(b[col] ?? "", undefined, { numeric: true })
      : (b[col] ?? "").localeCompare(a[col] ?? "", undefined, { numeric: true })
  );
  renderTable(filteredData);
}

function prepareDownload(data) {
  const btn = document.getElementById("downloadFilteredBtn");
  if (!data.length) { btn.style.display = "none"; return; }
  const ws_data = [selectedCols];
  data.forEach(r => ws_data.push(selectedCols.map(c => r[c] ?? "")));
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(ws_data);
  XLSX.utils.book_append_sheet(wb, ws, "Hasil");
  const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([wbout], { type: "application/octet-stream" });
  btn.href = URL.createObjectURL(blob);
  btn.download = "hasil_filter.xlsx";
  btn.style.display = document.getElementById("enableExport").checked ? "" : "none";
}

/* =====================================================
   7️⃣ Pencarian global
===================================================== */
document.getElementById("globalSearch").oninput = e => {
  const q = e.target.value.toLowerCase();
  if (!q) return renderTable(filteredData);
  renderTable(filteredData.filter(r =>
    Object.values(r).some(v => String(v).toLowerCase().includes(q))
  ));
};
document.getElementById("clearSearch").onclick = () => {
  document.getElementById("globalSearch").value = "";
  renderTable(filteredData);
};
