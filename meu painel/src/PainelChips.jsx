import React, { useState, useEffect, useMemo } from "react";
import {
  collection, onSnapshot, doc, setDoc, deleteDoc, writeBatch, query, where, getDocs,
} from "firebase/firestore";
import {
  Smartphone, Plus, Search, X, Pencil, Trash2, Check, ChevronDown, ChevronUp,
  Download, LayoutGrid, List, SlidersHorizontal, Eye, Ban, Package,
} from "lucide-react";
import { db } from "./firebase";
import {
  AnimStyles, Dropdown, useCountUp, usePersistentState,
  rgba, inputCls, inputStyleFor, uid,
} from "./painelShared";

/* =====================================================================
   PAINEL DE CHIPS — estoque/cadastro de chips
   - Coleção: "chips"
   - O status do chip é recalculado ao criar/devolver empréstimos
     (PainelEmprestimos faz merge). Aqui só cadastramos e editamos dados.
   ===================================================================== */

const STATUS_ORDEM = ["disponivel", "emprestado", "bloqueado", "descartado"];
const STATUS_LABEL = {
  disponivel: "Disponível",
  emprestado: "Emprestado",
  bloqueado: "Bloqueado",
  descartado: "Descartado",
};

const operadorasCor = (T) => ({
  disponivel: T.STATUS.ativa.fg,
  emprestado: T.STATUS.em_recurso.fg,
  bloqueado: T.STATUS.banida.fg,
  descartado: T.STATUS.estoque.fg,
});

const OPERADORAS_SUGERIDAS = ["Vivo", "Claro", "TIM", "Oi", "Nextel", "Algar", "Sercomtel", "Outra"];

const emptyChip = () => ({
  id: "",
  numero: "",
  iccid: "",
  operadora: "",
  status: "disponivel",
  observacoes: "",
});

const COLS = [
  { id: "numero", label: "Número", fixed: true },
  { id: "iccid", label: "ICCID" },
  { id: "operadora", label: "Operadora" },
  { id: "status", label: "Status" },
  { id: "observacoes", label: "Observações" },
];
const COLS_PADRAO = ["numero", "operadora", "status", "observacoes"];

const F0 = { status: [], operadora: [] };

function StatusPill({ status, T }) {
  const cor = operadorasCor(T)[status] || T.inkSoft;
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap" style={{ background: rgba(cor, 0.12), color: cor }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: cor }} />
      {STATUS_LABEL[status] || status}
    </span>
  );
}

function Kpi({ label, value, color, icon: Icon, onClick, active, delay, sub, T }) {
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
      <div className="pg-mono text-2xl font-semibold" style={{ color: c }}>{Math.round(v)}</div>
      {sub && <div className="text-[11px]" style={{ color: T.inkFaint }}>{sub}</div>}
    </button>
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
              {o.label}
            </label>
          );
        })}
      </div>
    </Dropdown>
  );
}

/* ---------------- modal ---------------- */
function ChipModal({ initial, T, onClose, onSave }) {
  const [f, setF] = useState(initial || emptyChip());
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = (e) => {
    e.preventDefault();
    if (!f.numero.trim()) return alert("Informe o número.");
    onSave(f);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: T.overlay }}>
      <div className="w-full max-w-lg rounded-xl border flex flex-col max-h-[92vh]" style={{ background: T.surface, color: T.ink, borderColor: T.border }}>
        <div className="flex items-center justify-between border-b px-6 py-4 shrink-0" style={{ borderColor: T.borderSoft }}>
          <h3 className="pg-font-display text-lg font-semibold">{initial?.id ? "Editar chip" : "Novo chip"}</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:opacity-70"><X size={20} /></button>
        </div>

        <form onSubmit={submit} className="flex flex-col gap-4 p-6 overflow-y-auto pg-scroll">
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="pg-font-body block">
              <span className="block text-xs font-medium mb-1.5" style={{ color: T.inkSoft }}>Número *</span>
              <input required value={f.numero} onChange={set("numero")} placeholder="+55 11 99999-9999" className={inputCls + " pg-mono"} style={inputStyleFor(T)} />
            </label>
            <label className="pg-font-body block">
              <span className="block text-xs font-medium mb-1.5" style={{ color: T.inkSoft }}>ICCID / SIM</span>
              <input value={f.iccid} onChange={set("iccid")} placeholder="Número do chip" className={inputCls + " pg-mono"} style={inputStyleFor(T)} />
            </label>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <label className="pg-font-body block">
              <span className="block text-xs font-medium mb-1.5" style={{ color: T.inkSoft }}>Operadora</span>
              <input list="chips-operadoras-dl" value={f.operadora} onChange={set("operadora")} placeholder="Vivo, Claro…" className={inputCls} style={inputStyleFor(T)} />
              <datalist id="chips-operadoras-dl">
                {OPERADORAS_SUGERIDAS.map((o) => <option key={o} value={o} />)}
              </datalist>
            </label>
            <label className="pg-font-body block">
              <span className="block text-xs font-medium mb-1.5" style={{ color: T.inkSoft }}>Status</span>
              <select value={f.status} onChange={set("status")} className={inputCls} style={inputStyleFor(T)}>
                {STATUS_ORDEM.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
              </select>
            </label>
          </div>

          <label className="pg-font-body block">
            <span className="block text-xs font-medium mb-1.5" style={{ color: T.inkSoft }}>Observações</span>
            <textarea rows={3} value={f.observacoes} onChange={set("observacoes")} placeholder="Anotações internas…" className={inputCls} style={inputStyleFor(T)} />
          </label>

          <div className="flex justify-end gap-3 border-t pt-4 mt-2" style={{ borderColor: T.borderSoft }}>
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ background: T.borderSoft, color: T.inkSoft }}>Cancelar</button>
            <button type="submit" className="px-5 py-2 rounded-lg text-sm font-medium text-white transition-shadow hover:shadow-lg" style={{ background: T.primary }}>Salvar chip</button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* =====================================================================
   COMPONENTE PRINCIPAL
   ===================================================================== */
export default function PainelChips({ T, registrarHistorico, chips, loading }) {
  const [search, setSearch] = useState("");
  const [F, setF] = useState(F0);
  const [showFiltros, setShowFiltros] = useState(false);
  const [sort, setSort] = useState({ key: null, dir: "asc" });
  const [visible, setVisible] = usePersistentState("wa_cols_chips", COLS_PADRAO);
  const [view, setView] = usePersistentState("wa_view_chips", "tabela");
  const [limite, setLimite] = useState(60);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const upd = (patch) => setF((f) => ({ ...f, ...patch }));

  const operadoras = useMemo(
    () => Array.from(new Set(chips.map((c) => c.operadora).filter(Boolean))).sort(),
    [chips]
  );

  const contagem = useMemo(() => {
    const c = { disponivel: 0, emprestado: 0, bloqueado: 0, descartado: 0 };
    chips.forEach((x) => { if (c[x.status] !== undefined) c[x.status]++; });
    return c;
  }, [chips]);

  const filtrados = useMemo(() => {
    const q = search.trim().toLowerCase();
    let r = chips.filter((c) => {
      if (q && !`${c.numero} ${c.iccid || ""} ${c.operadora || ""} ${c.observacoes || ""}`.toLowerCase().includes(q)) return false;
      if (F.status.length && !F.status.includes(c.status)) return false;
      if (F.operadora.length && !F.operadora.includes(c.operadora)) return false;
      return true;
    });
    if (sort.key) {
      const val = (c) => String(c[sort.key] || "").toLowerCase();
      r = [...r].sort((a, b) => { const x = val(a), y = val(b); return (x > y ? 1 : x < y ? -1 : 0) * (sort.dir === "asc" ? 1 : -1); });
    }
    return r;
  }, [chips, search, F, sort]);

  const cols = COLS.filter((c) => c.fixed || visible.includes(c.id));
  const mostrados = filtrados.slice(0, limite);

  const chipsFiltros = [];
  F.status.forEach((s) => chipsFiltros.push({ k: "s" + s, l: `Status: ${STATUS_LABEL[s]}`, off: () => upd({ status: F.status.filter((x) => x !== s) }) }));
  F.operadora.forEach((s) => chipsFiltros.push({ k: "o" + s, l: `Operadora: ${s}`, off: () => upd({ operadora: F.operadora.filter((x) => x !== s) }) }));
  if (search) chipsFiltros.push({ k: "b", l: `Busca: "${search}"`, off: () => setSearch("") });

  const limparTudo = () => { setF(F0); setSearch(""); };
  const toggleStatus = (s) => upd({ status: F.status.includes(s) ? F.status.filter((x) => x !== s) : [...F.status, s] });

  const handleSave = async (data) => {
    const isEdit = Boolean(data.id);
    const id = data.id || uid();
    const payload = { ...data, id, atualizadoEm: new Date().toISOString() };
    if (!isEdit) payload.criadoEm = new Date().toISOString();

    // Se editou e o número mudou, sincroniza os empréstimos ligados
    if (isEdit) {
      const antigo = chips.find((c) => c.id === id);
      if (antigo && antigo.numero !== data.numero) {
        const { collection: col, query, where, getDocs } = await import("firebase/firestore");
        const snap = await getDocs(query(col(db, "emprestimos"), where("chipId", "==", id)));
        if (!snap.empty) {
          const batch = writeBatch(db);
          snap.docs.forEach((d) => batch.set(d.ref, { numero: data.numero, atualizadoEm: new Date().toISOString() }, { merge: true }));
          await batch.commit();
        }
      }
    }

    await setDoc(doc(db, "chips", id), payload);
    await registrarHistorico?.(isEdit ? "Edição de Chip" : "Novo Chip", `${data.numero}${data.operadora ? ` (${data.operadora})` : ""}`);
    setModalOpen(false);
    setEditing(null);
  };

  const handleDelete = async (id, label) => {
    if (!confirm(`Remover o chip "${label}"? Empréstimos antigos ligados a ele continuam no histórico.`)) return;
    await deleteDoc(doc(db, "chips", id));
    await registrarHistorico?.("Exclusão de Chip", `Chip "${label}" removido`);
  };

  const exportarCSV = () => {
    const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csvVal = (c, id) => {
      if (id === "status") return STATUS_LABEL[c.status] || c.status;
      return c[id] || "";
    };
    const linhas = [
      cols.map((c) => esc(c.label)).join(";"),
      ...filtrados.map((c) => cols.map((col) => esc(csvVal(c, col.id))).join(";")),
    ];
    const blob = new Blob(["\uFEFF" + linhas.join("\n")], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `chips_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  const cell = (c, id) => {
    switch (id) {
      case "numero": return <span className="pg-mono font-medium">{c.numero}</span>;
      case "iccid": return <span className="pg-mono" style={{ color: T.inkSoft }}>{c.iccid || "—"}</span>;
      case "operadora": return <span>{c.operadora || "—"}</span>;
      case "status": return <StatusPill status={c.status} T={T} />;
      case "observacoes": return <span className="block max-w-[240px] truncate" style={{ color: T.inkSoft }} title={c.observacoes}>{c.observacoes || "—"}</span>;
      default: return <span style={{ color: T.inkSoft }}>{c[id] || "—"}</span>;
    }
  };

  if (loading) {
    return <div className="p-10 text-center text-sm" style={{ color: T.inkFaint }}>Carregando chips…</div>;
  }

  return (
    <div className="flex flex-col gap-5" style={{ "--pa-accent": T.primary, "--pa-hover": T.surfaceAlt }}>
      <AnimStyles />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi T={T} delay={0} label="Chips cadastrados" value={chips.length} icon={Smartphone} onClick={limparTudo} />
        <Kpi T={T} delay={50} label="Disponíveis" value={contagem.disponivel} color={T.STATUS.ativa.fg} icon={Check} active={F.status.length === 1 && F.status[0] === "disponivel"} onClick={() => upd({ status: ["disponivel"] })} />
        <Kpi T={T} delay={100} label="Emprestados" value={contagem.emprestado} color={T.STATUS.em_recurso.fg} icon={Package} active={F.status.length === 1 && F.status[0] === "emprestado"} onClick={() => upd({ status: ["emprestado"] })} />
        <Kpi T={T} delay={150} label="Bloqueados / descartados" value={contagem.bloqueado + contagem.descartado} color={T.STATUS.banida.fg} icon={Ban} />
      </div>

      <div className="pa-fade rounded-xl border p-4 flex flex-col gap-4" style={{ background: T.surface, borderColor: T.borderSoft, animationDelay: "120ms" }}>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => upd({ status: [] })} className="pa-chip px-3 py-1 rounded-full text-xs font-medium" style={{ background: F.status.length === 0 ? T.primary : T.borderSoft, color: F.status.length === 0 ? "#fff" : T.inkSoft }}>
            Todos <span className="pg-mono ml-1 opacity-80">{chips.length}</span>
          </button>
          {STATUS_ORDEM.map((k) => {
            const on = F.status.includes(k);
            const fg = operadorasCor(T)[k];
            return (
              <button key={k} onClick={() => toggleStatus(k)} className="pa-chip px-3 py-1 rounded-full text-xs font-medium inline-flex items-center gap-1.5" style={{ background: on ? fg : rgba(fg, 0.1), color: on ? "#fff" : fg }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: on ? "#fff" : fg }} />
                {STATUS_LABEL[k]} <span className="pg-mono opacity-80">{contagem[k] || 0}</span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-col md:flex-row gap-2.5">
          <div className="flex-1 flex items-center gap-2 border rounded-lg px-3 py-2 transition-shadow focus-within:shadow-md" style={{ borderColor: T.border }}>
            <Search size={17} style={{ color: T.inkFaint }} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por número, ICCID, operadora…" className="w-full bg-transparent text-sm outline-none" style={{ color: T.ink }} />
            {search && <button onClick={() => setSearch("")}><X size={15} style={{ color: T.inkFaint }} /></button>}
          </div>

          <button onClick={() => setShowFiltros((s) => !s)} className="pa-chip px-3.5 py-2 rounded-lg text-sm font-medium border flex items-center justify-center gap-2" style={{ borderColor: showFiltros || chipsFiltros.length ? T.primary : T.border, color: showFiltros || chipsFiltros.length ? T.primary : T.ink, background: showFiltros ? T.primarySoft : "transparent" }}>
            <SlidersHorizontal size={16} /> Filtros
            {chipsFiltros.length > 0 && <span className="pg-mono text-[11px] px-1.5 rounded-full text-white" style={{ background: T.primary }}>{chipsFiltros.length}</span>}
          </button>

          <Dropdown T={T} align="right" width={250} renderTrigger={({ toggle }) => (
            <button onClick={toggle} className="pa-chip w-full px-3.5 py-2 rounded-lg text-sm font-medium border flex items-center justify-center gap-2" style={{ borderColor: T.border, color: T.ink }}>
              <Eye size={16} /> Colunas <span className="pg-mono text-[11px]" style={{ color: T.inkFaint }}>{cols.length}/{COLS.length}</span>
            </button>
          )}>
            <div className="flex flex-col" style={{ maxHeight: "min(420px, 70vh)" }}>
              <div className="flex items-center justify-between px-3 py-2.5 border-b text-xs shrink-0" style={{ color: T.inkSoft, borderColor: T.borderSoft, background: T.surface }}>
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

          <button onClick={() => { setEditing(null); setModalOpen(true); }} className="pa-chip px-3.5 py-2 rounded-lg text-sm font-medium text-white flex items-center justify-center gap-2 transition-shadow hover:shadow-lg" style={{ background: T.primary }}>
            <Plus size={16} /> Novo chip
          </button>
        </div>

        {showFiltros && (
          <div className="pa-fade grid sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t" style={{ borderColor: T.borderSoft }}>
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium" style={{ color: T.inkSoft }}>Operadora</span>
              <MultiSelect T={T} label="Operadoras" options={operadoras.map((o) => ({ value: o, label: o }))} value={F.operadora} onChange={(v) => upd({ operadora: v })} />
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
          <Smartphone size={30} />
          <span className="text-sm">
            {chips.length === 0
              ? "Nenhum chip cadastrado ainda. Use Novo chip para começar."
              : "Nenhum chip com os filtros aplicados."}
          </span>
          {chips.length === 0 && (
            <button onClick={() => { setEditing(null); setModalOpen(true); }} className="px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ background: T.primary }}>
              Novo chip
            </button>
          )}
        </div>
      ) : view === "tabela" ? (
        <div className="pa-fade rounded-xl border overflow-x-auto pg-scroll" style={{ background: T.surface, borderColor: T.borderSoft, animationDelay: "160ms" }}>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b" style={{ borderColor: T.borderSoft, color: T.inkSoft }}>
                {cols.map((c) => (
                  <th
                    key={c.id}
                    onClick={() => setSort((s) => (s.key === c.id ? (s.dir === "asc" ? { key: c.id, dir: "desc" } : { key: null, dir: "asc" }) : { key: c.id, dir: "asc" }))}
                    className="pa-th p-4 font-medium whitespace-nowrap"
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
              {mostrados.map((c, i) => (
                <tr key={c.id} className="pa-row pa-fade" style={{ animationDelay: `${Math.min(i, 14) * 28}ms` }}>
                  {cols.map((col) => <td key={col.id} className="p-4">{cell(c, col.id)}</td>)}
                  <td className="p-4 text-right whitespace-nowrap">
                    <button onClick={() => { setEditing(c); setModalOpen(true); }} className="pa-chip p-1.5 mr-1 rounded" style={{ color: T.primary }}><Pencil size={16} /></button>
                    <button onClick={() => handleDelete(c.id, c.numero)} className="pa-chip p-1.5 rounded text-red-500"><Trash2 size={16} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
          {mostrados.map((c, i) => {
            const cor = operadorasCor(T)[c.status] || T.inkSoft;
            return (
              <div key={c.id} className="pa-fade pa-lift relative overflow-hidden rounded-xl border p-4 pl-5 flex flex-col gap-3" style={{ background: T.surface, borderColor: T.borderSoft, animationDelay: `${Math.min(i, 14) * 35}ms` }}>
                <span className="absolute left-0 top-0 bottom-0 w-1" style={{ background: cor }} />
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="pg-mono text-sm font-semibold truncate">{c.numero}</div>
                    <div className="text-xs mt-0.5" style={{ color: T.inkFaint }}>{c.operadora || "Sem operadora"}</div>
                    <div className="mt-1.5"><StatusPill status={c.status} T={T} /></div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => { setEditing(c); setModalOpen(true); }} className="pa-chip p-1.5 rounded" style={{ color: T.primary }}><Pencil size={16} /></button>
                    <button onClick={() => handleDelete(c.id, c.numero)} className="pa-chip p-1.5 rounded text-red-500"><Trash2 size={16} /></button>
                  </div>
                </div>
                {c.iccid && (
                  <div className="text-xs">
                    <div style={{ color: T.inkFaint }}>ICCID</div>
                    <div className="pg-mono truncate">{c.iccid}</div>
                  </div>
                )}
                {c.observacoes && <div className="text-xs line-clamp-2" style={{ color: T.inkSoft }} title={c.observacoes}>{c.observacoes}</div>}
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

      {modalOpen && (
        <ChipModal
          initial={editing}
          T={T}
          onClose={() => { setModalOpen(false); setEditing(null); }}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
