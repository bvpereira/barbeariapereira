import { supabase } from "@/integrations/supabase/client";

/**
 * Deleta um arquivo do storage a partir da sua URL pública.
 */
export const deleteByPublicUrl = async (bucket: string, url: string | null) => {
  if (!url) return;
  try {
    // Extrai o caminho do arquivo da URL pública do Supabase
    // Formato esperado: .../storage/v1/object/public/bucket-name/path/to/file.ext
    const urlParts = url.split(`/public/${bucket}/`);
    if (urlParts.length > 1) {
      const filePath = urlParts[1];
      const { error } = await supabase.storage.from(bucket).remove([filePath]);
      if (error) {
        console.error(`Erro ao deletar arquivo do bucket ${bucket}:`, error);
      }
    }
  } catch (error) {
    console.error(`Erro inesperado ao deletar arquivo do bucket ${bucket}:`, error);
  }
};

/**
 * Realiza o upload de uma imagem seguindo a nova estrutura de pastas.
 * {barbearia_id}/{parent_id}/{slot}-{uuid}.{ext}
 */
export const uploadImage = async (
  bucket: string,
  barbeariaId: string,
  parentId: string,
  slot: string,
  file: File
) => {
  const fileExt = file.name.split(".").pop();
  const uuid = Math.random().toString(36).substring(2, 10);
  const filePath = `${barbeariaId}/${parentId}/${slot}-${uuid}.${fileExt}`;

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(filePath, file);

  if (uploadError) throw uploadError;

  const { data: { publicUrl } } = supabase.storage
    .from(bucket)
    .getPublicUrl(filePath);

  return publicUrl;
};
