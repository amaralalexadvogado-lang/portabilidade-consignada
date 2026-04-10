import { useState } from "react";
import { trpc } from "../lib/trpc";
import { formatDate, formatPhone, STATUS_LABELS, STATUS_COLORS, cn } from "../lib/utils";
import {
  Search, ChevronLeft, ChevronRight, Loader2, Eye, Pencil,
  CheckCircle, Unlock, X, Calendar,
} from "lucide-react";

const STATUS_OPTIONS = [
  { value: "all", label: "Todos" },
  { value: "aguarda_retorno_saldo", label: "Aguarda Retorno" },
  { value: "aguarda_desbloqueio", label: "Aguarda Desbloqueio" },
  { value: "pendente_formalizacao", label: "Pend. Formalização" },
  { value: "aprovado", label: "Aprovado" },
  { value: "cancelado", label: "Cancelado" },
];

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-auto p-5">{children}</div>
      </div>
    </div>
  );
}

function ClientDetail({ clientId, onClose }: { clientId: number; onClose: () => void }) {
  const { data, isLoading } = trpc.getClient.useQuery({ id: clientId });

  if (isLoading) return (
    <Modal title="Detalhes do Cliente" onClose={onClose}>
      <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
    </Modal>
  );

  const c = data?.client;
  const logs = data?.logs || [];

  return (
    <Modal title={c?.name || "Cliente"} onClose={onClose}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div><span className="text-muted-foreground">Telefone:</span> <span className="text-foreground ml-1">{formatPhone(c?.phone)}</span></div>
          <div><span className="text-muted-foreground">CPF:</span> <span className="text-foreground ml-1">{c?.cpf || "—"}</span></div>
          <div><span className="text-muted-foreground">Proposta:</span> <span className="text-foreground ml-1">{c?.proposta || "—"}</span></div>
          <div><span className="text-muted-foreground">Banco:</span> <span className="text-foreground ml-1">{c?.banco || "—"}</span></div>
          <div><span className="text-muted-foreground">Retorno:</span> <span className="text-foreground ml-1">{formatDate(c?.expectedReturnDate)}</span></div>
          <div>
            <span className="text-muted-foreground">Status:</span>
            <span className={cn("ml-1 px-2 py-0.5 rounded-full text-xs border", STATUS_COLORS[c?.status || ""])}>
              {STATUS_LABELS[c?.status || ""] || c?.status}
            </span>
          </div>
        </div>

        {c?.notes && (
          <div>
            <p className="text-muted-foreground text-xs mb-1">Observações:</p>
            <p className="text-sm text-foreground bg-secondary rounded-lg p-3">{c.notes}</p>
          </div>
        )}

        {c?.formalizacaoLink && (
          <div>
            <p className="text-muted-foreground text-xs mb-1">Link de Formalização:</p>
            <a href={c.formalizacaoLink} target="_blank" rel="noreferrer"
              className="text-sm text-primary hover:underline break-all">{c.formalizacaoLink}</a>
          </div>
        )}

        <div>
          <p className="text-muted-foreground text-xs mb-2">Histórico de Mensagens ({logs.length})</p>
          <div className="space-y-2 max-h-60 overflow-auto">
            {logs.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma mensagem enviada ainda.</p>}
            {logs.map((l) => (
              <div key={l.id} className="bg-secondary rounded-lg p-3 text-sm">
                <div className="flex items-center justify-between mb-1">
                  <span className={cn("px-2 py-0.5 rounded-full text-xs border",
                    l.status === "sent" ? "bg-green-500/20 text-green-400 border-green-500/30"
                      : l.status === "failed" ? "bg-red-500/20 text-red-400 border-red-500/30"
                        : "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
                  )}>{l.status}</span>
                  <span className="text-muted-foreground text-xs">{formatDate(l.sentAt)}</span>
                </div>
                <p className="text-muted-foreground text-xs mt-1 line-clamp-2">{l.message}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}

function EditDateModal({ client, onClose, onSave }: { client: any; onClose: () => void; onSave: (date: string) => void }) {
  const [date, setDate] = useState(
    client.expectedReturnDate ? new Date(client.expectedReturnDate).toISOString().split("T")[0] : ""
  );

  return (
    <Modal title="Editar Data de Retorno" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">Cliente: <span className="text-foreground font-medium">{client.name}</span></p>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Nova data de retorno</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <div className="flex gap-3">
          <button onClick={() => onSave(date)}
            className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-all">
            Salvar
          </button>
          <button onClick={onClose}
            className="flex-1 py-2 rounded-lg bg-secondary text-muted-foreground text-sm hover:text-foreground transition-all">
            Cancelar
          </button>
        </div>
      </div>
    </Modal>
  );
}

export default function Clients() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [detailId, setDetailId] = useState<number | null>(null);
  const [editClient, setEditClient] = useState<any | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.listClients.useQuery({ page, limit: 20, search, status });
  const updateMut = trpc.updateClient.useMutation({
    onSuccess: () => { utils.listClients.invalidate(); setFeedback("✅ Salvo!"); setTimeout(() => setFeedback(null), 3000); },
  });

  const totalPages = data ? Math.ceil(data.total / 20) : 1;

  function handleMark(id: number, field: "formalizacaoConcluida" | "desbloqueoConcluido") {
    updateMut.mutate({ id, [field]: true });
  }

  function handleSaveDate(date: string) {
    if (!editClient) return;
    updateMut.mutate({ id: editClient.id, expectedReturnDate: date });
    setEditClient(null);
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Clientes</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {data?.total ?? "..."} clientes cadastrados
        </p>
      </div>

      {feedback && (
        <div className="px-4 py-3 rounded-lg bg-green-500/10 text-green-400 border border-green-500/20 text-sm">{feedback}</div>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Buscar por nome, telefone, CPF..."
            className="w-full pl-9 pr-4 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          className="px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        >
          {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {/* Tabela */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/50">
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Nome</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Telefone</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Proposta</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Banco</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Retorno</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Status</th>
                <th className="text-right px-4 py-3 text-muted-foreground font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={7} className="text-center py-12">
                  <Loader2 className="w-5 h-5 animate-spin text-primary mx-auto" />
                </td></tr>
              )}
              {!isLoading && (!data?.clients || data.clients.length === 0) && (
                <tr><td colSpan={7} className="text-center py-12 text-muted-foreground">Nenhum cliente encontrado</td></tr>
              )}
              {data?.clients.map((c) => (
                <tr key={c.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                  <td className="px-4 py-3 font-medium text-foreground">{c.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{formatPhone(c.phone)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{c.proposta || "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{c.banco || "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <span className="text-muted-foreground">{formatDate(c.expectedReturnDate)}</span>
                      <button
                        onClick={() => setEditClient(c)}
                        className="text-muted-foreground hover:text-primary transition-colors ml-1"
                        title="Editar data"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn("px-2 py-0.5 rounded-full text-xs border", STATUS_COLORS[c.status || ""])}>
                      {STATUS_LABELS[c.status || ""] || c.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {c.status === "pendente_formalizacao" && !c.formalizacaoConcluida && (
                        <button
                          onClick={() => handleMark(c.id, "formalizacaoConcluida")}
                          title="Assinou o link"
                          className="p-1.5 rounded-lg hover:bg-green-500/20 text-muted-foreground hover:text-green-400 transition-all"
                        >
                          <CheckCircle className="w-4 h-4" />
                        </button>
                      )}
                      {c.status === "aguarda_desbloqueio" && !c.desbloqueoConcluido && (
                        <button
                          onClick={() => handleMark(c.id, "desbloqueoConcluido")}
                          title="Desbloqueou"
                          className="p-1.5 rounded-lg hover:bg-orange-500/20 text-muted-foreground hover:text-orange-400 transition-all"
                        >
                          <Unlock className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => setDetailId(c.id)}
                        className="p-1.5 rounded-lg hover:bg-primary/20 text-muted-foreground hover:text-primary transition-all"
                        title="Ver detalhes"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Paginação */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <p className="text-sm text-muted-foreground">
              Página {page} de {totalPages} — {data?.total} registros
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded-lg bg-secondary text-muted-foreground hover:text-foreground disabled:opacity-40 transition-all"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1.5 rounded-lg bg-secondary text-muted-foreground hover:text-foreground disabled:opacity-40 transition-all"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {detailId && <ClientDetail clientId={detailId} onClose={() => setDetailId(null)} />}
      {editClient && <EditDateModal client={editClient} onClose={() => setEditClient(null)} onSave={handleSaveDate} />}
    </div>
  );
}
