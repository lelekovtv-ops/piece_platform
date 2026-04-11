import { existsSync, lstatSync, symlinkSync, mkdirSync } from "fs";
import { join, resolve } from "path";
import { homedir, platform } from "os";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const pluginRoot = resolve(__dirname, "..");

const PLUGIN_NAME = "PIECE Studio";

function getResolvePluginsDir() {
  const os = platform();

  if (os === "darwin") {
    return join(
      homedir(),
      "Library",
      "Application Support",
      "Blackmagic Design",
      "DaVinci Resolve",
      "Workflow Integration Plugins",
    );
  }

  if (os === "win32") {
    return join(
      process.env.PROGRAMDATA || "C:\\ProgramData",
      "Blackmagic Design",
      "DaVinci Resolve",
      "Support",
      "Workflow Integration Plugins",
    );
  }

  console.error(
    `Unsupported platform: ${os}. Only macOS and Windows are supported.`,
  );
  process.exit(1);
}

const pluginsDir = getResolvePluginsDir();
const targetPath = join(pluginsDir, PLUGIN_NAME);

if (!existsSync(pluginsDir)) {
  console.log(`Creating plugins directory: ${pluginsDir}`);
  mkdirSync(pluginsDir, { recursive: true });
}

if (existsSync(targetPath)) {
  try {
    const stats = lstatSync(targetPath);
    if (stats.isSymbolicLink()) {
      console.log(`Symlink already exists: ${targetPath}`);
      console.log("Remove it manually if you want to re-link.");
      process.exit(0);
    }
  } catch {
    // lstat failed — path may be broken symlink, proceed
  }

  console.error(`Target path exists and is NOT a symlink: ${targetPath}`);
  console.error(
    "Will not overwrite a real installation. Remove it manually first.",
  );
  process.exit(1);
}

symlinkSync(pluginRoot, targetPath, "dir");
console.log(`Symlink created:`);
console.log(`  ${targetPath} -> ${pluginRoot}`);
console.log("");
console.log("Restart DaVinci Resolve to load the plugin.");
