import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const credentialsSchema = z.object({
  id: z.string().uuid(),
  login: z.string().min(1).max(255),
  senha: z.string().min(1).max(255),
  nivel: z.number().int(),
});

const notificationSchema = z.object({
  titulo: z.string().trim().min(1, "Informe o título.").max(150),
  texto: z.string().trim().min(1, "Informe o texto.").max(3000),
});

const adminInputSchema = z.object({ credentials: credentialsSchema });

async function requireSuperAdmin(credentials: z.infer<typeof credentialsSchema>) {
  if (credentials.nivel !== 0) throw new Error("Acesso não autorizado.");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("usuarios")
    .select("id, login, nivel")
    .eq("id", credentials.id)
    .eq("login", credentials.login)
    .eq("senha", credentials.senha)
    .eq("nivel", 0)
    .maybeSingle();
  if (error || !data) throw new Error("Acesso não autorizado.");
  return { supabaseAdmin, admin: data };
}

async function sendWebhook(payload: Record<string, unknown>) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: integration, error } = await supabaseAdmin
    .from("integracoes")
    .select("webhook_url")
    .eq("tipo", "promocao")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !integration?.webhook_url) throw new Error("Webhook de promoções não configurado.");

  const response = await fetch(integration.webhook_url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(`O serviço de WhatsApp respondeu com status ${response.status}.`);
}

export const getLatestSiteNotifications = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("notificacoes")
    .select("id, titulo, texto, publicada_em")
    .eq("canal", "site")
    .not("publicada_em", "is", null)
    .order("publicada_em", { ascending: false })
    .limit(6);
  if (error) throw new Error("Não foi possível carregar as notificações.");
  return data ?? [];
});

export const getNotificationsPage = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ credentials: credentialsSchema, page: z.number().int().min(0).max(10000) }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await requireSuperAdmin(data.credentials);
    const from = data.page * 10;
    const { data: rows, error, count } = await supabaseAdmin
      .from("notificacoes")
      .select("id, titulo, texto, canal, numero_notificacao, testada, publicada_em, created_at", { count: "exact" })
      .or("canal.eq.site,and(canal.eq.whatsapp,numero_notificacao.gt.0)")
      .order("publicada_em", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .range(from, from + 9);
    if (error) throw new Error("Não foi possível carregar o histórico.");

    const { data: draft, error: draftError } = await supabaseAdmin
      .from("notificacoes")
      .select("id, titulo, texto, testada")
      .eq("canal", "whatsapp")
      .eq("numero_notificacao", 0)
      .maybeSingle();
    if (draftError) throw new Error("Não foi possível carregar o rascunho do WhatsApp.");
    return { rows: rows ?? [], count: count ?? 0, draft };
  });

export const publishSiteNotification = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ credentials: credentialsSchema, notification: notificationSchema }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await requireSuperAdmin(data.credentials);
    const { error } = await supabaseAdmin.from("notificacoes").insert({
      ...data.notification,
      canal: "site",
      publicada_em: new Date().toISOString(),
    });
    if (error) throw new Error("Não foi possível publicar a notificação.");
    return { ok: true };
  });

export const deleteNotification = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ credentials: credentialsSchema, id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await requireSuperAdmin(data.credentials);
    const { error } = await supabaseAdmin.from("notificacoes").delete().eq("id", data.id).neq("numero_notificacao", 0);
    if (error) throw new Error("Não foi possível excluir a notificação.");
    return { ok: true };
  });

export const saveWhatsAppDraft = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ credentials: credentialsSchema, notification: notificationSchema }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await requireSuperAdmin(data.credentials);
    const { error } = await supabaseAdmin
      .from("notificacoes")
      .update({ ...data.notification, testada: false })
      .eq("canal", "whatsapp")
      .eq("numero_notificacao", 0);
    if (error) throw new Error("Não foi possível salvar a notificação.");
    return { ok: true };
  });

export const testWhatsAppNotification = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ credentials: credentialsSchema, notification: notificationSchema }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin, admin } = await requireSuperAdmin(data.credentials);
    await sendWebhook({
      tipo: "teste_notificacao",
      telefone: admin.login,
      titulo: data.notification.titulo,
      texto: data.notification.texto,
      data: new Date().toISOString(),
    });
    const { error } = await supabaseAdmin
      .from("notificacoes")
      .update({ ...data.notification, testada: true })
      .eq("canal", "whatsapp")
      .eq("numero_notificacao", 0);
    if (error) throw new Error("Teste enviado, mas não foi possível registrar a confirmação.");
    return { ok: true };
  });

export const sendWhatsAppNotification = createServerFn({ method: "POST" })
  .inputValidator((input) => adminInputSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await requireSuperAdmin(data.credentials);
    const { data: draft, error: draftError } = await supabaseAdmin
      .from("notificacoes")
      .select("titulo, texto, testada")
      .eq("canal", "whatsapp")
      .eq("numero_notificacao", 0)
      .maybeSingle();
    if (draftError || !draft) throw new Error("Rascunho do WhatsApp não encontrado.");
    if (!draft.testada) throw new Error("Envie um teste antes da notificação real.");
    const notification = notificationSchema.parse(draft);

    await sendWebhook({ tipo: "envio_notificacao", titulo: notification.titulo, texto: notification.texto, data: new Date().toISOString() });

    const { data: latest } = await supabaseAdmin
      .from("notificacoes")
      .select("numero_notificacao")
      .eq("canal", "whatsapp")
      .gt("numero_notificacao", 0)
      .order("numero_notificacao", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextNumber = (latest?.numero_notificacao ?? 0) + 1;
    const publishedAt = new Date().toISOString();
    const { error: historyError } = await supabaseAdmin.from("notificacoes").insert({
      ...notification,
      canal: "whatsapp",
      numero_notificacao: nextNumber,
      testada: true,
      publicada_em: publishedAt,
    });
    if (historyError) throw new Error("Notificação enviada, mas não foi possível criar o histórico.");
    const { error: clearError } = await supabaseAdmin
      .from("notificacoes")
      .update({ titulo: "", texto: "", testada: false, publicada_em: null })
      .eq("canal", "whatsapp")
      .eq("numero_notificacao", 0);
    if (clearError) throw new Error("Notificação enviada, mas não foi possível limpar o formulário.");
    return { ok: true };
  });