const { JSDOM } = require('jsdom');
const fs = require('fs');
const html = fs.readFileSync('./index.html', 'utf8');
const script = fs.readFileSync('./js/app.js', 'utf8');
const dom = new JSDOM(html, { runScripts: "outside-only" });
const window = dom.window;
const document = window.document;
const navigator = window.navigator;
window.eval(script);
try {
  window.addGymExercise();
  console.log("addGymExercise works!");
} catch (e) {
  console.error("addGymExercise error:", e);
}
