const pdf = require('pdf-parse');
const fs = require('fs');
fs.writeFileSync('debug_pdf.json', JSON.stringify(typeof pdf) + ' ' + JSON.stringify(Object.keys(pdf)));
