import { useState } from "react";
import { trpc } from "../lib/trpc";
import { Loader2, CheckCircle2, XCircle, Send, Wifi, RefreshCw } from "lucide-react";
import { formatDate } from "../lib/utils";

function Field({
  label, value, onChange, type = "text", placeholder,
}: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string;
}) {
  return (
    <div>
      <label className="text-xs text-muted-foreground block mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
      />
    </div>
  );
}

export default function Settings() {
  const { data } = trpc.getConfig.useQuery();
  const { data: lastSync, refetch: refetchSync } = trpc.lastSync.useQuery(undefined, { refetchInterval: 60_000 });
  const setConfig = trpc.setConfig.useMutation();
  const testZAPI = trpc.testZAPI.useMutation();
  const syncSheets = trpc.syncSheets.useMutation();
  const [reportPhone, setReportPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<any | null>(null);

  const currentReport = data?.["report_phone"] || "5511952756127";

  async function saveReportPhone() {
    const val = reportPhone || currentReport;
    setSaving(true);
    try {
      await setConfig.mutateAsync({ key: "report_phone", value: val });
      setSaveMsg("✅ Salvo com sucesso!");
    } catch {
      setSaveMsg("❌ Erro ao salvar");
    } finally {
      setSaving(false);
      setTimeout(() => setSaveMsg(null), 3000);
    }
  }

  async function handleTest() {
    setTestResult(null);
    try {
      const result = await testZAPI.mutateAsync();
      setTestResult(result);
    } catch (err: any) {
      setTestResult({ success: false, message: err.message });
    }
  }

  async function handleSync() {
    setSyncResult(null);
    try {
      const result = await syncSheets.mutateAsync();
      setSyncResult(result);
      refetchSync();
    } catch (err: any) {
      setSyncResult({ errors: [err.message], inserted: 0, updated: 0, skipped: 0 });
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Configurações</h1>
        <p className="text-muted-foreground text-sm mt-1">Integração Z-API e sincronização com Google Sheets</p>
      </div>

      {/* Google Sheets Sync */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <RefreshCw className="w-4 h-4 text-primary" />
          <h2 className="text-base font-semibold text-foreground">Sincronização com Google Sheets</h2>
        </div>
        <div className="bg-secondary rounded-lg p-3 space-y-1">
          <p className="text-xs text-muted-foreground">ID da planilha</p>
          <p className="text-sm font-mono text-foreground break-all">1QZNIROr-CG3d61sZQnGefDZ9D4yLVfMiuOsHi_jk_58</p>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="bg-secondary rounded-lg p-3">
            <p className="text-xs text-muted-foreground mb-1">Frequência automática</p>
            <p className="text-foreground font-medium">A cada 30 minutos</p>
          </div>
          <div className="bg-secondary rounded-lg p-3">
            <p className="text-xs text-muted-foreground mb-1">Última sincronização</p>
            <p className="text-foreground font-medium">
              {lastSync?.lastSync ? formatDate(lastSync.lastSync) : "Nunca"}
            </p>
          </div>
        </div>
        {lastSync && (
          <div className="flex gap-3 text-sm">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500/10 text-green-400 border border-green-500/20">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {lastSync.inserted} novos
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <RefreshCw className="w-3.5 h-3.5" />
              {lastSync.updated} atualizados
            </div>
            {lastSync.errors?.length > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20">
                <XCircle className="w-3.5 h-3.5" />
                {lastSync.errors.length} erros
              </div>
            )}
          </div>
        )}
        {lastSync?.errors?.length > 0 && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
            {lastSync.errors.map((e: string, i: number) => (
              <p key={i} className="text-xs text-red-400">{e}</p>
            ))}
          </div>
        )}
        <button
          onClick={handleSync}
          disabled={syncSheets.isPending}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-all disabled:opacity-50"
        >
          {syncSheets.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Sincronizar Agora
        </button>
        {syncResult && (
          <div className={`px-4 py-3 rounded-lg text-sm border ${
            syncResult.errors?.length === 0
              ? "bg-green-500/10 text-green-400 border-green-500/20"
              : "bg-yellow-500/10 text-yellow-400 border-yellow-500/20"
          }`}>
            {syncResult.errors?.length === 0
              ? `✅ Sincronizado! ${syncResult.inserted} novos, ${syncResult.updated} atualizados.`
              : `⚠️ ${syncResult.inserted} novos, ${syncResult.updated} atualizados. Erros: ${syncResult.errors.join(", ")}`
            }
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          Para funcionar, a planilha precisa estar compartilhada como <strong className="text-foreground">pública para leitura</strong> no Google Sheets (Compartilhar → Qualquer pessoa com o link → Leitor).
        </p>
      </div>

      {/* Z-API */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Wifi className="w-4 h-4 text-primary" />
          <h2 className="text-base font-semibold text-foreground">Credenciais Z-API</h2>
        </div>
        <div className="grid gap-3">
          <div className="bg-secondary rounded-lg p-3">
            <p className="text-xs text-muted-foreground mb-1">Instance ID</p>
            <p className="text-sm text-foreground font-mono">3F0F77FB7F735150F1D5BA665B49BD70</p>
          </div>
          <div className="bg-secondary rounded-lg p-3">
            <p className="text-xs text-muted-foreground mb-1">Token da Instância</p>
            <p className="text-sm text-foreground font-mono">D69E92226EAEA0D710827FA4</p>
          </div>
          <div className="bg-secondary rounded-lg p-3">
            <p className="text-xs text-muted-foreground mb-1">Client Token</p>
            <p className="text-sm text-foreground font-mono">Fd30ad825715b44d8a25f5d591ea5de16S</p>
          </div>
        </div>
        <button
          onClick={handleTest}
          disabled={testZAPI.isPending}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-all disabled:opacity-50"
        >
          {testZAPI.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          Testar Conexão Z-API
        </button>
        {testResult && (
          <div className={`flex items-start gap-2 px-4 py-3 rounded-lg text-sm border ${
            testResult.success
              ? "bg-green-500/10 text-green-400 border-green-500/20"
              : "bg-red-500/10 text-red-400 border-red-500/20"
          }`}>
            {testResult.success
              ? <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
              : <XCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />}
            {testResult.message}
          </div>
        )}
      </div>

      {/* Relatório diário */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <h2 className="text-base font-semibold text-foreground">Relatório Diário</h2>
        <p className="text-sm text-muted-foreground">
          Enviado automaticamente às 20h de segunda a sexta para o número abaixo.
        </p>
        <Field
          label="Número de destino (com DDI 55)"
          value={reportPhone || currentReport}
          onChange={setReportPhone}
          placeholder="5511999999999"
        />
        {saveMsg && (
          <p className={`text-sm ${saveMsg.startsWith("✅") ? "text-green-400" : "text-red-400"}`}>{saveMsg}</p>
        )}
        <button
          onClick={saveReportPhone}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-all disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          Salvar
        </button>
      </div>

      {/* Cron jobs */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="text-base font-semibold text-foreground mb-4">Horários Automáticos</h2>
        <div className="space-y-2 text-sm">
          {[
            ["A cada 30min", "Sincronização com Google Sheets"],
            ["09:00 (Seg–Sex)", "Disparo matinal — Aguarda Retorno"],
            ["12:00 (Seg–Sex)", "Disparo meio-dia — Fase inicial (> 7 dias)"],
            ["15:00 (Seg–Sex)", "Disparo vespertino — Aguarda Retorno"],
            ["A cada 1h (8h–18h)", "Formalização e Desbloqueio"],
            ["20:00 (Seg–Sex)", "Relatório diário"],
          ].map(([time, desc]) => (
            <div key={time} className="flex gap-4 py-2 border-b border-border/50 last:border-0">
              <span className="text-primary font-medium w-44 flex-shrink-0">{time}</span>
              <span className="text-muted-foreground">{desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
