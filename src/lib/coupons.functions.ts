import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const ruleSchema = z.object({
  servico_id: z.string().uuid(),
  tipo_desconto: z.enum(["percentual", "fixo"]).nullable(),
  valor_desconto: z.number().positive().max(100000).nullable(),
});

const couponSchema = z.object({
  id: z.string().uuid().optional(),
  barbearia_id: z.string().uuid(),
  admin_id: z.string().uuid(),
  admin_password: z.string().min(1).max(200),
  nome: z.string().trim().min(1).max(100),
  descricao: z.string().trim().max(500),
  codigo: z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{4,10}$/),
  data_inicio: z.string().date(),
  data_fim: z.string().date(),
  dias_semana: z.array(z.number().int().min(0).max(6)).min(1).max(7),
  limite_por_cliente: z.enum(["1", "ilimitado"]),
  somente_novos_clientes: z.boolean(),
  inatividade_dias: z.number().int().positive().max(36500).nullable(),
  valor_minimo_total: z.number().positive().max(1000000).nullable(),
  tipo_desconto_total: z.enum(["percentual", "fixo"]).nullable(),
  valor_desconto_total: z.number().positive().max(1000000).nullable(),
  regras_servicos: z.array(ruleSchema).min(1).max(500),
});

const credentialsSchema = z.object({
  barbearia_id: z.string().uuid(),
  admin_id: z.string().uuid(),
  admin_password: z.string().min(1).max(200),
});

async function requireAdmin(data: z.infer<typeof credentialsSchema>) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: admin } = await supabaseAdmin
    .from("usuarios")
    .select("id")
    .eq("id", data.admin_id)
    .eq("barbearia_id", data.barbearia_id)
    .eq("senha", data.admin_password)
    .eq("nivel", 1)
    .maybeSingle();
  if (!admin) throw new Error("Acesso administrativo não autorizado.");
  return supabaseAdmin;
}

export const listCoupons = createServerFn({ method: "POST" })
  .inputValidator((input) => credentialsSchema.parse(input))
  .handler(async ({ data }) => {
    const db = await requireAdmin(data);
    const { data: coupons, error } = await db
      .from("cupons_desconto")
      .select("*")
      .eq("barbearia_id", data.barbearia_id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const ids = (coupons ?? []).map((coupon) => coupon.id);
    const { data: uses } = ids.length
      ? await db.from("atendimentos").select("cupom_id").in("cupom_id", ids).eq("cupom_status", "aplicado").neq("status", "Não compareceu")
      : { data: [] };
    return (coupons ?? []).map((coupon) => ({
      ...coupon,
      usos: (uses ?? []).filter((use) => use.cupom_id === coupon.id).length,
    }));
  });

export const saveCoupon = createServerFn({ method: "POST" })
  .inputValidator((input) => couponSchema.parse(input))
  .handler(async ({ data }) => {
    const db = await requireAdmin(data);
    const { admin_id: _adminId, admin_password: _password, id, ...values } = data;
    const query = id
      ? db.from("cupons_desconto").update(values).eq("id", id).eq("barbearia_id", data.barbearia_id)
      : db.from("cupons_desconto").insert(values);
    const { data: coupon, error } = await query.select().single();
    if (error?.code === "23505") throw new Error("Já existe um cupom com este código nesta barbearia.");
    if (error) throw new Error(error.message);
    return coupon;
  });

export const deleteCoupon = createServerFn({ method: "POST" })
  .inputValidator((input) => credentialsSchema.extend({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const db = await requireAdmin(data);
    const { error } = await db.from("cupons_desconto").update({ deleted_at: new Date().toISOString() })
      .eq("id", data.id).eq("barbearia_id", data.barbearia_id);
    if (error) throw new Error(error.message);
    const { data: appointments } = await db.from("atendimentos").select("id")
      .eq("cupom_id", data.id).eq("cupom_status", "aplicado").eq("status", "Agendado");
    for (const appointment of appointments ?? []) {
      await db.rpc("remove_coupon_from_appointment", { p_atendimento_id: appointment.id, p_reason: "Cupom excluído." });
    }
    return { ok: true };
  });

const applySchema = z.object({
  atendimento_id: z.string().uuid(),
  barbearia_id: z.string().uuid(),
  cliente_id: z.string().uuid(),
  actor_id: z.string().uuid(),
  password: z.string().min(1).max(200),
  codigo: z.string().trim().min(4).max(10),
});

export const applyCoupon = createServerFn({ method: "POST" })
  .inputValidator((input) => applySchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: user } = await supabaseAdmin.from("usuarios").select("id, nivel")
      .eq("id", data.actor_id).eq("barbearia_id", data.barbearia_id).eq("senha", data.password).maybeSingle();
    if (!user || (user.nivel !== 1 && user.id !== data.cliente_id)) throw new Error("Usuário não autorizado.");
    const { data: result, error } = await supabaseAdmin.rpc("apply_coupon_to_appointment", {
      p_atendimento_id: data.atendimento_id,
      p_barbearia_id: data.barbearia_id,
      p_cliente_id: data.cliente_id,
      p_codigo: data.codigo,
    });
    if (error) throw new Error(error.message);
    return result;
  });

export const removeCoupon = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({
    atendimento_id: z.string().uuid(), barbearia_id: z.string().uuid(), cliente_id: z.string().uuid(),
    actor_id: z.string().uuid(), password: z.string().min(1).max(200),
  }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: user } = await supabaseAdmin.from("usuarios").select("id, nivel")
      .eq("id", data.actor_id).eq("barbearia_id", data.barbearia_id).eq("senha", data.password).maybeSingle();
    if (!user || (user.nivel !== 1 && user.id !== data.cliente_id)) throw new Error("Usuário não autorizado.");
    const { data: appointment } = await supabaseAdmin.from("atendimentos").select("id")
      .eq("id", data.atendimento_id).eq("barbearia_id", data.barbearia_id).eq("cliente_id", data.cliente_id).maybeSingle();
    if (!appointment) throw new Error("Atendimento não encontrado.");
    const { error } = await supabaseAdmin.rpc("remove_coupon_from_appointment", {
      p_atendimento_id: data.atendimento_id, p_reason: "Cupom removido pelo usuário.",
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const invalidateAppointmentCoupon = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({
    atendimento_id: z.string().uuid(), barbearia_id: z.string().uuid(), admin_id: z.string().uuid(),
    admin_password: z.string().min(1).max(200), reason: z.string().trim().min(1).max(200),
  }).parse(input))
  .handler(async ({ data }) => {
    const db = await requireAdmin(data);
    const { data: appointment } = await db.from("atendimentos").select("id, cupom_id")
      .eq("id", data.atendimento_id).eq("barbearia_id", data.barbearia_id).maybeSingle();
    if (!appointment?.cupom_id) return { ok: true };
    const { error } = await db.rpc("remove_coupon_from_appointment", {
      p_atendimento_id: data.atendimento_id, p_reason: data.reason,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });