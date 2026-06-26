import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/stripe-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const signature = request.headers.get("stripe-signature");
        if (!signature) return new Response("Missing signature", { status: 400 });
        const rawBody = await request.text();

        // Parse unverified to read metadata and identify which barbearia this event belongs to.
        let parsed: any;
        try { parsed = JSON.parse(rawBody); } catch { return new Response("Invalid JSON", { status: 400 }); }
        const obj = parsed?.data?.object ?? {};
        const barbeariaId: string | undefined =
          obj?.metadata?.barbearia_id ||
          obj?.subscription_details?.metadata?.barbearia_id ||
          obj?.lines?.data?.[0]?.metadata?.barbearia_id;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { makeStripe } = await import("@/lib/stripe-helper.server");

        let cfg: any = null;
        if (barbeariaId) {
          const { data } = await supabaseAdmin
            .from("informacoes")
            .select("chave_stripe, stripe_webhook_secret, barbearia_id")
            .eq("barbearia_id", barbeariaId)
            .maybeSingle();
          cfg = data;
        } else {
          // Fallback: try to identify by customer
          const customerId = obj?.customer;
          if (customerId) {
            const { data: row } = await supabaseAdmin
              .from("clube_usuarios")
              .select("barbearia_id")
              .eq("stripe_customer_id", customerId)
              .limit(1)
              .maybeSingle();
            if (row?.barbearia_id) {
              const { data } = await supabaseAdmin
                .from("informacoes")
                .select("chave_stripe, stripe_webhook_secret, barbearia_id")
                .eq("barbearia_id", row.barbearia_id)
                .maybeSingle();
              cfg = data;
            }
          }
        }
        if (!cfg?.chave_stripe || !cfg?.stripe_webhook_secret) {
          return new Response("Unknown tenant", { status: 400 });
        }

        const stripe = makeStripe(cfg.chave_stripe);
        let event;
        try {
          event = await stripe.webhooks.constructEventAsync(rawBody, signature, cfg.stripe_webhook_secret);
        } catch (e) {
          console.error("Stripe signature invalid", e);
          return new Response("Invalid signature", { status: 400 });
        }

        // Idempotency
        const { data: seen } = await supabaseAdmin
          .from("stripe_eventos")
          .select("event_id")
          .eq("event_id", event.id)
          .maybeSingle();
        if (seen) return new Response("ok", { status: 200 });

        try {
          await handleEvent(event, cfg.barbearia_id);
          await supabaseAdmin.from("stripe_eventos").insert({
            event_id: event.id,
            type: event.type,
            barbearia_id: cfg.barbearia_id,
          });
        } catch (e) {
          console.error("Webhook handler error", event.type, e);
          return new Response("Handler error", { status: 500 });
        }

        return new Response("ok", { status: 200 });
      },
    },
  },
});

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

async function handleEvent(event: any, barbeariaId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const obj = event.data.object;

  const upsertFromSubscription = async (params: {
    subscriptionId: string;
    customerId: string;
    clienteId?: string;
    clubeId?: string;
    status?: string;
    dataFim?: string;
  }) => {
    const meta = obj?.metadata ?? obj?.subscription_details?.metadata ?? {};
    const clienteId = params.clienteId || meta.cliente_id;
    const clubeId = params.clubeId || meta.clube_id;
    if (!clienteId || !clubeId) return;

    const dataInicio = new Date().toISOString().slice(0, 10);
    const dataFim = params.dataFim || addMonths(new Date(), 1).toISOString().slice(0, 10);

    const { data: existing } = await supabaseAdmin
      .from("clube_usuarios")
      .select("id")
      .eq("stripe_subscription_id", params.subscriptionId)
      .maybeSingle();

    if (existing) {
      await supabaseAdmin
        .from("clube_usuarios")
        .update({
          status_stripe: params.status,
          data_fim: dataFim,
          stripe_customer_id: params.customerId,
        })
        .eq("id", existing.id);
    } else {
      const { data: clube } = await supabaseAdmin
        .from("clube_assinatura")
        .select("valor_mensal")
        .eq("id", clubeId)
        .maybeSingle();
      await supabaseAdmin.from("clube_usuarios").insert({
        usuario_id: clienteId,
        clube_id: clubeId,
        barbearia_id: barbeariaId,
        data_inicio: dataInicio,
        data_fim: dataFim,
        valor_pago: Number(clube?.valor_mensal ?? 0),
        origem: "stripe",
        status_stripe: params.status ?? "active",
        stripe_subscription_id: params.subscriptionId,
        stripe_customer_id: params.customerId,
      });
    }
  };

  switch (event.type) {
    case "checkout.session.completed": {
      const subId = obj.subscription as string;
      const customerId = obj.customer as string;
      const meta = obj.metadata ?? {};
      await upsertFromSubscription({
        subscriptionId: subId,
        customerId,
        clienteId: meta.cliente_id,
        clubeId: meta.clube_id,
        status: "active",
      });
      break;
    }
    case "invoice.paid": {
      const subId = obj.subscription as string;
      if (subId) {
        const periodEnd: number | undefined =
          obj.lines?.data?.[0]?.period?.end ?? undefined;
        const dataFim = periodEnd
          ? new Date(periodEnd * 1000).toISOString().slice(0, 10)
          : addMonths(new Date(), 1).toISOString().slice(0, 10);
        await supabaseAdmin
          .from("clube_usuarios")
          .update({ data_fim: dataFim, status_stripe: "active" })
          .eq("stripe_subscription_id", subId);
      }

      const amountPaid = Number(obj.amount_paid ?? 0) / 100;
      if (amountPaid > 0 && obj.id) {
        const meta = obj.metadata ?? obj.subscription_details?.metadata ?? obj.lines?.data?.[0]?.metadata ?? {};
        const { data: cfgFee } = await supabaseAdmin
          .from("informacoes")
          .select("stripe_fee_percent, stripe_fee_fixed")
          .eq("barbearia_id", barbeariaId)
          .maybeSingle();
        const pct = Number((cfgFee as { stripe_fee_percent?: number } | null)?.stripe_fee_percent ?? 0.0399);
        const fix = Number((cfgFee as { stripe_fee_fixed?: number } | null)?.stripe_fee_fixed ?? 0.39);
        const taxa = Math.round((amountPaid * pct + fix) * 100) / 100;
        const liquido = Math.round((amountPaid - taxa) * 100) / 100;
        await supabaseAdmin.from("clube_pagamentos").insert({
          barbearia_id: barbeariaId,
          clube_id: meta.clube_id ?? null,
          cliente_id: meta.cliente_id ?? null,
          stripe_invoice_id: obj.id,
          stripe_payment_intent_id: (obj.payment_intent as string) ?? null,
          stripe_charge_id: (obj.charge as string) ?? null,
          stripe_subscription_id: subId ?? null,
          stripe_event_id: event.id,
          valor_bruto: amountPaid,
          taxa_stripe: taxa,
          valor_liquido: liquido,
          moeda: obj.currency ?? "brl",
          status: "paid",
          tipo: "payment",
          pago_em: new Date(((obj.status_transitions?.paid_at ?? obj.created ?? Math.floor(Date.now() / 1000)) as number) * 1000).toISOString(),
        });
      }
      break;
    }
    case "charge.refunded": {
      const chargeId = obj.id as string;
      const refundedTotal = Number(obj.amount_refunded ?? 0) / 100;
      if (!chargeId || refundedTotal <= 0) break;
      const { data: original } = await supabaseAdmin
        .from("clube_pagamentos")
        .select("id, barbearia_id, clube_id, cliente_id, stripe_invoice_id, stripe_subscription_id, valor_bruto, refunded_amount")
        .eq("stripe_charge_id", chargeId)
        .eq("tipo", "payment")
        .maybeSingle();
      const prevRefunded = Number(original?.refunded_amount ?? 0);
      const delta = Math.max(0, refundedTotal - prevRefunded);
      if (delta > 0) {
        await supabaseAdmin.from("clube_pagamentos").insert({
          barbearia_id: original?.barbearia_id ?? barbeariaId,
          clube_id: original?.clube_id ?? null,
          cliente_id: original?.cliente_id ?? null,
          stripe_invoice_id: original?.stripe_invoice_id ?? null,
          stripe_charge_id: chargeId,
          stripe_subscription_id: original?.stripe_subscription_id ?? null,
          stripe_event_id: event.id,
          valor_bruto: -delta,
          taxa_stripe: 0,
          valor_liquido: -delta,
          moeda: obj.currency ?? "brl",
          status: "refunded",
          tipo: "refund",
          pago_em: new Date().toISOString(),
        });
      }
      if (original) {
        const novoTotal = prevRefunded + delta;
        const novoStatus = novoTotal >= Number(original.valor_bruto) ? "refunded" : "partial_refund";
        await supabaseAdmin
          .from("clube_pagamentos")
          .update({ refunded_amount: novoTotal, status: novoStatus })
          .eq("id", original.id);
      }
      break;
    }
    case "invoice.payment_failed": {
      const subId = obj.subscription as string;
      if (!subId) break;
      await supabaseAdmin
        .from("clube_usuarios")
        .update({ status_stripe: "past_due" })
        .eq("stripe_subscription_id", subId);
      break;
    }
    case "customer.subscription.updated": {
      const subId = obj.id as string;
      await supabaseAdmin
        .from("clube_usuarios")
        .update({ status_stripe: obj.status })
        .eq("stripe_subscription_id", subId);
      break;
    }
    case "customer.subscription.deleted": {
      const subId = obj.id as string;
      await supabaseAdmin
        .from("clube_usuarios")
        .update({ status_stripe: "canceled" })
        .eq("stripe_subscription_id", subId);
      break;
    }
  }
}
