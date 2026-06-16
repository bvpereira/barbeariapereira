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
