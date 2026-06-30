import imageCompression from "browser-image-compression";

export type CompressPreset = "logo" | "avatar" | "gallery" | "banner" | "default";

const PRESETS: Record<CompressPreset, { maxWidthOrHeight: number; quality: number }> = {
  logo: { maxWidthOrHeight: 512, quality: 0.85 },
  avatar: { maxWidthOrHeight: 512, quality: 0.82 },
  gallery: { maxWidthOrHeight: 1024, quality: 0.82 },
  banner: { maxWidthOrHeight: 1920, quality: 0.82 },
  default: { maxWidthOrHeight: 1920, quality: 0.82 },
};

// Tipos que NÃO devem ser comprimidos/convertidos
const SKIP_TYPES = new Set([
  "image/svg+xml",
  "image/gif",
  "image/x-icon",
  "image/vnd.microsoft.icon",
]);

/**
 * Recorta a imagem para um quadrado centralizado (center-crop) usando canvas.
 * Mantém o tipo original; SVG/GIF/ICO passam direto.
 */
export async function cropToSquare(file: File): Promise<File> {
  try {
    if (!file || !file.type?.startsWith("image/")) return file;
    if (SKIP_TYPES.has(file.type)) return file;

    const bitmap = await createImageBitmap(file);
    const size = Math.min(bitmap.width, bitmap.height);
    const sx = Math.floor((bitmap.width - size) / 2);
    const sy = Math.floor((bitmap.height - size) / 2);

    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, sx, sy, size, size, 0, 0, size, size);
    bitmap.close?.();

    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob(resolve, file.type || "image/jpeg", 0.95),
    );
    if (!blob) return file;
    return new File([blob], file.name, { type: blob.type, lastModified: Date.now() });
  } catch (err) {
    console.warn("[cropToSquare] falha, usando original:", err);
    return file;
  }
}

/**
 * Comprime e converte imagens raster para WebP no browser antes do upload.
 * - Pula SVG, GIF, ICO e qualquer arquivo que não seja imagem.
 * - Se a compressão falhar ou resultar em arquivo maior, retorna o original.
 */
export async function compressImage(
  file: File,
  preset: CompressPreset = "default",
): Promise<File> {
  try {
    if (!file || !file.type || !file.type.startsWith("image/")) return file;
    if (SKIP_TYPES.has(file.type)) return file;

    const { maxWidthOrHeight, quality } = PRESETS[preset];

    const compressed = await imageCompression(file, {
      maxWidthOrHeight,
      initialQuality: quality,
      useWebWorker: true,
      fileType: "image/webp",
      maxSizeMB: 5,
    });

    // Se ficou maior que o original (raro, mas possível em imagens já otimizadas), mantém original
    if (compressed.size >= file.size) {
      if (import.meta.env.DEV) {
        console.log(
          `[compressImage] mantido original (${(file.size / 1024).toFixed(1)}KB <= ${(compressed.size / 1024).toFixed(1)}KB)`,
        );
      }
      return file;
    }

    // Renomeia para .webp
    const baseName = file.name.replace(/\.[^.]+$/, "");
    const newFile = new File([compressed], `${baseName}.webp`, {
      type: "image/webp",
      lastModified: Date.now(),
    });

    if (import.meta.env.DEV) {
      const saved = (1 - newFile.size / file.size) * 100;
      console.log(
        `[compressImage] ${file.name}: ${(file.size / 1024).toFixed(1)}KB → ${(newFile.size / 1024).toFixed(1)}KB (-${saved.toFixed(0)}%)`,
      );
    }

    return newFile;
  } catch (err) {
    console.warn("[compressImage] falha, usando original:", err);
    return file;
  }
}
