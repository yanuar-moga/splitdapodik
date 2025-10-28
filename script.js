let rawData = [];
let headers = [];

function loadExcel() {
    const file = document.getElementById('fileInput').files[0];
    if (!file) return alert("Pilih file dulu!");

    const reader = new FileReader();
    reader.onload = function (e) {
        const data = new Uint8Array(e.target.result);
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];

        rawData = XLSX.utils.sheet_to_json(ws, { header: 1 });

        headers = rawData[4]; 
        let dataRows = rawData.slice(6);

        let mappedHeaders = [
            "No","Nama","NIPD","JK","NISN","Tempat Lahir","Tanggal Lahir","NIK","Agama",
            "Alamat","RT","RW","Dusun","Kelurahan","Kecamatan","Kodepos","Jenis Tinggal",
            "Alat Transportasi","Telepon","HP","Email","SKHUN","Penerima KPS","No KPS"
        ];

        for (let i = 0; i < mappedHeaders.length; i++) {
            if (!headers[i] || headers[i].toString().trim() === "") {
                headers[i] = mappedHeaders[i];
            }
        }

        rawData = dataRows.map(row => {
            let obj = {};
            headers.forEach((h, i) => obj[h] = row[i] || "");
            return obj;
        });

        createColSelect();
        renderTable(rawData);
    };
    reader.readAsArrayBuffer(file);
}

function createColSelect() {
    const box = document.getElementById("colSelect");
    box.innerHTML = "";
    headers.forEach(h => {
        box.innerHTML += `<label><input type="checkbox" checked value="${h}"> ${h}</label><br>`;
    });
}

function getSelectedCols() {
    return [...document.querySelectorAll("#colSelect input:checked")]
        .map(c => c.value);
}

function renderTable(data) {
    const cols = getSelectedCols();
    const thead = document.querySelector("#dataTable thead");
    const tbody = document.querySelector("#dataTable tbody");

    thead.innerHTML = "<tr>" + cols.map(c => `<th>${c}</th>`).join("") + "</tr>";
    tbody.innerHTML = data.map(row =>
        "<tr>" + cols.map(c => `<td>${row[c]}</td>`).join("") + "</tr>"
    ).join("");
}

function filterTable(force = false) {
    if (!rawData.length) return;
    const keyword = document.getElementById("searchInput").value.toLowerCase();
    const filtered = force ?
        rawData.filter(r => JSON.stringify(r).toLowerCase().includes(keyword)) :
        rawData;
    renderTable(filtered);
}

function exportToExcel() {
    const cols = getSelectedCols();
    const filtered = rawData.map(r => {
        let o = {};
        cols.forEach(c => o[c] = r[c]);
        return o;
    });
    const ws = XLSX.utils.json_to_sheet(filtered);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Hasil");
    XLSX.writeFile(wb, "hasil_filter.xlsx");
}

function selectAllCols() {
    document.querySelectorAll("#colSelect input").forEach(c => c.checked = true);
    renderTable(rawData);
}
function resetCols() {
    document.querySelectorAll("#colSelect input").forEach(c => c.checked = false);
    renderTable(rawData);
}