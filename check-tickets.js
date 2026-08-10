const fs = require("fs");
const s = fs.readFileSync("/app/data/secchangelog.db", "utf8");
const re = /SOC-\d{4}\/\d{2}\/\d{2}-\d{4}/g;
const m = s.match(re);
console.log(m ? m.slice(0, 5) : "NO TICKET");
