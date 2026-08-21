import dgram from "node:dgram";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { SystemSettingService } from "@/lib/services/system-setting.service";

// Seconds between the NTP epoch (1900-01-01) and UNIX epoch (1970-01-01)
const NTP_ERA = 2208988800;

export interface NtpCheckResult {
  success: boolean;
  server: string;
  offsetMs: number;
  roundTripMs: number;
  serverTimeIso: string;
  localTimeIso: string;
  error?: string;
}

export interface NtpSyncResult extends NtpCheckResult {
  applied: boolean;
}

function parseServer(input: string): { host: string; port: number } {
  const s = input.trim().replace(/^udp:\/\//i, "");
  if (!s || s.includes("/") || s.includes("\\") || /\s/.test(s)) {
    throw new Error("Alamat server NTP tidak valid");
  }

  const colon = s.lastIndexOf(":");
  if (colon > 0 && /^\d+$/.test(s.slice(colon + 1))) {
    const port = parseInt(s.slice(colon + 1), 10);
    if (port < 1 || port > 65535) throw new Error("Port tidak valid");
    return { host: s.slice(0, colon), port };
  }
  return { host: s, port: 123 };
}

function queryNtpServer(
  server: string,
  timeoutMs = 5000
): Promise<{ timeMs: number; roundTripMs: number }> {
  return new Promise((resolve, reject) => {
    let client: ReturnType<typeof dgram.createSocket>;
    try {
      client = dgram.createSocket("udp4");
    } catch (err) {
      reject(err instanceof Error ? err : new Error(String(err)));
      return;
    }

    const started = process.hrtime.bigint();
    let done = false;

    const finish = (err?: Error) => {
      if (done) return;
      if (err) {
        done = true;
        clearTimeout(timer);
        try {
          client.close();
        } catch {
          // ignore
        }
        reject(err);
      }
    };

    const timer = setTimeout(
      () => finish(new Error("NTP server timeout")),
      timeoutMs
    );

    client.on("error", (err) => finish(err));

    client.on("message", (msg) => {
      if (done) return;
      const roundTripNs = process.hrtime.bigint() - started;
      try {
        if (msg.length < 48) throw new Error("Respon NTP tidak valid");
        const seconds = msg.readUInt32BE(40);
        const fraction = msg.readUInt32BE(44);
        const epochMs =
          (seconds - NTP_ERA) * 1000 +
          Math.round((fraction / 0x100000000) * 1000);
        done = true;
        clearTimeout(timer);
        try {
          client.close();
        } catch {
          // ignore
        }
        resolve({
          timeMs: epochMs,
          roundTripMs: Number(roundTripNs) / 1e6,
        });
      } catch (err) {
        finish(err instanceof Error ? err : new Error("Respon NTP tidak valid"));
      }
    });

    try {
      const { host, port } = parseServer(server);
      const packet = Buffer.alloc(48);
      packet[0] = 0x1b; // LI=0, VN=3, Mode=3 (client)
      client.send(packet, 0, packet.length, port, host, (err) => {
        if (err) finish(err);
      });
    } catch (err) {
      finish(err instanceof Error ? err : new Error(String(err)));
    }
  });
}

/** Detect whether the process is allowed to change the system clock (CAP_SYS_TIME). */
function canSetSystemTime(): boolean {
  if (process.env.ALLOW_SYSTEM_TIME_SYNC !== "true") return false;
  try {
    const status = readFileSync("/proc/self/status", "utf8");
    const capEff = status.match(/^CapEff:\s*([0-9a-f]+)$/im)?.[1];
    if (!capEff) return false;
    const lowCapabilityBits = Number.parseInt(capEff.slice(-8), 16);
    const CAP_SYS_TIME = 0x02000000;
    return (lowCapabilityBits & CAP_SYS_TIME) !== 0;
  } catch {
    return false;
  }
}

function applySystemTime(unixSec: number): boolean {
  try {
    execFileSync("date", ["-s", `@${Math.floor(unixSec)}`], {
      timeout: 10_000,
    });
    const out = execFileSync("date", ["+%s"], { timeout: 5000 })
      .toString()
      .trim();
    const appliedSec = parseInt(out, 10);
    return Math.abs(appliedSec - Math.floor(unixSec)) <= 2;
  } catch {
    return false;
  }
}

export class NtpService {
  static async getServer(): Promise<string> {
    const value = await SystemSettingService.get("ntp.server");
    return value || "id.pool.ntp.org";
  }

  static async check(inputServer?: string): Promise<NtpCheckResult> {
    const server = inputServer?.trim() || (await this.getServer());
    try {
      const { timeMs, roundTripMs } = await queryNtpServer(server);
      const now = Date.now();
      // Adjust for network delay (half the round-trip)
      const adjustedMs = timeMs + roundTripMs / 2;
      return {
        success: true,
        server,
        offsetMs: Math.round(adjustedMs - now),
        roundTripMs: Math.round(roundTripMs),
        serverTimeIso: new Date(adjustedMs).toISOString(),
        localTimeIso: new Date(now).toISOString(),
      };
    } catch (err) {
      return {
        success: false,
        server,
        offsetMs: 0,
        roundTripMs: 0,
        serverTimeIso: "",
        localTimeIso: new Date().toISOString(),
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  static async sync(inputServer?: string): Promise<NtpSyncResult> {
    const server = inputServer?.trim() || (await this.getServer());
    try {
      if (!canSetSystemTime()) {
        throw new Error("Sinkronisasi waktu sistem dinonaktifkan pada kontainer");
      }
      const { timeMs, roundTripMs } = await queryNtpServer(server);
      const adjustedMs = timeMs + roundTripMs / 2;
      const applied = applySystemTime(adjustedMs / 1000);
      const now = Date.now();
      return {
        success: true,
        server,
        offsetMs: Math.round(adjustedMs - now),
        roundTripMs: Math.round(roundTripMs),
        serverTimeIso: new Date(adjustedMs).toISOString(),
        localTimeIso: new Date(now).toISOString(),
        applied,
      };
    } catch (err) {
      return {
        success: false,
        server,
        offsetMs: 0,
        roundTripMs: 0,
        serverTimeIso: "",
        localTimeIso: new Date().toISOString(),
        applied: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  static getCapability(): boolean {
    return canSetSystemTime();
  }
}
