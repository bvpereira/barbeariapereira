import { createServerFn } from "@tanstack/react-start";

/**
 * Função para migrar imagens existentes para a nova estrutura de pastas:
 * {barbearia_id}/{id}/main-{filename}
 */
export const migrateImages = createServerFn({ method: "POST" }).handler(async () => {
  const { createCouponsDbClient } = await import("@/lib/coupons-db.server");
  const db = createCouponsDbClient();
  const results = {
    servicos: [] as string[],
    colaboradores: [] as string[],
    errors: [] as string[]
  };

  try {
    // 1. Migrar serviços
    const { data: servicos, error: servicosErr } = await db
      .from("servicos")
      .select("id, barbearia_id, image_url")
      .not("image_url", "is", null);

    if (servicosErr) throw servicosErr;

    for (const servico of (servicos || [])) {
      if (!servico.image_url) continue;
      
      // Se já estiver na nova estrutura (contém id da barbearia), ignorar
      if (servico.image_url.includes(`${servico.barbearia_id}/${servico.id}`)) {
        continue;
      }

      const urlParts = servico.image_url.split("/public/service-images/");
      if (urlParts.length > 1) {
        const oldPath = urlParts[1];
        // Se estiver na raiz (não tem / no path restante), migrar
        if (!oldPath.includes("/")) {
          const newPath = `${servico.barbearia_id}/${servico.id}/main-${oldPath}`;
          
          const { error: moveError } = await db.storage
            .from("service-images")
            .move(oldPath, newPath);

          if (!moveError || moveError.message.includes("already exists")) {
            const { data: { publicUrl } } = db.storage
              .from("service-images")
              .getPublicUrl(newPath);
            
            await db
              .from("servicos")
              .update({ image_url: publicUrl })
              .eq("id", servico.id);
            
            results.servicos.push(`Migrado: ${servico.id} (${oldPath} -> ${newPath})`);
          } else {
            results.errors.push(`Erro mover servico ${servico.id}: ${moveError.message}`);
          }
        }
      }
    }

    // 2. Migrar colaboradores
    const { data: colabs, error: colabsErr } = await db
      .from("colaboradores")
      .select("id, barbearia_id, foto_url")
      .not("foto_url", "is", null);

    if (colabsErr) throw colabsErr;

    for (const colab of (colabs || [])) {
      if (!colab.foto_url) continue;
      
      if (colab.foto_url.includes(`${colab.barbearia_id}/${colab.id}`)) {
        continue;
      }

      const urlParts = colab.foto_url.split("/public/collaborator-images/");
      if (urlParts.length > 1) {
        const oldPath = urlParts[1];
        if (!oldPath.includes("/")) {
          const newPath = `${colab.barbearia_id}/${colab.id}/main-${oldPath}`;
          
          const { error: moveError } = await db.storage
            .from("collaborator-images")
            .move(oldPath, newPath);

          if (!moveError || moveError.message.includes("already exists")) {
            const { data: { publicUrl } } = db.storage
              .from("collaborator-images")
              .getPublicUrl(newPath);
            
            await db
              .from("colaboradores")
              .update({ foto_url: publicUrl })
              .eq("id", colab.id);
            
            results.colaboradores.push(`Migrado: ${colab.id} (${oldPath} -> ${newPath})`);
          } else {
            results.errors.push(`Erro mover colaborador ${colab.id}: ${moveError.message}`);
          }
        }
      }
    }

    return { success: true, results };
  } catch (err: any) {
    console.error("Erro na migração:", err);
    return { success: false, error: err.message };
  }
});
