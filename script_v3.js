// script_v6_rombel.js - Upload Excel → Pilih kolom AQ → Pilih rombel → Tampilkan data
const MAPPING = {
  "A": "No", "B": "Nama", "C": "NIPD", "D": "JK", "E": "NISN",
  "F": "Tempat Lahir", "G": "Tanggal Lahir", "H": "NIK", "I": "Agama",
  "J": "Alamat", "K": "RT", "L": "RW", "M": "Dusun", "N": "Kelurahan",
  "O": "Kecamatan", "P": "Kodepos", "Q": "Jenis Tinggal", "R": "Alat Transportasi",
  "S": "Telepon", "T": "HP", "U": "Email", "V": "SKHUN", "W": "Penerima KPS", "X": "No KPS"
};

let headers = [];
let allRows = [];
let filteredRows = [];

/* ========== 1️⃣ Saat klik Upload & Baca File ========== */
document.getElementById("loadFileBtn").addEventListener("click", () => {
  const file = document.getElementById("fileInput").files[0];
  if (!file) return alert("Pilih file Excel terlebih dahulu.");
  const reader = new FileReader();
  reader.onload = e => {
    const data = new Uint8Array(e.target.result);
    const wb = XLSX.read(data, { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
    processExcel(aoa);
  };
  reader.readAsArrayBuffer(file);
});

/* ========== 2️⃣ Proses Excel (auto deteksi header & isi) ========== */
function processExcel(aoa) {
  if (!aoa.length) return alert("File kosong atau tidak terbaca.");

  // Deteksi baris header otomatis (baris dengan isi terbanyak)
  let headerRow = 0, maxFilled = 0;
  for (let i = 0; i < Math.min(10, aoa.length); i++) {
    const filled = aoa[i].filter(v => String(v).trim() !== "").length;
    if (filled > maxFilled) { maxFilled = filled; headerRow = i; }
  }

  headers = aoa[headerRow].map((v, i) => {
    const letter = columnLetter(i);
    return MAPPING[letter] || (v || "Kolom_" + letter);
  });

  allRows = aoa.slice(headerRow + 1).filter(r => r.some(v => String(v).trim() !== ""));

  document.getElementById("status").textContent = `✅ File dimuat (${allRows.length} baris data ditemukan)`;
  setupRombelSelector();
}

/* ========== 3️⃣ Siapkan pilihan kolom rombel & nama rombel ========== */
function setupRombelSelector() {
  const rombelColSelect = document.getElementById("rombelColumn");
  const rombelNameSelect = document.getElementById("rombelName");
  rombelColSelect.innerHTML = "";
  rombelNameSelect.innerHTML = `<option value="">-- Pilih rombel --</option>`;

  // Daftar kolom A–BN
  const letters = [];
  for (let i = 0; i < 66; i++) {
    const first = String.fromCharCode(65 + Math.floor(i / 26) - (i < 26 ? 0 : 1));
    const second = String.fromCharCode(65 + (i % 26));
    letters.push(i < 26 ? second : first + second);
  }

  letters.forEach(l => {
    const opt = document.createElement("option");
    opt.value = l;
    opt.textContent = `${l}`;
    if (l === "AQ") opt.selected = true;
    rombelColSelect.appendChild(opt);
  });

  // Tampilkan section rombel
  document.getElementById("rombelSection").style.display = "";

  // Isi nama rombel otomatis saat kolom dipilih
  rombelColSelect.addEventListener("change", () => {
    const colIndex = columnIndex(rombelColSelect.value);
    const uniqueValues = [...new Set(allRows.map(r => r[colIndex]).filter(Boolean))].sort();
    rombelNameSelect.innerHTML = `<option value="">-- Pilih rombel --</option>`;
    uniqueValues.forEach(val => {
      const opt = document.createElement("option");
      opt.value = val;
      opt.textContent = val;
      rombelNameSelect.appendChild(opt);
    });
  });

  // Trigger awal (kolom AQ)
  rombelColSelect.dispatchEvent(new Event("change"));
}

/* ========== 4️⃣ Proses Filter Rombel ========== */
document.getElementById("processBtn").addEventListener("click", () => {
  const colLetter = document.getElementById("rombelColumn").value;
  const rombelName = document.getElementById("rombelName").value;
  if (!rombelName) return alert("Pilih nama rombel terlebih dahulu.");

  const colIdx = columnIndex(colLetter);
  filteredRows = allRows.filter(r => String(r[colIdx]).trim() === rombelName.trim());

  if (filteredRows.length === 0) {
    alert("Tidak ada data untuk rombel " + rombelName);
    return;
  }

  renderTable(headers, filteredRows);
  document.getElementById("exportSection").style.display = "";
  document.getElementById("status").textContent = `📋 Menampilkan ${filteredRows.length} data untuk ${rombelName}`;
});

/* ========== 5️⃣ Tampilkan tabel ========== */
function renderTable(heads, rows) {
  const thead = document.getElementById("resultHead");
  const tbody = document.getElementById("resultBody");
  thead.innerHTML = "";
  tbody.innerHTML = "";

  const tr = document.createElement("tr");
  heads.forEach(h => {
    const th = document.createElement("th");
    th.textContent = h;
    tr.appendChild(th);
  });
  thead.appendChild(tr);

  rows.slice(0, 3000).forEach(r => {
    const trb = document.createElement("tr");
    heads.forEach((_, i) => {
      const td = document.createElement("td");
      td.textContent = r[i] ?? "";
      trb.appendChild(td);
    });
    tbody.appendChild(trb);
  });
}

/* ========== 6️⃣ Export ke Excel ========== */
document.getElementById("exportBtn").addEventListener("click", () => {
  const ws_data = [headers];
  filteredRows.forEach(r => ws_data.push(r));
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(ws_data);
  XLSX.utils.book_append_sheet(wb, ws, "Rombel");
  XLSX.writeFile(wb, "Data_Rombel.xlsx");
});

/* ========== Helper ========== */
function columnLetter(idx) {
  const A = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  if (idx < 26) return A[idx];
  const first = A[Math.floor(idx / 26) - 1];
  const second = A[idx % 26];
  return first + second;
}
function columnIndex(letter) {
  const A = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  letter = letter.toUpperCase();
  if (letter.length === 1) return A.indexOf(letter);
  const first = A.indexOf(letter[0]) + 1;
  const second = A.indexOf(letter[1]);
  return first * 26 + second;
}
