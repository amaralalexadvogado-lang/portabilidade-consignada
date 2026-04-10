import { useState } from "react";
import { trpc } from "../lib/trpc";
import { formatDate, cn } from "../lib/utils";
import { ChevronLeft, ChevronRight, Loader2, ChevronDown, ChevronUp } from "lucide-react";

const STATUS_OPTIONS = [
  { value: "all", label: "Todos" },
  { value: "sent", label: "Enviados" },
  { value: "failed", label: "Falhas" },
  { value: "pending", label: "Pendentes" },
];

const TYPE_LABELS: Record<string, string> = {
  morning: "9h — Matinal",
  noon: "12h — Meio-dia",
  afternoon: "15h — Vespertino",
  formalizacao_1h: "Formalização 1h",
  desbloqueio_1h: "Desbloqueio 1h",
};

export default function Messages() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("all");
  const [expanded, setExpanded] = useState<number | null>(null);

  const { data, isLoading } = trpc.listMessages.useQuery({ page, limit: 50, status });
  const totalPages = data ? Math.ceil(data.total / 50) : 1;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Mensagens</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {data?.total ?? "..."} mensagens no histórico
        </p>
      </div>

      <div className="flex gap-3">
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          className="px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        >
          {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {(!data?.messages || data.messages.length === 0) && (
              <p className="text-center py-12 text-muted-foreground text-sm">Nenhuma mensagem encontrada</p>
            )}
            {data?.messages.map((m) => (
              <div key={m.id} className="px-4 py-3 hover:bg-secondary/20 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className={cn(
                      "px-2 py-0.5 rounded-full text-xs border",
                      m.status === "sent" ? "bg-green-500/20 text-green-400 border-green-500/30"
                        : m.status === "failed" ? "bg-red-500/20 text-red-400 border-red-500/30"
                          : "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
                    )}>
                      {m.status === "sent" ? "Enviado" : m.status === "failed" ? "Falha" : "Pendente"}
                    </span>
                    <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
                      {TYPE_LABELS[m.messageType || ""] || m.messageType}
                    </span>
                    <span className="text-sm text-foreground font-medium">{m.phone}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">{formatDate(m.sentAt)}</span>
                    <button
                      onClick={() => setExpanded(expanded === m.id ? null : m.id)}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {expanded === m.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                {expanded === m.id && (
                  <div className="mt-3 bg-secondary rounded-lg p-3">
                    <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-sans">{m.message}</pre>
                    {m.errorMessage && (
                      <p className="mt-2 text-xs text-red-400">Erro: {m.errorMessage}</p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <p className="text-sm text-muted-foreground">Página {page} de {totalPages}</p>
            <div className="flex gap-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                className="p-1.5 rounded-lg bg-secondary text-muted-foreground hover:text-foreground disabled:opacity-40 transition-all">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="p-1.5 rounded-lg bg-secondary text-muted-foreground hover:text-foreground disabled:opacity-40 transition-all">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
