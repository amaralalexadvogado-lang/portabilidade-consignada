import { useRef, useState } from "react";
import { Upload as UploadIcon, FileSpreadsheet, Loader2, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { cn } from "../lib/utils";

export default function Upload() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    inserted: number; updated: number; errors: string[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    if (!file) return;
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["xlsx", "xls", "csv"].includes(ext || "")) {
      setError("Formato inválido. Use .xlsx, .xls ou .csv");
      return;
    }

    setLoading(true);
    setResult(null);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro no servidor");
      setResult(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  return (
    <div className="space-y-5 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Upload de Planilha</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Importe clientes via arquivo Excel ou CSV. O sistema detecta automaticamente as colunas.
        </p>
      </div>

      {/* Área de drop */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "border-2 border-dashed rounded-xl p-12 flex flex-col items-center justify-center gap-4 cursor-pointer transition-all",
          dragging
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/50 hover:bg-secondary/30"
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }}
        />
        {loading ? (
          <>
            <Loader2 className="w-12 h-12 text-primary animate-spin" />
            <p className="text-foreground font-medium">Processando planilha...</p>
          </>
        ) : (
          <>
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <UploadIcon className="w-8 h-8 text-primary" />
            </div>
            <div className="text-center">
              <p className="text-foreground font-medium">Arraste a planilha aqui</p>
              <p className="text-muted-foreground text-sm mt-1">ou clique para selecionar</p>
              <p className="text-muted-foreground text-xs mt-2">.xlsx • .xls • .csv</p>
            </div>
          </>
        )}
      </div>

      {/* Resultado */}
      {result && (
        <div className="bg-card border border-border rounded-xl p-5 space-y-3">
          <h2 className="text-base font-semibold text-foreground">Resultado da importação</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3 flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />
              <div>
                <p className="text-2xl font-bold text-green-400">{result.inserted}</p>
                <p className="text-xs text-muted-foreground">Novos inseridos</p>
              </div>
            </div>
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-blue-400 flex-shrink-0" />
              <div>
                <p className="text-2xl font-bold text-blue-400">{result.updated}</p>
                <p className="text-xs text-muted-foreground">Atualizados</p>
              </div>
            </div>
          </div>
          {result.errors.length > 0 && (
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-yellow-400" />
                <p className="text-sm text-yellow-400 font-medium">{result.errors.length} erro(s) nas linhas:</p>
              </div>
              <ul className="space-y-1">
                {result.errors.map((e, i) => (
                  <li key={i} className="text-xs text-muted-foreground">{e}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-center gap-3">
          <XCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Mapeamento de colunas */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="text-sm font-semibold text-foreground mb-3">Colunas reconhecidas automaticamente</h2>
        <div className="grid grid-cols-2 gap-2 text-xs">
          {[
            ["Nome", "nome, name, cliente, beneficiário"],
            ["Telefone", "telefone, phone, celular, whatsapp"],
            ["CPF", "cpf, documento"],
            ["Proposta", "proposta, num proposta, nº proposta"],
            ["Banco", "banco, bank, instituição"],
            ["Status", "status, situação"],
            ["Obs/Link/Data", "obs, observação, observacoes, notes"],
          ].map(([field, cols]) => (
            <div key={field} className="bg-secondary rounded-lg p-2">
              <p className="text-foreground font-medium">{field}</p>
              <p className="text-muted-foreground mt-0.5">{cols}</p>
            </div>
          ))}
        </div>
        <div className="mt-3 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
          <p className="text-xs text-blue-400">
            💡 O campo <strong>OBS</strong> extrai automaticamente:<br />
            • Data de retorno: <code>PREVISÃO - DD/MM/YYYY</code><br />
            • Link de formalização: qualquer URL <code>https://...</code>
          </p>
        </div>
      </div>
    </div>
  );
}
