let allData = [];
let filteredData = [];
let selectedData = [];

const fileInput = document.getElementById("fileInput");
const rombelSelect = document.getElementById("rombelSelect");
const filterBtn = document.getElementById("filterBtn");
const downloadBtn = document.getElementById("downloadBtn");
const tableContainer = document.getElementById("tableContainer");

const columnCheckboxes = document.getElementById("columnCheckboxes");
const showColumnsBtn = document.getElementById("showColumnsBtn");
const downloadSelectedBtn = document.getElementById("downloadSelectedBtn");
const filteredColumnsContainer = document.getElementById("filteredColumnsContainer");

// --- Membaca file Excel ---
fileInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (evt) => {
    const data = new Uint8Array(evt.target.result);
    const workbook = XLSX.read(data, { type: "array" });
    const sheet = workbook.SheetNames[0];
    const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[sheet], { defval: "" });
    allData = jsonData;

    const rombelSet = new Set(allData.map(row => row["Rombel Saat Ini"]).filter(Boolean));
    rombelSelect.innerHTML = '<option value="">-- Pilih Rombel --</option>';
    rombelSet.forEach(r => {
      const opt = document.createElement("option");
      opt.value = r;
      opt.textContent = r;
      rombelSelect.appendChild(opt);
    });

    alert(`File dimuat! (${rombelSet.size} rombel ditemukan)`);
  };
  reader.readAsArrayBuffer(file);
});

// --- Filter berdasarkan rombel ---
filterBtn.addEventListener("click", () => {
  const rombel = rombelSelect.value;
  if (!rombel) return alert("Pilih rombel dulu!");

  filteredData = allData.filter(row => row["Rombel Saat Ini"] === rombel);
  if (filteredData.length === 0) {
    tableContainer.innerHTML = "<p>Tidak ada data untuk rombel ini.</p>";
    return;
  }

  renderTable(filteredData, tableContainer);

  // Buat checkbox kolom (baru sekali saja)
  const columns = Object.keys(filteredData[0]);
  columnCheckboxes.innerHTML = "";
  columns.forEach(col => {
    const label = document.createElement("label");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = col;
    if (["No", "Nama", "JK", "Alamat"].includes(col)) checkbox.checked = true; // default
    label.appendChild(checkbox);
    label.appendChild(document.createTextNode(" " + col));
    columnCheckboxes.appendChild(label);
  });
});

// --- Tampilkan hanya kolom terpilih ---
showColumnsBtn.addEventListener("click", () => {
  const checked = columnCheckboxes.querySelectorAll("input:checked");
  const selectedColumns = Array.from(checked).map(c => c.value);
  if (selectedColumns.length === 0) {
    alert("Pilih minimal satu kolom!");
    return;
  }

  selectedData = filteredData.map(row => {
    const obj = {};
    selectedColumns.forEach(col => obj[col] = row[col]);
    return obj;
  });

  renderTable(selectedData, filteredColumnsContainer);
});

// --- Download hasil filter utama ---
downloadBtn.addEventListener("click", () => {
  if (!filteredData.length) return alert("Tidak ada data untuk diunduh!");
  exportToExcel(filteredData, "hasil_filter_rombel.xlsx");
});

// --- Download hasil kolom terpilih ---
downloadSelectedBtn.addEventListener("click", () => {
  if (!selectedData.length) return alert("Belum ada data kolom terpilih untuk diunduh!");
  exportToExcel(selectedData, "hasil_kolom_terpilih.xlsx");
});

// --- Render tabel ke layar ---
function renderTable(data, container) {
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
  container.innerHTML = html;
}

// --- Ekspor Excel ---
function exportToExcel(jsonData, filename) {
  const ws = XLSX.utils.json_to_sheet(jsonData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Data");
  XLSX.writeFile(wb, filename);
}
