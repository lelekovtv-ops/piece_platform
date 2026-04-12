import { existsSync, mkdirSync } from "fs";
import { join } from "path";
import { getResolve } from "./client.js";

export function snapshotCurrentFrame(outputDir, options = {}) {
  const resolve = getResolve();
  if (!resolve) {
    throw new Error("Resolve API not initialized");
  }

  const projectManager = resolve.GetProjectManager();
  const project = projectManager.GetCurrentProject();
  if (!project) {
    throw new Error("No project is currently open");
  }

  const timeline = project.GetCurrentTimeline();
  if (!timeline) {
    throw new Error("No timeline is currently open");
  }

  const still = timeline.GrabStill();
  if (!still) {
    throw new Error("Failed to grab still from timeline");
  }

  const gallery = project.GetGallery();
  const album = gallery.GetCurrentStillAlbum();

  const format = options.format || "png";
  const filePrefix = `piece-snapshot-${Date.now()}`;

  mkdirSync(outputDir, { recursive: true });

  const exported = album.ExportStills([still], outputDir, filePrefix, format);
  if (!exported) {
    throw new Error("Failed to export still");
  }

  const expectedPath = join(outputDir, `${filePrefix}.${format}`);
  if (!existsSync(expectedPath)) {
    throw new Error(
      `Exported file not found at expected path: ${expectedPath}`,
    );
  }

  return expectedPath;
}
