import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const creds = z.object({
  barbearia_id: z.string().uuid(),
  admin_id: z.string().uuid(),
  admin_password: z.string().min(1).max(200),
});

/** Save / update Stripe credentials for a barbershop. Validates the key. */
export const saveStripeConfig = createServerFn({ method: "POST" })
  .inputValidator((i) =>
    creds.extend({
      chave_stripe: z.string().trim().min(10).max(300).optional().nullable(),
      ativo: z.boolean(),
      base_url: z.string().url().max(500),
    }).parse(i),
  )
  .handler(async ({ data }) => {
    const { assertAdmin, makeStripe, getBarbeariaStripeConfig } = await import("@/lib/stripe-helper.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await assertAdmin(data.barbearia_id, data.admin_id, data.admin_password);

    const current = await getBarbeariaStripeConfig(data.barbearia_id);
    const finalKey = data.chave_stripe?.trim() || current?.chave_stripe || null;

    if (data.ativo && !finalKey) throw new Error("Informe a chave secreta do Stripe.");

    let accountId = current?.stripe_account_id ?? null;
    let webhookSecret = current?.stripe_webhook_secret ?? null;

    if (finalKey && (data.chave_stripe || data.ativo)) {
      const stripe = makeStripe(finalKey);
      try {
        const acc = await (stripe.accounts as unknown as { retrieve: () => Promise<{ id: string }> }).retrieve();
        accountId = acc.id;
      } catch (e) {
        console.error("Stripe key validation failed:", e);
        const msg = e instanceof Error ? e.message : "desconhecido";
        throw new Error(`Chave do Stripe inválida: ${msg}`);
      }
      if (data.ativo && !webhookSecret) {
        const url = `${data.base_url.replace(/\/$/, "")}/api/public/stripe-webhook`;
        const wh = await stripe.webhookEndpoints.create({
          url,
          enabled_events: [
            "checkout.session.completed",
            "invoice.paid",
            "invoice.payment_failed",
            "customer.subscription.updated",
            "customer.subscription.deleted",
          ],
          metadata: { barbearia_id: data.barbearia_id },
        });
        webhookSecret = wh.secret ?? null;
      }
    }

    const { error } = await supabaseAdmin
      .from("informacoes")
      .update({
        chave_stripe: finalKey,
        stripe_ativo: data.ativo,
        stripe_account_id: accountId,
        stripe_webhook_secret: webhookSecret,
      })
      .eq("barbearia_id", data.barbearia_id);
    if (error) throw new Error(error.message);

    return { ok: true, account_id: accountId };
  });

export const getStripeConfig = createServerFn({ method: "POST" })
  .inputValidator((i) => creds.parse(i))
  .handler(async ({ data }) => {
    const { assertAdmin, getBarbeariaStripeConfig, maskKey } = await import("@/lib/stripe-helper.server");
    await assertAdmin(data.barbearia_id, data.admin_id, data.admin_password);
    const cfg = await getBarbeariaStripeConfig(data.barbearia_id);
    return {
      ativo: Boolean(cfg?.stripe_ativo),
      configurado: Boolean(cfg?.chave_stripe),
      account_id: cfg?.stripe_account_id ?? null,
      chave_mascarada: maskKey(cfg?.chave_stripe),
    };
  });

/** Public: only returns whether the integration is enabled (for the client UI). */
export const getStripeStatusPublic = createServerFn({ method: "POST" })
  .inputValidator((i) => z.object({ barbearia_id: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    const { getBarbeariaStripeConfig } = await import("@/lib/stripe-helper.server");
    const cfg = await getBarbeariaStripeConfig(data.barbearia_id);
    return { ativo: Boolean(cfg?.stripe_ativo && cfg?.chave_stripe) };
  });

/** Save trial/coupon options for a clube. */
export const setClubeStripeOptions = createServerFn({ method: "POST" })
  .inputValidator((i) =>
    creds.extend({
      clube_id: z.string().uuid(),
      trial_dias: z.number().int().min(0).max(365),
      stripe_coupon_id: z.string().trim().max(100).nullable().optional(),
    }).parse(i),
  )
  .handler(async ({ data }) => {
    const { assertAdmin } = await import("@/lib/stripe-helper.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await assertAdmin(data.barbearia_id, data.admin_id, data.admin_password);
    const { error } = await supabaseAdmin
      .from("clube_assinatura")
      .update({
        trial_dias: data.trial_dias,
        stripe_coupon_id: data.stripe_coupon_id?.trim() || null,
      })
      .eq("id", data.clube_id)
      .eq("barbearia_id", data.barbearia_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Create/update Stripe Product + Price for a clube. Archives old price when value changes. */
export const syncClubeToStripe = createServerFn({ method: "POST" })
  .inputValidator((i) => creds.extend({ clube_id: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    const { assertAdmin, getStripeForBarbearia } = await import("@/lib/stripe-helper.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await assertAdmin(data.barbearia_id, data.admin_id, data.admin_password);

    const { data: clube, error: cErr } = await supabaseAdmin
      .from("clube_assinatura")
      .select("id, nome, descricao, valor_mensal, ativo, stripe_product_id, stripe_price_id, barbearia_id")
      .eq("id", data.clube_id)
      .maybeSingle();
    if (cErr) throw new Error(cErr.message);
    if (!clube || clube.barbearia_id !== data.barbearia_id) throw new Error("Clube não encontrado.");

    const stripe = await getStripeForBarbearia(data.barbearia_id);
    const amount = Math.round(Number(clube.valor_mensal) * 100);

    let productId = clube.stripe_product_id;
    if (!productId) {
      const p = await stripe.products.create({
        name: clube.nome,
        description: clube.descricao || undefined,
        active: clube.ativo,
        metadata: { barbearia_id: data.barbearia_id, clube_id: clube.id },
      });
      productId = p.id;
    } else {
      await stripe.products.update(productId, {
        name: clube.nome,
        description: clube.descricao || undefined,
        active: clube.ativo,
      });
    }

    let priceId = clube.stripe_price_id;
    let needNewPrice = !priceId;
    if (priceId) {
      try {
        const existing = await stripe.prices.retrieve(priceId);
        if (existing.unit_amount !== amount || existing.currency !== "brl") needNewPrice = true;
      } catch {
        needNewPrice = true;
      }
    }
    if (needNewPrice) {
      if (priceId) {
        try { await stripe.prices.update(priceId, { active: false }); } catch { /* ignore */ }
      }
      const np = await stripe.prices.create({
        product: productId,
        unit_amount: amount,
        currency: "brl",
        recurring: { interval: "month" },
        metadata: { barbearia_id: data.barbearia_id, clube_id: clube.id },
      });
      priceId = np.id;
    }

    await supabaseAdmin
      .from("clube_assinatura")
      .update({ stripe_product_id: productId, stripe_price_id: priceId })
      .eq("id", clube.id);

    return { product_id: productId, price_id: priceId };
  });

/** Sync all active clubes for a barbershop (used after activating Stripe). */
export const syncAllClubes = createServerFn({ method: "POST" })
  .inputValidator((i) => creds.parse(i))
  .handler(async ({ data }) => {
    const { assertAdmin } = await import("@/lib/stripe-helper.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await assertAdmin(data.barbearia_id, data.admin_id, data.admin_password);
    const { data: clubes, error } = await supabaseAdmin
      .from("clube_assinatura")
      .select("id")
      .eq("barbearia_id", data.barbearia_id)
      .eq("ativo", true);
    if (error) throw new Error(error.message);

    const { syncClubeToStripe } = await import("@/lib/stripe.functions");
    let count = 0;
    for (const c of clubes ?? []) {
      try {
        await syncClubeToStripe({
          data: { ...data, clube_id: c.id },
        } as never);
        count++;
      } catch (e) {
        console.error("sync clube failed", c.id, e);
      }
    }
    return { synced: count };
  });

/** Create a Checkout Session for a client to subscribe. Public (client-side). */
export const createCheckoutSession = createServerFn({ method: "POST" })
  .inputValidator((i) =>
    z.object({
      barbearia_id: z.string().uuid(),
      clube_id: z.string().uuid(),
      cliente_id: z.string().uuid(),
      base_url: z.string().url().max(500),
    }).parse(i),
  )
  .handler(async ({ data }) => {
    const { getStripeForBarbearia, getBarbeariaStripeConfig } = await import("@/lib/stripe-helper.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const cfg = await getBarbeariaStripeConfig(data.barbearia_id);
    if (!cfg?.stripe_ativo || !cfg.chave_stripe) throw new Error("Pagamento via Stripe não está ativo.");

    const { data: clube } = await supabaseAdmin
      .from("clube_assinatura")
      .select("id, nome, stripe_price_id, trial_dias, stripe_coupon_id, ativo")
      .eq("id", data.clube_id)
      .eq("barbearia_id", data.barbearia_id)
      .maybeSingle();
    if (!clube || !clube.ativo) throw new Error("Clube indisponível.");
    if (!clube.stripe_price_id) throw new Error("Clube ainda não sincronizado com o Stripe.");

    const { data: cliente } = await supabaseAdmin
      .from("usuarios")
      .select("id, nome, email_usuario, login")
      .eq("id", data.cliente_id)
      .eq("barbearia_id", data.barbearia_id)
      .maybeSingle();
    if (!cliente) throw new Error("Cliente não encontrado.");

    const { data: jaCliente } = await supabaseAdmin
      .from("clube_usuarios")
      .select("stripe_customer_id")
      .eq("usuario_id", data.cliente_id)
      .eq("barbearia_id", data.barbearia_id)
      .not("stripe_customer_id", "is", null)
      .limit(1)
      .maybeSingle();

    const stripe = await getStripeForBarbearia(data.barbearia_id);
    let customerId = jaCliente?.stripe_customer_id ?? null;
    if (!customerId) {
      const c = await stripe.customers.create({
        name: cliente.nome ?? undefined,
        email: cliente.email_usuario ?? undefined,
        metadata: { cliente_id: cliente.id, barbearia_id: data.barbearia_id },
      });
      customerId = c.id;
    }

    const base = data.base_url.replace(/\/$/, "");
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: clube.stripe_price_id, quantity: 1 }],
      subscription_data: {
        trial_period_days: clube.trial_dias && clube.trial_dias > 0 ? clube.trial_dias : undefined,
        metadata: {
          barbearia_id: data.barbearia_id,
          cliente_id: data.cliente_id,
          clube_id: data.clube_id,
        },
      },
      discounts: clube.stripe_coupon_id ? [{ coupon: clube.stripe_coupon_id }] : undefined,
      success_url: `${base}/clube/sucesso?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/clube/cancelado`,
      metadata: {
        barbearia_id: data.barbearia_id,
        cliente_id: data.cliente_id,
        clube_id: data.clube_id,
      },
    });

    return { url: session.url };
  });

/** Open the Stripe Billing Portal for the customer. */
export const createBillingPortalSession = createServerFn({ method: "POST" })
  .inputValidator((i) =>
    z.object({
      barbearia_id: z.string().uuid(),
      cliente_id: z.string().uuid(),
      base_url: z.string().url().max(500),
    }).parse(i),
  )
  .handler(async ({ data }) => {
    const { getStripeForBarbearia } = await import("@/lib/stripe-helper.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: row } = await supabaseAdmin
      .from("clube_usuarios")
      .select("stripe_customer_id")
      .eq("usuario_id", data.cliente_id)
      .eq("barbearia_id", data.barbearia_id)
      .not("stripe_customer_id", "is", null)
      .limit(1)
      .maybeSingle();
    if (!row?.stripe_customer_id) throw new Error("Cliente sem assinatura no Stripe.");

    const stripe = await getStripeForBarbearia(data.barbearia_id);
    const session = await stripe.billingPortal.sessions.create({
      customer: row.stripe_customer_id,
      return_url: data.base_url.replace(/\/$/, "") + "/cliente",
    });
    return { url: session.url };
  });

/** Returns the current client's subscription status (origem, status_stripe) for one barbershop. */
export const getClienteSubscriptionStatus = createServerFn({ method: "POST" })
  .inputValidator((i) =>
    z.object({ barbearia_id: z.string().uuid(), cliente_id: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("clube_usuarios")
      .select("origem, status_stripe, stripe_customer_id, data_fim")
      .eq("usuario_id", data.cliente_id)
      .eq("barbearia_id", data.barbearia_id)
      .order("data_fim", { ascending: false })
      .limit(1);
    const r = rows?.[0];
    return {
      origem: r?.origem ?? null,
      status_stripe: r?.status_stripe ?? null,
      has_customer: Boolean(r?.stripe_customer_id),
      data_fim: r?.data_fim ?? null,
    };
  });
