
let excelData = [];
let headers = [];

document.getElementById('upload').addEventListener('change', handleFile);

function handleFile(event) {
    const file = event.target.files[0];
    const reader = new FileReader();
    reader.onload = function(e) {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(sheet, { header: 1 });

        headers = json[4];
        excelData = json.slice(5);

        populateColumnSelect();
        populateRombelFilter();
        processData();
    };
    reader.readAsArrayBuffer(file);
}

function populateColumnSelect() {
    let select = document.getElementById("selectedColumns");
    select.innerHTML = "";
    headers.forEach((h, i) => {
        if(h) {
            let option = document.createElement("option");
            option.value = i;
            option.text = h;
            select.appendChild(option);
        }
    });
}

function populateRombelFilter() {
    let rombelIndex = headers.indexOf("Rombel Saat Ini");
    if (rombelIndex === -1) return;

    let uniqueRombel = [...new Set(excelData.map(r => r[rombelIndex]))];
    let select = document.getElementById("filterRombel");
    select.innerHTML = "<option value='ALL'>Semua</option>";
    uniqueRombel.forEach(r => {
        if(r) {
            let opt = document.createElement("option");
            opt.value = r;
            opt.text = r;
            select.appendChild(opt);
        }
    });
}

function processData() {
    let selected = Array.from(document.getElementById("selectedColumns").selectedOptions).map(o => parseInt(o.value));
    let rombelFilter = document.getElementById("filterRombel").value;
    let rombelIndex = headers.indexOf("Rombel Saat Ini");
    let search = document.getElementById("searchName").value.toLowerCase();
    let nameIndex = headers.indexOf("Nama");

    let filtered = excelData.filter(row => 
        (rombelFilter === "ALL" || row[rombelIndex] == rombelFilter) &&
        (!search || (row[nameIndex] && row[nameIndex].toLowerCase().includes(search)))
    );

    let output = document.getElementById("output");
    output.innerHTML = "";

    let headerRow = document.createElement("tr");
    let thNo = document.createElement("th");
    thNo.textContent = "NO";
    headerRow.appendChild(thNo);

    selected.forEach(i => {
        let th = document.createElement("th");
        th.textContent = headers[i];
        headerRow.appendChild(th);
    });
    output.appendChild(headerRow);

    filtered.forEach((r, idx) => {
        let tr = document.createElement("tr");

        let tdNo = document.createElement("td");
        tdNo.textContent = idx + 1;
        tr.appendChild(tdNo);

        selected.forEach(i => {
            let td = document.createElement("td");
            td.textContent = r[i] || "";
            tr.appendChild(td);
        });
        output.appendChild(tr);
    });
}

function downloadExcel() {
    let table = document.getElementById("output");
    let wb = XLSX.utils.table_to_book(table, { sheet: "Filtered" });
    XLSX.writeFile(wb, "filtered_data.xlsx");
}
