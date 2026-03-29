const xlsx = require('xlsx');
const fs = require('fs');

try {
  const workbook = xlsx.readFile('bus routes.xlsx');
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  // Convert first sheet to JSON, grab first 20 rows to understand structure
  const rawData = xlsx.utils.sheet_to_json(worksheet);
  const preview = rawData.slice(0, 20);
  
  fs.writeFileSync('preview.json', JSON.stringify(preview, null, 2));
  console.log('Preview generated.');
} catch (e) {
  console.error("Failed to read Excel:", e);
}
