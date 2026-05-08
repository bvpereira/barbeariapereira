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
    console.log("Triggering Webhook:", event, data);

    // 2. Check if the user is level 3
    const userData = localStorage.getItem("user");
    if (!userData) return;
    
    const user = JSON.parse(userData);
    if (user.nivel !== 3) {
      console.log("Webhook skipped: User is not Level 3 (Nível:", user.nivel, ")");
      return;
    }

    // 2. Fetch the webhook URL
    const { data: config, error } = await supabase
      .from("integracoes")
      .select("webhook_url")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (error || !config?.webhook_url) {
      if (error && error.code !== "PGRST116") {
        console.error("Error fetching webhook config:", error);
      }
      return;
    }

    // 3. Send the POST request
    // We use fetch and don't await/block the UI if it fails
    fetch(config.webhook_url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    }).catch(err => {
      console.error("Webhook call failed:", err);
    });

  } catch (error) {
    console.error("Error in triggerWebhook:", error);
  }
}
