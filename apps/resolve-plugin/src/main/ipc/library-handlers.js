import { readdirSync, statSync, mkdirSync, copyFileSync, unlinkSync, readFileSync, writeFileSync, existsSync } from "fs";
import { join, basename, extname } from "path";
import crypto from "crypto";
import { LIBRARY_CHANNELS } from "../../shared/ipc-channels.js";
import { uploadFileForUrl } from "../utils/upload.js";

const IMAGE_EXTS = new Set([".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tiff"]);
const VIDEO_EXTS = new Set([".mp4", ".mov", ".webm", ".mkv", ".avi"]);
const AUDIO_EXTS = new Set([".mp3", ".wav", ".ogg", ".flac", ".aac", ".m4a"]);

function classifyFile(name) {
  const ext = extname(name).toLowerCase();
  if (IMAGE_EXTS.has(ext)) return "image";
  if (VIDEO_EXTS.has(ext)) return "video";
  if (AUDIO_EXTS.has(ext)) return "audio";
  return null;
}

function loadManifest(manifestPath) {
  try {
    if (existsSync(manifestPath)) {
      return JSON.parse(readFileSync(manifestPath, "utf-8"));
    }
  } catch {
    // Ignore corrupt manifest
  }
  return {};
}

function saveManifest(manifestPath, manifest) {
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
}

function scanDir(dirPath) {
  try {
    mkdirSync(dirPath, { recursive: true });
    return readdirSync(dirPath);
  } catch {
    return [];
  }
}

export function registerLibraryHandlers(handlers, { downloadDir, uploadsDir, dataDir, logger }) {
  const log = logger.createComponentLogger
    ? logger.createComponentLogger("Library")
    : logger;

  const manifestPath = join(dataDir, "library.json");

  handlers[LIBRARY_CHANNELS.list] = () => {
    const manifest = loadManifest(manifestPath);
    const items = [];

    for (const dir of [downloadDir, uploadsDir]) {
      const files = scanDir(dir);
      for (const name of files) {
        const type = classifyFile(name);
        if (!type) continue;

        const filePath = join(dir, name);
        try {
          const stats = statSync(filePath);
          const id = crypto.createHash("md5").update(filePath).digest("hex").slice(0, 12);
          const meta = manifest[filePath] || {};

          items.push({
            id,
            name,
            path: filePath,
            type,
            url: meta.originalUrl || null,
            createdAt: meta.createdAt || stats.mtimeMs,
            size: stats.size,
          });
        } catch {
          // Skip inaccessible files
        }
      }
    }

    items.sort((a, b) => b.createdAt - a.createdAt);
    return items;
  };

  handlers[LIBRARY_CHANNELS.import] = (filePath) => {
    if (!filePath || !existsSync(filePath)) {
      throw new Error("File not found");
    }

    mkdirSync(uploadsDir, { recursive: true });
    const name = basename(filePath);
    const dest = join(uploadsDir, `${Date.now()}-${name}`);
    copyFileSync(filePath, dest);

    const manifest = loadManifest(manifestPath);
    manifest[dest] = { createdAt: Date.now() };
    saveManifest(manifestPath, manifest);

    log.info("File imported to library", { dest });
    return { path: dest };
  };

  handlers[LIBRARY_CHANNELS.remove] = (itemId) => {
    const allItems = handlers[LIBRARY_CHANNELS.list]();
    const item = allItems.find((i) => i.id === itemId);
    if (!item) throw new Error("Item not found");

    try {
      unlinkSync(item.path);
    } catch {
      // File already gone
    }

    const manifest = loadManifest(manifestPath);
    delete manifest[item.path];
    saveManifest(manifestPath, manifest);

    log.info("Library item removed", { id: itemId, path: item.path });
  };

  handlers[LIBRARY_CHANNELS.getUrl] = async (itemId) => {
    const allItems = handlers[LIBRARY_CHANNELS.list]();
    const item = allItems.find((i) => i.id === itemId);
    if (!item) throw new Error("Item not found");

    if (item.url) return item.url;

    const url = await uploadFileForUrl(item.path);

    const manifest = loadManifest(manifestPath);
    manifest[item.path] = { ...manifest[item.path], originalUrl: url };
    saveManifest(manifestPath, manifest);

    log.info("File uploaded for URL", { id: itemId, url });
    return url;
  };
}

export function addToLibraryManifest(dataDir, filePath, meta = {}) {
  const manifestPath = join(dataDir, "library.json");
  const manifest = loadManifest(manifestPath);
  manifest[filePath] = {
    createdAt: Date.now(),
    ...meta,
  };
  saveManifest(manifestPath, manifest);
}
