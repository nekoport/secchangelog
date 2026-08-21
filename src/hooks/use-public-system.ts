"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";

interface PublicSystemIdentity {
  name: string;
  logoPath?: string;
  faviconPath?: string;
  defaultTheme?: string;
  footerText?: string;
}

export function usePublicSystem() {
  const query = useQuery<PublicSystemIdentity | null>({
    queryKey: ["public-system"],
    queryFn: async () => {
      const response = await fetch("/api/public/system", { cache: "no-store" });
      if (!response.ok) return null;
      const json = await response.json();
      return json.data as PublicSystemIdentity;
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  useEffect(() => {
    if (!query.data) return;
    document.title = query.data.name?.trim() || "SecChangeLog";
    const href = query.data.faviconPath ? "/api/files/favicon" : "/logo.svg";
    document.querySelectorAll<HTMLLinkElement>('link[rel="icon"]').forEach((link) => {
      link.href = href;
    });
  }, [query.data]);

  return { identity: query.data, isLoading: query.isLoading };
}
