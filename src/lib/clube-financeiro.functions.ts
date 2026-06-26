import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const creds = z.object({
  barbearia_id: z.string().uuid(),
  admin_id: z.string().uuid(),
  admin_password: z.string().min(1).max(200),
});

const periodo = z.object({
  inicio: z.string(), // ISO date
  fim: z.string(),
});

const DEFAULT_FEE_PCT = 0.0399;
const DEFAULT_FEE_FIXED = 0.39;

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function calcFee(bruto: number, cfg: { pct: number; fixed: number }) {
  if (bruto <= 0) return { taxa: 0, liquido: bruto };
  const taxa = round2(bruto * cfg.pct + cfg.fixed);
  return { taxa, liquido: round2(bruto - taxa) };
}

export const getStripeFeeConfig = createServerFn({ method: "POST" })
  .inputValidator((i) => creds.parse(i))
  .handler(async ({ data }) => {
    const { assertAdmin } = await import("@/lib/stripe-helper.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await assertAdmin(data.barbearia_id, data.admin_id, data.admin_password);
    const { data: row } = await supabaseAdmin
      .from("informacoes")
      .select("stripe_fee_percent, stripe_fee_fixed")
      .eq("barbearia_id", data.barbearia_id)
      .maybeSingle();
    return {
      percent: Number((row as { stripe_fee_percent?: number } | null)?.stripe_fee_percent ?? DEFAULT_FEE_PCT),
      fixed: Number((row as { stripe_fee_fixed?: number } | null)?.stripe_fee_fixed ?? DEFAULT_FEE_FIXED),
    };
  });

export const setStripeFeeConfig = createServerFn({ method: "POST" })
  .inputValidator((i) =>
    creds.extend({
      percent: z.number().min(0).max(0.5),
      fixed: z.number().min(0).max(50),
    }).parse(i),
  )
  .handler(async ({ data }) => {
    const { assertAdmin } = await import("@/lib/stripe-helper.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await assertAdmin(data.barbearia_id, data.admin_id, data.admin_password);
    const { error } = await supabaseAdmin
      .from("informacoes")
      .update({ stripe_fee_percent: data.percent, stripe_fee_fixed: data.fixed })
      .eq("barbearia_id", data.barbearia_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

async function loadFee(supabaseAdmin: typeof import("@/integrations/supabase/client.server").supabaseAdmin, barbeariaId: string) {
  const { data } = await supabaseAdmin
    .from("informacoes")
    .select("stripe_fee_percent, stripe_fee_fixed")
    .eq("barbearia_id", barbeariaId)
    .maybeSingle();
  return {
    pct: Number((data as { stripe_fee_percent?: number } | null)?.stripe_fee_percent ?? DEFAULT_FEE_PCT),
    fixed: Number((data as { stripe_fee_fixed?: number } | null)?.stripe_fee_fixed ?? DEFAULT_FEE_FIXED),
  };
}

export const getFinanceiroResumo = createServerFn({ method: "POST" })
  .inputValidator((i) => creds.merge(periodo).parse(i))
  .handler(async ({ data }) => {
    const { assertAdmin } = await import("@/lib/stripe-helper.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await assertAdmin(data.barbearia_id, data.admin_id, data.admin_password);

    const { data: pagamentos } = await supabaseAdmin
      .from("clube_pagamentos")
      .select("valor_bruto, taxa_stripe, valor_liquido, tipo, status")
      .eq("barbearia_id", data.barbearia_id)
      .gte("pago_em", data.inicio)
      .lte("pago_em", data.fim);

    let bruto = 0, taxas = 0, liquido = 0, reembolsos = 0;
    let nTransacoes = 0;
    for (const p of pagamentos ?? []) {
      bruto += Number(p.valor_bruto);
      taxas += Number(p.taxa_stripe);
      liquido += Number(p.valor_liquido);
      if (p.tipo === "refund" || Number(p.valor_bruto) < 0) reembolsos += Math.abs(Number(p.valor_bruto));
      if (p.tipo === "payment") nTransacoes++;
    }

    // Assinaturas ativas + MRR
    const hoje = new Date().toISOString().slice(0, 10);
    const { data: assinaturas } = await supabaseAdmin
      .from("clube_usuarios")
      .select("clube_id, data_fim, status_stripe, clube_assinatura:clube_id(valor_mensal)")
      .eq("barbearia_id", data.barbearia_id)
      .gte("data_fim", hoje);

    const fee = await loadFee(supabaseAdmin, data.barbearia_id);
    let mrrBruto = 0, mrrLiquido = 0, assinantesAtivos = 0;
    for (const a of assinaturas ?? []) {
      const status = (a as { status_stripe?: string }).status_stripe;
      if (status && !["active", "trialing", null, undefined].includes(status)) continue;
      const valor = Number((a as { clube_assinatura?: { valor_mensal?: number } }).clube_assinatura?.valor_mensal ?? 0);
      if (valor <= 0) continue;
      assinantesAtivos++;
      mrrBruto += valor;
      mrrLiquido += calcFee(valor, fee).liquido;
    }

    return {
      bruto: round2(bruto),
      taxas: round2(taxas),
      reembolsos: round2(reembolsos),
      liquido: round2(liquido),
      n_transacoes: nTransacoes,
      assinantes_ativos: assinantesAtivos,
      mrr_bruto: round2(mrrBruto),
      mrr_liquido: round2(mrrLiquido),
      mrr_previsao_proximo_ciclo: round2(mrrLiquido),
      fee,
    };
  });

export const getFinanceiroPorClube = createServerFn({ method: "POST" })
  .inputValidator((i) => creds.merge(periodo).parse(i))
  .handler(async ({ data }) => {
    const { assertAdmin } = await import("@/lib/stripe-helper.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await assertAdmin(data.barbearia_id, data.admin_id, data.admin_password);

    const [{ data: clubes }, { data: pagamentos }, { data: ativos }] = await Promise.all([
      supabaseAdmin
        .from("clube_assinatura")
        .select("id, nome, valor_mensal")
        .eq("barbearia_id", data.barbearia_id),
      supabaseAdmin
        .from("clube_pagamentos")
        .select("clube_id, valor_bruto, taxa_stripe, valor_liquido, tipo")
        .eq("barbearia_id", data.barbearia_id)
        .gte("pago_em", data.inicio)
        .lte("pago_em", data.fim),
      supabaseAdmin
        .from("clube_usuarios")
        .select("clube_id, status_stripe, data_fim")
        .eq("barbearia_id", data.barbearia_id)
        .gte("data_fim", new Date().toISOString().slice(0, 10)),
    ]);

    const fee = await loadFee(supabaseAdmin, data.barbearia_id);

    return (clubes ?? []).map((c) => {
      const ps = (pagamentos ?? []).filter((p) => p.clube_id === c.id);
      let bruto = 0, taxas = 0, liquido = 0, reembolsos = 0, nPag = 0;
      for (const p of ps) {
        bruto += Number(p.valor_bruto);
        taxas += Number(p.taxa_stripe);
        liquido += Number(p.valor_liquido);
        if (p.tipo === "refund" || Number(p.valor_bruto) < 0) reembolsos += Math.abs(Number(p.valor_bruto));
        if (p.tipo === "payment") nPag++;
      }
      const ativosClube = (ativos ?? []).filter(
        (a) => a.clube_id === c.id &&
          (!a.status_stripe || ["active", "trialing"].includes(a.status_stripe)),
      ).length;
      const valor = Number(c.valor_mensal);
      const liqMensal = calcFee(valor, fee).liquido;
      return {
        id: c.id,
        nome: c.nome,
        valor_mensal: valor,
        liquido_mensal: liqMensal,
        assinantes_ativos: ativosClube,
        mrr_liquido: round2(liqMensal * ativosClube),
        n_pagamentos: nPag,
        bruto: round2(bruto),
        taxas: round2(taxas),
        reembolsos: round2(reembolsos),
        liquido: round2(liquido),
        ticket_medio: nPag > 0 ? round2((bruto + (reembolsos > 0 ? 0 : 0)) / nPag) : 0,
      };
    });
  });

export const getFinanceiroSerie = createServerFn({ method: "POST" })
  .inputValidator((i) => creds.merge(periodo).parse(i))
  .handler(async ({ data }) => {
    const { assertAdmin } = await import("@/lib/stripe-helper.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await assertAdmin(data.barbearia_id, data.admin_id, data.admin_password);
    const { data: pagamentos } = await supabaseAdmin
      .from("clube_pagamentos")
      .select("valor_bruto, taxa_stripe, valor_liquido, tipo, pago_em")
      .eq("barbearia_id", data.barbearia_id)
      .gte("pago_em", data.inicio)
      .lte("pago_em", data.fim)
      .order("pago_em");

    const buckets = new Map<string, { bruto: number; liquido: number; reembolsos: number }>();
    for (const p of pagamentos ?? []) {
      const key = String(p.pago_em).slice(0, 7); // YYYY-MM
      const b = buckets.get(key) ?? { bruto: 0, liquido: 0, reembolsos: 0 };
      b.bruto += Number(p.valor_bruto);
      b.liquido += Number(p.valor_liquido);
      if (p.tipo === "refund" || Number(p.valor_bruto) < 0) b.reembolsos += Math.abs(Number(p.valor_bruto));
      buckets.set(key, b);
    }
    return Array.from(buckets.entries()).map(([mes, v]) => ({
      mes,
      bruto: round2(v.bruto),
      liquido: round2(v.liquido),
      reembolsos: round2(v.reembolsos),
    }));
  });

export const listFinanceiroTransacoes = createServerFn({ method: "POST" })
  .inputValidator((i) => creds.merge(periodo).extend({ limit: z.number().int().min(1).max(200).default(50) }).parse(i))
  .handler(async ({ data }) => {
    const { assertAdmin } = await import("@/lib/stripe-helper.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await assertAdmin(data.barbearia_id, data.admin_id, data.admin_password);
    const { data: rows } = await supabaseAdmin
      .from("clube_pagamentos")
      .select("id, valor_bruto, taxa_stripe, valor_liquido, status, tipo, pago_em, stripe_invoice_id, clube_id, cliente_id")
      .eq("barbearia_id", data.barbearia_id)
      .gte("pago_em", data.inicio)
      .lte("pago_em", data.fim)
      .order("pago_em", { ascending: false })
      .limit(data.limit);
    return rows ?? [];
  });
