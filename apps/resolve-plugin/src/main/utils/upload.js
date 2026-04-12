import { readFileSync } from "fs";
import { basename } from "path";

export async function uploadFileForUrl(filePath) {
  const fileName = basename(filePath);
  const fileBuffer = readFileSync(filePath);
  const blob = new Blob([fileBuffer]);
  const form = new FormData();
  form.append("file", blob, fileName);

  const res = await fetch("https://tmpfiles.org/api/v1/upload", {
    method: "POST",
    body: form,
  });

  if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
  const data = await res.json();
  const viewUrl = data.data?.url;
  if (!viewUrl) throw new Error("Upload returned no URL");
  return viewUrl.replace("tmpfiles.org/", "tmpfiles.org/dl/");
}
