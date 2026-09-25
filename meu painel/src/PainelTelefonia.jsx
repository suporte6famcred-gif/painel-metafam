import React, { useState, useEffect, useMemo } from "react";
import {
  Phone, Plus, Search, X, Pencil, Trash2, Check, ChevronDown, ChevronUp,
  Download, Upload, Tag as TagIcon, Ban, Clock, Wifi, AlertTriangle, FileUp,
} from "lucide-react";
import { db } from "./firebase";
import { collection, onSnapshot, doc, setDoc, deleteDoc, writeBatch } from "firebase/firestore";
import {
  AnimStyles, TagChip, Dropdown, useCountUp, usePersistentState, useTagsCatalog,
  brl, fmtData, rgba, inputCls, inputStyleFor, uid,
} from "./painelShared";

/* =====================================================================
   PAINEL DE TELEFONIA
   - Coleção Firestore: "telefonia"
   - Independente das BMs (sem vínculo)
   - Status: conectado | em_analise | banido
   - Sem qualidade, sem rodízio, sem gráficos
   - Recursos: KPIs simples, tabela, cards, filtros, ações em lote, CSV,
     tags (usa catálogo compartilhado) e ABA DE IMPORTAÇÃO.
   props: T, registrarHistorico
   ===================================================================== */

const STATUS_ORDEM = ["conectado", "em_analise", "banido"];
const STATUS_LABEL = {
  conectado: "Conectado",
  em_analise: "Em análise",
  banido: "Banido",
};
const STATUS_COR = (T) => ({
  conectado: T.STATUS.ativa.fg,
  em_analise: T.STATUS.em_recurso.fg,
  banido: T.STATUS.banida.fg,
});

const TIPOS = {
  movel: "Móvel",
  fixo: "Fixo",
  virtual: "Virtual",
  whatsapp: "WhatsApp",
  outro: "Outro",
};

const OPERADORAS_SUGERIDAS = ["Vivo", "Claro", "TIM", "Oi", "Nextel", "Algar", "Sercomtel", "Outra"];

const emptyNumero = () => ({
  id: "",
  numero: "",
  apelido: "",
  operadora: "",
  tipo: "movel",
  plano: "",
  status: "conectado",
  fornecedor: "",
  valor: "",
  dataCompra: new Date().toISOString().split("T")[0],
  dataAtivacao: "",
  dataCancelamento: "",
  colaborador: "",
  iccid: "",
  observacoes: "",
  tags: [],
});

const COLS = [
  { id: "apelido", label: "Identificação", fixed: true },
  { id: "numero", label: "Número" },
  { id: "status", label: "Status" },
  { id: "operadora", label: "Operadora" },
  { id: "tipo", label: "Tipo" },
  { id: "plano", label: "Plano" },
  { id: "tags", label: "Tags" },
  { id: "colaborador", label: "Colaborador" },
  { id: "fornecedor", label: "Fornecedor" },
  { id: "valor", label: "Valor", right: true },
  { id: "dataCompra", label: "Data compra" },
  { id: "dataAtivacao", label: "Ativação" },
  { id: "iccid", label: "ICCID" },
  { id: "observacoes", label: "Observações" },
];
const COLS_PADRAO = ["apelido", "numero", "status", "operadora", "tipo", "colaborador", "valor"];

const F0 = {
  status: [],
  operadora: [],
  tipo: [],
  fornecedor: [],
  tags: [],
  tagsModo: "qualquer",
  semTag: false,
  compraDe: "",
  compraAte: "",
};

/* ---------------- util ---------------- */
function StatusPill({ status, T }) {
  const cor = STATUS_COR(T)[status] || T.STATUS.estoque.fg;
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap" style={{ background: rgba(cor, 0.12), color: cor }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: cor }} />
      {STATUS_LABEL[status] || status}
    </span>
  );
}

function Kpi({ label, value, fmt, color, icon: Icon, onClick, active, delay, T }) {
  const v = useCountUp(value, 800);
  useEffect(() => {}, []);
  const c = color || T.primary;
  return (
    <button
      onClick={onClick}
      className="pa-fade pa-lift text-left rounded-xl border p-4 flex flex-col gap-1.5"
      style={{ background: T.surface, borderColor: active ? c : T.borderSoft, boxShadow: active ? `0 0 0 1px ${c}` : "none", animationDelay: `${delay}ms` }}
    >
      <div className="flex items-center justify-between text-xs" style={{ color: T.inkSoft }}>
        <span>{label}</span>
        {Icon && <Icon size={15} style={{ color: c }} />}
      </div>
      <div className="pg-mono text-2xl font-semibold" style={{ color: c }}>{fmt ? fmt(v) : Math.round(v)}</div>
    </button>
  );
}

function Seg({ value, onChange, options, T }) {
  return (
    <div className="inline-flex p-0.5 rounded-lg border w-full" style={{ borderColor: T.border, background: T.surface }}>
      {options.map(([id, l]) => (
        <button key={id} type="button" onClick={() => onChange(id)} className="flex-1 px-2.5 py-1.5 rounded-md text-xs transition-colors whitespace-nowrap" style={{ background: value === id ? T.primary : "transparent", color: value === id ? "#fff" : T.inkSoft, fontWeight: value === id ? 600 : 500 }}>
          {l}
        </button>
      ))}
    </div>
  );
}

function MultiSelect({ label, options, value, onChange, T }) {
  return (
    <Dropdown
      T={T}
      width={230}
      renderTrigger={({ toggle }) => (
        <button type="button" onClick={toggle} className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm" style={{ ...inputStyleFor(T), borderColor: value.length ? T.primary : T.border }}>
          <span className="truncate">{value.length ? `${label} · ${value.length}` : `Todos · ${label}`}</span>
          <ChevronDown size={14} />
        </button>
      )}
    >
      <div className="max-h-64 overflow-y-auto pg-scroll p-1">
        {options.length === 0 && <div className="p-3 text-xs" style={{ color: T.inkFaint }}>Sem opções ainda.</div>}
        {options.map((o) => {
          const on = value.includes(o.value);
          return (
            <label key={o.value} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm cursor-pointer transition-colors" style={{ background: on ? T.primarySoft : "transparent" }}>
              <input type="checkbox" checked={on} onChange={() => onChange(on ? value.filter((x) => x !== o.value) : [...value, o.value])} style={{ accentColor: T.primary }} />
              {o.render || o.label}
            </label>
          );
        })}
      </div>
    </Dropdown>
  );
}

/* ---------------- Modal de cadastro ---------------- */
function NumeroModal({ initial, fornecedores, T, onClose, onSave }) {
  const [f, setF] = useState(initial || emptyNumero());
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const { tags: catalogo, porNome } = useTagsCatalog();

  const submit = (e) => {
    e.preventDefault();
    if (!f.numero.trim()) return alert("Informe o número.");
    onSave(f);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: T.overlay }}>
      <div className="w-full max-w-2xl rounded-xl border flex flex-col max-h-[92vh]" style={{ background: T.surface, color: T.ink, borderColor: T.border }}>
        <div className="flex items-center justify-between border-b px-6 py-4 shrink-0" style={{ borderColor: T.borderSoft }}>
          <h3 className="pg-font-display text-lg font-semibold">{initial?.id ? "Editar número" : "Novo número"}</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:opacity-70"><X size={20} /></button>
        </div>

        <form onSubmit={submit} className="flex flex-col gap-4 p-6 overflow-y-auto pg-scroll">
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="pg-font-body block">
              <span className="block text-xs font-medium mb-1.5" style={{ color: T.inkSoft }}>Número *</span>
              <input required value={f.numero} onChange={set("numero")} placeholder="+55 11 99999-9999" className={inputCls + " pg-mono"} style={inputStyleFor(T)} />
            </label>
            <label className="pg-font-body block">
              <span className="block text-xs font-medium mb-1.5" style={{ color: T.inkSoft }}>Identificação / Apelido</span>
              <input value={f.apelido} onChange={set("apelido")} placeholder="Ex: Vendas SP" className={inputCls} style={inputStyleFor(T)} />
            </label>
          </div>

          <div className="grid sm:grid-cols-3 gap-3">
            <label className="pg-font-body block">
              <span className="block text-xs font-medium mb-1.5" style={{ color: T.inkSoft }}>Status</span>
              <select value={f.status} onChange={set("status")} className={inputCls} style={inputStyleFor(T)}>
                {STATUS_ORDEM.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
              </select>
            </label>
            <label className="pg-font-body block">
              <span className="block text-xs font-medium mb-1.5" style={{ color: T.inkSoft }}>Operadora</span>
              <input list="operadoras-dl" value={f.operadora} onChange={set("operadora")} placeholder="Vivo, Claro…" className={inputCls} style={inputStyleFor(T)} />
              <datalist id="operadoras-dl">
                {OPERADORAS_SUGERIDAS.map((o) => <option key={o} value={o} />)}
              </datalist>
            </label>
            <label className="pg-font-body block">
              <span className="block text-xs font-medium mb-1.5" style={{ color: T.inkSoft }}>Tipo</span>
              <select value={f.tipo} onChange={set("tipo")} className={inputCls} style={inputStyleFor(T)}>
                {Object.entries(TIPOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <label className="pg-font-body block">
              <span className="block text-xs font-medium mb-1.5" style={{ color: T.inkSoft }}>Plano</span>
              <input value={f.plano} onChange={set("plano")} placeholder="Ex: Controle 20GB" className={inputCls} style={inputStyleFor(T)} />
            </label>
            <label className="pg-font-body block">
              <span className="block text-xs font-medium mb-1.5" style={{ color: T.inkSoft }}>Colaborador responsável</span>
              <input value={f.colaborador} onChange={set("colaborador")} placeholder="Quem usa este número" className={inputCls} style={inputStyleFor(T)} />
            </label>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <label className="pg-font-body block">
              <span className="block text-xs font-medium mb-1.5" style={{ color: T.inkSoft }}>Fornecedor</span>
              <input list="fornecedores-dl" value={f.fornecedor} onChange={set("fornecedor")} placeholder="Nome do fornecedor" className={inputCls} style={inputStyleFor(T)} />
              <datalist id="fornecedores-dl">
                {fornecedores.map((x) => <option key={x.id} value={x.nome} />)}
              </datalist>
            </label>
            <label className="pg-font-body block">
              <span className="block text-xs font-medium mb-1.5" style={{ color: T.inkSoft }}>Valor mensal (R$)</span>
              <input type="number" step="0.01" value={f.valor} onChange={set("valor")} placeholder="0,00" className={inputCls} style={inputStyleFor(T)} />
            </label>
          </div>

          <div className="grid sm:grid-cols-3 gap-3">
            <label className="pg-font-body block">
              <span className="block text-xs font-medium mb-1.5" style={{ color: T.inkSoft }}>Data de compra</span>
              <input type="date" value={f.dataCompra} onChange={set("dataCompra")} className={inputCls} style={inputStyleFor(T)} />
            </label>
            <label className="pg-font-body block">
              <span className="block text-xs font-medium mb-1.5" style={{ color: T.inkSoft }}>Ativação</span>
              <input type="date" value={f.dataAtivacao} onChange={set("dataAtivacao")} className={inputCls} style={inputStyleFor(T)} />
            </label>
            <label className="pg-font-body block">
              <span className="block text-xs font-medium mb-1.5" style={{ color: T.inkSoft }}>Cancelamento</span>
              <input type="date" value={f.dataCancelamento} onChange={set("dataCancelamento")} className={inputCls} style={inputStyleFor(T)} />
            </label>
          </div>

          <label className="pg-font-body block">
            <span className="block text-xs font-medium mb-1.5" style={{ color: T.inkSoft }}>ICCID / Chip</span>
            <input value={f.iccid} onChange={set("iccid")} placeholder="Número do SIM" className={inputCls + " pg-mono"} style={inputStyleFor(T)} />
          </label>

          <div>
            <span className="block text-xs font-medium mb-1.5" style={{ color: T.inkSoft }}>Tags</span>
            <div className="flex flex-wrap gap-1.5 mb-2 min-h-[26px]">
              {(f.tags || []).length === 0 && <span className="text-xs" style={{ color: T.inkFaint }}>Nenhuma tag.</span>}
              {(f.tags || []).map((t) => (
                <TagChip key={t} nome={t} cor={porNome[t]?.cor} T={T} onRemove={() => setF({ ...f, tags: f.tags.filter((x) => x !== t) })} />
              ))}
            </div>
            <Dropdown T={T} width={240} renderTrigger={({ toggle }) => (
              <button type="button" onClick={toggle} className="px-3 py-1.5 rounded-lg text-xs font-medium border inline-flex items-center gap-1.5" style={{ borderColor: T.border, color: T.inkSoft }}>
                <TagIcon size={13} /> Adicionar tag
              </button>
            )}>
              {({ close }) => (
                <div className="p-2 max-h-64 overflow-y-auto pg-scroll flex flex-col gap-1">
                  {catalogo.length === 0 && <div className="p-3 text-xs" style={{ color: T.inkFaint }}>Crie tags na aba Tags.</div>}
                  {catalogo.filter((t) => !(f.tags || []).includes(t.nome)).map((t) => (
                    <button key={t.id} type="button" onClick={() => { setF({ ...f, tags: [...(f.tags || []), t.nome] }); close(); }} className="text-left p-1 rounded-lg hover:opacity-80">
                      <TagChip nome={t.nome} cor={t.cor} T={T} />
                    </button>
                  ))}
                </div>
              )}
            </Dropdown>
          </div>

          <label className="pg-font-body block">
            <span className="block text-xs font-medium mb-1.5" style={{ color: T.inkSoft }}>Observações</span>
            <textarea rows={3} value={f.observacoes} onChange={set("observacoes")} placeholder="Anotações internas…" className={inputCls} style={inputStyleFor(T)} />
          </label>

          <div className="flex justify-end gap-3 border-t pt-4 mt-2" style={{ borderColor: T.borderSoft }}>
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ background: T.borderSoft, color: T.inkSoft }}>Cancelar</button>
            <button type="submit" className="px-5 py-2 rounded-lg text-sm font-medium text-white transition-shadow hover:shadow-lg" style={{ background: T.primary }}>Salvar número</button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* =====================================================================
   ABA DE IMPORTAÇÃO
   - Colar CSV / texto (uma linha por número) OU upload de arquivo .csv
   - Colunas aceitas (ordem livre, com cabeçalho):
     numero, apelido, operadora, tipo, plano, status, fornecedor,
     colaborador, valor, dataCompra, dataAtivacao, iccid, observacoes
   - Pré-visualização, detecção de duplicados, importação em lote
   ===================================================================== */
function Importacao({ numerosExistentes, T, onClose, onImportar, registrarHistorico }) {
  const [texto, setTexto] = useState("");
  const [preview, setPreview] = useState([]);
  const [erro, setErro] = useState("");
  const [importando, setImportando] = useState(false);

  const parseCSV = (txt) => {
    // separador: detecta ; ou , pela primeira linha
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
      // marca duplicados
      const set = new Set(numerosExistentes.map((n) => (n.numero || "").replace(/\D/g, "")));
      const marcados = rows.map((r) => ({ ...r, duplicado: set.has((r.numero || "").replace(/\D/g, "")) }));
      setPreview(marcados);
    } catch (e) {
      setErro(e.message);
      setPreview([]);
    }
  };

  useEffect(() => { if (texto.trim()) processar(texto); else { setPreview([]); setErro(""); } }, [texto]);

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
    const ex = '+5511999999999,Vendas SP,Vivo,movel,Controle 20GB,conectado,Fornecedor X,João,89.90,2024-01-15,2024-01-20,8955000000000000000,Anotação livre';
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
          batch.set(doc(db, "telefonia", id), {
            ...r,
            id,
            duplicado: undefined,
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
      <div className="pa-fade flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="pg-font-display text-xl font-bold tracking-tight flex items-center gap-2"><Upload size={20} /> Importar números</h2>
          <p className="text-sm mt-1" style={{ color: T.inkSoft }}>Cole um CSV ou envie um arquivo. A primeira linha precisa ter cabeçalho.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={baixarModelo} className="pa-chip px-3 py-2 rounded-lg text-sm font-medium border inline-flex items-center gap-2" style={{ borderColor: T.border, color: T.inkSoft }}>
            <Download size={15} /> Baixar modelo
          </button>
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ background: T.borderSoft, color: T.inkSoft }}>Voltar</button>
        </div>
      </div>

      <div className="pa-fade rounded-xl border p-5 flex flex-col gap-4" style={{ background: T.surface, borderColor: T.borderSoft, animationDelay: "60ms" }}>
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium" style={{ color: T.inkSoft }}>Cole aqui o CSV (ou texto com vírgula/ponto e vírgula)</span>
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
          {texto && <button onClick={() => { setTexto(""); setPreview([]); setErro(""); }} className="text-xs underline" style={{ color: T.inkSoft }}>Limpar</button>}
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
            <button disabled={validos.length === 0 || importando} onClick={importar} className="pa-chip px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-40 transition-shadow hover:shadow-lg" style={{ background: T.primary }}>
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

/* =====================================================================
   COMPONENTE PRINCIPAL
   ===================================================================== */
export default function PainelTelefonia({ T, registrarHistorico }) {
  const { tags: catalogo, porNome } = useTagsCatalog();
  const [numeros, setNumeros] = useState([]);
  const [fornecedores, setFornecedores] = useState([]);
  const [loading, setLoading] = useState(true);

  const [sub, setSub] = useState("lista"); // "lista" | "importar"
  const [search, setSearch] = useState("");
  const [F, setF] = useState(F0);
  const [showFiltros, setShowFiltros] = useState(false);
  const [sort, setSort] = useState({ key: null, dir: "asc" });
  const [visible, setVisible] = usePersistentState("wa_cols_telefonia", COLS_PADRAO);
  const [view, setView] = usePersistentState("wa_view_telefonia", "tabela");
  const [sel, setSel] = useState(new Set());
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  useEffect(() => {
    const unsubT = onSnapshot(collection(db, "telefonia"), (snap) => {
      setNumeros(snap.docs.map((d) => ({ id: d.id, tags: [], ...d.data() })));
      setLoading(false);
    }, (e) => { console.error(e); setLoading(false); });
    const unsubF = onSnapshot(collection(db, "fornecedores"), (snap) => {
      setFornecedores(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => { unsubT(); unsubF(); };
  }, []);

  const upd = (patch) => setF((f) => ({ ...f, ...patch }));

  const fornecedoresNomes = useMemo(() => {
    const s = new Set(fornecedores.map((f) => f.nome));
    numeros.forEach((n) => n.fornecedor && s.add(n.fornecedor));
    return Array.from(s).filter(Boolean).sort();
  }, [fornecedores, numeros]);
  const operadoras = useMemo(() => Array.from(new Set(numeros.map((n) =>