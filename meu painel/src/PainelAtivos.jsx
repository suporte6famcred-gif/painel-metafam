import React, { useState, useEffect, useMemo } from "react";
import {
  Search, SlidersHorizontal, Eye, LayoutGrid, List, Download, Pencil, Trash2, X, Check,
  ChevronUp, ChevronDown, Tag as TagIcon, MessageSquare, Boxes, Wallet, Ban,
} from "lucide-react";
import { db } from "./firebase";
import { collection, onSnapshot, doc, writeBatch } from "firebase/firestore";
import {
  AnimStyles, TagChip, Dropdown, useCountUp, usePersistentState, useTagsCatalog,
  brl, fmtData, rgba, inputCls, inputStyleFor,
} from "./painelShared";

/* =====================================================================
   ABA ATIVOS / BMs — versão completa
   props: bms, T, onEdit(bm), onDelete(id, nome), registrarHistorico
   Lê as coleções "modelos" e "tags" por conta própria.
   ===================================================================== */

const STATUS_ORDEM = ["ativa", "estoque", "em_recurso", "banida", "vendida"];

const COLS = [
  { id: "nome", label: "Ativo", fixed: true },
  { id: "status", label: "Status" },
  { id: "tags", label: "Tags" },
  { id: "modelos", label: "Modelos de mensagem" },
  { id: "cadastro", label: "Vagas para modelos" },
  { id: "telefone", label: "Telefone" },
  { id: "fornecedor", label: "Fornecedor" },
  { id: "qualidade", label: "Qualidade" },
  { id: "dataCompra", label: "Data compra" },
  { id: "dataConexao", label: "Data conexão" },
  { id: "valor", label: "Valor", right: true },
  { id: "observacoes", label: "Observações" },
];
const COLS_PADRAO = ["nome", "status", "tags", "modelos", "telefone", "fornecedor", "dataCompra", "valor"];

const F0 = {
  status: [], fornecedor: [], qualidade: [], tags: [], tagsModo: "qualquer", semTag: false,
  modelo: "todos", cadastro: "todos", compraDe: "", compraAte: "", valorMin: "", valorMax: "",
};

const STATUS_MODELO = {
  APPROVED: { label: "Ativo", tone: "ativa" },
  IN_REVIEW: { label: "Em análise", tone: "em_recurso" },
  REJECTED: { label: "Rejeitado", tone: "banida" },
  PAUSED: { label: "Pausado", tone: "em_recurso" },
  DISABLED: { label: "Desativado", tone: "banida" },
};

function vagas(bm, usados) {
  const limite = Number(bm.limiteModelos) || 250;
  let motivo = null;
  if (bm.modelosBloqueado) motivo = bm.modelosBloqueioMotivo || "Bloqueado";
  else if (bm.status === "banida") motivo = "BM banida";
  else if (bm.status === "vendida") motivo = "BM vendida";
  else if (bm.status === "em_recurso") motivo = "Em recurso";
  else if (usados >= limite) motivo = "Limite atingido";
  return { limite, usados, pode: !motivo, motivo };
}

/* ---------------- peças reutilizáveis ---------------- */
function Kpi({ label, value, fmt, sub, color, icon: Icon, onClick, active, delay, T, bar }) {
  const v = useCountUp(value, 900);
  const [m, setM] = useState(false);
  useEffect(() => { const t = setTimeout(() => setM(true), 90); return () => clearTimeout(t); }, []);
  const c = color || T.primary;
  return (
    <button
      onClick={onClick}
      className="pa-fade pa-lift text-left rounded-xl border p-4 flex flex-col gap-1.5"
      style={{ background: T.surface, borderColor: active ? c : T.borderSoft, boxShadow: active ? `0 0 0 1px ${c}` : "none", animationDelay: `${delay}ms` }}
    >
      <div className="flex items-center justify-between text-xs" style={{ color: T.inkSoft }}>
        <span>{label}</span>
        {Icon && <Icon size={15} style={{ color: color || T.inkFaint }} />}
      </div>
      <div className="pg-mono text-2xl font-semibold" style={{ color: color || T.ink }}>{fmt ? fmt(v) : Math.round(v)}</div>
      {bar !== undefined && (
        <div className="h-1 rounded-full overflow-hidden" style={{ background: T.borderSoft }}>
          <div className="h-full rounded-full pa-bar" style={{ width: `${m ? bar : 0}%`, background: c }} />
        </div>
      )}
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

function StatusPill({ status, T }) {
  const cfg = T.STATUS[status] || T.STATUS.estoque;
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap" style={{ background: rgba(cfg.fg, 0.12), color: cfg.fg }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: cfg.fg }} /> {cfg.label}
    </span>
  );
}

/* =====================================================================
   COMPONENTE PRINCIPAL
   ===================================================================== */
export default function PainelAtivos({ bms, T, onEdit, onDelete, registrarHistorico }) {
  const { tags: catalogo, porNome } = useTagsCatalog();
  const [modelos, setModelos] = useState([]);
  const [search, setSearch] = useState("");
  const [F, setF] = useState(F0);
  const [showFiltros, setShowFiltros] = useState(false);
  const [sort, setSort] = useState({ key: null, dir: "asc" });
  const [visible, setVisible] = usePersistentState("wa_cols_ativos", COLS_PADRAO);
  const [view, setView] = usePersistentState("wa_view_ativos", "tabela");
  const [sel, setSel] = useState(new Set());
  const [limite, setLimite] = useState(60);
  const [tip, setTip] = useState(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { const t = setTimeout(() => setMounted(true), 90); return () => clearTimeout(t); }, []);
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "modelos"), (s) => setModelos(s.docs.map((d) => ({ id: d.id, ...d.data() }))), (e) => console.error("modelos:", e));
    return () => unsub();
  }, []);

  const upd = (patch) => setF((f) => ({ ...f, ...patch }));

  /* ---- dados derivados ---- */
  const modPorBM = useMemo(() => {
    const m = {};
    bms.forEach((b) => (m[b.id] = { nomes: new Set(), lista: [] }));
    modelos.forEach((md) =>
      Object.entries(md.canais || {}).forEach(([id, r]) => {
        if (m[id]) { m[id].nomes.add(md.nome); m[id].lista.push({ nome: md.nome, idioma: md.idioma, status: r.status }); }
      })
    );
    return m;
  }, [bms, modelos]);

  const canalPorBM = useMemo(() => {
    const c = {};
    bms.forEach((b) => (c[b.id] = vagas(b, modPorBM[b.id]?.nomes.size || 0)));
    return c;
  }, [bms, modPorBM]);

  const fornecedores = useMemo(() => Array.from(new Set(bms.map((b) => b.fornecedor).filter(Boolean))).sort(), [bms]);
  const contagem = useMemo(() => { const c = {}; bms.forEach((b) => (c[b.status] = (c[b.status] || 0) + 1)); return c; }, [bms]);

  const comModelo = bms.filter((b) => modPorBM[b.id]?.nomes.size).length;
  const ativasSemModelo = bms.filter((b) => b.status === "ativa" && !modPorBM[b.id]?.nomes.size).length;
  const cobertura = bms.length ? Math.round((comModelo / bms.length) * 100) : 0;

  const filtrados = useMemo(() => {
    const q = search.trim().toLowerCase();
    let r = bms.filter((b) => {
      const tg = b.tags || [];
      if (q && !`${b.nome} ${b.fornecedor || ""} ${b.telefone || ""} ${tg.join(" ")}`.toLowerCase().includes(q)) return false;
      if (F.status.length && !F.status.includes(b.status)) return false;
      if (F.fornecedor.length && !F.fornecedor.includes(b.fornecedor)) return false;
      if (F.qualidade.length && !F.qualidade.includes(b.qualidade)) return false;
      if (F.semTag && tg.length) return false;
      if (F.tags.length && !(F.tagsModo === "todas" ? F.tags.every((t) => tg.includes(t)) : F.tags.some((t) => tg.includes(t)))) return false;
      const nm = modPorBM[b.id]?.nomes.size || 0;
      if (F.modelo === "com" && !nm) return false;
      if (F.modelo === "sem" && nm) return false;
      const c = canalPorBM[b.id];
      if (F.cadastro === "pode" && !c.pode) return false;
      if (F.cadastro === "sem_vaga" && c.pode) return false;
      if (F.compraDe && (!b.dataCompra || b.dataCompra < F.compraDe)) return false;
      if (F.compraAte && (!b.dataCompra || b.dataCompra > F.compraAte)) return false;
      const v = Number(b.valor) || 0;
      if (F.valorMin !== "" && v < Number(F.valorMin)) return false;
      if (F.valorMax !== "" && v > Number(F.valorMax)) return false;
      return true;
    });
    if (sort.key) {
      const val = (b) => {
        switch (sort.key) {
          case "modelos": return modPorBM[b.id]?.nomes.size || 0;
          case "valor": return Number(b.valor) || 0;
          case "tags": return (b.tags || []).length;
          case "cadastro": return canalPorBM[b.id].limite - canalPorBM[b.id].usados;
          default: return String(b[sort.key] || "").toLowerCase();
        }
      };
      r = [...r].sort((a, b) => { const x = val(a), y = val(b); return (x > y ? 1 : x < y ? -1 : 0) * (sort.dir === "asc" ? 1 : -1); });
    }
    return r;
  }, [bms, search, F, sort, modPorBM, canalPorBM]);

  const valorExibido = filtrados.reduce((s, b) => s + (Number(b.valor) || 0), 0);
  const cols = COLS.filter((c) => c.fixed || visible.includes(c.id));
  const mostrados = filtrados.slice(0, limite);

  /* ---- filtros ativos (chips removíveis) ---- */
  const chips = [];
  F.status.forEach((s) => chips.push({ k: "s" + s, l: `Status: ${T.STATUS[s]?.label}`, off: () => upd({ status: F.status.filter((x) => x !== s) }) }));
  F.fornecedor.forEach((s) => chips.push({ k: "f" + s, l: `Fornecedor: ${s}`, off: () => upd({ fornecedor: F.fornecedor.filter((x) => x !== s) }) }));
  F.qualidade.forEach((s) => chips.push({ k: "q" + s, l: `Qualidade: ${T.QUALIDADE[s]?.label || s}`, off: () => upd({ qualidade: F.qualidade.filter((x) => x !== s) }) }));
  F.tags.forEach((s) => chips.push({ k: "t" + s, l: `Tag: ${s}`, off: () => upd({ tags: F.tags.filter((x) => x !== s) }) }));
  if (F.semTag) chips.push({ k: "st", l: "Sem tag", off: () => upd({ semTag: false }) });
  if (F.modelo !== "todos") chips.push({ k: "m", l: F.modelo === "com" ? "Com modelo cadastrado" : "Sem modelo cadastrado", off: () => upd({ modelo: "todos" }) });
  if (F.cadastro !== "todos") chips.push({ k: "c", l: F.cadastro === "pode" ? "Pode cadastrar modelos" : "Sem vaga para modelos", off: () => upd({ cadastro: "todos" }) });
  if (F.compraDe) chips.push({ k: "cd", l: `Compra desde ${fmtData(F.compraDe)}`, off: () => upd({ compraDe: "" }) });
  if (F.compraAte) chips.push({ k: "ca", l: `Compra até ${fmtData(F.compraAte)}`, off: () => upd({ compraAte: "" }) });
  if (F.valorMin !== "") chips.push({ k: "vn", l: `Valor ≥ ${brl(F.valorMin)}`, off: () => upd({ valorMin: "" }) });
  if (F.valorMax !== "") chips.push({ k: "vx", l: `Valor ≤ ${brl(F.valorMax)}`, off: () => upd({ valorMax: "" }) });
  if (search) chips.push({ k: "b", l: `Busca: "${search}"`, off: () => setSearch("") });
  const limparTudo = () => { setF(F0); setSearch(""); };
  const nAvancados = chips.filter((c) => !["b"].includes(c.k) && !c.k.startsWith("s") || c.k === "st").length;

  const toggleStatus = (s) => upd({ status: F.status.includes(s) ? F.status.filter((x) => x !== s) : [...F.status, s] });

  /* ---- seleção e ações em lote ---- */
  const toggleSel = (id) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const todosSel = mostrados.length > 0 && mostrados.every((b) => sel.has(b.id));
  const toggleTodos = () => setSel(todosSel ? new Set() : new Set(mostrados.map((b) => b.id)));

  const lote = async (fn, descr) => {
    const ops = [];
    bms.filter((b) => sel.has(b.id)).forEach((b) => { const data = fn(b); if (data) ops.push({ ref: doc(db, "bms", b.id), data }); });
    for (let i = 0; i < ops.length; i += 400) {
      const batch = writeBatch(db);
      ops.slice(i, i + 400).forEach((o) => batch.set(o.ref, o.data, { merge: true }));
      await batch.commit();
    }
    await registrarHistorico?.("Ação em Lote", `${descr} em ${ops.length} ativo(s)`);
    setSel(new Set());
  };

  /* ---- exportar CSV (respeita colunas visíveis e filtros) ---- */
  const csvVal = (b, id) => {
    switch (id) {
      case "status": return T.STATUS[b.status]?.label || b.status;
      case "tags": return (b.tags || []).join(", ");
      case "modelos": return (modPorBM[b.id]?.lista || []).map((m) => m.nome).join(", ");
      case "cadastro": return canalPorBM[b.id].pode ? "Pode cadastrar" : canalPorBM[b.id].motivo;
      case "qualidade": return T.QUALIDADE[b.qualidade]?.label || "";
      case "dataCompra": case "dataConexao": return fmtData(b[id]);
      case "valor": return String(Number(b.valor) || 0).replace(".", ",");
      default: return b[id] || "";
    }
  };
  const exportarCSV = () => {
    const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const linhas = [cols.map((c) => esc(c.label)).join(";"), ...filtrados.map((b) => cols.map((c) => esc(csvVal(b, c.id))).join(";"))];
    const blob = new Blob(["\uFEFF" + linhas.join("\n")], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `ativos_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  /* ---- células ---- */
  const ModeloPill = ({ bm }) => {
    const m = modPorBM[bm.id];
    const n = m?.nomes.size || 0;
    if (!n) return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] whitespace-nowrap" style={{ border: `1px dashed ${T.border}`, color: T.inkFaint }}>Sem modelo</span>;
    const aprov = m.lista.filter((x) => x.status === "APPROVED").length;
    const cor = aprov ? T.STATUS.ativa.fg : T.STATUS.em_recurso.fg;
    return (
      <span
        onMouseEnter={(e) => { const r = e.currentTarget.getBoundingClientRect(); setTip({ id: bm.id, x: r.left, y: r.bottom + 6, top: r.top - 6, above: r.bottom + 250 > window.innerHeight }); }}
        onMouseLeave={() => setTip(null)}
        className="pa-chip inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium cursor-default whitespace-nowrap"
        style={{ background: rgba(cor, 0.13), color: cor }}
      >
        <MessageSquare size={12} /> {n} modelo{n > 1 ? "s" : ""}
      </span>
    );
  };

  const cell = (b, id) => {
    switch (id) {
      case "nome": return <span className="font-medium">{b.nome}</span>;
      case "status": return <StatusPill status={b.status} T={T} />;
      case "tags":
        return (
          <div className="flex flex-wrap gap-1 max-w-[220px]">
            {(b.tags || []).slice(0, 3).map((t) => <TagChip key={t} nome={t} cor={porNome[t]?.cor} T={T} />)}
            {(b.tags || []).length > 3 && <span className="text-[11px] self-center" style={{ color: T.inkFaint }}>+{b.tags.length - 3}</span>}
            {!(b.tags || []).length && <span style={{ color: T.inkFaint }}>—</span>}
          </div>
        );
      case "modelos": return <ModeloPill bm={b} />;
      case "cadastro": {
        const c = canalPorBM[b.id];
        return c.pode
          ? <span className="text-xs font-medium" style={{ color: T.STATUS.ativa.fg }}>{c.limite - c.usados} vaga{c.limite - c.usados === 1 ? "" : "s"}</span>
          : <span className="inline-flex items-center gap-1 text-xs font-medium" style={{ color: T.STATUS.banida.fg }}><Ban size={12} /> {c.motivo}</span>;
      }
      case "qualidade": {
        const q = T.QUALIDADE[b.qualidade];
        return q ? <span className="inline-flex items-center gap-1.5 text-xs font-medium" style={{ color: q.fg }}><span className="w-1.5 h-1.5 rounded-full" style={{ background: q.fg }} />{q.label}</span> : "—";
      }
      case "dataCompra": case "dataConexao": return <span className="pg-tnum" style={{ color: T.inkSoft }}>{fmtData(b[id])}</span>;
      case "valor": return <span className="pg-tnum font-medium">{brl(b.valor)}</span>;
      case "observacoes": return <span className="block max-w-[200px] truncate" style={{ color: T.inkSoft }} title={b.observacoes}>{b.observacoes || "—"}</span>;
      default: return <span style={{ color: T.inkSoft }}>{b[id] || "—"}</span>;
    }
  };

  const tipInfo = tip ? modPorBM[tip.id]?.lista || [] : [];

  return (
    <div className="flex flex-col gap-5" style={{ "--pa-accent": T.primary, "--pa-hover": T.surfaceAlt }}>
      <AnimStyles />

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Kpi T={T} delay={0} label="Ativos exibidos" value={filtrados.length} sub={`de ${bms.length} no total`} icon={Boxes} onClick={limparTudo} />
        <Kpi T={T} delay={50} label="Ativas agora" value={contagem.ativa || 0} color={T.STATUS.ativa.fg} sub="clique para filtrar" active={F.status.length === 1 && F.status[0] === "ativa"} onClick={() => upd({ status: ["ativa"] })} />
        <Kpi T={T} delay={100} label="Com modelo cadastrado" value={comModelo} color={T.primary} icon={MessageSquare} bar={cobertura} sub={`${cobertura}% dos ativos`} active={F.modelo === "com"} onClick={() => upd({ modelo: F.modelo === "com" ? "todos" : "com" })} />
        <Kpi T={T} delay={150} label="Ativas sem modelo" value={ativasSemModelo} color={ativasSemModelo ? T.STATUS.em_recurso.fg : T.STATUS.ativa.fg} sub="precisam de cadastro" active={F.modelo === "sem" && F.status.includes("ativa")} onClick={() => upd({ modelo: "sem", status: ["ativa"] })} />
        <Kpi T={T} delay={200} label="Valor dos exibidos" value={valorExibido} fmt={brl} icon={Wallet} sub="soma do filtro atual" />
      </div>

      {/* barra de controle */}
      <div className="pa-fade rounded-xl border p-4 flex flex-col gap-4" style={{ background: T.surface, borderColor: T.borderSoft, animationDelay: "120ms" }}>
        {/* distribuição por status = filtro rápido */}
        <div className="flex flex-col gap-2.5">
          <div className="flex h-2 rounded-full overflow-hidden gap-0.5" style={{ background: T.borderSoft }}>
            {STATUS_ORDEM.map((k) => contagem[k] ? (
              <button key={k} title={`${T.STATUS[k].label}: ${contagem[k]}`} onClick={() => toggleStatus(k)} className="pa-bar h-full" style={{ width: mounted ? `${(contagem[k] / bms.length) * 100}%` : "0%", background: T.STATUS[k].fg, opacity: F.status.length && !F.status.includes(k) ? 0.22 : 1 }} />
            ) : null)}
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => upd({ status: [] })} className="pa-chip px-3 py-1 rounded-full text-xs font-medium" style={{ background: F.status.length === 0 ? T.primary : T.borderSoft, color: F.status.length === 0 ? "#fff" : T.inkSoft }}>
              Todos <span className="pg-mono ml-1 opacity-80">{bms.length}</span>
            </button>
            {STATUS_ORDEM.map((k) => {
              const on = F.status.includes(k);
              const fg = T.STATUS[k].fg;
              return (
                <button key={k} onClick={() => toggleStatus(k)} className="pa-chip px-3 py-1 rounded-full text-xs font-medium inline-flex items-center gap-1.5" style={{ background: on ? fg : rgba(fg, 0.1), color: on ? "#fff" : fg }}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: on ? "#fff" : fg }} />
                  {T.STATUS[k].label} <span className="pg-mono opacity-80">{contagem[k] || 0}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* busca + botões */}
        <div className="flex flex-col md:flex-row gap-2.5">
          <div className="flex-1 flex items-center gap-2 border rounded-lg px-3 py-2 transition-shadow focus-within:shadow-md" style={{ borderColor: T.border }}>
            <Search size={17} style={{ color: T.inkFaint }} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome, fornecedor, telefone ou tag…" className="w-full bg-transparent text-sm outline-none" style={{ color: T.ink }} />
            {search && <button onClick={() => setSearch("")}><X size={15} style={{ color: T.inkFaint }} /></button>}
          </div>

          <button onClick={() => setShowFiltros((s) => !s)} className="pa-chip px-3.5 py-2 rounded-lg text-sm font-medium border flex items-center justify-center gap-2" style={{ borderColor: showFiltros || nAvancados ? T.primary : T.border, color: showFiltros || nAvancados ? T.primary : T.ink, background: showFiltros ? T.primarySoft : "transparent" }}>
            <SlidersHorizontal size={16} /> Filtros
            {nAvancados > 0 && <span className="pg-mono text-[11px] px-1.5 rounded-full text-white" style={{ background: T.primary }}>{nAvancados}</span>}
          </button>

          <Dropdown T={T} align="right" width={250} renderTrigger={({ toggle }) => (
            <button onClick={toggle} className="pa-chip w-full px-3.5 py-2 rounded-lg text-sm font-medium border flex items-center justify-center gap-2" style={{ borderColor: T.border, color: T.ink }}>
              <Eye size={16} /> Colunas <span className="pg-mono text-[11px]" style={{ color: T.inkFaint }}>{cols.length}/{COLS.length}</span>
            </button>
          )}>
            <div className="p-2">
              <div className="flex items-center justify-between px-2 py-1.5 text-xs" style={{ color: T.inkSoft }}>
                <span className="font-semibold">Tópicos em amostragem</span>
                <span className="flex gap-2">
                  <button onClick={() => setVisible(COLS.map((c) => c.id))} className="underline" style={{ color: T.primary }}>Todas</button>
                  <button onClick={() => setVisible(COLS_PADRAO)} className="underline" style={{ color: T.primary }}>Padrão</button>
                </span>
              </div>
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
        </div>

        {/* painel de filtros avançados */}
        {showFiltros && (
          <div className="pa-fade grid sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t" style={{ borderColor: T.borderSoft }}>
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium" style={{ color: T.inkSoft }}>Fornecedor</span>
              <MultiSelect T={T} label="Fornecedores" options={fornecedores.map((f) => ({ value: f, label: f }))} value={F.fornecedor} onChange={(v) => upd({ fornecedor: v })} />
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium" style={{ color: T.inkSoft }}>Qualidade</span>
              <MultiSelect T={T} label="Qualidades" options={Object.entries(T.QUALIDADE).map(([k, v]) => ({ value: k, label: v.label }))} value={F.qualidade} onChange={(v) => upd({ qualidade: v })} />
            </div>
            <div className="flex flex-col gap-1.5 lg:col-span-2">
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
              <span className="text-xs font-medium" style={{ color: T.inkSoft }}>Modelo de mensagem</span>
              <Seg T={T} value={F.modelo} onChange={(v) => upd({ modelo: v })} options={[["todos", "Todos"], ["com", "Com"], ["sem", "Sem"]]} />
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium" style={{ color: T.inkSoft }}>Cadastro de novos modelos</span>
              <Seg T={T} value={F.cadastro} onChange={(v) => upd({ cadastro: v })} options={[["todos", "Todos"], ["pode", "Pode"], ["sem_vaga", "Sem vaga"]]} />
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium" style={{ color: T.inkSoft }}>Data de compra</span>
              <div className="flex items-center gap-1.5">
                <input type="date" value={F.compraDe} onChange={(e) => upd({ compraDe: e.target.value })} className={inputCls} style={inputStyleFor(T)} />
                <span className="text-xs" style={{ color: T.inkFaint }}>até</span>
                <input type="date" value={F.compraAte} onChange={(e) => upd({ compraAte: e.target.value })} className={inputCls} style={inputStyleFor(T)} />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium" style={{ color: T.inkSoft }}>Valor (R$)</span>
              <div className="flex items-center gap-1.5">
                <input type="number" placeholder="mín" value={F.valorMin} onChange={(e) => upd({ valorMin: e.target.value })} className={inputCls} style={inputStyleFor(T)} />
                <span className="text-xs" style={{ color: T.inkFaint }}>a</span>
                <input type="number" placeholder="máx" value={F.valorMax} onChange={(e) => upd({ valorMax: e.target.value })} className={inputCls} style={inputStyleFor(T)} />
              </div>
            </div>
          </div>
        )}

        {/* filtros ativos */}
        {chips.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 pt-3 border-t" style={{ borderColor: T.borderSoft }}>
            {chips.map((c) => (
              <button key={c.k} onClick={c.off} className="pa-chip pa-pop-in inline-flex items-center gap-1.5 pl-3 pr-2 py-1 rounded-full text-xs" style={{ background: T.primarySoft, color: T.primary }}>
                {c.l} <X size={12} />
              </button>
            ))}
            <button onClick={limparTudo} className="text-xs underline ml-1" style={{ color: T.inkSoft }}>Limpar tudo ({chips.length})</button>
          </div>
        )}
      </div>

      {/* resultado */}
      {filtrados.length === 0 ? (
        <div className="pa-fade rounded-xl border p-14 text-center flex flex-col items-center gap-3" style={{ background: T.surface, borderColor: T.borderSoft, color: T.inkFaint }}>
          <Search size={30} />
          <span className="text-sm">Nenhum ativo com os filtros aplicados.</span>
          {chips.length > 0 && <button onClick={limparTudo} className="px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ background: T.primary }}>Limpar filtros</button>}
        </div>
      ) : view === "tabela" ? (
        <div className="pa-fade rounded-xl border overflow-x-auto pg-scroll" style={{ background: T.surface, borderColor: T.borderSoft, animationDelay: "160ms" }}>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b" style={{ borderColor: T.borderSoft, color: T.inkSoft }}>
                <th className="p-4 w-10"><input type="checkbox" checked={todosSel} onChange={toggleTodos} style={{ accentColor: T.primary }} /></th>
                {cols.map((c) => (
                  <th key={c.id} onClick={() => setSort((s) => (s.key === c.id ? (s.dir === "asc" ? { key: c.id, dir: "desc" } : { key: null, dir: "asc" }) : { key: c.id, dir: "asc" }))} className={`pa-th p-4 font-medium whitespace-nowrap ${c.right ? "text-right" : ""}`} style={sort.key === c.id ? { color: T.primary } : undefined}>
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
              {mostrados.map((b, i) => (
                <tr key={b.id} className="pa-row pa-fade" style={{ animationDelay: `${Math.min(i, 14) * 28}ms`, background: sel.has(b.id) ? rgba(T.primary, 0.07) : undefined }}>
                  <td className="p-4"><input type="checkbox" checked={sel.has(b.id)} onChange={() => toggleSel(b.id)} style={{ accentColor: T.primary }} /></td>
                  {cols.map((c) => <td key={c.id} className={`p-4 ${c.right ? "text-right" : ""}`}>{cell(b, c.id)}</td>)}
                  <td className="p-4 text-right whitespace-nowrap">
                    <button onClick={() => onEdit(b)} className="pa-chip p-1.5 mr-1 rounded" style={{ color: T.primary }}><Pencil size={16} /></button>
                    <button onClick={() => onDelete(b.id, b.nome)} className="pa-chip p-1.5 rounded text-red-500"><Trash2 size={16} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
          {mostrados.map((b, i) => {
            const st = T.STATUS[b.status] || T.STATUS.estoque;
            return (
              <div key={b.id} className="pa-fade pa-lift relative overflow-hidden rounded-xl border p-4 pl-5 flex flex-col gap-3" style={{ background: T.surface, borderColor: sel.has(b.id) ? T.primary : T.borderSoft, animationDelay: `${Math.min(i, 14) * 35}ms` }}>
                <span className="absolute left-0 top-0 bottom-0 w-1" style={{ background: st.fg }} />
                <div className="flex items-start gap-2.5">
                  <input type="checkbox" checked={sel.has(b.id)} onChange={() => toggleSel(b.id)} className="mt-1" style={{ accentColor: T.primary }} />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm leading-snug">{b.nome}</div>
                    <div className="mt-1.5"><StatusPill status={b.status} T={T} /></div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1 min-h-[22px]">
                  {(b.tags || []).map((t) => <TagChip key={t} nome={t} cor={porNome[t]?.cor} T={T} />)}
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                  {[["Telefone", b.telefone || "—"], ["Fornecedor", b.fornecedor || "—"], ["Compra", fmtData(b.dataCompra)], ["Valor", brl(b.valor)]].map(([l, v]) => (
                    <div key={l} className="min-w-0"><div style={{ color: T.inkFaint }}>{l}</div><div className="truncate font-medium">{v}</div></div>
                  ))}
                </div>
                <div className="flex items-center justify-between pt-3 border-t" style={{ borderColor: T.borderSoft }}>
                  <ModeloPill bm={b} />
                  <span>
                    <button onClick={() => onEdit(b)} className="pa-chip p-1.5 mr-1 rounded" style={{ color: T.primary }}><Pencil size={16} /></button>
                    <button onClick={() => onDelete(b.id, b.nome)} className="pa-chip p-1.5 rounded text-red-500"><Trash2 size={16} /></button>
                  </span>
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

      {/* tooltip dos modelos (fora do container com scroll) */}
      {tip && tipInfo.length > 0 && (
        <div className="pa-pop-in fixed z-50 rounded-xl border shadow-xl p-3 w-72 pointer-events-none" style={{ left: Math.max(8, Math.min(tip.x, window.innerWidth - 296)), top: tip.above ? undefined : tip.y, bottom: tip.above ? window.innerHeight - tip.top : undefined, background: T.surface, borderColor: T.border, color: T.ink }}>
          <div className="text-xs font-semibold mb-2" style={{ color: T.inkSoft }}>Modelos cadastrados neste canal</div>
          <div className="flex flex-col gap-1.5">
            {tipInfo.slice(0, 8).map((m, i) => {
              const cfg = STATUS_MODELO[m.status] || STATUS_MODELO.IN_REVIEW;
              const fg = T.STATUS[cfg.tone].fg;
              return (
                <div key={i} className="flex items-center justify-between gap-3 text-xs">
                  <span className="pg-mono truncate">{m.nome}</span>
                  <span className="inline-flex items-center gap-1 shrink-0" style={{ color: fg }}><span className="w-1.5 h-1.5 rounded-full" style={{ background: fg }} />{cfg.label}</span>
                </div>
              );
            })}
            {tipInfo.length > 8 && <div className="text-[11px]" style={{ color: T.inkFaint }}>+{tipInfo.length - 8} outros</div>}
          </div>
        </div>
      )}

      {/* barra de ações em lote */}
      {sel.size > 0 && (
        <div className="pa-slide-up fixed bottom-6 left-1/2 -translate-x-1/2 z-40 rounded-2xl border shadow-2xl px-4 py-3 flex items-center gap-3 flex-wrap justify-center max-w-[94vw]" style={{ background: T.surface, borderColor: T.border, color: T.ink }}>
          <span className="text-sm font-medium"><span className="pg-mono">{sel.size}</span> selecionado{sel.size > 1 ? "s" : ""}</span>
          <span className="w-px h-5" style={{ background: T.border }} />
          <Dropdown T={T} up renderTrigger={({ toggle }) => (
            <button onClick={toggle} className="pa-chip px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5" style={{ background: T.primarySoft, color: T.primary }}><TagIcon size={14} /> Aplicar tag</button>
          )}>
            {({ close }) => (
              <div className="p-2 max-h-64 overflow-y-auto pg-scroll flex flex-col gap-1">
                {catalogo.length === 0 && <div className="p-3 text-xs" style={{ color: T.inkFaint }}>Crie tags na aba Tags.</div>}
                {catalogo.map((t) => (
                  <button key={t.id} onClick={() => { close(); lote((b) => ((b.tags || []).includes(t.nome) ? null : { tags: [...(b.tags || []), t.nome] }), `Tag "${t.nome}" aplicada`); }} className="text-left p-1 rounded-lg hover:opacity-80"><TagChip nome={t.nome} cor={t.cor} T={T} /></button>
                ))}
              </div>
            )}
          </Dropdown>
          <Dropdown T={T} up renderTrigger={({ toggle }) => (
            <button onClick={toggle} className="pa-chip px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5" style={{ background: T.borderSoft, color: T.inkSoft }}><X size={14} /> Remover tag</button>
          )}>
            {({ close }) => (
              <div className="p-2 max-h-64 overflow-y-auto pg-scroll flex flex-col gap-1">
                {catalogo.map((t) => (
                  <button key={t.id} onClick={() => { close(); lote((b) => ((b.tags || []).includes(t.nome) ? { tags: b.tags.filter((x) => x !== t.nome) } : null), `Tag "${t.nome}" removida`); }} className="text-left p-1 rounded-lg hover:opacity-80"><TagChip nome={t.nome} cor={t.cor} T={T} /></button>
                ))}
              </div>
            )}
          </Dropdown>
          <Dropdown T={T} up renderTrigger={({ toggle }) => (
            <button onClick={toggle} className="pa-chip px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5" style={{ background: T.borderSoft, color: T.inkSoft }}><Check size={14} /> Mudar status</button>
          )}>
            {({ close }) => (
              <div className="p-2 flex flex-col gap-1">
                {STATUS_ORDEM.map((k) => (
                  <button key={k} onClick={() => { close(); lote((b) => (b.status === k ? null : { status: k }), `Status → ${T.STATUS[k].label}`); }} className="text-left p-1 rounded-lg hover:opacity-80"><StatusPill status={k} T={T} /></button>
                ))}
              </div>
            )}
          </Dropdown>
          <button onClick={() => setSel(new Set())} className="text-xs underline" style={{ color: T.inkSoft }}>Limpar seleção</button>
        </div>
      )}
    </div>
  );
}
