const fs = require("fs");
const cwd = fs.readlinkSync("/proc/1/cwd");
console.log("proc1 cwd:", cwd);
const env = fs.readFileSync("/proc/1/environ");
const vars = {};
env.toString().split("\0").forEach((kv) => {
  const i = kv.indexOf("=");
  if (i > 0) vars[kv.slice(0, i)] = kv.slice(i + 1);
});
console.log("UPLOAD_DIR:", vars.UPLOAD_DIR || "(not set)");
console.log("PWD:", vars.PWD || "(not set)");
const p = require("path");
const logoFullPath = p.join(cwd, "public", "/uploads/logos/system-logo.png");
console.log("resolved:", logoFullPath, "exists:", fs.existsSync(logoFullPath));
