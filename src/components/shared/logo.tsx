"use client";

import { ShieldCheck } from "lucide-react";
import { usePublicSystem } from "@/hooks/use-public-system";

export function Logo({
  size = 32,
  className,
}: {
  size?: number;
  className?: string;
}) {
  const { identity } = usePublicSystem();
  const logoPath = identity?.logoPath;

  if (logoPath) {
    return (
      <img
        src={"/api/files/logo"}
        alt="Logo"
        width={size}
        height={size}
        className={`object-contain ${className || ""}`}
      />
    );
  }

  return (
    <div
      className={`relative flex items-center justify-center rounded-md border border-primary/25 bg-primary/[0.09] text-primary shadow-[0_0_0_1px_color-mix(in_oklab,var(--primary)_6%,transparent)_inset] ${className || ""}`}
      style={{ width: size, height: size }}
    >
      <span className="absolute left-1 top-1 h-1 w-1 border-l border-t border-current opacity-70" />
      <span className="absolute bottom-1 right-1 h-1 w-1 border-b border-r border-current opacity-70" />
      <ShieldCheck className="h-[58%] w-[58%]" strokeWidth={1.8} />
    </div>
  );
}
