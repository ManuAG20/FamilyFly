import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";

export type CacheEnvelope<T> = {
  value: T;
  fetchedAt: number;
};

export interface FlightCache {
  get<T>(key: string): CacheEnvelope<T> | null;
  getStale<T>(key: string, maxStaleMs: number): CacheEnvelope<T> | null;
  set<T>(key: string, value: T, ttlMs: number, fetchedAt?: number): void;
  delete(key: string): void;
}

type CacheRow = {
  payload: string;
  fetched_at: number;
  expires_at: number;
};

const DEFAULT_TTL_HOURS = 6;
const DEFAULT_STALE_HOURS = 24;
const MAX_TTL_HOURS = 168;
const MAX_STALE_HOURS = 720;
const CLEANUP_INTERVAL = 100;
const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

export class MemoryFlightCache implements FlightCache {
  private readonly entries = new Map<string, { payload: string; fetchedAt: number; expiresAt: number }>();
  private writes = 0;

  constructor(private readonly now: () => number = Date.now) {}

  get<T>(key: string): CacheEnvelope<T> | null {
    const entry = this.entries.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= this.now()) return null;
    const value = parseValue<T>(entry.payload);
    return value === null ? null : { value, fetchedAt: entry.fetchedAt };
  }

  getStale<T>(key: string, maxStaleMs: number): CacheEnvelope<T> | null {
    const entry = this.entries.get(key);
    if (!entry) return null;
    if (this.now() - entry.fetchedAt > maxStaleMs) return null;
    const value = parseValue<T>(entry.payload);
    return value === null ? null : { value, fetchedAt: entry.fetchedAt };
  }

  set<T>(key: string, value: T, ttlMs: number, fetchedAt = this.now()): void {
    const expiresAt = fetchedAt + Math.max(0, ttlMs);
    this.entries.set(key, {
      payload: JSON.stringify(value),
      fetchedAt,
      expiresAt,
    });
    this.writes += 1;
    if (this.writes % CLEANUP_INTERVAL === 0) this.cleanup();
  }

  delete(key: string): void {
    this.entries.delete(key);
  }

  clear(): void {
    this.entries.clear();
  }

  private cleanup(): void {
    const threshold = this.now() - RETENTION_MS;
    for (const [key, entry] of this.entries) {
      if (entry.expiresAt < threshold) this.entries.delete(key);
    }
  }
}

export class SqliteFlightCache implements FlightCache {
  private readonly db: DatabaseSync;
  private writes = 0;

  constructor(
    path = defaultCachePath(),
    private readonly now: () => number = Date.now,
  ) {
    if (path !== ":memory:") {
      mkdirSync(dirname(path), { recursive: true });
    }

    this.db = new DatabaseSync(path);
    this.db.exec("PRAGMA busy_timeout = 2000");
    if (path !== ":memory:") {
      this.db.exec("PRAGMA journal_mode = WAL");
    }
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS flight_cache (
        cache_key TEXT PRIMARY KEY,
        payload TEXT NOT NULL,
        fetched_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
      ) STRICT;
      CREATE INDEX IF NOT EXISTS flight_cache_expires_at
        ON flight_cache (expires_at);
    `);
  }

  get<T>(key: string): CacheEnvelope<T> | null {
    const row = this.db
      .prepare("SELECT payload, fetched_at, expires_at FROM flight_cache WHERE cache_key = ?")
      .get(key) as CacheRow | undefined;

    if (!row || Number(row.expires_at) <= this.now()) return null;
    const value = parseValue<T>(row.payload);
    return value === null ? null : { value, fetchedAt: Number(row.fetched_at) };
  }

  getStale<T>(key: string, maxStaleMs: number): CacheEnvelope<T> | null {
    const row = this.db
      .prepare("SELECT payload, fetched_at, expires_at FROM flight_cache WHERE cache_key = ?")
      .get(key) as CacheRow | undefined;

    if (!row) return null;
    if (this.now() - Number(row.fetched_at) > maxStaleMs) return null;
    const value = parseValue<T>(row.payload);
    return value === null ? null : { value, fetchedAt: Number(row.fetched_at) };
  }

  set<T>(key: string, value: T, ttlMs: number, fetchedAt = this.now()): void {
    const expiresAt = fetchedAt + Math.max(0, ttlMs);
    this.db
      .prepare(
        `INSERT INTO flight_cache (cache_key, payload, fetched_at, expires_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(cache_key) DO UPDATE SET
           payload = excluded.payload,
           fetched_at = excluded.fetched_at,
           expires_at = excluded.expires_at`,
      )
      .run(key, JSON.stringify(value), fetchedAt, expiresAt);

    this.writes += 1;
    if (this.writes % CLEANUP_INTERVAL === 0) this.cleanup();
  }

  delete(key: string): void {
    this.db.prepare("DELETE FROM flight_cache WHERE cache_key = ?").run(key);
  }

  close(): void {
    this.db.close();
  }

  private cleanup(): void {
    this.db
      .prepare("DELETE FROM flight_cache WHERE expires_at < ?")
      .run(this.now() - RETENTION_MS);
  }
}

export function getFlightCacheTtlMs(): number {
  return readHours("FLIGHT_CACHE_TTL_HOURS", DEFAULT_TTL_HOURS, MAX_TTL_HOURS);
}

export function getFlightCacheStaleMs(): number {
  return readHours("FLIGHT_CACHE_STALE_HOURS", DEFAULT_STALE_HOURS, MAX_STALE_HOURS);
}

export function defaultCachePath(): string {
  const configured = process.env.FLIGHT_CACHE_PATH?.trim();
  if (configured) return configured;
  if (process.env.VERCEL) return join(tmpdir(), "familyfly-flight-cache.sqlite");
  return join(process.cwd(), ".data", "flight-cache.sqlite");
}

let sharedCache: FlightCache | undefined;

export function getFlightCache(): FlightCache {
  sharedCache ??= createFlightCache();
  return sharedCache;
}

export function resetFlightCacheForTests(): void {
  sharedCache = undefined;
}

export function createFlightCache(): FlightCache {
  if (process.env.FLIGHT_CACHE_BACKEND?.toLowerCase() === "memory") {
    return new MemoryFlightCache();
  }

  try {
    return new SqliteFlightCache();
  } catch (error) {
    console.warn(
      "No se pudo abrir la caché SQLite; se usará memoria.",
      error instanceof Error ? error.message : error,
    );
    return new MemoryFlightCache();
  }
}

function readHours(name: string, fallback: number, max: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") return fallback * 60 * 60 * 1000;

  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) return fallback * 60 * 60 * 1000;
  return Math.min(value, max) * 60 * 60 * 1000;
}

function parseValue<T>(payload: string): T | null {
  try {
    return JSON.parse(payload) as T;
  } catch {
    return null;
  }
}
