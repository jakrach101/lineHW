
const defaultHeader = `ผู้ป่วย: ... (อายุ ... ปี)\nDx: ...\nIndication: ...\nวันที่รับ: ...\nCC: ...\nHPI: ...\nPH: ...\nFHx: ...\nAllergy: ...\n==============\n💊 ยาที่ใช้ปัจจุบัน (ยังไม่มีรายการยา)\n• ...`;

const raw = defaultHeader;
console.log("Raw header:");
console.log(raw);

const ccMatch = raw.match(/^CC:\s*(.*?)(?:\n|$)/m);
if (ccMatch) console.log("CC Val:", ccMatch[1].trim());
else console.log("CC Not found");

const hpiMatch = raw.match(/^HPI:\s*(.*?)(?:\n|$)/m);
if (hpiMatch) console.log("HPI Val:", hpiMatch[1].trim());
else console.log("HPI Not found");
