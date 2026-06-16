import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const ruleSchema = z.object({
  servico_id: z.string().uuid(),
  quantidade: z.number().int().min(1).max(1000),
  dias_semana: z.array(z.number().int().min(0).max(6)).min(1).max(7),
  tipo_desconto: z.enum(["percentual", "fixo"]),
  valor_desconto: z.number().positive().max(1000000),
});

const credentials = z.object({
  barbearia_id: z.string().uuid(),
  admin_id: z.string().uuid(),
  admin_password: z.string().min(1).max(200),
});

const saveSchema = credentials.extend({
  id: z.string().uuid().nullable().optional(),
  nome: z.string().trim().min(1).max(100),
  valor_mensal: z.number().positive().max(1000000),
  descricao: z.string().trim().max(1000).default(""),
  ativo: z.boolean(),
  regras_servicos: z.array(ruleSchema).min(1).max(100),
});

export const listClubes = createServerFn({ method: "POST" })
  .inputValidator((input) => credentials.parse(input))
  .handler(async ({ data }) => {
    const { createClubeDbClient } = await import("@/lib/clube-db.server");
    const db = createClubeDbClient();
    const { data: rows, error } = await db.rpc("list_clubes_assinatura", {
      p_admin_id: data.admin_id,
      p_admin_password: data.admin_password,
      p_barbearia_id: data.barbearia_id,
    } as never);
    if (error) throw new Error(error.message);
    return (rows ?? []) as Array<{
      id: string; nome: string; valor_mensal: number; descricao: string; ativo: boolean;
      regras_servicos: Array<{ servico_id: string; quantidade: number; dias_semana: number[]; tipo_desconto: "percentual" | "fixo"; valor_desconto: number }>;
      created_at: string;
      assinantes: Array<{ id: string; nome: string; data_fim: string }>;
      total_assinantes: number;
    }>;
  });

export const saveClube = createServerFn({ method: "POST" })
  .inputValidator((input) => saveSchema.parse(input))
  .handler(async ({ data }) => {
    const { createClubeDbClient } = await import("@/lib/clube-db.server");
    const db = createClubeDbClient();
    const { data: row, error } = await db.rpc("save_clube_assinatura", {
      p_admin_id: data.admin_id,
      p_admin_password: data.admin_password,
      p_barbearia_id: data.barbearia_id,
      p_id: data.id ?? null,
      p_nome: data.nome,
      p_valor_mensal: data.valor_mensal,
      p_descricao: data.descricao,
      p_ativo: data.ativo,
      p_regras_servicos: data.regras_servicos,
    } as never);
    if (error) throw new Error(error.message);
    return row;
  });

export const toggleClube = createServerFn({ method: "POST" })
  .inputValidator((input) => credentials.extend({ id: z.string().uuid(), ativo: z.boolean() }).parse(input))
  .handler(async ({ data }) => {
    const { createClubeDbClient } = await import("@/lib/clube-db.server");
    const db = createClubeDbClient();
    const { error } = await db.rpc("toggle_clube_assinatura", {
      p_admin_id: data.admin_id, p_admin_password: data.admin_password,
      p_barbearia_id: data.barbearia_id, p_id: data.id, p_ativo: data.ativo,
    } as never);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteClube = createServerFn({ method: "POST" })
  .inputValidator((input) => credentials.extend({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { createClubeDbClient } = await import("@/lib/clube-db.server");
    const db = createClubeDbClient();
    const { error } = await db.rpc("delete_clube_assinatura", {
      p_admin_id: data.admin_id, p_admin_password: data.admin_password,
      p_barbearia_id: data.barbearia_id, p_id: data.id,
    } as never);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listExpirando = createServerFn({ method: "POST" })
  .inputValidator((input) => credentials.parse(input))
  .handler(async ({ data }) => {
    const { createClubeDbClient } = await import("@/lib/clube-db.server");
    const db = createClubeDbClient();
    const { data: rows, error } = await db.rpc("list_clube_expirando", {
      p_admin_id: data.admin_id, p_admin_password: data.admin_password, p_barbearia_id: data.barbearia_id,
    } as never);
    if (error) throw new Error(error.message);
    return (rows ?? []) as Array<{
      cliente_id: string; cliente_nome: string; cliente_login: string;
      clube_id: string; clube_nome: string; data_fim: string; dias_restantes: number;
    }>;
  });

export const setClienteClube = createServerFn({ method: "POST" })
  .inputValidator((input) => credentials.extend({
    cliente_id: z.string().uuid(),
    clube_id: z.string().uuid(),
    data_inicio: z.string().date(),
    data_fim: z.string().date(),
    valor: z.number().nonnegative().max(1000000),
  }).parse(input))
  .handler(async ({ data }) => {
    const { createClubeDbClient } = await import("@/lib/clube-db.server");
    const db = createClubeDbClient();
    const { error } = await db.rpc("set_cliente_clube", {
      p_admin_id: data.admin_id, p_admin_password: data.admin_password, p_barbearia_id: data.barbearia_id,
      p_cliente_id: data.cliente_id, p_clube_id: data.clube_id,
      p_data_inicio: data.data_inicio, p_data_fim: data.data_fim, p_valor: data.valor,
    } as never);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removeClienteClube = createServerFn({ method: "POST" })
  .inputValidator((input) => credentials.extend({ cliente_id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { createClubeDbClient } = await import("@/lib/clube-db.server");
    const db = createClubeDbClient();
    const { error } = await db.rpc("remove_cliente_clube", {
      p_admin_id: data.admin_id, p_admin_password: data.admin_password,
      p_barbearia_id: data.barbearia_id, p_cliente_id: data.cliente_id,
    } as never);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getClienteClubeStatus = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({
    barbearia_id: z.string().uuid(), cliente_id: z.string().uuid(),
  }).parse(input))
  .handler(async ({ data }) => {
    const { createClubeDbClient } = await import("@/lib/clube-db.server");
    const db = createClubeDbClient();
    const { data: row, error } = await db.rpc("get_cliente_clube_status", {
      p_barbearia_id: data.barbearia_id, p_cliente_id: data.cliente_id,
    } as never);
    if (error) throw new Error(error.message);
    return row as {
      ativo: boolean; expirado?: boolean;
      clube_id?: string; clube_nome?: string; descricao?: string;
      valor?: number; data_inicio?: string; data_fim?: string;
      servicos?: Array<{ servico_id: string; nome: string; quantidade: number; usados: number; restantes: number; tipo_desconto: string; valor_desconto: number; dias_semana: number[] }>;
      historico: Array<{ clube_id: string; clube_nome: string; data_inicio: string; data_fim: string; valor: number }>;
    };
  });

export const listClubesPublicos = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ barbearia_id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { createClubeDbClient } = await import("@/lib/clube-db.server");
    const db = createClubeDbClient();
    const { data: rows, error } = await db.rpc("list_clubes_publicos", {
      p_barbearia_id: data.barbearia_id,
    } as never);
    if (error) throw new Error(error.message);
    return (rows ?? []) as Array<{ id: string; nome: string; valor_mensal: number; descricao: string }>;
  });

export const applyClubeToAppointment = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({
    atendimento_id: z.string().uuid(), barbearia_id: z.string().uuid(), cliente_id: z.string().uuid(),
  }).parse(input))
  .handler(async ({ data }) => {
    const { createClubeDbClient } = await import("@/lib/clube-db.server");
    const db = createClubeDbClient();
    const { data: row, error } = await db.rpc("apply_clube_to_appointment", {
      p_atendimento_id: data.atendimento_id, p_barbearia_id: data.barbearia_id, p_cliente_id: data.cliente_id,
    } as never);
    if (error) throw new Error(error.message);
    return row as { aplicado: boolean; desconto?: number; valor_original?: number; valor_final?: number; motivo?: string };
  });

export const listClientesClubeAtivo = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ barbearia_id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { createClubeDbClient } = await import("@/lib/clube-db.server");
    const db = createClubeDbClient();
    const today = new Date().toISOString().slice(0, 10);
    const { data: rows, error } = await db
      .from("clube_usuarios")
      .select("usuario_id, clube_id, data_fim, status, clube_assinatura(nome)")
      .eq("barbearia_id", data.barbearia_id)
      .eq("status", "ativa")
      .gte("data_fim", today);
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r: any) => ({
      usuario_id: r.usuario_id as string,
      clube_id: r.clube_id as string,
      data_fim: r.data_fim as string,
      clube_nome: (r.clube_assinatura?.nome ?? null) as string | null,
    }));
  });
