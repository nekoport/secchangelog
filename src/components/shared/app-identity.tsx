"use client";

import { useEffect, useState } from "react";

interface SystemIdentity {
  name: string;
  logoPath?: string;
  faviconPath?: string;
  defaultTheme: string;
}

// Fetches the public system identity endpoint and applies the
// system name to the browser tab title. The favicon is resolved by server
// metadata so React remains the sole owner of nodes inside <head>.
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

  }, [identity]);

  return null;
}
