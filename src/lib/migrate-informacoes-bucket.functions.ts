import { createServerFn } from "@tanstack/react-start";

/**
 * Migra arquivos legados no bucket `informacoes_imagens` para o layout
 * padronizado por barbearia:
 *
 *   {barbearia_id}/{informacoes.id}/{slot}-{uuid}.{ext}
 *
 * Estratégia: para cada linha de `informacoes`, lê as colunas de mídia, e
 * para cada URL que não esteja em `{barbearia_id}/`, faz `storage.move`
 * para o novo path e atualiza a coluna com a nova URL pública.
 *
 * Vantagem: `move` é rename interno do Storage — não consome egress.
 *
 * Requer privilégio admin (passado pelo painel /barbearias).
 */
type AdminAuth = { adminId: string; adminLogin: string; adminSenha: string };

const BUCKET = "informacoes_imagens";
const PUBLIC_PREFIX = `/storage/v1/object/public/${BUCKET}/`;
const SLOT_COLUMNS = [
  "imagem_1", "imagem_2", "imagem_3", "imagem_4",
  "imagem_5", "imagem_6", "imagem_7", "imagem_8",
  "imagem_logo", "foto_perfil", "video_local",
] as const;

export const migrateInformacoesBucketFn = createServerFn({ method: "POST" })
  .inputValidator((input: AdminAuth) => input)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Verifica admin
    const { data: adminRow, error: adminErr } = await supabaseAdmin
      .from("usuarios")
      .select("id")
      .eq("id", data.adminId)
      .eq("login", data.adminLogin)
      .eq("senha", data.adminSenha)
      .eq("nivel", 0)
      .maybeSingle();
    if (adminErr) throw new Error(adminErr.message);
    if (!adminRow) throw new Error("Acesso não autorizado.");

    const report = {
      checked: 0,
      moved: 0,
      skipped: 0,
      missing: 0,
      errors: [] as string[],
      details: [] as { from: string; to: string }[],
    };

    const { data: rows, error: readErr } = await supabaseAdmin
      .from("informacoes")
      .select("id, barbearia_id, imagem_1, imagem_2, imagem_3, imagem_4, imagem_5, imagem_6, imagem_7, imagem_8, imagem_logo, foto_perfil, video_local");
    if (readErr) throw new Error(readErr.message);

    for (const row of rows ?? []) {
      const barbeariaId = (row as any).barbearia_id as string | null;
      const informacoesId = (row as any).id as string;
      if (!barbeariaId) continue;

      const updates: Record<string, string> = {};

      for (const col of SLOT_COLUMNS) {
        const url = (row as any)[col] as string | null;
        if (!url || typeof url !== "string") continue;
        const idx = url.indexOf(PUBLIC_PREFIX);
        if (idx === -1) continue;

        const oldPath = url.substring(idx + PUBLIC_PREFIX.length).split("?")[0];
        if (!oldPath) continue;
        report.checked++;

        if (oldPath.startsWith(`${barbeariaId}/`)) {
          report.skipped++;
          continue;
        }

        const ext = oldPath.includes(".") ? oldPath.split(".").pop() : "bin";
        const uuid = Math.random().toString(36).substring(2, 10);
        const newPath = `${barbeariaId}/${informacoesId}/${col}-${uuid}.${ext}`;

        const { error: moveErr } = await supabaseAdmin.storage
          .from(BUCKET)
          .move(oldPath, newPath);

        if (moveErr) {
          // Se origem sumiu, limpa a URL na linha para não apontar para arquivo inexistente
          if (/not.?found|does not exist/i.test(moveErr.message)) {
            report.missing++;
            updates[col] = "";
            continue;
          }
          report.errors.push(`${oldPath} -> ${newPath}: ${moveErr.message}`);
          continue;
        }

        const { data: pub } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(newPath);
        updates[col] = pub.publicUrl;
        report.moved++;
        report.details.push({ from: oldPath, to: newPath });
      }

      if (Object.keys(updates).length > 0) {
        // Normaliza "" para null
        const normalized: Record<string, string | null> = {};
        for (const [k, v] of Object.entries(updates)) normalized[k] = v === "" ? null : v;
        const { error: updErr } = await supabaseAdmin
          .from("informacoes")
          .update(normalized as any)
          .eq("id", informacoesId);
        if (updErr) report.errors.push(`update ${informacoesId}: ${updErr.message}`);
      }
    }

    return report;
  });
