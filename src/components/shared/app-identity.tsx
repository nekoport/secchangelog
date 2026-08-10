"use client";

import { useEffect, useState } from "react";

interface SystemIdentity {
  name: string;
  logoPath?: string;
  faviconPath?: string;
  defaultTheme: string;
}

// Fetches the public system identity endpoint and applies the
// system name to the browser tab title and the favicon link.
// Works on public pages (e.g. /login) too because it needs no session.
export function AppIdentity() {
  const [identity, setIdentity] = useState<SystemIdentity | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/public/system", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (!cancelled && json?.data) setIdentity(json.data as SystemIdentity);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const name = identity?.name?.trim() || "SecChangeLog";
    if (document.title !== name) {
      document.title = name;
    }

    const faviconPath = identity?.faviconPath || "";
    let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (faviconPath) {
      if (!link) {
        link = document.createElement("link");
        link.rel = "icon";
        document.head.appendChild(link);
      }
      const faviconExt = faviconPath.split("?")[0];
      link.href = faviconPath;
      link.type = faviconExt.endsWith(".svg")
        ? "image/svg+xml"
        : faviconExt.endsWith(".ico")
        ? "image/x-icon"
        : "image/png";
    } else if (link) {
      link.remove();
    }
  }, [identity]);

  return null;
}