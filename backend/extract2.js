const { PdfReader } = require('pdfreader');
const fs = require('fs');

let text = '';
new PdfReader().parseFileItems("bus routes.pdf", (err, item) => {
  if (err) console.error("error:", err);
  else if (!item) {
    fs.writeFileSync('extracted_routes.txt', text);
    console.log("Done");
  }
  else if (item.text) text += item.text + '\n';
});
