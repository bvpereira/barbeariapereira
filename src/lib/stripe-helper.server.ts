import Stripe from "stripe";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export function makeStripe(apiKey: string): Stripe {
  return new Stripe(apiKey);
}

export async function assertAdmin(barbeariaId: string, adminId: string, adminPassword: string) {
  const { data, error } = await supabaseAdmin
    .from("usuarios")
    .select("id, nivel, barbearia_id, senha")
    .eq("id", adminId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || data.barbearia_id !== barbeariaId || Number(data.nivel) !== 1 || data.senha !== adminPassword) {
    throw new Error("Credenciais administrativas inválidas.");
  }
}

export async function getBarbeariaStripeConfig(barbeariaId: string) {
  const { data, error } = await supabaseAdmin
    .from("informacoes")
    .select("chave_stripe, stripe_ativo, stripe_webhook_secret, stripe_account_id")
    .eq("barbearia_id", barbeariaId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function getStripeForBarbearia(barbeariaId: string): Promise<Stripe> {
  const cfg = await getBarbeariaStripeConfig(barbeariaId);
  if (!cfg?.chave_stripe) throw new Error("Stripe não configurado para esta barbearia.");
  return makeStripe(cfg.chave_stripe);
}

export function maskKey(key: string | null | undefined): string {
  if (!key) return "";
  if (key.length < 12) return "••••";
  return `${key.slice(0, 7)}••••${key.slice(-4)}`;
}
