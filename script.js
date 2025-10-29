let allData = [];
let filteredData = [];
let selectedColumns = [];

const fileInput = document.getElementById("fileInput");
const rombelSelect = document.getElementById("rombelSelect");
const filterBtn = document.getElementById("filterBtn");
const downloadBtn = document.getElementById("downloadBtn");
const columnCheckboxes = document.getElementById("columnCheckboxes");
const showColumnsBtn = document.getElementById("showColumnsBtn");
const tableContainer = document.getElementById("tableContainer");

// --- Membaca file Excel ---
fileInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (evt) => {
    const data = new Uint8Array(evt.target.result);
    const workbook = XLSX.read(data, { type: "array" });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    allData = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

    // Ambil daftar rombel unik
    const rombelSet = new Set(allData.map(row => row["Rombel Saat Ini"]).filter(Boolean));
    rombelSelect.innerHTML = '<option value="">-- Pilih Rombel --</option>';
    rombelSet.forEach(r => {
      const opt = document.createElement("option");
      opt.value = r;
      opt.textContent = r;
      rombelSelect.appendChild(opt);
    });

    alert(`File dimuat ✅\nDitemukan ${rombelSet.size} rombel.`);
  };
  reader.readAsArrayBuffer(file);
});

// --- Filter berdasarkan rombel ---
filterBtn.addEventListener("click", () => {
  const rombel = rombelSelect.value;
  if (!rombel) {
    alert("Pilih rombel terlebih dahulu!");
    return;
  }

  filteredData = allData.filter(row => row["Rombel Saat Ini"] === rombel);
  if (filteredData.length === 0) {
    alert("Tidak ada data untuk rombel ini!");
    return;
  }

  // Buat daftar checkbox kolom
  const columns = Object.keys(filteredData[0]);
  columnCheckboxes.innerHTML = "";
  columns.forEach(col => {
    const label = document.createElement("label");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = col;
    checkbox.checked = ["No", "Nama", "JK", "Alamat"].includes(col); // default
    label.appendChild(checkbox);
    label.appendChild(document.createTextNode(" " + col));
    columnCheckboxes.appendChild(label);
  });

  renderTable(filteredData);
});

// --- Tampilkan hanya kolom terpilih ---
showColumnsBtn.addEventListener("click", () => {
  const checkedBoxes = columnCheckboxes.querySelectorAll("input:checked");
  selectedColumns = Array.from(checkedBoxes).map(cb => cb.value);

  if (selectedColumns.length === 0) {
    alert("Pilih minimal satu kolom!");
    return;
  }

  const reduced = filteredData.map(row => {
    const obj = {};
    selectedColumns.forEach(col => obj[col] = row[col]);
    return obj;
  });
  renderTable(reduced);
});

// --- Fungsi render tabel ---
function renderTable(data) {
  if (!data || data.length === 0) {
    tableContainer.innerHTML = "<p>Tidak ada data untuk ditampilkan.</p>";
    return;
  }

  const cols = Object.keys(data[0]);
  let html = "<table><thead><tr>";
  cols.forEach(c => html += `<th>${c}</th>`);
  html += "</tr></thead><tbody>";
  data.forEach(row => {
    html += "<tr>";
    cols.forEach(c => html += `<td>${row[c]}</td>`);
    html += "</tr>";
  });
  html += "</tbody></table>";
  tableContainer.innerHTML = html;
}

// --- Download Excel hasil tampilan ---
downloadBtn.addEventListener("click", () => {
  if (!filteredData.length) {
    alert("Belum ada data untuk diunduh!");
    return;
  }

  const ws = XLSX.utils.json_to_sheet(filteredData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Hasil Filter");
  XLSX.writeFile(wb, "hasil_filter.xlsx");
});
