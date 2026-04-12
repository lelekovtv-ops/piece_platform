import { getResolve } from "./client.js";

const PIECE_FOLDER_NAME = "PIECE Generations";

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

function findSubFolder(parentFolder, name) {
  const subFolders = parentFolder.GetSubFolderList();
  if (!subFolders) return null;
  for (const folder of subFolders) {
    if (folder.GetName() === name) return folder;
  }
  return null;
}

export function ensurePieceFolder() {
  const project = getProject();
  const mediaPool = project.GetMediaPool();
  const rootFolder = mediaPool.GetRootFolder();

  let pieceFolder = findSubFolder(rootFolder, PIECE_FOLDER_NAME);
  if (!pieceFolder) {
    mediaPool.SetCurrentFolder(rootFolder);
    pieceFolder = mediaPool.AddSubFolder(rootFolder, PIECE_FOLDER_NAME);
  }
  return { mediaPool, pieceFolder };
}

export function importMedia(filePath) {
  const project = getProject();
  const mediaPool = project.GetMediaPool();
  return mediaPool.ImportMedia([filePath]);
}

export function importToFolder(filePath) {
  const { mediaPool, pieceFolder } = ensurePieceFolder();
  mediaPool.SetCurrentFolder(pieceFolder);
  const imported = mediaPool.ImportMedia([filePath]);
  return imported;
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
  const imported = importToFolder(filePath);

  if (!imported || imported.length === 0) {
    return { imported: [], timeline: [] };
  }

  const timeline = appendToTimeline(imported[0], options);
  return { imported, timeline };
}

export function listMediaPoolClips() {
  const project = getProject();
  const mediaPool = project.GetMediaPool();
  const rootFolder = mediaPool.GetRootFolder();

  const clips = [];

  function walkFolder(folder, path) {
    const items = folder.GetClipList();
    if (items) {
      for (const item of items) {
        const filePath = item.GetClipProperty("File Path") || "";
        const name = item.GetName() || "";
        const type = item.GetClipProperty("Type") || "";
        if (filePath) {
          clips.push({
            name,
            path: filePath,
            folder: path,
            type: type.toLowerCase(),
          });
        }
      }
    }
    const subFolders = folder.GetSubFolderList();
    if (subFolders) {
      for (const sub of subFolders) {
        walkFolder(sub, `${path}/${sub.GetName()}`);
      }
    }
  }

  walkFolder(rootFolder, "Master");
  return clips;
}
