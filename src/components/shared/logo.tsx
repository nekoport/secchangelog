"use client";

import Image from "next/image";
import { ShieldCheck } from "lucide-react";
import { useSystemSettings } from "@/hooks/use-system-settings";

export function Logo({
  size = 32,
  className,
}: {
  size?: number;
  className?: string;
}) {
  const { settings } = useSystemSettings();
  const logoPath = settings?.["system.logoPath"];

  if (logoPath) {
    return (
      <Image
        src={logoPath}
        alt="Logo"
        width={size}
        height={size}
        className={`object-contain ${className || ""}`}
        priority
      />
    );
  }

  return (
    <div
      className={`flex items-center justify-center rounded-md bg-primary/10 text-primary ${className || ""}`}
      style={{ width: size, height: size }}
    >
      <ShieldCheck className="h-2/3 w-2/3" />
    </div>
  );
}
