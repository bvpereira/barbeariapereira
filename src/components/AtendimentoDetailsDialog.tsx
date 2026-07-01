import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Scissors, Package, Wallet, Ticket, Crown, CreditCard, QrCode, Banknote } from "lucide-react";

type MeioPagamento = "pix" | "dinheiro" | "credito" | "debito";
const MEIO_PAG_LABEL: Record<MeioPagamento, string> = {
  pix: "Pix",
  dinheiro: "Dinheiro",
  credito: "Cartão de crédito",
  debito: "Cartão de débito",
};
const MEIO_PAG_ICON: Record<MeioPagamento, React.ComponentType<{ className?: string }>> = {
  pix: QrCode,
  dinheiro: Banknote,
  credito: CreditCard,
  debito: CreditCard,
};

export interface AtendimentoDetailsData {
  id: string;
  data: string;
  status: string;
  valor: number;
  valor_original?: number | null;
  valor_desconto?: number | null;
  cashback_usado?: number | null;
  cashback_gerado?: number | null;
  clube_desconto_aplicado?: number | null;
  clube_id?: string | null;
  cupom_codigo?: string | null;
  cupom_nome?: string | null;
  meio_pagamento?: MeioPagamento | string | null;
  colaborador?: { nome?: string } | null;
  servicos?: {
    id?: string;
    name?: string;
    price?: number | null;
    cashback_gerado_item?: number | null;
  }[];
  produtos?: {
    id?: string;
    nome_produto: string;
    quantidade: number;
    valor_unitario: number;
  }[];
}

const fmt = (v: number) => `R$ ${(Number(v) || 0).toFixed(2).replace(".", ",")}`;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: AtendimentoDetailsData | null;
}

export function AtendimentoDetailsDialog({ open, onOpenChange, item }: Props) {
  if (!item) return null;

  const somaServicos = (item.servicos || []).reduce((s, sv) => s + (Number(sv?.price) || 0), 0);
  const somaProdutos = (item.produtos || []).reduce(
    (s, p) => s + Number(p.quantidade) * Number(p.valor_unitario),
    0,
  );
  const valorFinal = Number(item.valor) || 0;
  const descontoTotal = Number(item.valor_desconto) || 0;
  const cashbackUsado = Number(item.cashback_usado) || 0;
  const clubeDesc = Number(item.clube_desconto_aplicado) || 0;
  const cupom = Math.max(0, descontoTotal - cashbackUsado - clubeDesc);
  const cashbackGerado = Number(item.cashback_gerado) || 0;
  const valorOriginalDb = Number(item.valor_original) || 0;
  const original =
    valorOriginalDb > 0
      ? valorOriginalDb
      : somaServicos + somaProdutos > 0
        ? somaServicos + somaProdutos
        : valorFinal + descontoTotal;

  const MeioIcon =
    item.meio_pagamento && MEIO_PAG_ICON[item.meio_pagamento as MeioPagamento];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Detalhes do atendimento</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">
            <span>
              {format(parseISO(item.data), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
            </span>
            {item.colaborador?.nome && <span>Prof.: {item.colaborador.nome}</span>}
            <span>Status: {item.status}</span>
          </div>

          {(item.servicos?.length || 0) > 0 && (
            <div>
              <div className="font-semibold mb-1 flex items-center gap-2">
                <Scissors className="w-4 h-4 text-primary" /> Serviços
              </div>
              <ul className="space-y-1">
                {item.servicos!.map((s, i) => (
                  <li key={s.id || i} className="flex justify-between border-b border-border/50 py-1">
                    <span>{s.name}</span>
                    <span className="font-medium">{fmt(Number(s.price) || 0)}</span>
                  </li>
                ))}
                <li className="flex justify-between pt-1 text-muted-foreground">
                  <span>Subtotal serviços</span>
                  <span>{fmt(somaServicos)}</span>
                </li>
              </ul>
            </div>
          )}

          {(item.produtos?.length || 0) > 0 && (
            <div>
              <div className="font-semibold mb-1 flex items-center gap-2">
                <Package className="w-4 h-4 text-primary" /> Produtos
              </div>
              <ul className="space-y-1">
                {item.produtos!.map((p, i) => (
                  <li key={p.id || i} className="flex justify-between border-b border-border/50 py-1">
                    <span>
                      {p.nome_produto}{" "}
                      <span className="text-muted-foreground">
                        ({p.quantidade}x {fmt(Number(p.valor_unitario))})
                      </span>
                    </span>
                    <span className="font-medium">
                      {fmt(Number(p.quantidade) * Number(p.valor_unitario))}
                    </span>
                  </li>
                ))}
                <li className="flex justify-between pt-1 text-muted-foreground">
                  <span>Subtotal produtos</span>
                  <span>{fmt(somaProdutos)}</span>
                </li>
              </ul>
            </div>
          )}

          <div className="border-t pt-3 space-y-1">
            <div className="flex justify-between text-muted-foreground">
              <span>Valor original</span>
              <span className={descontoTotal > 0 ? "line-through" : ""}>{fmt(original)}</span>
            </div>
            {clubeDesc > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Crown className="w-3 h-3" /> Plano de assinatura
                </span>
                <span>-{fmt(clubeDesc)}</span>
              </div>
            )}
            {cupom > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Ticket className="w-3 h-3" /> Cupom
                  {item.cupom_nome
                    ? ` (${item.cupom_nome})`
                    : item.cupom_codigo
                      ? ` (${item.cupom_codigo})`
                      : ""}
                </span>
                <span>-{fmt(cupom)}</span>
              </div>
            )}
            {cashbackUsado > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Wallet className="w-3 h-3" /> Cashback usado
                </span>
                <span>-{fmt(cashbackUsado)}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-bold pt-2 border-t">
              <span>Total pago</span>
              <span className="text-primary">{fmt(valorFinal)}</span>
            </div>
            {cashbackGerado > 0 && (
              <div className="flex justify-between text-xs text-green-600 pt-1">
                <span className="flex items-center gap-1">
                  <Wallet className="w-3 h-3" /> Cashback gerado
                </span>
                <span>+{fmt(cashbackGerado)}</span>
              </div>
            )}
            {item.meio_pagamento && MeioIcon && (
              <div className="flex justify-between text-xs text-muted-foreground pt-1">
                <span className="flex items-center gap-1">
                  <MeioIcon className="w-3 h-3" /> Meio de pagamento
                </span>
                <span>{MEIO_PAG_LABEL[item.meio_pagamento as MeioPagamento] || String(item.meio_pagamento)}</span>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
