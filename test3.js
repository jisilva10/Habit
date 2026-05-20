const { JSDOM } = require('jsdom');
const fs = require('fs');
const html = fs.readFileSync('./index.html', 'utf8');
const script = fs.readFileSync('./js/app.js', 'utf8');
const dom = new JSDOM(html, { runScripts: "outside-only" });
const window = dom.window;
const document = window.document;
const navigator = window.navigator;

window.eval(script);

// Set up the environment as if the gym detail screen is open
window.exerciseIndexToEdit = null;
window.currentExercises = [];

try {
  window.addGymExercise();
  const modal = document.getElementById('editExerciseModal');
  console.log("Modal classes:", modal.className);
  console.log("Modal Title:", document.getElementById('editExerciseModalTitle').textContent);
} catch (e) {
  console.error("Error in addGymExercise:", e.stack);
}
