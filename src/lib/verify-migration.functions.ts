import { createServerFn } from "@tanstack/react-start";

/**
 * Função para verificar a integridade da migração das imagens.
 * Cruza os dados do banco com a estrutura de pastas do Storage.
 */
export const verifyMigration = createServerFn({ method: "POST" }).handler(async () => {
  const { createCouponsDbClient } = await import("@/lib/coupons-db.server");
  const db = createCouponsDbClient();
  const report = {
    servicos: { total: 0, migrados: 0, pendentes: 0, detalhes: [] as any[] },
    colaboradores: { total: 0, migrados: 0, pendentes: 0, detalhes: [] as any[] },
    storage_checks: [] as string[]
  };

  try {
    // 1. Verificar Serviços
    const { data: servicos } = await db
      .from("servicos")
      .select("id, barbearia_id, image_url, name")
      .not("image_url", "is", null);

    if (servicos) {
      report.servicos.total = servicos.length;
      for (const s of servicos) {
        const expectedPrefix = `${s.barbearia_id}/${s.id}/`;
        const isMigrated = s.image_url?.includes(expectedPrefix);
        
        if (isMigrated) {
          report.servicos.migrados++;
        } else {
          report.servicos.pendentes++;
        }

        report.servicos.detalhes.push({
          id: s.id,
          nome: s.name,
          url: s.image_url,
          status: isMigrated ? "OK" : "PENDENTE",
          caminho_esperado: expectedPrefix
        });
      }
    }

    // 2. Verificar Colaboradores
    const { data: colabs } = await db
      .from("colaboradores")
      .select("id, barbearia_id, foto_url, nome")
      .not("foto_url", "is", null);

    if (colabs) {
      report.colaboradores.total = colabs.length;
      for (const c of colabs) {
        const expectedPrefix = `${c.barbearia_id}/${c.id}/`;
        const isMigrated = c.foto_url?.includes(expectedPrefix);
        
        if (isMigrated) {
          report.colaboradores.migrados++;
        } else {
          report.colaboradores.pendentes++;
        }

        report.colaboradores.detalhes.push({
          id: c.id,
          nome: c.nome,
          url: c.foto_url,
          status: isMigrated ? "OK" : "PENDENTE",
          caminho_esperado: expectedPrefix
        });
      }
    }

    // 3. Verificação física no Storage (Amostragem)
    // Vamos listar as pastas raiz para ver se ainda existem arquivos soltos
    const { data: rootFilesServicos } = await db.storage.from("service-images").list();
    const legacyFilesServicos = rootFilesServicos?.filter(f => !f.id && f.name.includes(".")).length || 0;
    report.storage_checks.push(`Arquivos soltos na raiz de service-images: ${legacyFilesServicos}`);

    const { data: rootFilesColabs } = await db.storage.from("collaborator-images").list();
    const legacyFilesColabs = rootFilesColabs?.filter(f => !f.id && f.name.includes(".")).length || 0;
    report.storage_checks.push(`Arquivos soltos na raiz de collaborator-images: ${legacyFilesColabs}`);

    return { success: true, report };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});
