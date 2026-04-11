import { getResolve } from "./client.js";

function getProject() {
  const resolve = getResolve();
  if (!resolve) {
    throw new Error("Resolve API not initialized");
  }

  const projectManager = resolve.GetProjectManager();
  const project = projectManager.GetCurrentProject();
  if (!project) {
    throw new Error("No project is currently open");
  }

  return project;
}

export function getCurrentTimeline() {
  const resolve = getResolve();
  if (!resolve) {
    return null;
  }

  const projectManager = resolve.GetProjectManager();
  const project = projectManager.GetCurrentProject();
  if (!project) {
    return null;
  }

  return project.GetCurrentTimeline() || null;
}

export function importMedia(filePath) {
  const project = getProject();
  const mediaPool = project.GetMediaPool();
  return mediaPool.ImportMedia([filePath]);
}

export function appendToTimeline(mediaPoolItem, options = {}) {
  const resolve = getResolve();
  if (!resolve) {
    throw new Error("Resolve API not initialized");
  }

  const project = getProject();
  const timeline = project.GetCurrentTimeline();
  if (!timeline) {
    throw new Error("No timeline is currently open");
  }

  const mediaPool = project.GetMediaPool();
  const clipInfo = { mediaPoolItem };

  if (options.startFrame !== undefined) {
    clipInfo.startFrame = options.startFrame;
  }
  if (options.endFrame !== undefined) {
    clipInfo.endFrame = options.endFrame;
  }
  if (options.mediaType !== undefined) {
    clipInfo.mediaType = options.mediaType;
  }

  return mediaPool.AppendToTimeline([clipInfo]);
}

export function importAndAppend(filePath, options = {}) {
  const imported = importMedia(filePath);

  if (!imported || imported.length === 0) {
    return { imported: [], timeline: [] };
  }

  const timeline = appendToTimeline(imported[0], options);
  return { imported, timeline };
}
