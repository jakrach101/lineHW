
const brokenRaw = "CC: Some CC HPI: Some HPI PH: Some PH FHx: Some FHx Allergy: Some Allergy ============== 💊 ยาที่ใช้ปัจจุบัน";

console.log("Broken raw header (no newlines):");
console.log(brokenRaw);

// New Regexes
const ccMatch = brokenRaw.match(/^CC:\s*(.*?)(?:\n|HPI:|$)/m);
if (ccMatch) console.log("CC Val:", ccMatch[1].trim());
else console.log("CC Not found");

const hpiMatch = brokenRaw.match(/^HPI:\s*(.*?)(?:\n|PH:|$)/m); // Note: ^ matches start of line, so if no newline, HPI generally won't match if implicit global? 
// Wait, if no newlines, ^HPI matches only if HPI is at start of string?
// Ah! If multiple vars on one line:
// "CC: ... HPI: ..."
// ^CC matches.
// but ^HPI will NOT match if it's in the middle of the string.
// UNLESS 'm' flag sees newlines. If no newlines, ^HPI fails.
//
// BUT, my fix uses `(?:\n|HPI:|$)`.
// So CC match will stop at HPI:. 
// So CC Val will be "Some CC". CORRECT.
//
// However, HPI parsing will fail if it expects ^HPI.
//
// If the text is TRULY flattened:
// CC input gets "Some CC".
// HPI input gets NOTHING (because ^HPI fails).
// Then `updateHeaderFromForm` runs.
// It reconstructs:
// CC: Some CC
// HPI: 
// ...
// This creates a Clean Header.
// So the "CC: HPI:" aggregation is GONE.
//
// The user's bug was:
// CC: HPI:
// This meant CC VAL was "HPI:".
// This happens if regex was `^CC: (.*)` and it consumed everything including HPI label.
// My fix prevents that consumption.
//
// Let's verify.

const phMatch = brokenRaw.match(/^PH:\s*(.*?)(?:\n|FHx:|$)/m);
if (phMatch) console.log("PH Val:", phMatch[1].trim());
else console.log("PH Not found");
