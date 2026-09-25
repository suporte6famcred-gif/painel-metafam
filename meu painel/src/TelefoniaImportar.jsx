import React, { useState, useEffect } from "react";
import {
  Check, X, Download, Upload, AlertTriangle, FileUp,
} from "lucide-react";
import { db } from "./firebase";
import { collection, doc, writeBatch } from "firebase/firestore";
import {
  AnimStyles, brl, rgba, inputCls, inputStyleFor, uid,
} from "./painelShared";

/* =====================================================================
   ABA DE IMPORTAÇÃO — Telefonia
   - Cola CSV ou upload de arquivo .csv
   - Colunas: numero (obrigatório), apelido, operadora, tipo, plano, status,
     fornecedor, colaborador, valor, dataCompra, dataAtivacao, iccid, observacoes
   - Pré-visualização + detecção de duplicados + download de modelo
   props: numerosExistentes, T, onClose, onImportar, registrarHistorico
   ===================================================================== */

const STATUS_ORDEM = ["conectado", "em_analise", "banido"];
const STATUS_LABEL = {
  conectado: "Conectado",
  em_analise: "Em análise",
  banido: "Banido",
};
const TIPOS = {
  movel: "Móvel",
  fixo: "Fixo",
  virtual: "Virtual",
  whatsapp: "WhatsApp",
  outro: "Outro",
};

const statusCor = (T) => ({
  conectado: T.STATUS.ativa.fg,
  em_analise: T.STATUS.em_recurso.fg,
  banido: T.STATUS.banida.fg,
});

function StatusPill({ status, T }) {
  const cor = statusCor(T)[status] || T.inkSoft;
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap" style={{ background: rgba(cor, 0.12), color: cor }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: cor }} />
      {STATUS_LABEL[status] || status}
    </span>
  );
}

export default function TelefoniaImportar({ numerosExistentes, T, onClose, onImportar, registrarHistorico }) {
  const [texto, setTexto] = useState("");
  const [preview, setPreview] = useState([]);
  const [erro, setErro] = useState("");
  const [importando, setImportando] = useState(false);

  const parseCSV = (txt) => {
    const primeira = txt.split(/\r?\n/)[0] || "";
    const sep = (primeira.match(/;/g) || []).length >= (primeira.match(/,/g) || []).length ? ";" : ",";
    const linhas = txt.split(/\r?\n/).filter((l) => l.trim());
    if (linhas.length < 2) throw new Error("Arquivo vazio ou sem cabeçalho.");
    const headers = linhas[0].split(sep).map((h) => h.trim().toLowerCase().replace(/\s+/g, ""));
    const idx = (nome) => headers.indexOf(nome);
    const out = [];
    for (let i = 1; i < linhas.length; i++) {
      const cols = linhas[i].split(sep).map((c) => c.trim().replace(/^"|"$/g, ""));
      const get = (k) => (idx(k) >= 0 ? cols[idx(k)] || "" : "");
      const numero = get("numero") || get("telefone") || get("fone");
      if (!numero) continue;
      out.push({
        numero,
        apelido: get("apelido") || get("nome") || "",
        operadora: get("operadora") || "",
        tipo: TIPOS[get("tipo")] ? get("tipo") : "movel",
        plano: get("plano") || "",
        status: STATUS_ORDEM.includes(get("status")) ? get("status") : "conectado",
        fornecedor: get("fornecedor") || "",
        colaborador: get("colaborador") || get("responsavel") || "",
        valor: get("valor") || get("customensal") || "",
        dataCompra: get("datacompra") || get("compra") || "",
        dataAtivacao: get("dataativacao") || get("ativacao") || "",
        iccid: get("iccid") || get("chip") || "",
        observacoes: get("observacoes") || get("obs") || "",
        tags: [],
      });
    }
    return out;
  };

  const processar = (txt) => {
    setErro("");
    try {
      const rows = parseCSV(txt);
      if (rows.length === 0) {
        setErro("Nenhuma linha válida encontrada. Verifique se existe a coluna 'numero'.");
        setPreview([]);
        return;
      }
      const set = new Set(numerosExistentes.map((n) => (n.numero || "").replace(/\D/g, "")));
      setPreview(rows.map((r) => ({ ...r, duplicado: set.has((r.numero || "").replace(/\D/g, "")) })));
    } catch (e) {
      setErro(e.message);
      setPreview([]);
    }
  };

  useEffect(() => {
    if (texto.trim()) processar(texto);
    else { setPreview([]); setErro(""); }
  }, [texto]);

  const onFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setTexto(String(reader.result || ""));
    reader.onerror = () => setErro("Não foi possível ler o arquivo.");
    reader.readAsText(file, "utf-8");
  };

  const baixarModelo = () => {
    const header = "numero,apelido,operadora,tipo,plano,status,fornecedor,colaborador,valor,dataCompra,dataAtivacao,iccid,observacoes";
    const ex = "+5511999999999,Vendas SP,Vivo,movel,Controle 20GB,conectado,Fornecedor X,Joao,89.90,2024-01-15,2024-01-20,8955000000000000000,Anotacao livre";
    const blob = new Blob(["\uFEFF" + header + "\n" + ex], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "modelo_telefonia.csv";
    a.click();
  };

  const validos = preview.filter((p) => !p.duplicado);
  const dup = preview.length - validos.length;

 const importar = async () => {
  if (validos.length === 0) return;
  setImportando(true);
  try {
    for (let i = 0; i < validos.length; i += 400) {
      const batch = writeBatch(db);
      validos.slice(i, i + 400).forEach((r) => {
        const id = uid();
        const { duplicado, ...limpo } = r;  // ← remove o campo 'duplicado'
        batch.set(doc(db, "telefonia", id), {
          ...limpo,
          id,
          criadoEm: new Date().toISOString(),
          atualizadoEm: new Date().toISOString(),
        });
      });
      await batch.commit();
    }
    await registrarHistorico?.("Importação de Telefonia", `${validos.length} número(s) importado(s)${dup ? ` · ${dup} duplicado(s) ignorado(s)` : ""}`);
    onImportar?.();
    setTexto("");
    setPreview([]);
  } catch (e) {
    alert("Erro ao importar: " + e.message);
  } finally {
    setImportando(false);
  }
};

  return (
    <div className="flex flex-col gap-5">
      <AnimStyles />

      <div className="pa-fade flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="pg-font-display text-xl font-bold tracking-tight flex items-center gap-2">
            <Upload size={20} /> Importar números
          </h2>
          <p className="text-sm mt-1" style={{ color: T.inkSoft }}>
            Cole um CSV ou envie um arquivo. A primeira linha precisa ter cabeçalho.
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={baixarModelo} className="pa-chip px-3 py-2 rounded-lg text-sm font-medium border inline-flex items-center gap-2" style={{ borderColor: T.border, color: T.inkSoft }}>
            <Download size={15} /> Baixar modelo
          </button>
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ background: T.borderSoft, color: T.inkSoft }}>
            Voltar
          </button>
        </div>
      </div>

      <div className="pa-fade rounded-xl border p-5 flex flex-col gap-4" style={{ background: T.surface, borderColor: T.borderSoft, animationDelay: "60ms" }}>
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium" style={{ color: T.inkSoft }}>Cole aqui o CSV (vírgula ou ponto e vírgula)</span>
          <textarea
            rows={6}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder={`numero;apelido;operadora;status;valor\n+5511999999999;Vendas SP;Vivo;conectado;89.90`}
            className={inputCls + " pg-mono"}
            style={inputStyleFor(T)}
          />
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <label className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer border inline-flex items-center gap-2" style={{ borderColor: T.border, color: T.inkSoft }}>
            <FileUp size={15} />
            Enviar arquivo .csv
            <input type="file" accept=".csv,text/csv,text/plain" className="hidden" onChange={onFile} />
          </label>
          {texto && (
            <button onClick={() => { setTexto(""); setPreview([]); setErro(""); }} className="text-xs underline" style={{ color: T.inkSoft }}>
              Limpar
            </button>
          )}
        </div>

        <div className="text-[11px] leading-relaxed" style={{ color: T.inkFaint }}>
          <b>Colunas aceitas:</b> numero, apelido, operadora, tipo, plano, status, fornecedor, colaborador, valor, dataCompra, dataAtivacao, iccid, observacoes.
          {" "}A coluna <b>numero</b> é obrigatória. Status válidos: conectado, em_analise, banido.
        </div>
      </div>

      {erro && (
        <div className="pa-fade rounded-xl border p-4 flex items-start gap-3 text-sm" style={{ borderColor: T.STATUS.banida.fg + "55", background: rgba(T.STATUS.banida.fg, 0.06) }}>
          <AlertTriangle size={20} className="shrink-0" style={{ color: T.STATUS.banida.fg }} />
          <span>{erro}</span>
        </div>
      )}

      {preview.length > 0 && (
        <div className="pa-fade rounded-xl border overflow-hidden" style={{ background: T.surface, borderColor: T.borderSoft, animationDelay: "120ms" }}>
          <div className="p-4 border-b flex items-center justify-between flex-wrap gap-2" style={{ borderColor: T.borderSoft }}>
            <span className="text-sm font-medium">
              Pré-visualização · <span className="pg-mono">{validos.length}</span> prontos
              {dup > 0 && <span className="ml-2 pg-mono" style={{ color: T.STATUS.em_recurso.fg }}>{dup} duplicado(s) ignorado(s)</span>}
            </span>
            <button
              disabled={validos.length === 0 || importando}
              onClick={importar}
              className="pa-chip px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-40 transition-shadow hover:shadow-lg"
              style={{ background: T.primary }}
            >
              {importando ? "Importando…" : `Importar ${validos.length} número(s)`}
            </button>
          </div>
          <div className="overflow-x-auto pg-scroll max-h-[420px]">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0" style={{ background: T.surfaceAlt }}>
                <tr className="border-b" style={{ borderColor: T.borderSoft, color: T.inkSoft }}>
                  <th className="p-3 font-medium">#</th>
                  <th className="p-3 font-medium">Número</th>
                  <th className="p-3 font-medium">Apelido</th>
                  <th className="p-3 font-medium">Operadora</th>
                  <th className="p-3 font-medium">Tipo</th>
                  <th className="p-3 font-medium">Status</th>
                  <th className="p-3 font-medium">Valor</th>
                  <th className="p-3 font-medium">Aviso</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: T.borderSoft }}>
                {preview.map((p, i) => (
                  <tr key={i} style={{ opacity: p.duplicado ? 0.5 : 1 }}>
                    <td className="p-3 pg-mono" style={{ color: T.inkFaint }}>{i + 1}</td>
                    <td className="p-3 pg-mono">{p.numero}</td>
                    <td className="p-3">{p.apelido || "—"}</td>
                    <td className="p-3">{p.operadora || "—"}</td>
                    <td className="p-3">{TIPOS[p.tipo] || p.tipo}</td>
                    <td className="p-3"><StatusPill status={p.status} T={T} /></td>
                    <td className="p-3 pg-tnum">{p.valor ? brl(p.valor) : "—"}</td>
                    <td className="p-3">
                      {p.duplicado
                        ? <span className="inline-flex items-center gap-1 text-xs" style={{ color: T.STATUS.em_recurso.fg }}><AlertTriangle size={13} /> Já existe</span>
                        : <span className="inline-flex items-center gap-1 text-xs" style={{ color: T.STATUS.ativa.fg }}><Check size={13} /> OK</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
