
let excelData = [];
let headers = [];
let rombelIndex = 42;

document.getElementById('upload').addEventListener('change', handleFile);

function handleFile(e) {
    const file = e.target.files[0];
    const reader = new FileReader();

    reader.onload = function(evt) {
        const data = new Uint8Array(evt.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(sheet, { header: 1 });

        headers = json[4];
        excelData = json.slice(5);

        loadColumnOptions();
        loadRombelFilter();
        processData();
    };

    reader.readAsArrayBuffer(file);
}

function loadColumnOptions() {
    const select = document.getElementById("filterColumn");
    select.innerHTML = "";
    headers.forEach((h, i) => {
        if(h) {
            let opt = document.createElement("option");
            opt.value = i;
            opt.textContent = h;
            select.appendChild(opt);
        }
    });
}

function loadRombelFilter() {
    const select = document.getElementById("filterRombel");
    select.innerHTML = "<option value='ALL'>Semua</option>";
    let uniqueValues = [...new Set(excelData.map(r => r[rombelIndex]))];
    uniqueValues.forEach(val => {
        if(val) {
            let opt = document.createElement("option");
            opt.value = val;
            opt.textContent = val;
            select.appendChild(opt);
        }
    });
}

function processData() {
    const selectedCols = Array.from(document.getElementById("filterColumn").selectedOptions).map(o => parseInt(o.value));
    const filterRombel = document.getElementById("filterRombel").value;
    const searchText = document.getElementById("searchInput").value.toLowerCase();

    let filtered = excelData.filter(row => {
        let matchRombel = (filterRombel === "ALL") || (row[rombelIndex] == filterRombel);
        let matchSearch = !searchText || (row[1] && row[1].toLowerCase().includes(searchText));
        return matchRombel && matchSearch;
    });

    renderTable(filtered, selectedCols);
}

function renderTable(data, selectedCols) {
    let container = document.getElementById("tableContainer");
    let html = "<table border='1'><tr><th>No</th>";

    selectedCols.forEach(i => html += `<th>${headers[i]}</th>`);
    html += "</tr>";

    data.forEach((row, idx) => {
        html += `<tr><td>${idx+1}</td>`;
        selectedCols.forEach(i => html += `<td>${row[i] || ""}</td>`);
        html += "</tr>";
    });

    html += "</table>";
    container.innerHTML = html;
}

function exportExcel() {
    let table = document.querySelector("#tableContainer table");
    let wb = XLSX.utils.table_to_book(table, {sheet: "Filtered"});
    XLSX.writeFile(wb, "filtered_rombel.xlsx");
}
