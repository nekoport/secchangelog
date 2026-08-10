const fs = require("fs");
const buf = fs.readFileSync("/app/data/secchangelog.db");
const str = buf.toString("utf8");
const re = /system\.(?:logo|favicon)Path/g;
const matches = [];
let m;
while ((m = re.exec(str)) !== null) {
  const start = m.index;
  const chunk = str.slice(start, start + 300);
  matches.push(chunk.replace(/[^\x20-\x7E]/g, ".").slice(0, 200));
}
console.log(matches.length ? matches.join("\n---\n") : "NO logo/favicon settings found");
