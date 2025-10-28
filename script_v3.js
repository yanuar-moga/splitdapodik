// script_v3.js - Versi stabil (default Load Kolom AQ)
let HEADER_ROW_INDEX = 5; // bisa otomatis disesuaikan
const MAPPING = {
  "A": "No", "B": "Nama", "C": "NIPD", "D": "JK", "E": "NISN",
  "F": "Tempat Lahir", "G": "Tanggal Lahir", "H": "NIK", "I": "Agama",
  "J": "Alamat", "K": "RT", "L": "RW", "M": "Dusun", "N": "Kelurahan",
  "O": "Kecamatan", "P": "Kodepos", "Q": "Jenis Tinggal", "R": "Alat Transportasi",
  "S": "Telepon", "T": "HP", "U": "Email", "V": "SKHUN", "W": "Penerima KPS", "X": "No KPS"
};

let rawData = [], selectedCols = [], filteredData = [];
let currentSort = { col: null, asc: true };

function setStatus(msg) {
  document.getElementById("status").textContent = msg;
}

/* =====================================================
   1️⃣ Saat load halaman, set default dropdown AQ
===================================================== */
window.addEventListener("DOMContentLoaded", () => {
  const colSelect = document.getElementById("loadColumn");
  if (colSelect) colSelect.value = "AQ"; // default pilihan AQ
});

/* =====================================================
   2️⃣ Load file
===================================================== */
document.getElementById("loadFileBtn").addEventListener("click", () => {
  const file = document.getElementById("fileInput").files[0];
  if (!file) return alert("Pilih file terlebih dahulu.");
  const name = file.name.toLowerCase();

  const reader = new FileReader();
  reader.onload = e => {
    try {
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
    } catch (err) {
      alert("Gagal membaca file: " + err.message);
    }
  };
  if (name.endsWith(".csv")) reader.readAsText(file, "utf-8");
  else reader.readAsArrayBuffer(file);
});

/* =====================================================
   3️⃣ Proses data
===================================================== */
function handleParsedArray(aoa) {
  // daftar kolom A–BN
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").concat(
    Array.from({ length: 26 }, (_, i) => "A" + String.fromCharCode(65 + i))
  );

  const endCol = document.getElementById("loadColumn").value;
  const endIndex = letters.indexOf(endCol);
  if (endIndex < 0) return alert("Kolom tidak valid.");

  const range = aoa.map(r => r.slice(0, endIndex + 1));

  // 🔹 deteksi baris header otomatis (cari baris dengan banyak teks)
  let headerRow = 5;
  for (let i = 0; i < 10; i++) {
    const filled = (range[i] || []).filter(v => String(v).trim() !== "").length;
    if (filled > 4) headerRow = i;
  }
  HEADER_ROW_INDEX = headerRow;

  const prev = range[HEADER_ROW_INDEX - 1] || [];
  const curr = range[HEADER_ROW_INDEX] || [];

  // 🔹 gabung header baris 2 tingkat
  const headers = curr.map((v, i) => {
    const upper = prev[i] ? prev[i].trim() : "";
    const lower = v ? v.trim() : "";
    const key = letters[i];
    return (MAPPING[key] || (upper || lower || "Col_" + key));
  });

  // 🔹 isi data
  const records = [];
  for (let i = HEADER_ROW_INDEX + 1; i < range.length; i++) {
    const row = range[i];
    if (!row) continue;
    const allEmpty = row.every(c => String(c).trim() === "");
    if (allEmpty) continue;
    const obj = {};
    headers.forEach((h, j) => obj[h] = row[j] ?? "");
    records.push(obj);
  }

  if (records.length === 0) {
    setStatus("⚠️ Tidak ada data ditemukan dalam range A–" + endCol);
    alert("Tidak ada data ditemukan. Coba ubah Load Kolom ke kolom lebih kecil.");
    return;
  }

  rawData = records;
  populateColumnCheckboxes(Object.keys(rawData[0]));
  selectedCols = Object.keys(rawData[0]).slice(0, 3);
  applyFilterAndRender();
  setStatus(`✅ File dimuat (${records.length} baris) — Range A–${endCol}, Header baris ke-${HEADER_ROW_INDEX + 1}`);
}

/* =====================================================
   4️⃣ Checkbox kolom & tombol
===================================================== */
function populateColumnCheckboxes(cols) {
  const container = document.getElementById("columnsCheckboxes");
  container.innerHTML = "";
  cols.forEach((c, idx) => {
    const id = "col_" + idx;
    const div = document.createElement("div");
    div.className = "form-check";
    div.innerHTML = `
      <input class="form-check-input col-check" type="checkbox" value="${c}" id="${id}" ${(idx < 3 ? "checked" : "")}>
      <label class="form-check-label" for="${id}">${c}</label>`;
    container.appendChild(div);
  });
}

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

/* =====================================================
   5️⃣ Tabel dan Export
===================================================== */
function toggleToolbar() {
  document.getElementById("toolbar").style.display =
    document.getElementById("enableSearch").checked ? "" : "none";
}

function applyFilterAndRender() {
  filteredData = rawData.map(r => {
    const out = {};
    selectedCols.forEach(c => out[c] = r[c] ?? "");
    return out;
  });
  renderTable(filteredData);
  prepareDownload(filteredData);
}

function renderTable(data) {
  const head = document.getElementById("resultHead");
  const body = document.getElementById("resultBody");
  head.innerHTML = ""; body.innerHTML = "";

  const tr = document.createElement("tr");
  selectedCols.forEach(c => {
    const th = document.createElement("th");
    th.textContent = c; th.style.cursor = "pointer";
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
   6️⃣ Pencarian Global
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
