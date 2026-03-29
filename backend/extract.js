const fs = require('fs');
const pdf = require('pdf-parse');

let dataBuffer = fs.readFileSync('bus routes.pdf');

pdf(dataBuffer).then(function(data) {
  fs.writeFileSync('extracted_routes.txt', data.text);
  console.log('PDF Extracted successfully.');
}).catch(err => {
  console.error('Error extracting PDF:', err);
});
