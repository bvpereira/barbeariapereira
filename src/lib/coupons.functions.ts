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
  const { createCouponsDbClient } = await import("@/lib/coupons-db.server");
  const db = createCouponsDbClient();
  const { data: admin } = await db
    .from("usuarios")
    .select("id")
    .eq("id", data.admin_id)
    .eq("barbearia_id", data.barbearia_id)
    .eq("senha", data.admin_password)
    .eq("nivel", 1)
    .maybeSingle();
  if (!admin) throw new Error("Acesso administrativo não autorizado.");
  return db;
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

const previewSchema = z.object({
  barbearia_id: z.string().uuid(), cliente_id: z.string().uuid(), actor_id: z.string().uuid(),
  password: z.string().min(1).max(200), codigo: z.string().trim().min(4).max(10),
  data: z.string().date(), servicos_ids: z.array(z.string().uuid()).min(1).max(100),
});

export const previewCoupon = createServerFn({ method: "POST" })
  .inputValidator((input) => previewSchema.parse(input))
  .handler(async ({ data }) => {
    const { createCouponsDbClient } = await import("@/lib/coupons-db.server");
    const db = createCouponsDbClient();
    const { data: actor } = await db.from("usuarios").select("id, nivel")
      .eq("id", data.actor_id).eq("barbearia_id", data.barbearia_id).eq("senha", data.password).maybeSingle();
    if (!actor || (actor.nivel !== 1 && actor.id !== data.cliente_id)) throw new Error("Usuário não autorizado.");
    const { data: coupon } = await db.from("cupons_desconto").select("*")
      .eq("barbearia_id", data.barbearia_id).ilike("codigo", data.codigo.trim()).is("deleted_at", null).maybeSingle();
    if (!coupon) throw new Error("Cupom não encontrado.");
    const appointmentDate = new Date(`${data.data}T12:00:00-03:00`);
    const day = appointmentDate.getDay();
    if (data.data < coupon.data_inicio) throw new Error("Este cupom ainda não está ativo.");
    if (data.data > coupon.data_fim) throw new Error("Este cupom expirou.");
    if (!coupon.dias_semana.includes(day)) throw new Error("Cupom indisponível para o dia selecionado.");
    const rules = Array.isArray(coupon.regras_servicos) ? coupon.regras_servicos as Array<{ servico_id: string; tipo_desconto: string | null; valor_desconto: number | null }> : [];
    if (!data.servicos_ids.some((id) => rules.some((rule) => rule.servico_id === id))) throw new Error("Cupom não válido para os serviços selecionados.");
    if (coupon.somente_novos_clientes) {
      const { count } = await db.from("atendimentos").select("id", { count: "exact", head: true })
        .eq("barbearia_id", data.barbearia_id).eq("cliente_id", data.cliente_id);
      if ((count ?? 0) > 0) throw new Error("Este cupom é exclusivo para novos clientes.");
    }
    if (coupon.inatividade_dias) {
      const { data: last } = await db.from("atendimentos").select("data")
        .eq("barbearia_id", data.barbearia_id).eq("cliente_id", data.cliente_id).eq("status", "Finalizado")
        .order("data", { ascending: false }).limit(1).maybeSingle();
      if (last) {
        const elapsed = Math.floor((appointmentDate.getTime() - new Date(last.data).getTime()) / 86400000);
        if (elapsed <= coupon.inatividade_dias) throw new Error(`Este cupom exige ${coupon.inatividade_dias} dias sem atendimento.`);
      }
    }
    if (coupon.limite_por_cliente === "1") {
      const { count } = await db.from("atendimentos").select("id", { count: "exact", head: true })
        .eq("cupom_id", coupon.id).eq("cliente_id", data.cliente_id).eq("cupom_status", "aplicado").neq("status", "Não compareceu");
      if ((count ?? 0) > 0) throw new Error("Você já utilizou este cupom.");
    }
    const { data: services, error } = await db.from("servicos").select("id, name, price")
      .eq("barbearia_id", data.barbearia_id).in("id", data.servicos_ids);
    if (error || !services || services.length !== data.servicos_ids.length) throw new Error("Serviços inválidos.");
    const original = services.reduce((sum, service) => sum + Number(service.price), 0);
    if (coupon.valor_minimo_total && original < coupon.valor_minimo_total) throw new Error(`O valor mínimo para este cupom é R$ ${Number(coupon.valor_minimo_total).toFixed(2)}.`);
    let totalDiscount = 0;
    const details = services.map((service) => {
      const price = Number(service.price); const rule = rules.find((item) => item.servico_id === service.id); let discount = 0;
      if (!coupon.valor_minimo_total && rule) discount = rule.tipo_desconto === "percentual" ? price * Number(rule.valor_desconto) / 100 : Math.min(price, Number(rule.valor_desconto));
      totalDiscount += discount;
      return { servico_id: service.id, nome: service.name, valor_original: price, valor_desconto: Math.round(discount * 100) / 100, valor_final: Math.round((price - discount) * 100) / 100 };
    });
    if (coupon.valor_minimo_total) {
      totalDiscount = coupon.tipo_desconto_total === "percentual" ? original * Number(coupon.valor_desconto_total) / 100 : Math.min(original, Number(coupon.valor_desconto_total));
      for (const detail of details) {
        detail.valor_desconto = Math.round(totalDiscount * detail.valor_original / original * 100) / 100;
        detail.valor_final = Math.round((detail.valor_original - detail.valor_desconto) * 100) / 100;
      }
    }
    totalDiscount = Math.round(totalDiscount * 100) / 100;
    return { cupom_id: coupon.id, codigo: coupon.codigo, nome: coupon.nome, valor_original: original,
      valor_desconto: totalDiscount, valor_final: Math.round((original - totalDiscount) * 100) / 100, servicos: details };
  });

export const applyCoupon = createServerFn({ method: "POST" })
  .inputValidator((input) => applySchema.parse(input))
  .handler(async ({ data }) => {
    const { createCouponsDbClient } = await import("@/lib/coupons-db.server");
    const db = createCouponsDbClient();
    const { data: user } = await db.from("usuarios").select("id, nivel")
      .eq("id", data.actor_id).eq("barbearia_id", data.barbearia_id).eq("senha", data.password).maybeSingle();
    if (!user || (user.nivel !== 1 && user.id !== data.cliente_id)) throw new Error("Usuário não autorizado.");
    const { data: result, error } = await db.rpc("apply_coupon_to_appointment", {
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
    const { createCouponsDbClient } = await import("@/lib/coupons-db.server");
    const db = createCouponsDbClient();
    const { data: user } = await db.from("usuarios").select("id, nivel")
      .eq("id", data.actor_id).eq("barbearia_id", data.barbearia_id).eq("senha", data.password).maybeSingle();
    if (!user || (user.nivel !== 1 && user.id !== data.cliente_id)) throw new Error("Usuário não autorizado.");
    const { data: appointment } = await db.from("atendimentos").select("id")
      .eq("id", data.atendimento_id).eq("barbearia_id", data.barbearia_id).eq("cliente_id", data.cliente_id).maybeSingle();
    if (!appointment) throw new Error("Atendimento não encontrado.");
    const { error } = await db.rpc("remove_coupon_from_appointment", {
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