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

export async function triggerWebhook(event: WebhookEvent, data: WebhookData & { barbearia_id?: string }) {
  try {
    // 1. Log for debugging
    const userData = localStorage.getItem("user");
    let currentUserBarbeariaId = "";
    if (userData) {
      const user = JSON.parse(userData);
      currentUserBarbeariaId = user.barbearia_id;
      if (user.nivel && user.nivel !== 3) {
        console.log("Webhook skipped: User is level", user.nivel, "(only level 3 triggers webhooks)");
        return;
      }
    }

    // Function to lowercase all keys in an object
    const lowercaseKeys = (obj: any): any => {
      if (typeof obj !== 'object' || obj === null) return obj;
      if (Array.isArray(obj)) return obj.map(lowercaseKeys);
      
      return Object.keys(obj).reduce((acc: any, key) => {
        // Excluir id_barbearia, barbearia_id e ID_BARBEARIA da conversão para minúsculas
        // para garantir que cheguem exatamente como esperado no n8n/webhook
        if (key === 'id_barbearia' || key === 'barbearia_id' || key === 'ID_BARBEARIA') {
          acc[key] = obj[key];
        } else {
          acc[key.toLowerCase()] = lowercaseKeys(obj[key]);
        }
        return acc;
      }, {});
    };

    const currentBarbeariaId = data.barbearia_id || currentUserBarbeariaId;
    
    // We create the payload and THEN lowercase it. 
    // To ensure id_barbearia exists after lowercasing, we can just rely on the fact that 
    // it will become "id_barbearia" (which is already lowercase).
    const webhookPayload = {
      ...data,
      barbearia_id: currentBarbeariaId,
      id_barbearia: currentBarbeariaId
    };

    // Ensure they are definitely in there before lowercasing, 
    // and also reinforce them afterward just in case.
    const lowercasedData = lowercaseKeys(webhookPayload);
    
    if (currentBarbeariaId) {
      lowercasedData.id_barbearia = currentBarbeariaId;
      lowercasedData.barbearia_id = currentBarbeariaId;
      // Add one more just in case n8n or the receiver expects a specific casing
      lowercasedData["ID_BARBEARIA"] = currentBarbeariaId;
    }
    console.log("Triggering Webhook:", event, lowercasedData);

    // 2. Fetch the webhook URL (Unified for all barber shops)
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
        body: lowercasedData,
      }
    });

  } catch (error) {
    console.error("Error in triggerWebhook:", error);
  }
}
