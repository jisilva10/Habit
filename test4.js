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
  console.log("Success.");
} catch (e) {
  console.error("FAILED:", e.message);
}
console.log("Title after addGymExercise:", document.getElementById('editExerciseModalTitle').textContent);
console.log("Classes after addGymExercise:", document.getElementById('editExerciseModal').className);
