import { supabase } from "@/integrations/supabase/client";

export type WebhookEvent = "Agendamento" | "Remarcacao" | "Exclusao";

interface WebhookData {
  tipo: WebhookEvent;
  cliente: string;
  colaborador: string;
  tel_colaborador?: string;
  login_cliente?: string;
  data: string;
  horario: string;
  servicos: string[];
  data_antiga?: string;
  horario_antigo?: string;
}

export async function triggerWebhook(event: WebhookEvent, data: WebhookData) {
  try {
    // 1. Log for debugging
    // 1. Check user level (skip check if it's for debug/internal use)
    const userData = localStorage.getItem("user");
    if (userData) {
      const user = JSON.parse(userData);
      // Only skip if we explicitly know the user is NOT level 3
      // If we can't find the user level or it IS level 3, we continue
      if (user.nivel && user.nivel !== 3) {
        console.log("Webhook skipped: User is level", user.nivel, "(only level 3 triggers webhooks)");
        return;
      }
    }

    console.log("Triggering Webhook:", event, data);

    // 3. Fetch the webhook URL
    const { data: config, error } = await supabase
      .from("integracoes")
      .select("webhook_url")
      .eq("tipo", "atendimentos")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !config?.webhook_url) {
      if (error && error.code !== "PGRST116") {
        console.error("Error fetching webhook config:", error);
      }
      return;
    }

    // 3. Send the POST request via proxy to avoid CORS issues
    await supabase.functions.invoke('proxy-webhook', {
      body: {
        url: config.webhook_url,
        method: "POST",
        body: data,
      }
    });

  } catch (error) {
    console.error("Error in triggerWebhook:", error);
  }
}
