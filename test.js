const { JSDOM } = require('jsdom');
const fs = require('fs');
const html = fs.readFileSync('./index.html', 'utf8');
const script = fs.readFileSync('./js/app.js', 'utf8');

const dom = new JSDOM(html, { runScripts: "outside-only" });
const window = dom.window;
const document = window.document;
const navigator = window.navigator;

try {
  window.eval(script);
  console.log("No syntax or immediate runtime errors.");
} catch (e) {
  console.error("Runtime error:", e);
}
