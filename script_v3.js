// script_v4_sortAQ.js - Versi: Sort by AQ otomatis + sort manual
const MAPPING = {
  "A": "No", "B": "Nama", "C": "NIPD", "D": "JK", "E": "NISN",
  "F": "Tempat Lahir", "G": "Tanggal Lahir", "H": "NIK", "I": "Agama",
  "J": "Alamat", "K": "RT", "L": "RW", "M": "Dusun", "N": "Kelurahan",
  "O": "Kecamatan", "P": "Kodepos", "Q": "Jenis Tinggal", "R": "Alat Transportasi",
  "S": "Telepon", "T": "HP", "U": "Email", "V": "SKHUN", "W": "Penerima KPS", "X": "No KPS"
};

let dataRows = [];
let headers = [];
let sortedData = [];

/* ------------------ 1️⃣ Load File ------------------ */
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

function processExcel(aoa) {
  // Gabungkan header 2 baris (baris 5 & 6)
  const headerRow = aoa[5] || [];
  const prevHeader = aoa[4] || [];
  headers = headerRow.map((v, i) => {
    const top = prevHeader[i]?.trim() || "";
    const bottom = v?.trim() || "";
    const letter = columnLetter(i);
    return MAPPING[letter] || `${top || bottom || "Col_" + letter}`;
  });

  // Data mulai dari baris ke-7
  dataRows = aoa.slice(6).filter(row => row.some(v => String(v).trim() !== ""));
  if (dataRows.length === 0) {
    alert("Tidak ada data ditemukan di file ini.");
    return;
  }

  // Sort otomatis berdasarkan kolom AQ (kolom ke-42)
  const aqIndex = 42; // A=0 → AQ=42
  dataRows.sort((a, b) => String(a[aqIndex] || "").localeCompare(String(b[aqIndex] || "")));

  renderTable(headers, dataRows);
  document.getElementById("status").textContent = `✅ File dimuat (${dataRows.length} baris), otomatis diurut berdasarkan kolom AQ`;
  document.getElementById("sortOptions").style.display = "";
}

/* ------------------ 2️⃣ Sort Manual ------------------ */
document.getElementById("processBtn").addEventListener("click", () => {
  const selected = document.getElementById("sortColumn").value;
  const index = columnIndex(selected);
  if (index === -1) return alert("Kolom tidak valid.");

  sortedData = [...dataRows].sort((a, b) =>
    String(a[index] || "").localeCompare(String(b[index] || ""))
  );

  renderTable(headers, sortedData);
  document.getElementById("status").textContent = `🔄 Data diurut berdasarkan kolom ${selected}`;
  document.getElementById("exportSection").style.display = "";
});

/* ------------------ 3️⃣ Render Tabel ------------------ */
function renderTable(heads, rows) {
  const thead = document.getElementById("resultHead");
  const tbody = document.getElementById("resultBody");
  thead.innerHTML = ""; tbody.innerHTML = "";

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

/* ------------------ 4️⃣ Export Excel ------------------ */
document.getElementById("exportBtn").addEventListener("click", () => {
  const ws_data = [headers];
  const exp = sortedData.length ? sortedData : dataRows;
  exp.forEach(r => ws_data.push(r));
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(ws_data);
  XLSX.utils.book_append_sheet(wb, ws, "Sorted Data");
  XLSX.writeFile(wb, "Data_Sorted.xlsx");
});

/* ------------------ 5️⃣ Helper ------------------ */
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
