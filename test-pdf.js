const base = process.env.BASE || "http://127.0.0.1:3000";
const fs = require("fs");
function parseCookies(h) {
  const out = [];
  if (!h) return out;
  for (const part of h.split(/,(?=\s*[^;]+=[^;]+[,;]?)/)) {
    const m = part.match(/^\s*([^=;]+)=([^;]*)/);
    if (m) out.push(m[1] + "=" + m[2]);
  }
  return out;
}
async function main() {
  const csrfRes = await fetch(base + "/api/auth/csrf");
  const csrf = await csrfRes.json();
  const jar = parseCookies(csrfRes.headers.get("set-cookie"));
  const loginRes = await fetch(base + "/api/auth/callback/credentials", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: jar.join("; ") },
    body: new URLSearchParams({ csrfToken: csrf.csrfToken, email: "admin@secchangelog.local", password: "Admin@12345" }),
    redirect: "manual",
  });
  for (const c of parseCookies(loginRes.headers.get("set-cookie"))) jar.push(c);
  const cookie = jar.join("; ");
  const listRes = await fetch(base + "/api/change-logs?page=1&pageSize=1", { headers: { Cookie: cookie } });
  const listJson = await listRes.json();
  const first = listJson.data?.[0];
  if (!first) { console.log("[no items]"); return; }
  console.log("[ticket]", first.ticketId, first.id);
  const pdfRes = await fetch(base + "/api/export/pdf/" + first.id, { headers: { Cookie: cookie } });
  const buf = Buffer.from(await pdfRes.arrayBuffer());
  console.log("[pdf] status:", pdfRes.status, "bytes:", buf.length);
  fs.writeFileSync("/tmp/real-export.pdf", buf);
  const str = buf.toString("latin1");
  const images = (str.match(/\/Subtype\s*\/Image/g) || []).length;
  console.log("[pdf] image objects:", images);
}
main().catch((e) => { console.error(e.message); process.exit(1); });