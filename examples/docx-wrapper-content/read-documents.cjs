const mammoth = require('mammoth');
const path = require('node:path');
const expected = require('./expected-html.json');

(async () => {
  for (const name of Object.keys(expected)) {
    const result = await mammoth.convertToHtml({path: path.join(__dirname, `${name}.docx`)});
    console.log(JSON.stringify({file: `${name}.docx`, html: result.value, messages: result.messages}));
  }
})().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
