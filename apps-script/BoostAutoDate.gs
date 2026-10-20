function boostAutoDateOnEdit(e) {
  if (!e || !e.range) return;
  const sheet = e.range.getSheet();
  const name = sheet.getName();

  if (name === 'Online Order') {
    const firstColumn = e.range.getColumn();
    const lastColumn = e.range.getLastColumn();
    if (lastColumn < 2 || firstColumn > 39) return;
    for (let row = Math.max(2, e.range.getRow()); row <= e.range.getLastRow(); row++) {
      const date = sheet.getRange(row, 1);
      if (!date.isBlank()) continue;
      const rowData = sheet.getRange(row, 2, 1, 38).getValues()[0];
      if (rowData.some(value => value !== '' && value !== null)) {
        date.setValue(new Date()).setNumberFormat('yyyy-mm-dd hh:mm:ss');
      }
    }
    return;
  }

  const columns = name === 'Boost Ledger' ? [3, 4] : name === 'Boost Payments' ? [3] : name === 'Boost Spend' ? [4] : [];
  if (!columns.some(c => e.range.getColumn() <= c && e.range.getLastColumn() >= c)) return;
  for (let row = Math.max(6, e.range.getRow()); row <= e.range.getLastRow(); row++) {
    const date = sheet.getRange(row, 1);
    if (date.isBlank() && columns.some(c => typeof sheet.getRange(row, c).getValue() === 'number')) {
      date.setValue(new Date()).setNumberFormat('yyyy-mm-dd hh:mm');
    }
  }
}