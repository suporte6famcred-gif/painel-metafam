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
