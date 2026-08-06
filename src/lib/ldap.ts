import { SystemSettingService } from "@/lib/services/system-setting.service";

interface LdapConfig {
  enabled: boolean;
  url: string;
  bindDn: string;
  bindPassword: string;
  searchBase: string;
  searchFilter: string;
}

interface LdapAuthResult {
  success: boolean;
  dn?: string;
  error?: string;
}

let cachedClient: import("ldapts").Client | null = null;
let cachedUrl = "";

async function getLdapClient(url: string) {
  const { Client } = await import("ldapts");
  if (cachedClient && cachedUrl === url) {
    return cachedClient;
  }
  if (cachedClient) {
    try {
      await cachedClient.unbind();
    } catch {
      // ignore
    }
  }
  cachedClient = new Client({ url, timeout: 10000, connectTimeout: 5000 });
  cachedUrl = url;
  return cachedClient;
}

export async function getLdapConfig(): Promise<LdapConfig> {
  return SystemSettingService.getLdapConfig();
}

export async function testLdapConnection(): Promise<{ ok: boolean; error?: string }> {
  try {
    const config = await getLdapConfig();
    if (!config.enabled || !config.url) {
      return { ok: false, error: "LDAP tidak diaktifkan atau URL kosong" };
    }
    const client = await getLdapClient(config.url);
    await client.bind(config.bindDn, config.bindPassword);
    await client.unbind();
    cachedClient = null;
    return { ok: true };
  } catch (err) {
    cachedClient = null;
    return { ok: false, error: (err as Error).message };
  }
}

export async function authenticateLdap(
  usernameOrDn: string,
  password: string
): Promise<LdapAuthResult> {
  const config = await getLdapConfig();
  if (!config.enabled) {
    return { success: false, error: "LDAP disabled" };
  }
  if (!config.url) {
    return { success: false, error: "LDAP URL not configured" };
  }

  let client: import("ldapts").Client | null = null;
  try {
    client = await getLdapClient(config.url);

    // If we have a DN, try direct bind
    if (usernameOrDn.startsWith("CN=") || usernameOrDn.startsWith("cn=")) {
      try {
        await client.bind(usernameOrDn, password);
        return { success: true, dn: usernameOrDn };
      } catch {
        return { success: false, error: "Bind failed with DN" };
      }
    }

    // Otherwise: bind as service account, search for user, then bind as user
    await client.bind(config.bindDn, config.bindPassword);

    const filter = config.searchFilter.replace(
      "{username}",
      escapeLdapFilter(usernameOrDn)
    );

    const searchResult = await client.search(config.searchBase, {
      scope: "sub",
      filter,
      attributes: ["dn"],
    });

    const userEntry = searchResult.searchEntries[0];
    if (!userEntry) {
      return { success: false, error: "User not found in LDAP" };
    }

    // Unbind service account, bind as user
    await client.unbind();
    client = await getLdapClient(config.url);
    await client.bind(userEntry.dn, password);

    return { success: true, dn: userEntry.dn };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  } finally {
    if (client) {
      try {
        await client.unbind();
      } catch {
        // ignore
      }
      cachedClient = null;
    }
  }
}

function escapeLdapFilter(input: string): string {
  return input.replace(/[*()\\\x00]/g, (match) => {
    return `\\${match.charCodeAt(0).toString(16).padStart(2, "0")}`;
  });
}
