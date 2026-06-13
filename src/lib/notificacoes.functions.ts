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
  return credentials;
}

async function manageNotifications(
  credentials: z.infer<typeof credentialsSchema>,
  action: string,
  payload: Record<string, unknown> = {},
) {
  await requireSuperAdmin(credentials);
  const { supabase } = await import("@/integrations/supabase/client");
  const { data, error } = await supabase.rpc("manage_notificacoes", {
    p_admin_id: credentials.id,
    p_login: credentials.login,
    p_senha: credentials.senha,
    p_action: action,
    p_payload: payload,
  });
  if (error) throw new Error(error.message);
  return data as Record<string, unknown>;
}

async function sendWebhook(webhookUrl: string, payload: Record<string, unknown>) {
  if (!webhookUrl) throw new Error("Webhook de promoções não configurado.");
  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(`O serviço de WhatsApp respondeu com status ${response.status}.`);
}

export const getLatestSiteNotifications = createServerFn({ method: "GET" }).handler(async () => {
  const { supabase } = await import("@/integrations/supabase/client");
  const { data, error } = await supabase.rpc("get_latest_site_notifications");
  if (error) throw new Error("Não foi possível carregar as notificações.");
  return data ?? [];
});

export const getNotificationsPage = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ credentials: credentialsSchema, page: z.number().int().min(0).max(10000) }).parse(input))
  .handler(async ({ data }) => {
    const result = await manageNotifications(data.credentials, "page", { page: data.page });
    const drafts = Array.isArray(result.drafts) ? result.drafts : [];
    return { rows: Array.isArray(result.rows) ? result.rows : [], count: Number(result.count ?? 0), draft: drafts[0] ?? null };
  });

export const publishSiteNotification = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ credentials: credentialsSchema, notification: notificationSchema }).parse(input))
  .handler(async ({ data }) => {
    await manageNotifications(data.credentials, "publish_site", data.notification);
    return { ok: true };
  });

export const deleteNotification = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ credentials: credentialsSchema, id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    await manageNotifications(data.credentials, "delete", { id: data.id });
    return { ok: true };
  });

export const saveWhatsAppDraft = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ credentials: credentialsSchema, notification: notificationSchema }).parse(input))
  .handler(async ({ data }) => {
    await manageNotifications(data.credentials, "save_drafts", data.notification);
    return { ok: true };
  });

export const testWhatsAppNotification = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ credentials: credentialsSchema, notification: notificationSchema }).parse(input))
  .handler(async ({ data }) => {
    const config = await manageNotifications(data.credentials, "webhook_config");
    await sendWebhook(String(config.webhook_url ?? ""), {
      tipo: "teste_notificacao",
      telefone: data.credentials.login,
      titulo: data.notification.titulo,
      texto: data.notification.texto,
      data: new Date().toISOString(),
    });
    await manageNotifications(data.credentials, "mark_tested", data.notification);
    return { ok: true };
  });

export const sendWhatsAppNotification = createServerFn({ method: "POST" })
  .inputValidator((input) => adminInputSchema.parse(input))
  .handler(async ({ data }) => {
    const prepared = await manageNotifications(data.credentials, "prepare_send");
    const notification = notificationSchema.parse(prepared.notification);
    await sendWebhook(String(prepared.webhook_url ?? ""), { tipo: "envio_notificacao", ...notification, data: new Date().toISOString() });
    await manageNotifications(data.credentials, "finalize_send");
    return { ok: true };
  });