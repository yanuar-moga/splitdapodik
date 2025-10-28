function handleParsedArray(aoa){
  if(HEADER_ROW_INDEX >= aoa.length){
    alert('File terlalu pendek, tidak menemukan baris header ke-6.');
    return;
  }

  // gabungkan baris 5 dan 6 (index 4 dan 5)
  const prevRow = aoa[HEADER_ROW_INDEX - 1] || [];
  const currentRow = aoa[HEADER_ROW_INDEX] || [];

  const combinedHeaders = currentRow.map((val, i) => {
    const upper = prevRow[i] ? String(prevRow[i]).trim() : '';
    const lower = val ? String(val).trim() : '';
    if(upper && lower) return upper + ' - ' + lower;
    if(upper && !lower) return upper;
    if(!upper && lower) return lower;
    return 'Col_' + (i + 1);
  });

  const headers = mapHeaders(combinedHeaders);

  // lanjut seperti semula
  const records = [];
  for(let i = HEADER_ROW_INDEX + 1; i < aoa.length; i++){
    const row = aoa[i];
    const allEmpty = row.every(cell => !cell || String(cell).trim() === '');
    if(allEmpty) continue;
    const obj = {};
    for(let c = 0; c < headers.length; c++){
      obj[headers[c]] = row[c] ?? '';
    }
    records.push(obj);
  }

  if(records.length === 0){
    alert('Tidak ada data setelah baris header.');
    return;
  }

  rawData = records;
  populateColumnCheckboxes(Object.keys(rawData[0]));
  setStatus('File dimuat: ' + rawData.length + ' baris. Header baris ke-5 dan 6 digabung.');
  selectedCols = Object.keys(rawData[0]).slice(0, 3);
  applyFilterAndRender();
}
