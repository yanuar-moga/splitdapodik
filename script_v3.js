// script_v3.js - FINAL (support header 2 baris + pilih range kolom A–BN)
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

/* ---------------------------------------------------
   1️⃣ GENERATOR KOLOM A–BN UNTUK FILTER RANGE
---------------------------------------------------- */
function generateColLetters() {
  const letters = [];
  for (let i = 0; i < 66; i++) { // A-Z + AA–BN
    if (i < 26) letters.push(String.fromCharCode(65 + i)); // A–Z
    else {
      const first = String.fromCharCode(64 + Math.floor(i / 26)); // A–B
      const second = String.fromCharCode(65 + (i % 26));
      letters.push(first + second);
    }
  }
  return letters;
}

function populateColDropdowns() {
  const cols = generateColLetters();
  const startSel = document.getElementById("colStart");
  const endSel = document.getElementById("colEnd");
  cols.forEach(l => {
    startSel.add(new Option(l, l));
    endSel.add(new Option(l, l));
  });
  startSel.value = "A";
  endSel.value = "BN";
}
populateColDropdowns();

/* ---------------------------------------------------
   2️⃣ HEADER MAPPING
---------------------------------------------------- */
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
  setStatus("Kolom tersedia: " + cols.length);
}

/* ---------------------------------------------------
   3️⃣ LOAD FILE DAN PROSES
---------------------------------------------------- */
document.getElementById("loadFileBtn").addEventListener("click", () => {
  const f = document.getElementById("fileInput").files[0];
  if (!f) { alert("Pilih file terlebih dahulu."); return; }
  const fname = f.name.toLowerCase();

  if (fname.endsWith(".csv")) {
    const reader = new FileReader();
    reader.onload = e => {
      const text = e.target.result;
      const parsed = Papa.parse(text, { skipEmptyLines: true });
      handleParsedArray(parsed.data);
    };
    reader.readAsText(f, "utf-8");
  } else if (fname.endsWith(".xls") || fname.endsWith(".xlsx")) {
    const reader = new FileReader();
    reader.onload = e => {
      const data = new Uint8Array(e.target.result);
      const wb = XLSX.read(data, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: "" });
      handleParsedArray(aoa);
    };
    reader.readAsArrayBuffer(f);
  } else {
    alert("Format file tidak didukung. Pilih .xlsx, .xls atau .csv");
  }
});

/* ---------------------------------------------------
   4️⃣ PROSES DATA DARI EXCEL
---------------------------------------------------- */
function handleParsedArray(aoa) {
  // ambil range kolom sesuai pilihan
  const colLetters = generateColLetters();
  const startCol = document.getElementById("colStart").value;
  const endCol = document.getElementById("colEnd").value;
  const startIndex = colLetters.indexOf(startCol);
  const endIndex = colLetters.indexOf(endCol);
  const range = aoa.map(row => row.slice(startIndex, endIndex + 1));

  if (HEADER_ROW_INDEX >= range.length) {
    alert("File terlalu pendek, tidak menemukan baris header ke-6.");
    return;
  }

  // gabungkan baris 5 dan 6 jadi header
  const prevRow = range[HEADER_ROW_INDEX - 1] || [];
  const currentRow = range[HEADER_ROW_INDEX] || [];
  const combinedHeaders = currentRow.map((val, i) => {
    const upper = prevRow[i] ? String(prevRow[i]).trim() : "";
    const lower = val ? String(val).trim() : "";
    if (upper && lower) return upper + " - " + lower;
    if (upper && !lower) return upper;
    if (!upper && lower) return lower;
    return "Col_" + (i + 1);
  });

  const headers = mapHeaders(combinedHeaders);

  // isi data
  const records = [];
  for (let i = HEADER_ROW_INDEX + 1; i < range.length; i++) {
    const row = range[i];
    if (!row) continue;
    const allEmpty = row.every(cell => (cell === null || cell === undefined || String(cell).trim() === ""));
    if (allEmpty) continue;
    const obj = {};
    for (let c = 0; c < headers.length; c++) obj[headers[c]] = row[c] ?? "";
    records.push(obj);
  }

  if (records.length === 0) {
    alert("Tidak ada data setelah baris header.");
    return;
  }

  rawData = records;
  populateColumnCheckboxes(Object.keys(rawData[0]));
  setStatus(`File dimuat: ${rawData.length} baris. Header baris 5 & 6 digabung. Range: ${startCol}–${endCol}`);
  selectedCols = Object.keys(rawData[0]).slice(0, 3);
  applyFilterAndRender();
}

/* ---------------------------------------------------
   5️⃣ FUNGSI TAMBAHAN UI
---------------------------------------------------- */
document.getElementById("selectAllBtn").addEventListener("click", () => {
  document.querySelectorAll(".col-check").forEach(ch => ch.checked = true);
});
document.getElementById("deselectAllBtn").addEventListener("click", () => {
  document.querySelectorAll(".col-check").forEach(ch => ch.checked = false);
});
document.getElementById("clearDataBtn").addEventListener("click", () => {
  rawData = []; filteredData = []; selectedCols = [];
  document.getElementById("columnsCheckboxes").innerHTML = "";
  document.getElementById("resultHead").innerHTML = "";
  document.getElementById("resultBody").innerHTML = "";
  document.getElementById("toolbar").style.display = "none";
  document.getElementById("downloadFilteredBtn").style.display = "none";
  setStatus("Data upload dihapus.");
});
document.getElementById("processBtn").addEventListener("click", () => {
  const checks = Array.from(document.querySelectorAll(".col-check:checked")).map(i => i.value);
  if (checks.length === 0) { alert("Pilih minimal 1 kolom."); return; }
  selectedCols = checks;
  applyFilterAndRender();
  toggleToolbar();
});
document.getElementById("searchCols").addEventListener("input", e => {
  const q = e.target.value.toLowerCase();
  Array.from(document.querySelectorAll("#columnsCheckboxes .form-check")).forEach(div => {
    const lbl = div.innerText.toLowerCase();
    div.style.display = lbl.includes(q) ? "" : "none";
  });
});

function toggleToolbar() {
  const enabled = document.getElementById("enableSearch").checked;
  document.getElementById("toolbar").style.display = enabled ? "" : "none";
  document.getElementById("downloadFilteredBtn").style.display =
    document.getElementById("enableExport").checked ? "" : "none";
}

/* ---------------------------------------------------
   6️⃣ RENDER DAN SORT
---------------------------------------------------- */
function applyFilterAndRender() {
  filteredData = rawData.map(row => {
    const out = {};
    selectedCols.forEach(c => out[c] = row[c] ?? "");
    return out;
  });
  renderTable(filteredData);
  setStatus(`Menampilkan ${filteredData.length} baris — kolom: ${selectedCols.join(", ")}`);
  prepareDownload(filteredData);
}

function renderTable(data) {
  const thead = document.getElementById("resultHead");
  const tbody = document.getElementById("resultBody");
  thead.innerHTML = "";
  tbody.innerHTML = "";
  const tr = document.createElement("tr");
  selectedCols.forEach(c => {
    const th = document.createElement("th");
    th.textContent = c;
    th.style.cursor = "pointer";
    th.addEventListener("click", () => {
      if (!document.getElementById("enableSort").checked) return;
      sortByColumn(c);
    });
    tr.appendChild(th);
  });
  thead.appendChild(tr);

  const maxRows = 5000;
  const len = Math.min(data.length, maxRows);
  for (let i = 0; i < len; i++) {
    const r = data[i];
    const trb = document.createElement("tr");
    selectedCols.forEach(c => {
      const td = document.createElement("td");
      td.textContent = r[c] ?? "";
      trb.appendChild(td);
    });
    tbody.appendChild(trb);
  }
}

function sortByColumn(col) {
  if (currentSort.col === col) currentSort.asc = !currentSort.asc;
  else { currentSort.col = col; currentSort.asc = true; }
  filteredData.sort((a, b) => {
    const va = (a[col] ?? "").toString();
    const vb = (b[col] ?? "").toString();
    return currentSort.asc
      ? va.localeCompare(vb, undefined, { numeric: true })
      : vb.localeCompare(va, undefined, { numeric: true });
  });
  renderTable(filteredData);
}

/* ---------------------------------------------------
   7️⃣ DOWNLOAD XLSX
---------------------------------------------------- */
function prepareDownload(data) {
  const btn = document.getElementById("downloadFilteredBtn");
  if (!data || data.length === 0) { btn.style.display = "none"; return; }
  const ws_data = [selectedCols];
  data.forEach(row => ws_data.push(selectedCols.map(c => row[c] ?? "")));
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(ws_data);
  XLSX.utils.book_append_sheet(wb, ws, "Hasil Filter");
  const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([wbout], { type: "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  btn.href = url;
  btn.download = "hasil_filter.xlsx";
  btn.style.display = document.getElementById("enableExport").checked ? "" : "none";
}

/* ---------------------------------------------------
   8️⃣ PENCARIAN GLOBAL
---------------------------------------------------- */
document.getElementById("globalSearch").addEventListener("input", e => {
  const q = e.target.value.toLowerCase();
  if (q === "") { renderTable(filteredData); return; }
  const subset = filteredData.filter(r =>
    Object.values(r).some(v => String(v).toLowerCase().includes(q))
  );
  renderTable(subset);
});
document.getElementById("clearSearch").addEventListener("click", () => {
  document.getElementById("globalSearch").value = "";
  renderTable(filteredData);
});

/* ---------------------------------------------------
   9️⃣ LOAD DATA DEFAULT (data.json)
---------------------------------------------------- */
async function loadDefault() {
  try {
    const res = await fetch("data.json");
    const jd = await res.json();
    if (jd.length) {
      const headers = mapHeaders(Object.keys(jd[0]));
      rawData = jd.map(item => {
        const newObj = {};
        headers.forEach((h, i) => {
          const oldKey = Object.keys(jd[0])[i];
          newObj[h] = item[oldKey];
        });
        return newObj;
      });
      populateColumnCheckboxes(Object.keys(rawData[0]));
      setStatus("Data default dimuat dan dimapping: " + rawData.length + " baris.");
    }
  } catch {
    setStatus("Belum ada data default. Silakan unggah file.");
  }
}
loadDefault();
