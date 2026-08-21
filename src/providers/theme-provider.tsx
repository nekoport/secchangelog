"use client";

import { useEffect } from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ThemeProviderProps } from "next-themes";
import { setNonce } from "get-nonce";

export function ThemeProvider({ children, nonce, ...props }: ThemeProviderProps) {
  useEffect(() => {
    if (nonce) setNonce(nonce);
  }, [nonce]);

  return (
    <NextThemesProvider nonce={nonce} {...props}>
      {children}
    </NextThemesProvider>
  );
}
