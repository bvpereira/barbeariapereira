import { useState, useEffect, useRef } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AdminLayout } from "@/components/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Send, Bot, User, Scale, Copy } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/iacodconsumi")({
  component: IACodConsumiPage,
});

interface Message {
  role: "user" | "assistant";
  content: string;
}

function IACodConsumiPage() {
  const { tenant } = useTenant();
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Olá! Sou seu assistente especializado no Código de Defesa do Consumidor. Como posso ajudar com suas dúvidas hoje?",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchWebhook = async () => {
      if (!tenant?.id) return;
      try {
        const { data, error } = await supabase
          .from("integracoes")
          .select("webhook_url")
          .eq("tipo", "ia_codconsumi")
          .eq("barbearia_id", tenant.id)
          .maybeSingle();

        if (error) {
          console.error("Erro ao buscar webhook:", error);
          return;
        }

        if (data) {
          setWebhookUrl(data.webhook_url);
        }
      } catch (err) {
        console.error("Erro na busca do webhook:", err);
      }
    };

    fetchWebhook();
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    if (!webhookUrl) {
      toast.error("Webhook não configurado para esta funcionalidade.");
      return;
    }

    const userMessage = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setLoading(true);

    try {
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message: userMessage }),
      });

      if (!response.ok) {
        throw new Error("Falha na comunicação com o assistente.");
      }

      const data = await response.json();
      console.log("Resposta do webhook:", data);
      
      // Garante que pegamos o campo 'output' conforme solicitado, 
      // tratando possíveis variações de retorno (objeto único ou array)
      let botResponse = "";
      if (Array.isArray(data) && data.length > 0) {
        botResponse = data[0].output;
      } else if (data && typeof data === 'object') {
        botResponse = data.output;
      }

      if (!botResponse) {
        botResponse = "Desculpe, não consegui processar sua dúvida no momento.";
      }

      setMessages((prev) => [...prev, { role: "assistant", content: botResponse }]);
    } catch (error) {
      console.error("Erro ao enviar mensagem:", error);
      toast.error("Ocorreu um erro ao falar com o assistente.");
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Ops! Tive um problema técnico. Pode tentar perguntar novamente?" },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (messages.length === 0) return;
    
    const text = messages
      .map((msg) => {
        const role = msg.role === "user" ? "VOCÊ" : "ASSISTENTE CDC";
        return `=== ${role} ===\n${msg.content}`;
      })
      .join("\n\n------------------------------------------\n\n");

    navigator.clipboard.writeText(text).then(() => {
      toast.success("Conversa copiada para a área de transferência!");
    }).catch((err) => {
      console.error("Erro ao copiar:", err);
      toast.error("Não foi possível copiar a conversa.");
    });
  };

  return (
    <AdminLayout>
      <div className="max-w-4xl mx-auto h-[calc(100vh-180px)] flex flex-col space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-100 rounded-lg">
            <Scale className="h-6 w-6 text-orange-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">IA – Assistente Código do Consumidor</h1>
            <p className="text-muted-foreground">Tire suas dúvidas sobre direitos e deveres do consumidor.</p>
          </div>
        </div>

        <Card className="flex-1 flex flex-col overflow-hidden border-orange-100 shadow-sm">
          <CardHeader className="py-3 border-b bg-orange-50/30 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Bot className="h-4 w-4 text-orange-600" />
              Chat de Suporte Jurídico
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopy}
              className="h-8 gap-2 border-orange-200 text-orange-700 hover:bg-orange-100 hover:text-orange-800"
            >
              <Copy className="h-3.5 w-3.5" />
              Copiar Conversa
            </Button>
          </CardHeader>
          <CardContent className="flex-1 p-0 flex flex-col bg-white">
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {messages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`flex gap-3 max-w-[80%] ${
                        msg.role === "user" ? "flex-row-reverse" : "flex-row"
                      }`}
                    >
                      <div
                        className={`mt-1 p-1 rounded-full h-8 w-8 flex items-center justify-center shrink-0 ${
                          msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-orange-100 text-orange-600"
                        }`}
                      >
                        {msg.role === "user" ? <User className="h-5 w-5" /> : <Bot className="h-5 w-5" />}
                      </div>
                      <div
                        className={`p-3 rounded-2xl ${
                          msg.role === "user"
                            ? "bg-primary text-primary-foreground rounded-tr-none"
                            : "bg-muted text-foreground rounded-tl-none border border-orange-50"
                        }`}
                      >
                        <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                      </div>
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="flex justify-start">
                    <div className="flex gap-3 max-w-[80%]">
                      <div className="mt-1 p-1 rounded-full h-8 w-8 flex items-center justify-center shrink-0 bg-orange-100 text-orange-600">
                        <Bot className="h-5 w-5" />
                      </div>
                      <div className="p-4 rounded-2xl bg-muted rounded-tl-none border border-orange-50">
                        <Loader2 className="h-4 w-4 animate-spin text-orange-600" />
                      </div>
                    </div>
                  </div>
                )}
                <div ref={scrollRef} />
              </div>
            </ScrollArea>

            <div className="p-4 border-t bg-muted/20">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSend();
                }}
                className="flex gap-2"
              >
                <Input
                  placeholder="Digite sua dúvida sobre o CDC..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  disabled={loading}
                  className="bg-white border-orange-100 focus-visible:ring-orange-500 text-black"
                />
                <Button 
                  type="submit" 
                  disabled={loading || !input.trim()}
                  className="bg-orange-600 hover:bg-orange-700 text-white"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </form>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
