import type { RawImage } from "./importPicture";

export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const NOT_A_PICTURE = "That file isn't a picture we can use. Try a PNG.";

const MAX_SIDE = 256; // very large pictures are shrunk on the way in, so importing stays quick

// Reads a picture file into RGBA pixels, using the browser to decode it.
export async function readPicture(file: File): Promise<RawImage> {
  if (file.size > MAX_FILE_BYTES || typeof createImageBitmap !== "function") throw new Error(NOT_A_PICTURE);
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error(NOT_A_PICTURE);
  }
  try {
    if (bitmap.width === 0 || bitmap.height === 0) throw new Error(NOT_A_PICTURE);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error(NOT_A_PICTURE);
    ctx.imageSmoothingEnabled = scale < 1;
    ctx.drawImage(bitmap, 0, 0, width, height);
    return { width, height, data: ctx.getImageData(0, 0, width, height).data };
  } finally {
    bitmap.close();
  }
}
