import { createServerFn } from "@tanstack/react-start";

type AdminAuth = { adminId: string; adminLogin: string; adminSenha: string };

const BUCKETS = [
  "service-images",
  "collaborator-images",
  "informacoes_imagens",
  "promocoes",
  "blog_midia",
] as const;

const MODELO_BARBEARIA_ID = "01879baf-8f8b-4c3d-810f-7740b6432cd9";

type Mapping = {
  barbearia: { old: string; new: string };
  servicos: Record<string, string>;
  colaboradores: Record<string, string>;
  informacoes: Record<string, string>;
  promocao: Record<string, string>;
  blog: Record<string, string>;
  agentes: Record<string, string>;
};

function rewriteParentSegment(path: string, mapping: Mapping): string {
  // path is like "{old_barbearia}/{old_parent}/{file}"
  // We've already replaced barbearia in DB; for storage we need to rebuild target.
  const parts = path.split("/");
  if (parts.length < 2) return path;
  const oldParent = parts[1];
  const lookup: Record<string, string> = {
    ...mapping.servicos,
    ...mapping.colaboradores,
    ...mapping.informacoes,
    ...mapping.promocao,
    ...mapping.blog,
    ...mapping.agentes,
  };
  const newParent = lookup[oldParent] ?? oldParent;
  return [mapping.barbearia.new, newParent, ...parts.slice(2)].join("/");
}

async function listAllFiles(
  supabaseAdmin: any,
  bucket: string,
  prefix: string,
): Promise<string[]> {
  const results: string[] = [];
  async function walk(dir: string) {
    const { data, error } = await supabaseAdmin.storage.from(bucket).list(dir, {
      limit: 1000,
    });
    if (error) throw new Error(`Falha listando ${bucket}/${dir}: ${error.message}`);
    for (const item of data ?? []) {
      const full = dir ? `${dir}/${item.name}` : item.name;
      // Supabase returns folders as items with id === null
      if (item.id === null) {
        await walk(full);
      } else {
        results.push(full);
      }
    }
  }
  await walk(prefix);
  return results;
}

async function cloneStorageForBucket(
  supabaseAdmin: any,
  bucket: string,
  mapping: Mapping,
  uploadedTracker: Map<string, string[]>,
) {
  const files = await listAllFiles(supabaseAdmin, bucket, mapping.barbearia.old);
  const tracker: string[] = [];
  uploadedTracker.set(bucket, tracker);

  const BATCH = 8;
  for (let i = 0; i < files.length; i += BATCH) {
    const batch = files.slice(i, i + BATCH);
    await Promise.all(
      batch.map(async (oldPath) => {
        const newPath = rewriteParentSegment(oldPath, mapping);
        const dl = await supabaseAdmin.storage.from(bucket).download(oldPath);
        if (dl.error) throw new Error(`Download ${bucket}/${oldPath}: ${dl.error.message}`);
        const up = await supabaseAdmin.storage
          .from(bucket)
          .upload(newPath, dl.data, { upsert: true, contentType: dl.data.type || undefined });
        if (up.error) throw new Error(`Upload ${bucket}/${newPath}: ${up.error.message}`);
        tracker.push(newPath);
      }),
    );
  }
}

export const cloneBarbeariaFn = createServerFn({ method: "POST" })
  .inputValidator(
    (input: AdminAuth & {
      slug: string;
      nome: string;
      newAdminLogin: string;
      newAdminSenha: string;
    }) => input,
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1) Clone DB
    const rpc = await supabaseAdmin.rpc("clone_barbearia", {
      p_admin_id: data.adminId,
      p_admin_login: data.adminLogin,
      p_admin_senha: data.adminSenha,
      p_modelo_id: MODELO_BARBEARIA_ID,
      p_new_slug: data.slug,
      p_new_nome: data.nome,
      p_new_admin_login: data.newAdminLogin,
      p_new_admin_senha: data.newAdminSenha,
    });

    if (rpc.error) throw new Error(rpc.error.message);
    const result = rpc.data as { id: string; slug: string; mapping: Mapping };
    const newBarbeariaId = result.id;
    const uploadedTracker = new Map<string, string[]>();

    // 2) Clone Storage. On failure, rollback everything.
    try {
      for (const bucket of BUCKETS) {
        await cloneStorageForBucket(supabaseAdmin, bucket, result.mapping, uploadedTracker);
      }
    } catch (storageErr) {
      // Rollback DB
      await supabaseAdmin.rpc("rollback_barbearia", {
        p_admin_id: data.adminId,
        p_admin_login: data.adminLogin,
        p_admin_senha: data.adminSenha,
        p_id: newBarbeariaId,
      });
      // Rollback already-uploaded storage
      for (const [bucket, paths] of uploadedTracker.entries()) {
        if (paths.length === 0) continue;
        try {
          await supabaseAdmin.storage.from(bucket).remove(paths);
        } catch {
          // best-effort
        }
      }
      const msg = storageErr instanceof Error ? storageErr.message : String(storageErr);
      throw new Error(`Falha ao clonar imagens. Operação revertida. (${msg})`);
    }

    return { id: newBarbeariaId, slug: result.slug };
  });

export const softDeleteBarbeariaFn = createServerFn({ method: "POST" })
  .inputValidator((input: AdminAuth & { id: string }) => input)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.rpc("soft_delete_barbearia", {
      p_admin_id: data.adminId,
      p_admin_login: data.adminLogin,
      p_admin_senha: data.adminSenha,
      p_id: data.id,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const restoreBarbeariaFn = createServerFn({ method: "POST" })
  .inputValidator((input: AdminAuth & { id: string }) => input)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.rpc("restore_barbearia", {
      p_admin_id: data.adminId,
      p_admin_login: data.adminLogin,
      p_admin_senha: data.adminSenha,
      p_id: data.id,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
