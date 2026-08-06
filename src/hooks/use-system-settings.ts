"use client";

import { useQuery } from "@tanstack/react-query";

export function useSystemSettings() {
  const { data, isLoading } = useQuery({
    queryKey: ["system-settings"],
    queryFn: async () => {
      const res = await fetch("/api/admin/settings");
      if (!res.ok) return null;
      const json = await res.json();
      return json.data as Record<string, string>;
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  return { settings: data, isLoading };
}
