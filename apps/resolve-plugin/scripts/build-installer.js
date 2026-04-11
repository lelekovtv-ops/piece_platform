import { existsSync, mkdirSync, cpSync, readFileSync, writeFileSync } from "fs";
import { join, resolve } from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const pluginRoot = resolve(__dirname, "..");

const pkg = JSON.parse(readFileSync(join(pluginRoot, "package.json"), "utf-8"));
const version = pkg.version || "0.1.0";
const releaseName = `PIECE_Studio_v${version}`;
const releaseDir = join(pluginRoot, "release", "PIECE Studio");
const zipPath = join(pluginRoot, "release", `${releaseName}.zip`);

console.log(`Building PIECE Studio v${version}...`);

// Step 1: Run build
console.log("\n[1/4] Building plugin...");
execSync("pnpm run build", { cwd: pluginRoot, stdio: "inherit" });

// Step 2: Verify build artifacts
console.log("\n[2/4] Verifying build artifacts...");
const requiredFiles = [
  "main.js",
  "preload.js",
  "dist/renderer/index.html",
  "manifest.xml",
];

for (const file of requiredFiles) {
  const fullPath = join(pluginRoot, file);
  if (!existsSync(fullPath)) {
    console.error(`ERROR: Required file missing: ${file}`);
    process.exit(1);
  }
}

// Step 3: Assemble release folder
console.log("\n[3/4] Assembling release folder...");
if (existsSync(releaseDir)) {
  execSync(`rm -rf "${releaseDir}"`);
}
mkdirSync(releaseDir, { recursive: true });

// Copy manifest
cpSync(join(pluginRoot, "manifest.xml"), join(releaseDir, "manifest.xml"));

// Copy main process and preload
cpSync(join(pluginRoot, "main.js"), join(releaseDir, "main.js"));
cpSync(join(pluginRoot, "preload.js"), join(releaseDir, "preload.js"));

// Copy renderer dist
cpSync(
  join(pluginRoot, "dist", "renderer"),
  join(releaseDir, "dist", "renderer"),
  {
    recursive: true,
  },
);

// Copy installer scripts
const installerSrc = join(pluginRoot, "src", "installer", "macos");
if (existsSync(installerSrc)) {
  cpSync(
    join(installerSrc, "install.command"),
    join(releaseDir, "install.command"),
  );
  cpSync(
    join(installerSrc, "uninstall.command"),
    join(releaseDir, "uninstall.command"),
  );
  // Ensure executable
  execSync(`chmod +x "${join(releaseDir, "install.command")}"`);
  execSync(`chmod +x "${join(releaseDir, "uninstall.command")}"`);
}

// Write version file
writeFileSync(join(releaseDir, "VERSION"), version, "utf-8");

// Step 4: Create zip
console.log("\n[4/4] Creating zip archive...");
if (existsSync(zipPath)) {
  execSync(`rm -f "${zipPath}"`);
}
execSync(
  `cd "${join(pluginRoot, "release")}" && zip -r "${zipPath}" "PIECE Studio/"`,
  {
    stdio: "inherit",
  },
);

console.log(`\nDone! Release package: ${zipPath}`);
console.log(`\nContents:`);
execSync(`unzip -l "${zipPath}" | tail -20`, { stdio: "inherit" });
