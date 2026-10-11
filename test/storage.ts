/**
 * Integration-test access to the dev R2 bucket (architecture §7h), by the same unprefixed paths
 * the database stores. Tests seed and inspect objects through this, never through a route; the
 * app itself only reaches storage through lib/media/ and lib/storage/.
 */
import {
  CAPTURES_PREFIX,
  THEME_PREFIX,
  deleteKeys,
  getObject,
  headObject,
  listKeys,
  putObject,
} from "@/lib/storage/r2";

function area(prefix: string) {
  const key = (path: string) => `${prefix}${path}`;
  return {
    put: (path: string, bytes: Buffer, contentType: string) => putObject(key(path), bytes, contentType),
    get: (path: string) => getObject(key(path)),
    exists: async (path: string) => (await headObject(key(path))) !== null,
    head: (path: string) => headObject(key(path)),
    /** Paths (unprefixed) under a folder, e.g. an event id or a capture's base path. */
    list: async (folder: string) =>
      (await listKeys(key(folder.endsWith("/") ? folder : `${folder}/`))).map((k) => k.slice(prefix.length)),
    remove: (paths: string[]) => deleteKeys(paths.map(key)),
  };
}

export const captureStorage = area(CAPTURES_PREFIX);
export const themeStorage = area(THEME_PREFIX);
