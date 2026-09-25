import React, { useState, useEffect, useMemo } from "react";
import {
  Building2, Plus, Search, X, Pencil, Trash2, Check, ChevronDown,
  Phone, MessageSquare, Send, Star, LayoutGrid, List,
  DollarSign, Hash, AlertTriangle, Filter, Package, Boxes,
} from "lucide-react";
import { db } from "./firebase";
import {
  collection, onSnapshot, doc, setDoc, deleteDoc,
} from "firebase/firestore";
import {
  AnimStyles, TagChip, Dropdown, useCountUp, usePersistentState, useTagsCatalog,
  brl, rgba, inputCls, inputStyleFor, uid, isDarkT,
} from "./painelShared";

/* =====================================================================
   PAINEL DE FORNECEDORES — versão cards
   - Coleção Firestore: "fornecedores"
   - Campos: id, nome, contato, tipoContato, avaliacao, observacoes, tags
   - Estatísticas cruzadas com "bms" e "telefonia"
   props: bms, numeros (opcional), T, registrarHistorico
   ===================================================================== */

const TIPOS_CONTATO = {
  whatsapp: { label: "WhatsApp", icon: MessageSquare, cor: "#25D366" },
  telegram: { label: "Telegram", icon: Send, cor: "#229ED9" },
  telefone: { label: "Telefone", icon: Phone, cor: "#57667A" },
  outro: { label: "Outro", icon: Building2, cor: "#96A3B3" },
};

/* Detecta automaticamente o tipo de contato pelo conteúdo do campo */
function detectarTipoContato(contato) {
  if (!contato) return "outro";
  const c = String(contato).trim();
  if (c.startsWith("@")) return "telegram";
  if (c.includes("t.me") || c.toLowerCase().includes("telegram")) return "telegram";
  if (c.includes("wa.me") || c.toLowerCase().includes("whats")) return "whatsapp";
  // Se for só dígitos/símbolos de telefone → assume whatsapp (padrão comum)
  const somenteDigitos = c.replace(/\D/g, "");
  if (somenteDigitos.length >= 10) return "whatsapp";
  return "outro";
}

/* Monta o link clicável conforme o tipo */
function linkDoContato(contato, tipo) {
  if (!contato) return null;
  const c = String(contato).trim();
  if (tipo === "telegram") {
    const handle = c.startsWith("@") ? c.slice(1) : c;
    return `https://t.me/${handle}`;
  }
  if (tipo === "whatsapp") {
    const digits = c.replace(/\D/g, "");
    if (digits.length >= 10) return `https://wa.me/${digits.startsWith("55") ? digits : "55" + digits}`;
  }
  if (tipo === "telefone") {
    const digits = c.replace(/\D/g, "");
    if (digits) return `tel:${digits}`;
  }
  return null;
}

/* Estrelas clicáveis */
function Estrelas({ value, onChange, T, size = 15, readOnly }) {
  const [hover, setHover] = useState(0);
  const v = hover || value || 0;
  return (
    <div className="inline-flex items-center gap-0.5" onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={readOnly}
          onMouseEnter={() => !readOnly && setHover(n)}
          onClick={(e) => { e.stopPropagation(); if (!readOnly) onChange?.(n === value ? 0 : n); }}
          className={readOnly ? "" : "pa-chip"}
          style={{ color: n <= v ? "#E3BA6C" : T.borderSoft, cursor: readOnly ? "default" : "pointer", lineHeight: 0 }}
          title={readOnly ? `${value}/5` : `Avaliar ${n}/5`}
        >
          <Star size={size} fill={n <= v ? "#E3BA6C" : "none"} />
        </button>
      ))}
    </div>
  );
}

/* Avatar com iniciais */
function Avatar({ nome, T, size = 44 }) {
  const iniciais = (nome || "?")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
  // Cor determinística a partir do nome
  const hash = (nome || "").split("").reduce((s, c) => s + c.charCodeAt(0), 0);
  const cores = ["#0B4C82", "#1F7A4D", "#7A3FA0", "#A3402B", "#0E7C86", "#B8862F", "#C23B6B", "#57667A"];
  const cor = cores[hash % cores.length];
  return (
    <div
      className="rounded-xl flex items-center justify-center shrink-0 pg-font-display font-bold text-white"
      style={{ width: size, height: size, background: cor, fontSize: size * 0.36 }}
    >
      {iniciais}
    </div>
  );
}

/* KPI do topo */
function Kpi({ label, value, fmt, color, icon: Icon, delay, T, sub }) {
  const v = useCountUp(value, 800);
  const c = color || T.primary;
  return (
    <div className="pa-fade rounded-xl border p-4 flex flex-col gap-1.5" style={{ background: T.surface, borderColor: T.borderSoft, animationDelay: `${delay}ms` }}>
      <div className="flex items-center justify-between text-xs" style={{ color: T.inkSoft }}>
        <span>{label}</span>
        {Icon && <Icon size={15} style={{ color: c }} />}
      </div>
      <div className="pg-mono text-2xl font-semibold" style={{ color: c }}>{fmt ? fmt(v) : Math.round(v)}</div>
      {sub && <div className="text-[11px]" style={{ color: T.inkFaint }}>{sub}</div>}
    </div>
  );
}

/* ---------------- Modal de cadastro/edição ---------------- */
function FornecedorModal({ initial, T, onClose, onSave }) {
  const { tags: catalogo, porNome } = useTagsCatalog();
  const [f, setF] = useState(() => ({
    id: "",
    nome: "",
    contato: "",
    tipoContato: "whatsapp",
    avaliacao: 0,
    observacoes: "",
    tags: [],
    ...initial,
  }));
  const [auto, setAuto] = useState(!initial); // auto-detectar enquanto digita (só em novo)
  const set = (k, v) => setF((prev) => ({ ...prev, [k]: v }));

  const contatoTipoSugerido = useMemo(() => detectarTipoContato(f.contato), [f.contato]);
  useEffect(() => {
    if (auto && contatoTipoSugerido !== f.tipoContato) set("tipoContato", contatoTipoSugerido);
  }, [auto, contatoTipoSugerido]);

  const submit = (e) => {
    e.preventDefault();
    if (!f.nome.trim()) return alert("Informe o nome.");
    onSave(f);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: T.overlay }}>
      <div className="w-full max-w-2xl rounded-xl border flex flex-col max-h-[92vh]" style={{ background: T.surface, color: T.ink, borderColor: T.border }}>
        <div className="flex items-center justify-between border-b px-6 py-4 shrink-0" style={{ borderColor: T.borderSoft }}>
          <h3 className="pg-font-display text-lg font-semibold">{initial?.id ? "Editar fornecedor" : "Novo fornecedor"}</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:opacity-70"><X size={20} /></button>
        </div>

        <form onSubmit={submit} className="flex flex-col gap-4 p-6 overflow-y-auto pg-scroll">
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="pg-font-body block">
              <span className="block text-xs font-medium mb-1.5" style={{ color: T.inkSoft }}>Nome / Empresa *</span>
              <input required value={f.nome} onChange={(e) => set("nome", e.target.value)} placeholder="Ex: Falcon Corporation" className={inputCls} style={inputStyleFor(T)} />
            </label>
            <label className="pg-font-body block">
              <span className="block text-xs font-medium mb-1.5" style={{ color: T.inkSoft }}>Contato</span>
              <input value={f.contato} onChange={(e) => set("contato", e.target.value)} placeholder="(00) 00000-0000 ou @usuario" className={inputCls} style={inputStyleFor(T)} />
            </label>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div className="pg-font-body block">
              <span className="block text-xs font-medium mb-1.5" style={{ color: T.inkSoft }}>Tipo de contato</span>
              <div className="inline-flex p-0.5 rounded-lg border w-full" style={{ borderColor: T.border, background: T.surface }}>
                {Object.entries(TIPOS_CONTATO).map(([k, v]) => {
                  const Icon = v.icon;
                  const on = f.tipoContato === k;
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => { setAuto(false); set("tipoContato", k); }}
                      className="flex-1 px-2 py-1.5 rounded-md text-xs transition-colors inline-flex items-center justify-center gap-1.5"
                      style={{ background: on ? v.cor : "transparent", color: on ? "#fff" : T.inkSoft, fontWeight: on ? 600 : 500 }}
                      title={v.label}
                    >
                      <Icon size={13} />
                      <span className="hidden sm:inline">{v.label}</span>
                    </button>
                  );
                })}
              </div>
              {auto && contatoTipoSugerido !== f.tipoContato && (
                <div className="text-[11px] mt-1.5" style={{ color: T.inkFaint }}>Detectado automaticamente pelo contato.</div>
              )}
            </div>
            <div className="pg-font-body block">
              <span className="block text-xs font-medium mb-1.5" style={{ color: T.inkSoft }}>Avaliação</span>
              <Estrelas value={f.avaliacao || 0} onChange={(n) => set("avaliacao", n)} T={T} size={22} />
            </div>
          </div>

          <div>
            <span className="block text-xs font-medium mb-1.5" style={{ color: T.inkSoft }}>Tags</span>
            <div className="flex flex-wrap gap-1.5 mb-2 min-h-[26px]">
              {(f.tags || []).length === 0 && <span className="text-xs" style={{ color: T.inkFaint }}>Nenhuma tag.</span>}
              {(f.tags || []).map((t) => (
                <TagChip key={t} nome={t} cor={porNome[t]?.cor} T={T} onRemove={() => set("tags", (f.tags || []).filter((x) => x !== t))} />
              ))}
            </div>
            <Dropdown T={T} width={240} renderTrigger={({ toggle }) => (
              <button type="button" onClick={toggle} className="px-3 py-1.5 rounded-lg text-xs font-medium border inline-flex items-center gap-1.5" style={{ borderColor: T.border, color: T.inkSoft }}>
                Adicionar tag
              </button>
            )}>
              {({ close }) => (
                <div className="p-2 max-h-64 overflow-y-auto pg-scroll flex flex-col gap-1">
                  {catalogo.length === 0 && <div className="p-3 text-xs" style={{ color: T.inkFaint }}>Crie tags na aba Tags.</div>}
                  {catalogo.filter((t) => !(f.tags || []).includes(t.nome)).map((t) => (
                    <button key={t.id} type="button" onClick={() => { set("tags", [...(f.tags || []), t.nome]); close(); }} className="text-left p-1 rounded-lg hover:opacity-80">
                      <TagChip nome={t.nome} cor={t.cor} T={T} />
                    </button>
                  ))}
                </div>
              )}
            </Dropdown>
          </div>

          <label className="pg-font-body block">
            <span className="block text-xs font-medium mb-1.5" style={{ color: T.inkSoft }}>Observações</span>
            <textarea rows={3} value={f.observacoes} onChange={(e) => set("observacoes", e.target.value)} placeholder="Anotações internas sobre este fornecedor…" className={inputCls} style={inputStyleFor(T)} />
          </label>

          <div className="flex justify-end gap-3 border-t pt-4 mt-2" style={{ borderColor: T.borderSoft }}>
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ background: T.borderSoft, color: T.inkSoft }}>Cancelar</button>
            <button type="submit" className="px-5 py-2 rounded-lg text-sm font-medium text-white transition-shadow hover:shadow-lg" style={{ background: T.primary }}>Salvar fornecedor</button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ---------------- Card ---------------- */
function FornecedorCard({ f, stats, T, onEdit, onDelete, onAvaliar, idx, porNome }) {
  const tipo = TIPOS_CONTATO[f.tipoContato] || TIPOS_CONTATO.outro;
  const Icon = tipo.icon;
  const link = linkDoContato(f.contato, f.tipoContato);

  return (
    <div
      className="pa-fade pa-lift relative overflow-hidden rounded-xl border p-5 flex flex-col gap-4"
      style={{ background: T.surface, borderColor: T.borderSoft, animationDelay: `${Math.min(idx, 12) * 35}ms` }}
    >
      {/* Faixa lateral colorida pelo tipo de contato */}
      <span className="absolute left-0 top-0 bottom-0 w-1" style={{ background: tipo.cor }} />

      <div className="flex items-start gap-3">
        <Avatar nome={f.nome} T={T} />
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm leading-snug truncate">{f.nome}</div>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium" style={{ background: rgba(tipo.cor, 0.14), color: tipo.cor }}>
              <Icon size={11} />
              {tipo.label}
            </span>
            {f.contato && (
              link ? (
                <a
                  href={link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs pg-mono hover:underline"
                  style={{ color: T.primary }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {f.contato}
                </a>
              ) : (
                <span className="text-xs pg-mono" style={{ color: T.inkSoft }}>{f.contato}</span>
              )
            )}
          </div>
        </div>
        <div className="flex gap-1 shrink-0">
          <button onClick={() => onEdit(f)} className="pa-chip p-1.5 rounded" style={{ color: T.primary }} title="Editar"><Pencil size={15} /></button>
          <button onClick={() => onDelete(f)} className="pa-chip p-1.5 rounded text-red-500" title="Excluir"><Trash2 size={15} /></button>
        </div>
      </div>

      <div>
        <Estrelas value={f.avaliacao || 0} onChange={(n) => onAvaliar(f, n)} T={T} />
      </div>

      <div className="grid grid-cols-3 gap-3 pt-3 border-t" style={{ borderColor: T.borderSoft }}>
        <div>
          <div className="text-[11px] mb-0.5" style={{ color: T.inkFaint }}>Números</div>
          <div className="pg-mono text-base font-semibold">{stats.numeros}</div>
        </div>
        <div>
          <div className="text-[11px] mb-0.5" style={{ color: T.inkFaint }}>BMs</div>
          <div className="pg-mono text-base font-semibold">{stats.bms}</div>
        </div>
        <div>
          <div className="text-[11px] mb-0.5" style={{ color: T.inkFaint }}>Gasto</div>
          <div className="pg-mono text-base font-semibold" style={{ color: stats.gasto > 0 ? T.STATUS.em_recurso.fg : T.inkFaint }}>{brl(stats.gasto)}</div>
        </div>
      </div>

      {(f.tags || []).length > 0 && (
        <div className="flex flex-wrap gap-1">
          {f.tags.map((t) => <TagChip key={t} nome={t} cor={porNome[t]?.cor} T={T} />)}
        </div>
      )}

      {f.observacoes && (
        <div className="text-xs line-clamp-2" style={{ color: T.inkSoft }} title={f.observacoes}>{f.observacoes}</div>
      )}
    </div>
  );
}

/* =====================================================================
   COMPONENTE PRINCIPAL
   ===================================================================== */
export default function PainelFornecedores({ bms = [], numeros = [], T, registrarHistorico }) {
  const { porNome } = useTagsCatalog();
  const [fornecedores, setFornecedores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [fTipo, setFTipo] = useState("todos"); // todos | whatsapp | telegram | telefone | outro
  const [fAvaliacao, setFAvaliacao] = useState("todos"); // todos | com | sem | 5 | 4 | 3 | 2 | 1
  const [ordem, setOrdem] = useState("nome"); // nome | melhor | pior | usados | gasto
  const [view, setView] = usePersistentState("wa_view_fornecedores", "cards");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "fornecedores"), (snap) => {
      setFornecedores(snap.docs.map((d) => ({
        id: d.id,
        tipoContato: "outro",
        avaliacao: 0,
        observacoes: "",
        tags: [],
        ...d.data(),
      })));
      setLoading(false);
    }, (e) => { console.error("Erro fornecedores:", e); setLoading(false); });
    return () => unsub();
  }, []);

  /* estatísticas cruzadas */
  const statsPorForn = useMemo(() => {
    const m = {};
    const garantir = (nome) => {
      if (!m[nome]) m[nome] = { numeros: 0, bms: 0, gasto: 0 };
      return m[nome];
    };
    numeros.forEach((n) => {
      if (!n.fornecedor) return;
      const s = garantir(n.fornecedor);
      s.numeros++;
      s.gasto += Number(n.valor) || 0;
    });
    bms.forEach((b) => {
      if (!b.fornecedor) return;
      const s = garantir(b.fornecedor);
      s.bms++;
      s.gasto += Number(b.valor) || 0;
    });
    return m;
  }, [bms, numeros]);

  const totalGastoGeral = useMemo(() => Object.values(statsPorForn).reduce((s, x) => s + x.gasto, 0), [statsPorForn]);

  const contagem = useMemo(() => {
    const c = { whatsapp: 0, telegram: 0, telefone: 0, outro: 0, comAval: 0, somaAval: 0 };
    fornecedores.forEach((f) => {
      const t = f.tipoContato || detectarTipoContato(f.contato);
      if (c[t] !== undefined) c[t]++;
      if (f.avaliacao > 0) { c.comAval++; c.somaAval += f.avaliacao; }
    });
    c.media = c.comAval ? (c.somaAval / c.comAval) : 0;
    return c;
  }, [fornecedores]);

  const lista = useMemo(() => {
    const q = search.trim().toLowerCase();
    let r = fornecedores.filter((f) => {
      if (q && !`${f.nome} ${f.contato || ""} ${f.observacoes || ""} ${(f.tags || []).join(" ")}`.toLowerCase().includes(q)) return false;
      const tipo = f.tipoContato || detectarTipoContato(f.contato);
      if (fTipo !== "todos" && tipo !== fTipo) return false;
      if (fAvaliacao === "com" && !(f.avaliacao > 0)) return false;
      if (fAvaliacao === "sem" && (f.avaliacao > 0)) return false;
      if (["5", "4", "3", "2", "1"].includes(fAvaliacao)) {
        if ((f.avaliacao || 0) !== Number(fAvaliacao)) return false;
      }
      return true;
    });
    const stats = (f) => statsPorForn[f.nome] || { numeros: 0, bms: 0, gasto: 0 };
    if (ordem === "nome") r = [...r].sort((a, b) => (a.nome || "").localeCompare(b.nome || ""));
    if (ordem === "melhor") r = [...r].sort((a, b) => (b.avaliacao || 0) - (a.avaliacao || 0));
    if (ordem === "pior") r = [...r].sort((a, b) => (a.avaliacao || 0) - (b.avaliacao || 0));
    if (ordem === "usados") r = [...r].sort((a, b) => (stats(b).numeros + stats(b).bms) - (stats(a).numeros + stats(a).bms));
    if (ordem === "gasto") r = [...r].sort((a, b) => stats(b).gasto - stats(a).gasto);
    return r;
  }, [fornecedores, search, fTipo, fAvaliacao, ordem, statsPorForn]);

  const handleSave = async (data) => {
    const isEdit = Boolean(data.id);
    const id = data.id || uid();
    const payload = {
      ...data,
      id,
      tipoContato: data.tipoContato || detectarTipoContato(data.contato),
      avaliacao: Number(data.avaliacao) || 0,
      tags: data.tags || [],
      atualizadoEm: new Date().toISOString(),
    };
    if (!isEdit) payload.criadoEm = new Date().toISOString();
    await setDoc(doc(db, "fornecedores", id), payload);
    await registrarHistorico?.(isEdit ? "Edição de Fornecedor" : "Novo Fornecedor", `"${data.nome}"`);
    setModalOpen(false);
    setEditing(null);
  };

  const handleDelete = async (f) => {
    if (!confirm(`Remover o fornecedor "${f.nome}"?`)) return;
    await deleteDoc(doc(db, "fornecedores", f.id));
    await registrarHistorico?.("Exclusão de Fornecedor", `Fornecedor "${f.nome}" removido`);
  };

  const handleAvaliar = async (f, nota) => {
    await setDoc(doc(db, "fornecedores", f.id), { avaliacao: nota, atualizadoEm: new Date().toISOString() }, { merge: true });
    await registrarHistorico?.("Avaliação de Fornecedor", `"${f.nome}" avaliado com ${nota}/5`);
  };

  return (
    <div className="flex flex-col gap-5" style={{ "--pa-accent": T.primary }}>
      <AnimStyles />

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Kpi T={T} delay={0} label="Fornecedores" value={fornecedores.length} icon={Building2} />
        <Kpi T={T} delay={50} label="Com WhatsApp" value={contagem.whatsapp} color="#25D366" icon={MessageSquare} sub={`${contagem.telegram} no Telegram`} />
        <Kpi T={T} delay={100} label="Avaliação média" value={contagem.media} color="#E3BA6C" icon={Star} fmt={(v) => `${v.toFixed(1)}/5`} sub={`${contagem.comAval} avaliado(s)`} />
        <Kpi T={T} delay={150} label="Números vinculados" value={numeros.filter((n) => n.fornecedor).length} icon={Hash} />
        <Kpi T={T} delay={200} label="Gasto total" value={totalGastoGeral} fmt={brl} icon={DollarSign} color={T.STATUS.em_recurso.fg} sub="números + BMs" />
      </div>

      {/* Barra de controle */}
      <div className="pa-fade rounded-xl border p-4 flex flex-col gap-3" style={{ background: T.surface, borderColor: T.borderSoft, animationDelay: "120ms" }}>
        <div className="flex flex-col md:flex-row gap-2.5">
          <div className="flex-1 flex items-center gap-2 border rounded-lg px-3 py-2 transition-shadow focus-within:shadow-md" style={{ borderColor: T.border }}>
            <Search size={17} style={{ color: T.inkFaint }} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome, contato, tag ou observação…" className="w-full bg-transparent text-sm outline-none" style={{ color: T.ink }} />
            {search && <button onClick={() => setSearch("")}><X size={15} style={{ color: T.inkFaint }} /></button>}
          </div>

          <select value={fTipo} onChange={(e) => setFTipo(e.target.value)} className="px-3 py-2 rounded-lg text-sm" style={inputStyleFor(T)}>
            <option value="todos">Todos os tipos</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="telegram">Telegram</option>
            <option value="telefone">Telefone</option>
            <option value="outro">Outro</option>
          </select>

          <select value={fAvaliacao} onChange={(e) => setFAvaliacao(e.target.value)} className="px-3 py-2 rounded-lg text-sm" style={inputStyleFor(T)}>
            <option value="todos">Todas as avaliações</option>
            <option value="com">Com avaliação</option>
            <option value="sem">Sem avaliação</option>
            <option value="5">5 estrelas</option>
            <option value="4">4 estrelas</option>
            <option value="3">3 estrelas</option>
            <option value="2">2 estrelas</option>
            <option value="1">1 estrela</option>
          </select>

          <select value={ordem} onChange={(e) => setOrdem(e.target.value)} className="px-3 py-2 rounded-lg text-sm" style={inputStyleFor(T)}>
            <option value="nome">Nome (A-Z)</option>
            <option value="melhor">Melhor avaliados</option>
            <option value="pior">Pior avaliados</option>
            <option value="usados">Mais usados</option>
            <option value="gasto">Maior gasto</option>
          </select>

          <div className="inline-flex p-0.5 rounded-lg border self-stretch" style={{ borderColor: T.border }}>
            {[["cards", LayoutGrid], ["tabela", List]].map(([id, Icon]) => (
              <button key={id} onClick={() => setView(id)} title={id === "cards" ? "Cards" : "Tabela"} className="px-3 rounded-md transition-colors" style={{ background: view === id ? T.primary : "transparent", color: view === id ? "#fff" : T.inkSoft }}>
                <Icon size={16} />
              </button>
            ))}
          </div>

          <button onClick={() => { setEditing(null); setModalOpen(true); }} className="pa-chip px-4 py-2 rounded-lg text-sm font-medium text-white flex items-center justify-center gap-2 transition-shadow hover:shadow-lg" style={{ background: T.primary }}>
            <Plus size={16} /> Novo
          </button>
        </div>
      </div>

      {/* Resultado */}
      {loading ? (
        <div className="p-10 text-center text-sm" style={{ color: T.inkFaint }}>Carregando fornecedores…</div>
      ) : lista.length === 0 ? (
        <div className="pa-fade rounded-xl border p-14 text-center flex flex-col items-center gap-3" style={{ background: T.surface, borderColor: T.borderSoft, color: T.inkFaint }}>
          <Building2 size={30} />
          <span className="text-sm">
            {fornecedores.length === 0
              ? "Nenhum fornecedor cadastrado ainda. Use Novo para adicionar o primeiro."
              : "Nenhum fornecedor com os filtros aplicados."}
          </span>
          {fornecedores.length === 0 && (
            <button onClick={() => { setEditing(null); setModalOpen(true); }} className="px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ background: T.primary }}>
              Novo fornecedor
            </button>
          )}
        </div>
      ) : view === "cards" ? (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
          {lista.map((f, i) => (
            <FornecedorCard
              key={f.id}
              f={f}
              idx={i}
              T={T}
              porNome={porNome}
              stats={statsPorForn[f.nome] || { numeros: 0, bms: 0, gasto: 0 }}
              onEdit={(x) => { setEditing(x); setModalOpen(true); }}
              onDelete={handleDelete}
              onAvaliar={handleAvaliar}
            />
          ))}
        </div>
      ) : (
        <div className="pa-fade rounded-xl border overflow-x-auto pg-scroll" style={{ background: T.surface, borderColor: T.borderSoft }}>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b" style={{ color: T.inkSoft, borderColor: T.borderSoft }}>
                <th className="p-4 font-medium">Fornecedor</th>
                <th className="p-4 font-medium">Contato</th>
                <th className="p-4 font-medium">Avaliação</th>
                <th className="p-4 font-medium text-right">Números</th>
                <th className="p-4 font-medium text-right">BMs</th>
                <th className="p-4 font-medium text-right">Gasto</th>
                <th className="p-4 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: T.borderSoft }}>
              {lista.map((f) => {
                const tipo = TIPOS_CONTATO[f.tipoContato] || TIPOS_CONTATO.outro;
                const Icon = tipo.icon;
                const s = statsPorForn[f.nome] || { numeros: 0, bms: 0, gasto: 0 };
                const link = linkDoContato(f.contato, f.tipoContato);
                return (
                  <tr key={f.id} className="pa-row">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <Avatar nome={f.nome} T={T} size={34} />
                        <div className="font-medium">{f.nome}</div>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium" style={{ background: rgba(tipo.cor, 0.14), color: tipo.cor }}>
                          <Icon size={11} /> {tipo.label}
                        </span>
                        {f.contato && (link
                          ? <a href={link} target="_blank" rel="noopener noreferrer" className="pg-mono text-xs hover:underline" style={{ color: T.primary }}>{f.contato}</a>
                          : <span className="pg-mono text-xs" style={{ color: T.inkSoft }}>{f.contato}</span>
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                      <Estrelas value={f.avaliacao || 0} onChange={(n) => handleAvaliar(f, n)} T={T} />
                    </td>
                    <td className="p-4 text-right pg-mono">{s.numeros}</td>
                    <td className="p-4 text-right pg-mono">{s.bms}</td>
                    <td className="p-4 text-right pg-mono font-medium">{brl(s.gasto)}</td>
                    <td className="p-4 text-right whitespace-nowrap">
                      <button onClick={() => { setEditing(f); setModalOpen(true); }} className="pa-chip p-1.5 mr-1 rounded" style={{ color: T.primary }}><Pencil size={15} /></button>
                      <button onClick={() => handleDelete(f)} className="pa-chip p-1.5 rounded text-red-500"><Trash2 size={15} /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen && (
        <FornecedorModal
          initial={editing}
          T={T}
          onClose={() => { setModalOpen(false); setEditing(null); }}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
