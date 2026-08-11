import { db } from "@/lib/db";
import { DEFAULT_SETTINGS } from "@/lib/constants";
import { decryptSecret } from "@/lib/security/ldap-crypto";

export class SystemSettingService {
  private static cache: Map<string, string> | null = null;
  private static cacheExpiry: number = 0;
  private static readonly CACHE_TTL_MS = 30 * 1000; // 30 seconds

  static async getAll(): Promise<Record<string, string>> {
    // Check cache
    if (this.cache && Date.now() < this.cacheExpiry) {
      return Object.fromEntries(this.cache);
    }

    const settings = await db.systemSetting.findMany();
    const map = new Map<string, string>();

    // Start with defaults
    for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) {
      map.set(k, v);
    }

    // Override with DB values
    for (const s of settings) {
      map.set(s.key, s.value);
    }

    this.cache = map;
    this.cacheExpiry = Date.now() + this.CACHE_TTL_MS;

    return Object.fromEntries(map);
  }

  static async get(key: string): Promise<string> {
    const all = await this.getAll();
    return all[key] ?? DEFAULT_SETTINGS[key as keyof typeof DEFAULT_SETTINGS] ?? "";
  }

  static async getJSON<T>(key: string): Promise<T | null> {
    const value = await this.get(key);
    if (!value) return null;
    try {
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  }

  static async set(key: string, value: string, userId: string): Promise<void> {
    await db.systemSetting.upsert({
      where: { key },
      create: { key, value, updatedById: userId },
      update: { value, updatedById: userId },
    });
    this.invalidateCache();
  }

  static async setMany(
    entries: Record<string, string>,
    userId: string
  ): Promise<void> {
    await db.$transaction(
      Object.entries(entries).map(([key, value]) =>
        db.systemSetting.upsert({
          where: { key },
          create: { key, value, updatedById: userId },
          update: { value, updatedById: userId },
        })
      )
    );
    this.invalidateCache();
  }

  static invalidateCache() {
    this.cache = null;
    this.cacheExpiry = 0;
  }

  static async getSystemName(): Promise<string> {
    return this.get("system.name");
  }

  static async getLogoPath(): Promise<string> {
    return this.get("system.logoPath");
  }

  static async getDefaultTheme(): Promise<"light" | "dark"> {
    const t = await this.get("system.defaultTheme");
    return t === "light" ? "light" : "dark";
  }

  static async isLdapEnabled(): Promise<boolean> {
    return (await this.get("ldap.enabled")) === "true";
  }

  static async getLdapConfig() {
    const all = await this.getAll();
    return {
      enabled: all["ldap.enabled"] === "true",
      url: all["ldap.url"],
      bindDn: all["ldap.bindDn"],
      bindPassword: decryptSecret(all["ldap.bindPassword"]),
      searchBase: all["ldap.searchBase"],
      searchFilter: all["ldap.searchFilter"],
    };
  }
}
