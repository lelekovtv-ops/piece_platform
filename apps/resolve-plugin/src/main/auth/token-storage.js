import {
  readFile,
  writeFile,
  rename,
  unlink,
  mkdir,
  chmod,
} from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { join } from "node:path";
import { Encryption } from "@piece/encryption";

const KEYFILE = ".keyfile";
const AUTH_FILE = "auth.enc";

export async function getOrCreateKey(dataDir) {
  const keyPath = join(dataDir, KEYFILE);
  try {
    const hex = await readFile(keyPath, "utf-8");
    return hex.trim();
  } catch (err) {
    if (err.code !== "ENOENT") throw err;
  }

  await mkdir(dataDir, { recursive: true });
  const key = randomBytes(32).toString("hex");
  await writeFile(keyPath, key, "utf-8");
  await chmod(keyPath, 0o600);
  return key;
}

export async function saveToken(dataDir, tokenData) {
  const key = await getOrCreateKey(dataDir);
  const enc = new Encryption(key);
  const cipher = enc.encrypt(JSON.stringify(tokenData));

  await mkdir(dataDir, { recursive: true });
  const authPath = join(dataDir, AUTH_FILE);
  const tmpPath = authPath + ".tmp";
  await writeFile(tmpPath, cipher, "utf-8");
  await rename(tmpPath, authPath);
}

export async function loadToken(dataDir) {
  try {
    const key = await getOrCreateKey(dataDir);
    const enc = new Encryption(key);
    const cipher = await readFile(join(dataDir, AUTH_FILE), "utf-8");
    const plain = enc.decrypt(cipher);
    return JSON.parse(plain);
  } catch (err) {
    if (err.code === "ENOENT") return null;
    return null;
  }
}

export async function clearToken(dataDir) {
  try {
    await unlink(join(dataDir, AUTH_FILE));
  } catch (err) {
    if (err.code !== "ENOENT") throw err;
  }
}
