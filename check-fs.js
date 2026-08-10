const fs = require("fs/promises");
const path = require("path");
(async () => {
  const logoFile = "/uploads/logos/system-logo.png";
  const logoFullPath = path.join(process.cwd(), "public", logoFile);
  console.log("path:", logoFullPath);
  try {
    const b = await fs.readFile(logoFullPath);
    console.log("readFile OK bytes:", b.length, "type:", b.constructor.name);
  } catch (e) {
    console.log("readFile FAIL:", e.message);
  }
})();
