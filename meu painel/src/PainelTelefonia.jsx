import React, { useState, useEffect, useMemo } from "react";
import {
  Phone, Plus, Search, X, Pencil, Trash2, Check, ChevronDown, ChevronUp,
  Download, Upload, Tag as TagIcon, Ban, AlertTriangle, LayoutGrid, List,
  SlidersHorizontal, Eye,
} from "lucide-react";
import { db } from "./firebase";
import {
  collection, onSnapshot, doc, setDoc, deleteDoc, writeBatch,
} from "firebase/firestore";
import {
  AnimStyles, TagChip, Dropdown, useCountUp, usePersistentState, useTagsCatalog,
  brl, fmtData, rgba, inputCls, inputStyleFor, uid,
} from "./painelShared";
import TelefoniaImportar from "./TelefoniaImportar";

/* =====================================================================
   PAINEL DE TELEFONIA
   - Coleção Firestore: "telefonia"
   - Independente das BMs
   - Status: conectado | em_analise | banido
   props: T, registrarHistorico
   ===================================================================== */

const STATUS_ORDEM = ["conectado", "em_analise", "banido"];
const STATUS_LABEL = {
  conectado: "Conectado",
  em_analise: "Em análise",
  banido: "Banido",
};
const statusCor = (T) => ({
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

const OPERADORAS_SUGERIDAS = [
  "Vivo", "Claro", "TIM", "Oi", "Nextel", "Algar", "Sercomtel", "Outra",
];

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

/* ---------------- peças visuais ---------------- */
function StatusPill({ status, T }) {
  const cor = statusCor(T)[status] || T.inkSoft;
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap" style={{ background: rgba(cor, 0.12), color: cor }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: cor }} />
      {STATUS_LABEL[status] || status}
    </span>
  );
}

function Kpi({ label, value, fmt, color, icon: Icon, onClick, active, delay, sub, T }) {
  const v = useCountUp(value, 800);
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
      {sub && <div className="text-[11px]" style={{ color: T.inkFaint }}>{sub}</div>}
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

/* ---------------- Modal de cadastro/edição ---------------- */
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
   COMPONENTE PRINCIPAL
   ===================================================================== */
export default function PainelTelefonia({ T, registrarHistorico }) {
  const { tags: catalogo, porNome } = useTagsCatalog();
  const [numeros, setNumeros] = useState([]);
  const [fornecedores, setFornecedores] = useState([]);
  const [loading, setLoading] = useState(true);

  const [sub, setSub] = useState("lista");
  const [search, setSearch] = useState("");
  const [F, setF] = useState(F0);
  const [showFiltros, setShowFiltros] = useState(false);
  const [sort, setSort] = useState({ key: null, dir: "asc" });
  const [visible, setVisible] = usePersistentState("wa_cols_telefonia", COLS_PADRAO);
  const [view, setView] = usePersistentState("wa_view_telefonia", "tabela");
  const [sel, setSel] = useState(new Set());
  const [limite, setLimite] = useState(60);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  useEffect(() => {
    const unsubT = onSnapshot(collection(db, "telefonia"), (snap) => {
      setNumeros(snap.docs.map((d) => ({ id: d.id, tags: [], ...d.data() })));
      setLoading(false);
    }, (e) => { console.error("Erro telefonia:", e); setLoading(false); });
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

  const operadoras = useMemo(
    () => Array.from(new Set(numeros.map((n) => n.operadora).filter(Boolean))).sort(),
    [numeros]
  );

  const contagem = useMemo(() => {
    const c = { conectado: 0, em_analise: 0, banido: 0 };
    numeros.forEach((n) => { if (c[n.status] !== undefined) c[n.status]++; });
    return c;
  }, [numeros]);

  const custoMensal = useMemo(
    () => numeros.reduce((s, n) => s
  const custoMensal = useMemo(
    () => numeros.reduce((s, n) => s + (Number(n.valor) || 0), 0),
    [numeros]
  );

  const filtrados = useMemo(() => {
    const q = search.trim().toLowerCase();
    let r = numeros.filter((n) => {
      const tg = n.tags || [];
      if (q && !`${n.numero} ${n.apelido || ""} ${n.operadora || ""} ${n.colaborador || ""} ${n.fornecedor || ""} ${tg.join(" ")}`.toLowerCase().includes(q)) return false;
      if (F.status.length && !F.status.includes(n.status)) return false;
      if (F.operadora.length && !F.operadora.includes(n.operadora)) return false;
      if (F.tipo.length && !F.tipo.includes(n.tipo)) return false;
      if (F.fornecedor.length && !F.fornecedor.includes(n.fornecedor)) return false;
      if (F.semTag && tg.length) return false;
      if (F.tags.length && !(F.tagsModo === "todas" ? F.tags.every((t) => tg.includes(t)) : F.tags.some((t) => tg.includes(t)))) return false;
      if (F.compraDe && (!n.dataCompra || n.dataCompra < F.compraDe)) return false;
      if (F.compraAte && (!n.dataCompra || n.dataCompra > F.compraAte)) return false;
      return true;
    });
    if (sort.key) {
      const val = (n) => {
        if (sort.key === "valor") return Number(n.valor) || 0;
        if (sort.key === "tags") return (n.tags || []).length;
        return String(n[sort.key] || "").toLowerCase();
      };
      r = [...r].sort((a, b) => { const x = val(a), y = val(b); return (x > y ? 1 : x < y ? -1 : 0) * (sort.dir === "asc" ? 1 : -1); });
    }
    return r;
  }, [numeros, search, F, sort]);

  const cols = COLS.filter((c) => c.fixed || visible.includes(c.id));
  const mostrados = filtrados.slice(0, limite);

  const chips = [];
  F.status.forEach((s) => chips.push({ k: "s" + s, l: `Status: ${STATUS_LABEL[s]}`, off: () => upd({ status: F.status.filter((x) => x !== s) }) }));
  F.operadora.forEach((s) => chips.push({ k: "o" + s, l: `Operadora: ${s}`, off: () => upd({ operadora: F.operadora.filter((x) => x !== s) }) }));
  F.tipo.forEach((s) => chips.push({ k: "t" + s, l: `Tipo: ${TIPOS[s] || s}`, off: () => upd({ tipo: F.tipo.filter((x) => x !== s) }) }));
  F.fornecedor.forEach((s) => chips.push({ k: "f" + s, l: `Fornecedor: ${s}`, off: () => upd({ fornecedor: F.fornecedor.filter((x) => x !== s) }) }));
  F.tags.forEach((s) => chips.push({ k: "tg" + s, l: `Tag: ${s}`, off: () => upd({ tags: F.tags.filter((x) => x !== s) }) }));
  if (F.semTag) chips.push({ k: "st", l: "Sem tag", off: () => upd({ semTag: false }) });
  if (F.compraDe) chips.push({ k: "cd", l: `Compra desde ${fmtData(F.compraDe)}`, off: () => upd({ compraDe: "" }) });
  if (F.compraAte) chips.push({ k: "ca", l: `Compra até ${fmtData(F.compraAte)}`, off: () => upd({ compraAte: "" }) });
  if (search) chips.push({ k: "b", l: `Busca: "${search}"`, off: () => setSearch("") });

  const chipsFiltros = chips.filter((c) => c.k !== "b");
  const limparTudo = () => { setF(F0); setSearch(""); };

  const toggleStatus = (s) => upd({ status: F.status.includes(s) ? F.status.filter((x) => x !== s) : [...F.status, s] });

  const toggleSel = (id) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const todosSel = mostrados.length > 0 && mostrados.every((n) => sel.has(n.id));
  const toggleTodos = () => setSel(todosSel ? new Set() : new Set(mostrados.map((n) => n.id)));

  const lote = async (fn, descr) => {
    const ops = [];
    numeros.filter((n) => sel.has(n.id)).forEach((n) => { const data = fn(n); if (data) ops.push({ ref: doc(db, "telefonia", n.id), data }); });
    for (let i = 0; i < ops.length; i += 400) {
      const batch = writeBatch(db);
      ops.slice(i, i + 400).forEach((o) => batch.set(o.ref, o.data, { merge: true }));
      await batch.commit();
    }
    await registrarHistorico?.("Ação em Lote", `${descr} em ${ops.length} número(s)`);
    setSel(new Set());
  };

  const handleSave = async (data) => {
    const isEdit = Boolean(data.id);
    const id = data.id || uid();
    const payload = { ...data, id, tags: data.tags || [], atualizadoEm: new Date().toISOString() };
    if (!isEdit) payload.criadoEm = new Date().toISOString();
    await setDoc(doc(db, "telefonia", id), payload);
    await registrarHistorico?.(
      isEdit ? "Edição de Número" : "Novo Número",
      `${data.numero}${data.apelido ? ` (${data.apelido})` : ""} — ${STATUS_LABEL[data.status]}`
    );
    setModalOpen(false);
    setEditing(null);
  };

  const handleDelete = async (id, label) => {
    if (!confirm(`Remover o número "${label}"?`)) return;
    await deleteDoc(doc(db, "telefonia", id));
    await registrarHistorico?.("Exclusão de Número", `Número "${label}" removido`);
  };

  const csvVal = (n, id) => {
    switch (id) {
      case "status": return STATUS_LABEL[n.status] || n.status;
      case "tipo": return TIPOS[n.tipo] || n.tipo;
      case "tags": return (n.tags || []).join(", ");
      case "dataCompra": case "dataAtivacao": return fmtData(n[id]);
      case "valor": return String(Number(n.valor) || 0).replace(".", ",");
      default: return n[id] || "";
    }
  };
  const exportarCSV = () => {
    const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const linhas = [
      cols.map((c) => esc(c.label)).join(";"),
      ...filtrados.map((n) => cols.map((c) => esc(csvVal(n, c.id))).join(";")),
    ];
    const blob = new Blob(["\uFEFF" + linhas.join("\n")], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `telefonia_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  const cell = (n, id) => {
    switch (id) {
      case "apelido": return <span className="font-medium">{n.apelido || n.numero}</span>;
      case "numero": return <span className="pg-mono">{n.numero}</span>;
      case "status": return <StatusPill status={n.status} T={T} />;
      case "tipo": return <span style={{ color: T.inkSoft }}>{TIPOS[n.tipo] || n.tipo || "—"}</span>;
      case "tags":
        return (
          <div className="flex flex-wrap gap-1 max-w-[220px]">
            {(n.tags || []).slice(0, 3).map((t) => <TagChip key={t} nome={t} cor={porNome[t]?.cor} T={T} />)}
            {(n.tags || []).length > 3 && <span className="text-[11px] self-center" style={{ color: T.inkFaint }}>+{n.tags.length - 3}</span>}
            {!(n.tags || []).length && <span style={{ color: T.inkFaint }}>—</span>}
          </div>
        );
      case "dataCompra": case "dataAtivacao":
        return <span className="pg-tnum" style={{ color: T.inkSoft }}>{fmtData(n[id])}</span>;
      case "valor": return <span className="pg-tnum font-medium">{brl(n.valor)}</span>;
      case "observacoes":
        return <span className="block max-w-[200px] truncate" style={{ color: T.inkSoft }} title={n.observacoes}>{n.observacoes || "—"}</span>;
      default: return <span style={{ color: T.inkSoft }}>{n[id] || "—"}</span>;
    }
  };

  if (sub === "importar") {
    return (
      <TelefoniaImportar
        numerosExistentes={numeros}
        T={T}
        onClose={() => setSub("lista")}
        onImportar={() => setSub("lista")}
        registrarHistorico={registrarHistorico}
      />
    );
  }

  if (loading) {
    return (
      <div className="p-10 text-center text-sm" style={{ color: T.inkFaint }}>
        Carregando telefonia…
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5" style={{ "--pa-accent": T.primary, "--pa-hover": T.surfaceAlt }}>
      <AnimStyles />

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Kpi T={T} delay={0} label="Números cadastrados" value={numeros.length} icon={Phone} onClick={limparTudo} />
        <Kpi T={T} delay={50} label="Conectados" value={contagem.conectado} color={T.STATUS.ativa.fg} icon={Check} active={F.status.length === 1 && F.status[0] === "conectado"} onClick={() => upd({ status: ["conectado"] })} />
        <Kpi T={T} delay={100} label="Em análise" value={contagem.em_analise} color={T.STATUS.em_recurso.fg} icon={AlertTriangle} active={F.status.length === 1 && F.status[0] === "em_analise"} onClick={() => upd({ status: ["em_analise"] })} />
        <Kpi T={T} delay={150} label="Banidos" value={contagem.banido} color={T.STATUS.banida.fg} icon={Ban} active={F.status.length === 1 && F.status[0] === "banido"} onClick={() => upd({ status: ["banido"] })} />
        <Kpi T={T} delay={200} label="Custo mensal" value={custoMensal} fmt={brl} color={T.primary} sub="soma de todos os números" />
      </div>

      <div className="pa-fade rounded-xl border p-4 flex flex-col gap-4" style={{ background: T.surface, borderColor: T.borderSoft, animationDelay: "120ms" }}>
        <div className="flex flex-col gap-2.5">
          <div className="flex h-2 rounded-full overflow-hidden gap-0.5" style={{ background: T.borderSoft }}>
            {STATUS_ORDEM.map((k) => contagem[k] ? (
              <button
                key={k}
                title={`${STATUS_LABEL[k]}: ${contagem[k]}`}
                onClick={() => toggleStatus(k)}
                className="pa-bar h-full"
                style={{ width: `${(contagem[k] / numeros.length) * 100}%`, background: statusCor(T)[k], opacity: F.status.length && !F.status.includes(k) ? 0.22 : 1 }}
              />
            ) : null)}
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => upd({ status: [] })} className="pa-chip px-3 py-1 rounded-full text-xs font-medium" style={{ background: F.status.length === 0 ? T.primary : T.borderSoft, color: F.status.length === 0 ? "#fff" : T.inkSoft }}>
              Todos <span className="pg-mono ml-1 opacity-80">{numeros.length}</span>
            </button>
            {STATUS_ORDEM.map((k) => {
              const on = F.status.includes(k);
              const fg = statusCor(T)[k];
              return (
                <button key={k} onClick={() => toggleStatus(k)} className="pa-chip px-3 py-1 rounded-full text-xs font-medium inline-flex items-center gap-1.5" style={{ background: on ? fg : rgba(fg, 0.1), color: on ? "#fff" : fg }}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: on ? "#fff" : fg }} />
                  {STATUS_LABEL[k]} <span className="pg-mono opacity-80">{contagem[k] || 0}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-2.5">
          <div className="flex-1 flex items-center gap-2 border rounded-lg px-3 py-2 transition-shadow focus-within:shadow-md" style={{ borderColor: T.border }}>
            <Search size={17} style={{ color: T.inkFaint }} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por número, apelido, operadora, colaborador ou tag…" className="w-full bg-transparent text-sm outline-none" style={{ color: T.ink }} />
            {search && <button onClick={() => setSearch("")}><X size={15} style={{ color: T.inkFaint }} /></button>}
          </div>

          <button onClick={() => setShowFiltros((s) => !s)} className="pa-chip px-3.5 py-2 rounded-lg text-sm font-medium border flex items-center justify-center gap-2" style={{ borderColor: showFiltros || chipsFiltros.length ? T.primary : T.border, color: showFiltros || chipsFiltros.length ? T.primary : T.ink, background: showFiltros ? T.primarySoft : "transparent" }}>
            <SlidersHorizontal size={16} /> Filtros
            {chipsFiltros.length > 0 && <span className="pg-mono text-[11px] px-1.5 rounded-full text-white" style={{ background: T.primary }}>{chipsFiltros.length}</span>}
          </button>

          <div className="relative z-50">
            <Dropdown T={T} align="right" width={250} renderTrigger={({ toggle }) => (
              <button onClick={toggle} className="pa-chip w-full px-3.5 py-2 rounded-lg text-sm font-medium border flex items-center justify-center gap-2" style={{ borderColor: T.border, color: T.ink }}>
                <Eye size={16} /> Colunas <span className="pg-mono text-[11px]" style={{ color: T.inkFaint }}>{cols.length}/{COLS.length}</span>
              </button>
            )}>
              <div className="flex flex-col" style={{ maxHeight: "min(420px, 70vh)" }}>
                <div className="flex items-center justify-between px-3 py-2.5 border-b text-xs shrink-0 sticky top-0 z-10" style={{ color: T.inkSoft, borderColor: T.borderSoft, background: T.surface }}>
                  <span className="font-semibold">Colunas visíveis</span>
                  <span className="flex gap-2">
                    <button onClick={() => setVisible(COLS.map((c) => c.id))} className="underline" style={{ color: T.primary }}>Todas</button>
                    <button onClick={() => setVisible(COLS_PADRAO)} className="underline" style={{ color: T.primary }}>Padrão</button>
                  </span>
                </div>
                <div className="p-2 overflow-y-auto pg-scroll">
                  {COLS.map((c) => {
                    const on = c.fixed || visible.includes(c.id);
                    return (
                      <label key={c.id} className="flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm transition-colors" style={{ cursor: c.fixed ? "not-allowed" : "pointer", opacity: c.fixed ? 0.55 : 1, background: on ? T.primarySoft : "transparent" }}>
                        <input type="checkbox" disabled={c.fixed} checked={on} onChange={() => setVisible(on ? visible.filter((x) => x !== c.id) : [...visible, c.id])} style={{ accentColor: T.primary }} />
                        {c.label}
                      </label>
                    );
                  })}
                </div>
              </div>
            </Dropdown>
          </div>

          <div className="inline-flex p-0.5 rounded-lg border self-stretch" style={{ borderColor: T.border }}>
            {[["tabela", List], ["cards", LayoutGrid]].map(([id, Icon]) => (
              <button key={id} onClick={() => setView(id)} title={id === "tabela" ? "Tabela" : "Cards"} className="px-3 rounded-md transition-colors" style={{ background: view === id ? T.primary : "transparent", color: view === id ? "#fff" : T.inkSoft }}>
                <Icon size={16} />
              </button>
            ))}
          </div>

          <button onClick={exportarCSV} className="pa-chip px-3.5 py-2 rounded-lg text-sm font-medium border flex items-center justify-center gap-2" style={{ borderColor: T.border, color: T.ink }}>
            <Download size={16} /> CSV
          </button>

          <button onClick={() => setSub("importar")} className="pa-chip px-3.5 py-2 rounded-lg text-sm font-medium text-white flex items-center justify-center gap-2 transition-shadow hover:shadow-lg" style={{ background: T.primary }}>
            <Upload size={16} /> Importar
          </button>

          <button onClick={() => { setEditing(null); setModalOpen(true); }} className="pa-chip px-3.5 py-2 rounded-lg text-sm font-medium text-white flex items-center justify-center gap-2 transition-shadow hover:shadow-lg" style={{ background: T.primary }}>
            <Plus size={16} /> Novo
          </button>
        </div>

        {showFiltros && (
          <div className="pa-fade grid sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t" style={{ borderColor: T.borderSoft }}>
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium" style={{ color: T.inkSoft }}>Operadora</span>
              <MultiSelect T={T} label="Operadoras" options={operadoras.map((o) => ({ value: o, label: o }))} value={F.operadora} onChange={(v) => upd({ operadora: v })} />
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium" style={{ color: T.inkSoft }}>Tipo</span>
              <MultiSelect T={T} label="Tipos" options={Object.entries(TIPOS).map(([k, v]) => ({ value: k, label: v }))} value={F.tipo} onChange={(v) => upd({ tipo: v })} />
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium" style={{ color: T.inkSoft }}>Fornecedor</span>
              <MultiSelect T={T} label="Fornecedores" options={fornecedoresNomes.map((f) => ({ value: f, label: f }))} value={F.fornecedor} onChange={(v) => upd({ fornecedor: v })} />
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium flex items-center justify-between" style={{ color: T.inkSoft }}>
                Tags
                <label className="flex items-center gap-1.5 font-normal cursor-pointer"><input type="checkbox" checked={F.semTag} onChange={(e) => upd({ semTag: e.target.checked })} style={{ accentColor: T.primary }} /> apenas sem tag</label>
              </span>
              <div className="flex gap-2">
                <div className="flex-1">
                  <MultiSelect T={T} label="Tags" options={catalogo.map((t) => ({ value: t.nome, label: t.nome, render: <TagChip nome={t.nome} cor={t.cor} T={T} /> }))} value={F.tags} onChange={(v) => upd({ tags: v })} />
                </div>
                <div className="w-44"><Seg T={T} value={F.tagsModo} onChange={(v) => upd({ tagsModo: v })} options={[["qualquer", "Qualquer"], ["todas", "Todas"]]} /></div>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium" style={{ color: T.inkSoft }}>Data de compra</span>
              <div className="flex items-center gap-1.5">
                <input type="date" value={F.compraDe} onChange={(e) => upd({ compraDe: e.target.value })} className={inputCls} style={inputStyleFor(T)} />
                <span className="text-xs" style={{ color: T.inkFaint }}>até</span>
                <input type="date" value={F.compraAte} onChange={(e) => upd({ compraAte: e.target.value })} className={inputCls} style={inputStyleFor(T)} />
              </div>
            </div>
          </div>
        )}

        {chipsFiltros.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 pt-3 border-t" style={{ borderColor: T.borderSoft }}>
            {chipsFiltros.map((c) => (
              <button key={c.k} onClick={c.off} className="pa-chip pa-pop-in inline-flex items-center gap-1.5 pl-3 pr-2 py-1 rounded-full text-xs" style={{ background: T.primarySoft, color: T.primary }}>
                {c.l} <X size={12} />
              </button>
            ))}
            <button onClick={limparTudo} className="text-xs underline ml-1" style={{ color: T.inkSoft }}>Limpar tudo ({chipsFiltros.length})</button>
          </div>
        )}
      </div>

      {filtrados.length === 0 ? (
        <div className="pa-fade rounded-xl border p-14 text-center flex flex-col items-center gap-3" style={{ background: T.surface, borderColor: T.borderSoft, color: T.inkFaint }}>
          <Search size={30} />
          <span className="text-sm">
            {numeros.length === 0
              ? "Nenhum número cadastrado ainda. Use Novo para adicionar ou Importar para trazer em lote."
              : "Nenhum número com os filtros aplicados."}
          </span>
          {numeros.length === 0 ? (
            <div className="flex gap-2 mt-1">
              <button onClick={() => { setEditing(null); setModalOpen(true); }} className="px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ background: T.primary }}>Novo número</button>
              <button onClick={() => setSub("importar")} className="px-4 py-2 rounded-lg text-sm font-medium border" style={{ borderColor: T.border, color: T.ink }}>Importar</button>
            </div>
          ) : chipsFiltros.length > 0 && (
            <button onClick={limparTudo} className="px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ background: T.primary }}>Limpar filtros</button>
          )}
        </div>
      ) : view === "tabela" ? (
        <div className="pa-fade rounded-xl border overflow-x-auto pg-scroll" style={{ background: T.surface, borderColor: T.borderSoft, animationDelay: "160ms" }}>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b" style={{ borderColor: T.borderSoft, color: T.inkSoft }}>
                <th className="p-4 w-10"><input type="checkbox" checked={todosSel} onChange={toggleTodos} style={{ accentColor: T.primary }} /></th>
                {cols.map((c) => (
                  <th
                    key={c.id}
                    onClick={() => setSort((s) => (s.key === c.id ? (s.dir === "asc" ? { key: c.id, dir: "desc" } : { key: null, dir: "asc" }) : { key: c.id, dir: "asc" }))}
                    className={`pa-th p-4 font-medium whitespace-nowrap ${c.right ? "text-right" : ""}`}
                    style={sort.key === c.id ? { color: T.primary } : undefined}
                  >
                    <span className="inline-flex items-center gap-1">
                      {c.label}
                      {sort.key === c.id && (sort.dir === "asc" ? <ChevronUp size={13} /> : <ChevronDown size={13} />)}
                    </span>
                  </th>
                ))}
                <th className="p-4 text-right font-medium">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: T.borderSoft }}>
              {mostrados.map((n, i) => (
                <tr key={n.id} className="pa-row pa-fade" style={{ animationDelay: `${Math.min(i, 14) * 28}ms`, background: sel.has(n.id) ? rgba(T.primary, 0.07) : undefined }}>
                  <td className="p-4"><input type="checkbox" checked={sel.has(n.id)} onChange={() => toggleSel(n.id)} style={{ accentColor: T.primary }} /></td>
                  {cols.map((c) => <td key={c.id} className={`p-4 ${c.right ? "text-right" : ""}`}>{cell(n, c.id)}</td>)}
                  <td className="p-4 text-right whitespace-nowrap">
                    <button onClick={() => { setEditing(n); setModalOpen(true); }} className="pa-chip p-1.5 mr-1 rounded" style={{ color: T.primary }}><Pencil size={16} /></button>
                    <button onClick={() => handleDelete(n.id, n.apelido || n.numero)} className="pa-chip p-1.5 rounded text-red-500"><Trash2 size={16} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
          {mostrados.map((n, i) => {
            const cor = statusCor(T)[n.status] || T.inkSoft;
            return (
              <div
                key={n.id}
                className="pa-fade pa-lift relative overflow-hidden rounded-xl border p-4 pl-5 flex flex-col gap-3"
                style={{ background: T.surface, borderColor: sel.has(n.id) ? T.primary : T.borderSoft, animationDelay: `${Math.min(i, 14) * 35}ms` }}
              >
                <span className="absolute left-0 top-0 bottom-0 w-1" style={{ background: cor }} />
                <div className="flex items-start gap-2.5">
                  <input type="checkbox" checked={sel.has(n.id)} onChange={() => toggleSel(n.id)} className="mt-1" style={{ accentColor: T.primary }} />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm leading-snug truncate">{n.apelido || n.numero}</div>
                    <div className="pg-mono text-xs mt-0.5" style={{ color: T.inkSoft }}>{n.numero}</div>
                    <div className="mt-1.5"><StatusPill status={n.status} T={T} /></div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1 min-h-[22px]">
                  {(n.tags || []).map((t) => <TagChip key={t} nome={t} cor={porNome[t]?.cor} T={T} />)}
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                  {[
                    ["Operadora", n.operadora || "—"],
                    ["Tipo", TIPOS[n.tipo] || n.tipo || "—"],
                    ["Colaborador", n.colaborador || "—"],
                    ["Valor", brl(n.valor)],
                  ].map(([l, v]) => (
                    <div key={l} className="min-w-0">
                      <div style={{ color: T.inkFaint }}>{l}</div>
                      <div className="truncate font-medium">{v}</div>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-end gap-1 pt-3 border-t" style={{ borderColor: T.borderSoft }}>
                  <button onClick={() => { setEditing(n); setModalOpen(true); }} className="pa-chip p-1.5 rounded" style={{ color: T.primary }}><Pencil size={16} /></button>
                  <button onClick={() => handleDelete(n.id, n.apelido || n.numero)} className="pa-chip p-1.5 rounded text-red-500"><Trash2 size={16} /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {filtrados.length > limite && (
        <button onClick={() => setLimite((l) => l + 60)} className="pa-chip self-center px-5 py-2 rounded-lg text-sm font-medium border" style={{ borderColor: T.border, color: T.inkSoft }}>
          Mostrar mais ({filtrados.length - limite} restantes)
        </button>
      )}

      {sel.size > 0 && (
        <div className="pa-slide-up fixed bottom-6 left-1/2 -translate-x-1/2 z-40 rounded-2xl border shadow-2xl px-4 py-3 flex items-center gap-3 flex-wrap justify-center max-w-[94vw]" style={{ background: T.surface, borderColor: T.border, color: T.ink }}>
          <span className="text-sm font-medium"><span className="pg-mono">{sel.size}</span> selecionado{sel.size > 1 ? "s" : ""}</span>
          <span className="w-px h-5" style={{ background: T.border }} />

          <div className="relative z-50">
            <Dropdown T={T} up renderTrigger={({ toggle }) => (
              <button onClick={toggle} className="pa-chip px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5" style={{ background: T.primarySoft, color: T.primary }}><TagIcon size={14} /> Aplicar tag</button>
            )}>
              {({ close }) => (
                <div className="p-2 max-h-64 overflow-y-auto pg-scroll flex flex-col gap-1">
                  {catalogo.length === 0 && <div className="p-3 text-xs" style={{ color: T.inkFaint }}>Crie tags na aba Tags.</div>}
                  {catalogo.map((t) => (
                    <button key={t.id} onClick={() => { close(); lote((n) => ((n.tags || []).includes(t.nome) ? null : { tags: [...(n.tags || []), t.nome] }), `Tag "${t.nome}" aplicada`); }} className="text-left p-1 rounded-lg hover:opacity-80">
                      <TagChip nome={t.nome} cor={t.cor} T={T} />
                    </button>
                  ))}
                </div>
              )}
            </Dropdown>
          </div>

          <div className="relative z-50">
                      <div className="relative z-50">
            <Dropdown T={T} up renderTrigger={({ toggle }) => (
              <button onClick={toggle} className="pa-chip px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5" style={{ background: T.borderSoft, color: T.inkSoft }}><Check size={14} /> Mudar status</button>
            )}>
              {({ close }) => (
                <div className="p-2 flex flex-col gap-1">
                  {STATUS_ORDEM.map((k) => (
                    <button key={k} onClick={() => { close(); lote((n) => (n.status === k ? null : { status: k }), `Status → ${STATUS_LABEL[k]}`); }} className="text-left p-1 rounded-lg hover:opacity-80">
                      <StatusPill status={k} T={T} />
                    </button>
                  ))}
                </div>
              )}
            </Dropdown>
          </div>

          <button onClick={() => setSel(new Set())} className="text-xs underline" style={{ color: T.inkSoft }}>Limpar seleção</button>
        </div>
      )}

      {modalOpen && (
        <NumeroModal
          initial={editing}
          fornecedores={fornecedores}
          T={T}
          onClose={() => { setModalOpen(false); setEditing(null); }}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
