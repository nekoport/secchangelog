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
  const res = await fetch(base + "/api/change-logs?page=1&pageSize=1", { headers: { Cookie: cookie } });
  console.log("list status:", res.status);
  const txt = await res.text();
  console.log("body head:", txt.slice(0, 400));
}
main().catch((e) => { console.error(e.message); process.exit(1); });