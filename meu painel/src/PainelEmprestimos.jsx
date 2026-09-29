import React, { useState, useEffect, useMemo } from "react";
import {
  ArrowLeftRight, Plus, Search, X, Check, ChevronDown, ChevronUp,
  Download, LayoutGrid, List, SlidersHorizontal, Eye, Clock, AlertTriangle,
  CheckCircle2, Undo2, Smartphone,
} from "lucide-react";
import { db } from "./firebase";
import {
  collection, onSnapshot, doc, setDoc, deleteDoc, updateDoc,
} from "firebase/firestore";
import {
  AnimStyles, Dropdown, useCountUp, usePersistentState,
  rgba, inputCls, inputStyleFor, uid, fmtData,
} from "./painelShared";

/* =====================================================================
   PAINEL DE EMPRÉSTIMOS DE CHIPS
   - Coleção: "emprestimos"
   - Ao criar: chip vai para status "emprestado"
   - Ao devolver: grava dataDevolucaoReal e chip volta para "disponivel"
   - Sub-abas: Ativos | Histórico
   ===================================================================== */

const PRAZO_COR = {
  devolvido: "ativa",
  ok: "ativa",
  atencao: "em_recurso",
  hoje: "em_recurso",
  atrasado: "banida",
};

/* Calcula status do prazo (estilo Trello) */
export function getStatusPrazo(e) {
  if (e.dataDevolucaoReal) return { key: "devolvido", label: "Devolvido", dias: null };
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const prev = new Date((e.dataPrevistaDevolucao || "") + "T00:00:00");
  if (isNaN(prev.getTime())) return { key: "ok", label: "Sem prazo", dias: null };
  const dias = Math.round((prev - hoje) / 86400000);
  if (dias < 0) return { key: "atrasado", label: `Atrasado (${Math.abs(dias)}d)`, dias };
  if (dias === 0) return { key: "hoje", label: "Vence hoje", dias };
  if (dias <= 3) return { key: "atencao", label: `${dias}d restantes`, dias };
  return { key: "ok", label: `${dias}d restantes`, dias };
}

const F0 = { prazo: [], operador: [] };

function PrazoPill({ emp, T }) {
  const s = getStatusPrazo(emp);
  const cor = T.STATUS[PRAZO_COR[s.key]]?.fg || T.inkSoft;
  const Icon = s.key === "devolvido" ? CheckCircle2 : s.key === "atrasado" ? AlertTriangle : s.key === "hoje" || s.key === "atencao" ? Clock : Clock;
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap" style={{ background: rgba(cor, 0.12), color: cor }}>
      <Icon size={12} /> {s.label}
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

/* ---------------- modal: novo empréstimo ---------------- */
function EmprestarModal({ chips, T, onClose, onSave, chipsOcupados }) {
  const disponiveis = chips.filter((c) => c.status === "disponivel");
  const [chipId, setChipId] = useState(disponiveis[0]?.id || "");
  const [operadorNome, setOperadorNome] = useState("");
  const [dataEntrega, setDataEntrega] = useState(new Date().toISOString().split("T")[0]);
  const [dataPrevista, setDataPrevista] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 14);
    return d.toISOString().split("T")[0];
  });
  const [registradoPor, setRegistradoPor] = useState("");
  const [observacoes, setObservacoes] = useState("");

  const chipSel = chips.find((c) => c.id === chipId);

  const submit = (e) => {
    e.preventDefault();
    if (!chipId) return alert("Escolha um chip disponível.");
    if (!operadorNome.trim()) return alert("Informe o nome do operador.");
    if (!dataPrevista) return alert("Informe a data prevista de devolução.");
    onSave({
      chipId,
      numero: chipSel?.numero || "",
      operadorNome: operadorNome.trim(),
      dataEntrega,
      dataPrevistaDevolucao: dataPrevista,
      dataDevolucaoReal: null,
      observacoes,
      registradoPor: registradoPor.trim(),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: T.overlay }}>
      <div className="w-full max-w-lg rounded-xl border flex flex-col max-h-[92vh]" style={{ background: T.surface, color: T.ink, borderColor: T.border }}>
        <div className="flex items-center justify-between border-b px-6 py-4 shrink-0" style={{ borderColor: T.borderSoft }}>
          <h3 className="pg-font-display text-lg font-semibold">Novo empréstimo</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:opacity-70"><X size={20} /></button>
        </div>

        {disponiveis.length === 0 ? (
          <div className="p-6 flex flex-col gap-3">
            <div className="rounded-lg border p-4 flex items-start gap-3 text-sm" style={{ borderColor: T.STATUS.em_recurso.fg + "55", background: rgba(T.STATUS.em_recurso.fg, 0.06) }}>
              <AlertTriangle size={18} style={{ color: T.STATUS.em_recurso.fg }} className="shrink-0 mt-0.5" />
              <div>
                Nenhum chip disponível no momento.
                <div className="text-xs mt-1" style={{ color: T.inkSoft }}>Cadastre um chip na aba "Chips" ou devolva um emprestado antes.</div>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t" style={{ borderColor: T.borderSoft }}>
              <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ background: T.borderSoft, color: T.inkSoft }}>Fechar</button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-4 p-6 overflow-y-auto pg-scroll">
            <label className="pg-font-body block">
              <span className="block text-xs font-medium mb-1.5" style={{ color: T.inkSoft }}>Chip (somente disponíveis) *</span>
              <select value={chipId} onChange={(e) => setChipId(e.target.value)} className={inputCls} style={inputStyleFor(T)}>
                {disponiveis.map((c) => (
                  <option key={c.id} value={c.id}>{c.numero}{c.operadora ? ` — ${c.operadora}` : ""}</option>
                ))}
              </select>
            </label>

            <label className="pg-font-body block">
              <span className="block text-xs font-medium mb-1.5" style={{ color: T.inkSoft }}>Operador (quem vai usar) *</span>
              <input required value={operadorNome} onChange={(e) => setOperadorNome(e.target.value)} placeholder="Nome do operador" className={inputCls} style={inputStyleFor(T)} />
            </label>

            <div className="grid sm:grid-cols-2 gap-3">
              <label className="pg-font-body block">
                <span className="block text-xs font-medium mb-1.5" style={{ color: T.inkSoft }}>Data de entrega</span>
                <input type="date" value={dataEntrega} onChange={(e) => setDataEntrega(e.target.value)} className={inputCls} style={inputStyleFor(T)} />
              </label>
              <label className="pg-font-body block">
                <span className="block text-xs font-medium mb-1.5" style={{ color: T.inkSoft }}>Data prevista de devolução *</span>
                <input type="date" required value={dataPrevista} onChange={(e) => setDataPrevista(e.target.value)} className={inputCls} style={inputStyleFor(T)} />
              </label>
            </div>

            <label className="pg-font-body block">
              <span className="block text-xs font-medium mb-1.5" style={{ color: T.inkSoft }}>Registrado por</span>
              <input value={registradoPor} onChange={(e) => setRegistradoPor(e.target.value)} placeholder="Seu nome ou de quem entregou" className={inputCls} style={inputStyleFor(T)} />
            </label>

            <label className="pg-font-body block">
              <span className="block text-xs font-medium mb-1.5" style={{ color: T.inkSoft }}>Observações</span>
              <textarea rows={3} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} placeholder="Ex: uso para maturação, perfil X, etc." className={inputCls} style={inputStyleFor(T)} />
            </label>

            <div className="flex justify-end gap-3 border-t pt-4 mt-2" style={{ borderColor: T.borderSoft }}>
              <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ background: T.borderSoft, color: T.inkSoft }}>Cancelar</button>
              <button type="submit" className="px-5 py-2 rounded-lg text-sm font-medium text-white transition-shadow hover:shadow-lg" style={{ background: T.primary }}>Registrar empréstimo</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

/* ---------------- modal: devolver ---------------- */
function DevolverModal({ emp, chip, T, onClose, onSave }) {
  const [dataDevolucaoReal, setDataDevolucao] = useState(new Date().toISOString().split("T")[0]);
  const [observacoesDevolucao, setObs] = useState("");
  const [registradoPor, setRegistradoPor] = useState("");

  const submit = (e) => {
    e.preventDefault();
    onSave({ dataDevolucaoReal, observacoesDevolucao, registradoPor: registradoPor.trim() });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: T.overlay }}>
      <div className="w-full max-w-md rounded-xl border flex flex-col max-h-[92vh]" style={{ background: T.surface, color: T.ink, borderColor: T.border }}>
        <div className="flex items-center justify-between border-b px-6 py-4 shrink-0" style={{ borderColor: T.borderSoft }}>
          <h3 className="pg-font-display text-lg font-semibold">Registrar devolução</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:opacity-70"><X size={20} /></button>
        </div>
        <form onSubmit={submit} className="flex flex-col gap-4 p-6">
          <div className="rounded-lg p-3" style={{ background: T.surfaceAlt, border: `1px solid ${T.borderSoft}` }}>
            <div className="text-xs" style={{ color: T.inkFaint }}>Chip</div>
            <div className="pg-mono text-sm font-semibold">{emp.numero || chip?.numero || "—"}</div>
            <div className="text-xs mt-1" style={{ color: T.inkSoft }}>Operador: <b>{emp.operadorNome}</b></div>
            <div className="text-xs" style={{ color: T.inkSoft }}>Entrega: {fmtData(emp.dataEntrega)} · Previsto: {fmtData(emp.dataPrevistaDevolucao)}</div>
          </div>

          <label className="pg-font-body block">
            <span className="block text-xs font-medium mb-1.5" style={{ color: T.inkSoft }}>Data da devolução *</span>
            <input type="date" required value={dataDevolucaoReal} onChange={(e) => setDataDevolucao(e.target.value)} className={inputCls} style={inputStyleFor(T)} />
          </label>

          <label className="pg-font-body block">
            <span className="block text-xs font-medium mb-1.5" style={{ color: T.inkSoft }}>Registrado por</span>
            <input value={registradoPor} onChange={(e) => setRegistradoPor(e.target.value)} placeholder="Seu nome" className={inputCls} style={inputStyleFor(T)} />
          </label>

          <label className="pg-font-body block">
            <span className="block text-xs font-medium mb-1.5" style={{ color: T.inkSoft }}>Observações da devolução</span>
            <textarea rows={3} value={observacoesDevolucao} onChange={(e) => setObs(e.target.value)} placeholder="Ex: chip em bom estado, sem uso, etc." className={inputCls} style={inputStyleFor(T)} />
          </label>

          <div className="flex justify-end gap-3 border-t pt-4 mt-2" style={{ borderColor: T.borderSoft }}>
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ background: T.borderSoft, color: T.inkSoft }}>Cancelar</button>
            <button type="submit" className="px-5 py-2 rounded-lg text-sm font-medium text-white transition-shadow hover:shadow-lg" style={{ background: T.STATUS.ativa.fg }}>
              Confirmar devolução
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* =====================================================================
   COMPONENTE PRINCIPAL
   ===================================================================== */
export default function PainelEmprestimos({ T, registrarHistorico, chips, loading }) {
  const [emprestimos, setEmprestimos] = useState([]);
  const [loadingEmp, setLoadingEmp] = useState(true);
  const [sub, setSub] = useState("ativos"); // ativos | historico
  const [search, setSearch] = useState("");
  const [F, setF] = useState(F0);
  const [showFiltros, setShowFiltros] = useState(false);
  const [sort, setSort] = useState({ key: "dataPrevistaDevolucao", dir: "asc" });
  const [view, setView] = usePersistentState("wa_view_emprestimos", "tabela");
  const [limite, setLimite] = useState(60);
  const [modalOpen, setModalOpen] = useState(false);
  const [devolvendo, setDevolvendo] = useState(null);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "emprestimos"), (snap) => {
      setEmprestimos(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoadingEmp(false);
    }, (e) => { console.error("Erro emprestimos:", e); setLoadingEmp(false); });
    return () => unsub();
  }, []);

  const upd = (patch) => setF((f) => ({ ...f, ...patch }));

  const chipsPorId = useMemo(() => Object.fromEntries(chips.map((c) => [c.id, c])), [chips]);

  const ativos = useMemo(() => emprestimos.filter((e) => !e.dataDevolucaoReal), [emprestimos]);
  const historico = useMemo(() => emprestimos.filter((e) => e.dataDevolucaoReal), [emprestimos]);

  const contagemPrazo = useMemo(() => {
    const c = { ok: 0, atencao: 0, hoje: 0, atrasado: 0 };
    ativos.forEach((e) => { const s = getStatusPrazo(e); if (c[s.key] !== undefined) c[s.key]++; });
    return c;
  }, [ativos]);

  const devolvidosMes = useMemo(() => {
    const mes = new Date().toISOString().slice(0, 7);
    return historico.filter((e) => (e.dataDevolucaoReal || "").startsWith(mes)).length;
  }, [historico]);

  const base = sub === "ativos" ? ativos : historico;

  const operadores = useMemo(
    () => Array.from(new Set(emprestimos.map((e) => e.operadorNome).filter(Boolean))).sort(),
    [emprestimos]
  );

  const filtrados = useMemo(() => {
    const q = search.trim().toLowerCase();
    let r = base.filter((e) => {
      if (q && !`${e.numero} ${e.operadorNome || ""} ${e.observacoes || ""} ${e.registradoPor || ""}`.toLowerCase().includes(q)) return false;
      if (F.operador.length && !F.operador.includes(e.operadorNome)) return false;
      if (sub === "ativos" && F.prazo.length) {
        const s = getStatusPrazo(e);
        if (!F.prazo.includes(s.key)) return false;
      }
      return true;
    });
    if (sort.key) {
      const val = (e) => {
        if (sort.key === "prazo") {
          const s = getStatusPrazo(e);
          return s.dias === null ? 99999 : s.dias;
        }
        return String(e[sort.key] || "").toLowerCase();
      };
      r = [...r].sort((a, b) => { const x = val(a), y = val(b); return (x > y ? 1 : x < y ? -1 : 0) * (sort.dir === "asc" ? 1 : -1); });
    }
    return r;
  }, [base, search, F, sort, sub]);

  const mostrados = filtrados.slice(0, limite);

  const chipsFiltros = [];
  F.operador.forEach((s) => chipsFiltros.push({ k: "o" + s, l: `Operador: ${s}`, off: () => upd({ operador: F.operador.filter((x) => x !== s) }) }));
  F.prazo.forEach((s) => chipsFiltros.push({ k: "p" + s, l: `Prazo: ${s}`, off: () => upd({ prazo: F.prazo.filter((x) => x !== s) }) }));
  if (search) chipsFiltros.push({ k: "b", l: `Busca: "${search}"`, off: () => setSearch("") });

  const limparTudo = () => { setF(F0); setSearch(""); };

  const registrarEmprestimo = async (data) => {
    const id = uid();
    const payload = {
      ...data,
      id,
      criadoEm: new Date().toISOString(),
      atualizadoEm: new Date().toISOString(),
    };
    await setDoc(doc(db, "emprestimos", id), payload);
    await setDoc(doc(db, "chips", data.chipId), { status: "emprestado", atualizadoEm: new Date().toISOString() }, { merge: true });
    await registrarHistorico?.("Novo Empréstimo", `Chip ${data.numero} emprestado para "${data.operadorNome}" · previsto ${fmtData(data.dataPrevistaDevolucao)}`);
    setModalOpen(false);
  };

  const registrarDevolucao = async (emp, { dataDevolucaoReal, observacoesDevolucao, registradoPor }) => {
    await setDoc(doc(db, "emprestimos", emp.id), {
      dataDevolucaoReal,
      observacoesDevolucao: observacoesDevolucao || "",
      devolvidoPor: registradoPor || "",
      atualizadoEm: new Date().toISOString(),
    }, { merge: true });
    if (emp.chipId) {
      await setDoc(doc(db, "chips", emp.chipId), { status: "disponivel", atualizadoEm: new Date().toISOString() }, { merge: true });
    }
    await registrarHistorico?.("Devolução de Chip", `Chip ${emp.numero} devolvido por "${emp.operadorNome}" em ${fmtData(dataDevolucaoReal)}`);
    setDevolvendo(null);
  };

  const removerEmprestimo = async (emp) => {
    if (!confirm(`Remover o registro de empréstimo do chip "${emp.numero}"? Isso NÃO altera o status do chip.`)) return;
    await deleteDoc(doc(db, "emprestimos", emp.id));
    await registrarHistorico?.("Exclusão de Empréstimo", `Registro do chip ${emp.numero} (operador ${emp.operadorNome}) removido`);
  };

  const exportarCSV = () => {
    const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const header = ["numero", "operadorNome", "dataEntrega", "dataPrevistaDevolucao", "dataDevolucaoReal", "prazo", "registradoPor", "observacoes", "observacoesDevolucao"];
    const linhas = [
      header.map(esc).join(";"),
      ...filtrados.map((e) => {
        const s = getStatusPrazo(e);
        return [
          e.numero, e.operadorNome, e.dataEntrega || "", e.dataPrevistaDevolucao || "",
          e.dataDevolucaoReal || "", s.label, e.registradoPor || "", e.observacoes || "", e.observacoesDevolucao || "",
        ].map(esc).join(";");
      }),
    ];
    const blob = new Blob(["\uFEFF" + linhas.join("\n")], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `emprestimos_${sub}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  if (loading || loadingEmp) {
    return <div className="p-10 text-center text-sm" style={{ color: T.inkFaint }}>Carregando empréstimos…</div>;
  }

  return (
    <div className="flex flex-col gap-5" style={{ "--pa-accent": T.primary, "--pa-hover": T.surfaceAlt }}>
      <AnimStyles />

      <div className="pa-fade flex items-center justify-between flex-wrap gap-3">
        <div className="inline-flex p-1 rounded-lg border" style={{ borderColor: T.border, background: T.surface }}>
          {[
            { id: "ativos", label: "Ativos", count: ativos.length },
            { id: "historico", label: "Histórico", count: historico.length },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => { setSub(t.id); setSort(t.id === "ativos" ? { key: "dataPrevistaDevolucao", dir: "asc" } : { key: "dataDevolucaoReal", dir: "desc" }); }}
              className="px-4 py-1.5 rounded-md text-sm transition-colors inline-flex items-center gap-2"
              style={{ background: sub === t.id ? T.primary : "transparent", color: sub === t.id ? "#fff" : T.inkSoft, fontWeight: sub === t.id ? 600 : 500 }}
            >
              {t.label}
              <span className="pg-mono text-[11px] px-1.5 rounded-full" style={{ background: sub === t.id ? "rgba(255,255,255,0.2)" : T.borderSoft, color: sub === t.id ? "#fff" : T.inkSoft }}>{t.count}</span>
            </button>
          ))}
        </div>
        <button onClick={() => setModalOpen(true)} className="pa-chip px-4 py-2 rounded-lg text-sm font-medium text-white flex items-center gap-2 transition-shadow hover:shadow-lg" style={{ background: T.primary }}>
          <Plus size={16} /> Novo empréstimo
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi T={T} delay={0} label="Empréstimos ativos" value={ativos.length} icon={ArrowLeftRight} onClick={limparTudo} />
        <Kpi T={T} delay={50} label="Vencem em até 3 dias" value={contagemPrazo.atencao + contagemPrazo.hoje} color={T.STATUS.em_recurso.fg} icon={Clock} active={F.prazo.includes("atencao") || F.prazo.includes("hoje")} onClick={() => upd({ prazo: ["atencao", "hoje"] })} />
        <Kpi T={T} delay={100} label="Atrasados" value={contagemPrazo.atrasado} color={contagemPrazo.atrasado ? T.STATUS.banida.fg : undefined} icon={AlertTriangle} active={F.prazo.length === 1 && F.prazo[0] === "atrasado"} onClick={() => upd({ prazo: ["atrasado"] })} />
        <Kpi T={T} delay={150} label="Devolvidos neste mês" value={devolvidosMes} color={T.STATUS.ativa.fg} icon={CheckCircle2} />
      </div>

      <div className="pa-fade rounded-xl border p-4 flex flex-col gap-4" style={{ background: T.surface, borderColor: T.borderSoft, animationDelay: "120ms" }}>
        <div className="flex flex-col md:flex-row gap-2.5">
          <div className="flex-1 flex items-center gap-2 border rounded-lg px-3 py-2 transition-shadow focus-within:shadow-md" style={{ borderColor: T.border }}>
            <Search size={17} style={{ color: T.inkFaint }} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por número, operador, observações…" className="w-full bg-transparent text-sm outline-none" style={{ color: T.ink }} />
            {search && <button onClick={() => setSearch("")}><X size={15} style={{ color: T.inkFaint }} /></button>}
          </div>

          <button onClick={() => setShowFiltros((s) => !s)} className="pa-chip px-3.5 py-2 rounded-lg text-sm font-medium border flex items-center justify-center gap-2" style={{ borderColor: showFiltros || chipsFiltros.length ? T.primary : T.border, color: showFiltros || chipsFiltros.length ? T.primary : T.ink, background: showFiltros ? T.primarySoft : "transparent" }}>
            <SlidersHorizontal size={16} /> Filtros
            {chipsFiltros.length > 0 && <span className="pg-mono text-[11px] px-1.5 rounded-full text-white" style={{ background: T.primary }}>{chipsFiltros.length}</span>}
          </button>

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

        {showFiltros && (
          <div className="pa-fade grid sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-4 border-t" style={{ borderColor: T.borderSoft }}>
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium" style={{ color: T.inkSoft }}>Operador</span>
              <MultiSelect T={T} label="Operadores" options={operadores.map((o) => ({ value: o, label: o }))} value={F.operador} onChange={(v) => upd({ operador: v })} />
            </div>
            {sub === "ativos" && (
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-medium" style={{ color: T.inkSoft }}>Prazo</span>
                <MultiSelect
                  T={T}
                  label="Prazos"
                  options={[
                    { value: "ok", label: "Em dia" },
                    { value: "atencao", label: "Vence em até 3 dias" },
                    { value: "hoje", label: "Vence hoje" },
                    { value: "atrasado", label: "Atrasado" },
                  ]}
                  value={F.prazo}
                  onChange={(v) => upd({ prazo: v })}
                />
              </div>
            )}
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
          <ArrowLeftRight size={30} />
          <span className="text-sm">
            {base.length === 0
              ? (sub === "ativos" ? "Nenhum empréstimo ativo no momento." : "Nenhum empréstimo devolvido ainda.")
              : "Nenhum empréstimo com os filtros aplicados."}
          </span>
          {sub === "ativos" && base.length === 0 && chips.some((c) => c.status === "disponivel") && (
            <button onClick={() => setModalOpen(true)} className="px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ background: T.primary }}>
              Registrar primeiro empréstimo
            </button>
          )}
        </div>
      ) : view === "tabela" ? (
        <div className="pa-fade rounded-xl border overflow-x-auto pg-scroll" style={{ background: T.surface, borderColor: T.borderSoft, animationDelay: "160ms" }}>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b" style={{ borderColor: T.borderSoft, color: T.inkSoft }}>
                <th className="pa-th p-4 font-medium whitespace-nowrap" onClick={() => setSort((s) => (s.key === "numero" ? { key: "numero", dir: s.dir === "asc" ? "desc" : "asc" } : { key: "numero", dir: "asc" }))}>
                  <span className="inline-flex items-center gap-1">Chip {sort.key === "numero" && (sort.dir === "asc" ? <ChevronUp size={13} /> : <ChevronDown size={13} />)}</span>
                </th>
                <th className="p-4 font-medium">Operador</th>
                <th className="p-4 font-medium whitespace-nowrap">Entrega</th>
                <th className="p-4 font-medium whitespace-nowrap">
                  {sub === "ativos" ? "Previsto" : "Devolvido"}
                </th>
                <th className="pa-th p-4 font-medium whitespace-nowrap" onClick={() => setSort((s) => (s.key === "prazo" ? { key: "prazo", dir: s.dir === "asc" ? "desc" : "asc" } : { key: "prazo", dir: "asc" }))}>
                  <span className="inline-flex items-center gap-1">Prazo {sort.key === "prazo" && (sort.dir === "asc" ? <ChevronUp size={13} /> : <ChevronDown size={13} />)}</span>
                </th>
                <th className="p-4 font-medium">Registrado por</th>
                <th className="p-4 text-right font-medium">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: T.borderSoft }}>
              {mostrados.map((e, i) => (
                <tr key={e.id} className="pa-row pa-fade" style={{ animationDelay: `${Math.min(i, 14) * 28}ms` }}>
                  <td className="p-4 pg-mono font-medium">{e.numero || chipsPorId[e.chipId]?.numero || "—"}</td>
                  <td className="p-4 font-medium">{e.operadorNome}</td>
                  <td className="p-4 pg-tnum" style={{ color: T.inkSoft }}>{fmtData(e.dataEntrega)}</td>
                  <td className="p-4 pg-tnum" style={{ color: T.inkSoft }}>
                    {sub === "ativos" ? fmtData(e.dataPrevistaDevolucao) : fmtData(e.dataDevolucaoReal)}
                  </td>
                  <td className="p-4"><PrazoPill emp={e} T={T} /></td>
                  <td className="p-4" style={{ color: T.inkSoft }}>{e.registradoPor || "—"}</td>
                  <td className="p-4 text-right whitespace-nowrap">
                    {sub === "ativos" ? (
                      <button onClick={() => setDevolvendo(e)} className="pa-chip px-3 py-1.5 rounded-lg text-xs font-medium inline-flex items-center gap-1.5" style={{ background: rgba(T.STATUS.ativa.fg, 0.12), color: T.STATUS.ativa.fg }}>
                        <Undo2 size={13} /> Devolver
                      </button>
                    ) : (
                      <button onClick={() => removerEmprestimo(e)} className="pa-chip p-1.5 rounded text-red-500" title="Remover registro"><X size={16} /></button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
          {mostrados.map((e, i) => {
            const s = getStatusPrazo(e);
            const cor = T.STATUS[PRAZO_COR[s.key]]?.fg || T.inkSoft;
            return (
              <div key={e.id} className="pa-fade pa-lift relative overflow-hidden rounded-xl border p-4 pl-5 flex flex-col gap-3" style={{ background: T.surface, borderColor: T.borderSoft, animationDelay: `${Math.min(i, 14) * 35}ms` }}>
                <span className="absolute left-0 top-0 bottom-0 w-1" style={{ background: cor }} />
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="pg-mono text-sm font-semibold truncate">{e.numero || chipsPorId[e.chipId]?.numero || "—"}</div>
                    <div className="text-xs mt-0.5" style={{ color: T.inkSoft }}>{e.operadorNome}</div>
                    <div className="mt-1.5"><PrazoPill emp={e} T={T} /></div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                  <div><div style={{ color: T.inkFaint }}>Entrega</div><div className="pg-tnum font-medium">{fmtData(e.dataEntrega)}</div></div>
                  <div><div style={{ color: T.inkFaint }}>{sub === "ativos" ? "Previsto" : "Devolvido"}</div><div className="pg-tnum font-medium">{sub === "ativos" ? fmtData(e.dataPrevistaDevolucao) : fmtData(e.dataDevolucaoReal)}</div></div>
                  {e.registradoPor && <div className="col-span-2"><div style={{ color: T.inkFaint }}>Registrado por</div><div className="font-medium truncate">{e.registradoPor}</div></div>}
                </div>
                {(e.observacoes || e.observacoesDevolucao) && (
                  <div className="text-xs line-clamp-2" style={{ color: T.inkSoft }} title={e.observacoes || e.observacoesDevolucao}>
                    {e.observacoes || e.observacoesDevolucao}
                  </div>
                )}
                <div className="flex items-center justify-end gap-1 pt-3 border-t" style={{ borderColor: T.borderSoft }}>
                  {sub === "ativos" ? (
                    <button onClick={() => setDevolvendo(e)} className="pa-chip px-3 py-1.5 rounded-lg text-xs font-medium inline-flex items-center gap-1.5" style={{ background: rgba(T.STATUS.ativa.fg, 0.12), color: T.STATUS.ativa.fg }}>
                      <Undo2 size={13} /> Devolver
                    </button>
                  ) : (
                    <button onClick={() => removerEmprestimo(e)} className="pa-chip p-1.5 rounded text-red-500" title="Remover registro"><X size={16} /></button>
                  )}
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

      {modalOpen && (
        <EmprestarModal
          chips={chips}
          T={T}
          onClose={() => setModalOpen(false)}
          onSave={registrarEmprestimo}
        />
      )}

      {devolvendo && (
        <DevolverModal
          emp={devolvendo}
          chip={chipsPorId[devolvendo.chipId]}
          T={T}
          onClose={() => setDevolvendo(null)}
          onSave={(payload) => registrarDevolucao(devolvendo, payload)}
        />
      )}
    </div>
  );
}
