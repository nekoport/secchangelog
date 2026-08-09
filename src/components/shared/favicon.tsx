"use client";

import { useEffect } from "react";
import { useSystemSettings } from "@/hooks/use-system-settings";

export function Favicon() {
  const { settings } = useSystemSettings();
  const faviconPath = settings?.["system.faviconPath"] || "";

  useEffect(() => {
    let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (faviconPath) {
      if (!link) {
        link = document.createElement("link");
        link.rel = "icon";
        document.head.appendChild(link);
      }
      link.href = faviconPath;
      link.type = faviconPath.endsWith(".svg")
        ? "image/svg+xml"
        : faviconPath.endsWith(".ico")
        ? "image/x-icon"
        : "image/png";
    } else if (link) {
      link.remove();
    }
  }, [faviconPath]);

  return null;
}