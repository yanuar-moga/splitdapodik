let allData = [];
let filteredData = [];
let rombelColName = null;

document.getElementById('inputExcel').addEventListener('change', handleFile, false);
document.getElementById('btnFilter').addEventListener('click', filterData);
document.getElementById('btnDownload').addEventListener('click', downloadExcel);

function handleFile(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function (event) {
    const data = new Uint8Array(event.target.result);
    const workbook = XLSX.read(data, { type: 'array' });

    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    // Lewati 4 baris header
    const headers = json[4];
    const rows = json.slice(5);

    allData = rows.map(row => {
      let obj = {};
      headers.forEach((h, i) => {
        obj[h] = row[i];
      });
      return obj;
    });

    // Deteksi kolom Rombel
    rombelColName = headers.find(h => 
      h && (
        h.toLowerCase().includes("rombel saat ini") || 
        h.toLowerCase().includes("rombel") ||
        h.toLowerCase().includes("unnamed: 42")
      )
    );

    if (!rombelColName) {
      alert("Kolom 'Rombel Saat Ini' tidak ditemukan! Pastikan file Dapodik sesuai format ekspor.");
      return;
    }

    // Ambil semua nama rombel unik
    const rombelList = [...new Set(allData.map(d => d[rombelColName]).filter(Boolean))];

    const select = document.getElementById('rombelSelect');
    select.innerHTML = rombelList.map(r => `<option value="${r}">${r}</option>`).join('');

    if (rombelList.length > 0) {
      alert(`File berhasil dimuat ✅ (${rombelList.length} rombel terdeteksi).`);
    } else {
      alert("File berhasil dimuat, tapi tidak ada data rombel yang ditemukan!");
    }
  };
  reader.readAsArrayBuffer(file);
}

function filterData() {
  const rombel = document.getElementById('rombelSelect').value;
  if (!rombel) {
    alert("Pilih rombel terlebih dahulu!");
    return;
  }

  filteredData = allData.filter(d => d[rombelColName] === rombel);
  renderTable(filteredData);
}

function renderTable(data) {
  if (!data.length) {
    document.getElementById('tableContainer').innerHTML = "<p>Tidak ada data untuk ditampilkan.</p>";
    return;
  }

  const headers = Object.keys(data[0]);
  let html = "<table><thead><tr>";
  headers.forEach(h => html += `<th>${h}</th>`);
  html += "</tr></thead><tbody>";

  data.forEach(row => {
    html += "<tr>";
    headers.forEach(h => html += `<td>${row[h] || ""}</td>`);
    html += "</tr>";
  });

  html += "</tbody></table>";
  document.getElementById('tableContainer').innerHTML = html;
}

function downloadExcel() {
  if (!filteredData.length) {
    alert("Filter data dulu sebelum download!");
    return;
  }

  const ws = XLSX.utils.json_to_sheet(filteredData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Data Rombel");
  XLSX.writeFile(wb, `Data_${document.getElementById('rombelSelect').value}.xlsx`);
}
