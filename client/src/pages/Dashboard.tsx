import { useState } from "react";
import { trpc } from "../lib/trpc";
import {
  Users, Clock, CalendarCheck, CheckCircle2, Send, XCircle,
  FileText, Unlock, Play, Loader2, RefreshCw,
} from "lucide-react";

function StatCard({
  label, value, icon: Icon, color,
}: {
  label: string; value: number | undefined; icon: any; color: string;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-5 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
        <Icon className="w-6 h-6" />
      </div>
      <div>
        <p className="text-2xl font-bold text-foreground">{value ?? "—"}</p>
        <p className="text-sm text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { data, isLoading, refetch } = trpc.dashboard.useQuery();
  const [dispatching, setDispatching] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const triggerDispatch = trpc.triggerDispatch.useMutation();
  const triggerForm = trpc.triggerFormalizacao.useMutation();
  const triggerDesbloq = trpc.triggerDesbloqueio.useMutation();

  async function fire(period: "morning" | "noon" | "afternoon") {
    setDispatching(period);
    setMsg(null);
    try {
      await triggerDispatch.mutateAsync({ period });
      setMsg(`✅ Disparo "${period}" executado com sucesso!`);
      refetch();
    } catch (e: any) {
      setMsg(`❌ Erro: ${e.message}`);
    } finally {
      setDispatching(null);
    }
  }

  async function fireFormalizacao() {
    setDispatching("formalizacao");
    setMsg(null);
    try {
      await triggerForm.mutateAsync();
      setMsg("✅ Disparo de formalização executado!");
      refetch();
    } catch (e: any) {
      setMsg(`❌ Erro: ${e.message}`);
    } finally {
      setDispatching(null);
    }
  }

  async function fireDesbloqueio() {
    setDispatching("desbloqueio");
    setMsg(null);
    try {
      await triggerDesbloq.mutateAsync();
      setMsg("✅ Disparo de desbloqueio executado!");
      refetch();
    } catch (e: any) {
      setMsg(`❌ Erro: ${e.message}`);
    } finally {
      setDispatching(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">Visão geral do sistema</p>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary text-muted-foreground hover:text-foreground text-sm transition-all"
        >
          <RefreshCw className="w-4 h-4" />
          Atualizar
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Total de Clientes" value={data?.total} icon={Users} color="bg-blue-500/20 text-blue-400" />
            <StatCard label="Aguarda Retorno" value={data?.aguardandoRetorno} icon={Clock} color="bg-yellow-500/20 text-yellow-400" />
            <StatCard label="Retorno Hoje" value={data?.retornoHoje} icon={CalendarCheck} color="bg-orange-500/20 text-orange-400" />
            <StatCard label="Aprovados" value={data?.aprovados} icon={CheckCircle2} color="bg-green-500/20 text-green-400" />
            <StatCard label="Pend. Formalização" value={data?.pendentesFormalizacao} icon={FileText} color="bg-purple-500/20 text-purple-400" />
            <StatCard label="Aguarda Desbloqueio" value={data?.aguardandoDesbloqueio} icon={Unlock} color="bg-red-500/20 text-red-400" />
            <StatCard label="Enviados Hoje" value={data?.enviadosHoje} icon={Send} color="bg-primary/20 text-primary" />
            <StatCard label="Falhas Hoje" value={data?.falhasHoje} icon={XCircle} color="bg-red-500/20 text-red-400" />
          </div>

          {/* Disparo manual */}
          <div className="bg-card border border-border rounded-xl p-5">
            <h2 className="text-base font-semibold text-foreground mb-4">Disparo Manual</h2>
            {msg && (
              <div className={`mb-4 px-4 py-3 rounded-lg text-sm ${msg.startsWith("✅") ? "bg-green-500/10 text-green-400 border border-green-500/20" : "bg-red-500/10 text-red-400 border border-red-500/20"}`}>
                {msg}
              </div>
            )}
            <div className="flex flex-wrap gap-3">
              {(["morning", "noon", "afternoon"] as const).map((p) => {
                const labels: Record<string, string> = { morning: "9h — Matinal", noon: "12h — Meio-dia", afternoon: "15h — Vespertino" };
                return (
                  <button
                    key={p}
                    onClick={() => fire(p)}
                    disabled={dispatching !== null}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/20 text-primary hover:bg-primary/30 text-sm font-medium transition-all disabled:opacity-50"
                  >
                    {dispatching === p ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                    {labels[p]}
                  </button>
                );
              })}
              <button
                onClick={fireFormalizacao}
                disabled={dispatching !== null}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 text-sm font-medium transition-all disabled:opacity-50"
              >
                {dispatching === "formalizacao" ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                Formalização
              </button>
              <button
                onClick={fireDesbloqueio}
                disabled={dispatching !== null}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 text-sm font-medium transition-all disabled:opacity-50"
              >
                {dispatching === "desbloqueio" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Unlock className="w-4 h-4" />}
                Desbloqueio
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
