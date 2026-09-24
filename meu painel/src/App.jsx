import React, { useState, useEffect, useMemo } from "react";
import {
  LayoutGrid,
  Boxes,
  Building2,
  History,
  Wallet,
  Plus,
  X,
  Loader2,
  Sun,
  Moon,
  ShieldCheck,
  Target,
  Repeat,
  Menu,
  MessageSquare,
  Palette,
} from "lucide-react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { db } from "./firebase";
import PainelModelos from "./PainelModelos";
import PainelAtivos from "./PainelAtivos";
import {
  THEMES,
  rgba,
  FontStyles,
  HeroStat,
  StatStrip,
  TrilhoCiclo,
  ProgressBar,
  ColorPickerPanel,
  BMModal,
  emptyBM,
  brl,
  monthLabel,
  hojeYYYYMM,
  uid,
} from "./painelShared";
import {
  collection,
  onSnapshot,
  doc,
  setDoc,
  deleteDoc,
  addDoc,
} from "firebase/firestore";

/* ---------------- Utilitários Locais de Data ---------------- */
const hojeISO = () => new Date().toISOString().split("T")[0];

/* ---------------- Rodízio: utilitários de pontuação ---------------- */
const PESO_QUALIDADE = { alta: 3, media: 2, baixa: 1 };
const COLUNAS_RODIZIO = [
  { key: "disponivel", label: "Disponível" },
  { key: "em_uso", label: "Em uso hoje" },
  { key: "descanso", label: "Em descanso" },
];

function diasDesde(dataISO) {
  if (!dataISO) return null;
  const d = new Date(dataISO + "T00:00:00");
  const hoje = new Date(hojeISO() + "T00:00:00");
  return Math.floor((hoje - d) / (1000 * 60 * 60 * 24));
}

function usosNosUltimosDias(historico, dias) {
  if (!historico || historico.length === 0) return 0;
  const limite = new Date();
  limite.setDate(limite.getDate() - dias);
  return historico.filter((d) => new Date(d + "T00:00:00") >= limite).length;
}

function calcularScore(bm) {
  const pesoQ = PESO_QUALIDADE[bm.qualidade] || 2;
  const dias = diasDesde(bm.ultimoUsoRodizio);
  const diasFator = dias === null ? 14 : Math.min(dias, 14);
  const usos7d = usosNosUltimosDias(bm.historicoUsoRodizio, 7);
  return pesoQ * 10 + diasFator - usos7d * 6;
}

/* ---------------- Qualidade Badge complementar ---------------- */
function QualidadeBadge({ qualidade, T }) {
  const cfg = T.QUALIDADE?.[qualidade] || T.QUALIDADE?.media || { fg: "#A8791F", label: "Média" };
  const nivel = qualidade === "alta" ? 3 : qualidade === "baixa" ? 1 : 2;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium" style={{ color: cfg.fg }}>
      <span className="inline-flex items-end gap-[2px]">
        {[1, 2, 3].map((i) => (
          <span
            key={i}
            className="w-[3px] rounded-sm"
            style={{ height: `${i * 3 + 2}px`, background: i <= nivel ? cfg.fg : T.borderSoft }}
          />
        ))}
      </span>
      {cfg.label}
    </span>
  );
}

/* ---------------- Painel de Rodízio: kanban manual ---------------- */
function PainelRodizio({ bms, T, onMoverColuna }) {
  const [arrastando, setArrastando] = useState(null);
  const [colunaSobre, setColunaSobre] = useState(null);

  const elegiveis = useMemo(
    () => bms.filter((b) => b.status === "ativa" || b.status === "estoque"),
    [bms]
  );

  const grupos = useMemo(() => {
    const g = { disponivel: [], em_uso: [], descanso: [] };
    elegiveis.forEach((b) => {
      const col = g[b.colunaRodizio] ? b.colunaRodizio : "disponivel";
      g[col].push(b);
    });
    g.disponivel.sort((a, b) => calcularScore(b) - calcularScore(a));
    return g;
  }, [elegiveis]);

  const moverPara = (bm, coluna) => {
    if ((bm.colunaRodizio || "disponivel") === coluna) return;
    onMoverColuna(bm, coluna);
  };

  const handleDrop = (e, coluna) => {
    e.preventDefault();
    setColunaSobre(null);
    const id = e.dataTransfer.getData("text/plain");
    const bm = elegiveis.find((b) => b.id === id);
    if (bm) moverPara(bm, coluna);
    setArrastando(null);
  };

  const Card = ({ bm, coluna }) => {
    const dias = diasDesde(bm.ultimoUsoRodizio);
    const usos7d = usosNosUltimosDias(bm.historicoUsoRodizio, 7);
    return (
      <div
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData("text/plain", bm.id);
          e.dataTransfer.effectAllowed = "move";
          setArrastando(bm.id);
        }}
        onDragEnd={() => { setArrastando(null); setColunaSobre(null); }}
        className="p-3 rounded-xl border flex flex-col gap-2 cursor-grab active:cursor-grabbing select-none"
        style={{
          borderColor: T.borderSoft,
          background: T.bg,
          opacity: arrastando === bm.id ? 0.4 : 1,
        }}
      >
        <div className="flex items-start justify-between gap-2">
          <span className="text-sm font-medium leading-tight">{bm.nome}</span>
          <QualidadeBadge qualidade={bm.qualidade || "media"} T={T} />
        </div>
        <div className="flex items-center gap-3 text-xs" style={{ color: T.inkFaint }}>
          <span>{dias === null ? "Nunca usada" : `Usada há ${dias}d`}</span>
          <span>•</span>
          <span>{usos7d} uso(s) em 7d</span>
        </div>
        <div className="flex gap-1.5 pt-1">
          {COLUNAS_RODIZIO.filter((c) => c.key !== coluna).map((c) => (
            <button
              key={c.key}
              onClick={() => moverPara(bm, c.key)}
              className="flex-1 py-1.5 rounded-lg text-[11px] font-medium"
              style={{ background: T.borderSoft, color: T.inkSoft }}
              title={`Mover para ${c.label}`}
            >
              → {c.label}
            </button>
          ))}
        </div>
      </div>
    );
  };

  const Coluna = ({ chave, titulo, cor, itens }) => (
    <div
      onDragOver={(e) => { e.preventDefault(); setColunaSobre(chave); }}
      onDragLeave={() => setColunaSobre((c) => (c === chave ? null : c))}
      onDrop={(e) => handleDrop(e, chave)}
      className="flex-1 min-w-[260px] rounded-xl border flex flex-col transition-colors"
      style={{
        background: T.surface,
        borderColor: colunaSobre === chave ? T.primary : T.borderSoft,
      }}
    >
      <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: T.borderSoft }}>
        <span className="pg-font-display font-semibold text-sm flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: cor }} />
          {titulo}
        </span>
        <span className="text-xs pg-mono px-2 py-0.5 rounded-full" style={{ background: T.borderSoft, color: T.inkSoft }}>
          {itens.length}
        </span>
      </div>
      <div className="p-3 flex flex-col gap-2 min-h-[120px] max-h-[70vh] overflow-y-auto pg-scroll">
        {itens.length === 0 ? (
          <div
            className="p-6 text-center text-xs rounded-lg border border-dashed"
            style={{ color: T.inkFaint, borderColor: T.borderSoft }}
          >
            Arraste uma BM até aqui.
          </div>
        ) : (
          itens.map((bm) => <Card key={bm.id} bm={bm} coluna={chave} />)
        )}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="pg-font-display text-2xl font-bold tracking-tight">Rodízio de uso</h1>
          <p className="text-sm mt-1" style={{ color: T.inkSoft }}>
            Arraste as BMs entre as colunas (ou use os botões no card) — a qualidade e o uso recente são só referência, quem decide é você.
          </p>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-4">
        <Coluna chave="disponivel" titulo="Disponível" cor={T.primary} itens={grupos.disponivel} />
        <Coluna chave="em_uso" titulo="Em uso hoje" cor={T.STATUS.ativa.fg} itens={grupos.em_uso} />
        <Coluna chave="descanso" titulo="Em descanso" cor={T.STATUS.em_recurso.fg} itens={grupos.descanso} />
      </div>
    </div>
  );
}

/* ---------------- Componente Principal ---------------- */
export default function PainelGestaoAtivos() {
  const [themeMode, setThemeMode] = useState("light");
  const [customColor, setCustomColor] = useState("#0B4C82");
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const [bms, setBms] = useState([]);
  const [fornecedores, setFornecedores] = useState([]);
  const [historico, setHistorico] = useState([]);
  const [metas, setMetas] = useState({});
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("dashboard");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBm, setEditingBm] = useState(null);

  // Mês em foco (Dashboard + Financeiro)
  const [mesSelecionado, setMesSelecionado] = useState(hojeYYYYMM ? hojeYYYYMM() : "2026-09");
  const [orcamentoDraft, setOrcamentoDraft] = useState("");
  const [metaAtivosDraft, setMetaAtivosDraft] = useState("");

  const [fornNome, setFornNome] = useState("");
  const [fornContato, setFornContato] = useState("");

  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem("gestaoAtivos.theme");
      const savedColor = localStorage.getItem("gestaoAtivos.color");
      if (savedTheme) setThemeMode(savedTheme);
      if (savedColor) setCustomColor(savedColor);
    } catch (e) {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("gestaoAtivos.theme", themeMode);
    } catch (e) {}
  }, [themeMode]);

  useEffect(() => {
    try {
      localStorage.setItem("gestaoAtivos.color", customColor);
    } catch (e) {}
  }, [customColor]);

  const T = useMemo(() => {
    const base = THEMES[themeMode] || THEMES.light;
    return {
      ...base,
      primary: customColor,
      primarySoft: rgba(customColor, themeMode === "dark" ? 0.22 : 0.1),
    };
  }, [themeMode, customColor]);

  const registrarHistorico = async (acao, detalhes) => {
    try {
      await addDoc(collection(db, "historico"), {
        acao,
        detalhes,
        timestamp: new Date().toISOString(),
      });
    } catch (e) {
      console.error("Erro ao registrar histórico:", e);
    }
  };

  useEffect(() => {
    const unsubBMs = onSnapshot(collection(db, "bms"), (snapshot) => {
      const data = snapshot.docs.map((d) => ({
        id: d.id,
        tags: [],
        qualidade: "media",
        ultimoUsoRodizio: "",
        historicoUsoRodizio: [],
        colunaRodizio: "disponivel",
        ...d.data(),
      }));
      setBms(data);
      setLoading(false);
    });

    const unsubForn = onSnapshot(collection(db, "fornecedores"), (snapshot) => {
      setFornecedores(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    const unsubHist = onSnapshot(collection(db, "historico"), (snapshot) => {
      const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      data.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      setHistorico(data);
    });

    const unsubMetas = onSnapshot(collection(db, "metas"), (snapshot) => {
      const obj = {};
      snapshot.docs.forEach((d) => (obj[d.id] = d.data()));
      setMetas(obj);
    });

    return () => {
      unsubBMs();
      unsubForn();
      unsubHist();
      unsubMetas();
    };
  }, []);

  useEffect(() => {
    const m = metas[mesSelecionado] || {};
    setOrcamentoDraft(m.orcamento ?? "");
    setMetaAtivosDraft(m.metaAtivos ?? "");
  }, [mesSelecionado, metas]);

  const salvarMeta = async () => {
    await setDoc(doc(db, "metas", mesSelecionado), {
      orcamento: Number(orcamentoDraft) || 0,
      metaAtivos: Number(metaAtivosDraft) || 0,
    });
    await registrarHistorico(
      "Atualização de meta",
      `Meta de ${monthLabel ? monthLabel(mesSelecionado) : mesSelecionado}: orçamento ${brl ? brl(orcamentoDraft) : orcamentoDraft}, meta de ativos ${metaAtivosDraft || 0}`
    );
  };

  const handleSaveBM = async (bmData) => {
    const isEdit = Boolean(bmData.id);
    const bmId = bmData.id || (uid ? uid() : Date.now().toString());
    const payload = { ...bmData, id: bmId, tags: bmData.tags || [] };

    await setDoc(doc(db, "bms", bmId), payload);
    await registrarHistorico(
      isEdit ? "Edição de Ativo" : "Criação de Ativo",
      `BM/Perfil: "${bmData.nome}" (Status: ${bmData.status})`
    );

    setIsModalOpen(false);
    setEditingBm(null);
  };

  const handleDeleteBM = async (id, nome) => {
    if (confirm(`Deseja remover permanentemente o ativo "${nome}"?`)) {
      await deleteDoc(doc(db, "bms", id));
      await registrarHistorico("Exclusão de Ativo", `Ativo "${nome}" (ID: ${id}) foi removido.`);
    }
  };

  const handleAddFornecedor = async (e) => {
    e.preventDefault();
    if (!fornNome.trim()) return;
    const fId = uid ? uid() : Date.now().toString();
    await setDoc(doc(db, "fornecedores", fId), { id: fId, nome: fornNome, contato: fornContato });
    await registrarHistorico("Novo Fornecedor", `Fornecedor registrado: "${fornNome}"`);
    setFornNome("");
    setFornContato("");
  };

  const handleDeleteFornecedor = async (id, nome) => {
    if (confirm(`Deseja remover o fornecedor "${nome}"?`)) {
      await deleteDoc(doc(db, "fornecedores", id));
      await registrarHistorico("Exclusão de Fornecedor", `Fornecedor "${nome}" foi deletado.`);
    }
  };

  const handleMoverColunaRodizio = async (bm, novaColuna) => {
    const LABEL_COLUNA = { disponivel: "Disponível", em_uso: "Em uso hoje", descanso: "Em descanso" };
    const payload = { colunaRodizio: novaColuna };
    if (novaColuna === "em_uso") {
      const historicoAtual = bm.historicoUsoRodizio || [];
      payload.ultimoUsoRodizio = hojeISO();
      payload.historicoUsoRodizio = [...historicoAtual, hojeISO()].slice(-60);
    }
    await setDoc(doc(db, "bms", bm.id), payload, { merge: true });
    await registrarHistorico("Rodízio", `BM "${bm.nome}" movida para "${LABEL_COLUNA[novaColuna]}"`);
  };

  const mesesDisponiveis = useMemo(() => {
    const defaultMonth = hojeYYYYMM ? hojeYYYYMM() : "2026-09";
    const s = new Set([defaultMonth]);
    bms.forEach((b) => b.dataCompra && s.add(b.dataCompra.slice(0, 7)));
    return Array.from(s).sort().reverse();
  }, [bms]);

  const stats = useMemo(() => {
    let gastoTotal = 0,
      ativas = 0,
      estoque = 0,
      banidas = 0;
    bms.forEach((b) => {
      gastoTotal += Number(b.valor) || 0;
      if (b.status === "ativa") ativas++;
      if (b.status === "estoque") estoque++;
      if (b.status === "banida") banidas++;
    });
    return {
      totalBMs: bms.length,
      gastoTotal,
      ativas,
      estoque,
      banidas,
      taxaAtivas: bms.length > 0 ? ((ativas / bms.length) * 100).toFixed(1) : 0,
    };
  }, [bms]);

  const bmsDoMes = useMemo(
    () => (mesSelecionado === "todos" ? bms : bms.filter((b) => (b.dataCompra || "").startsWith(mesSelecionado))),
    [bms, mesSelecionado]
  );

  const gastoMes = useMemo(() => bmsDoMes.reduce((s, b) => s + (Number(b.valor) || 0), 0), [bmsDoMes]);
  const metaAtual = metas[mesSelecionado] || { orcamento: 0, metaAtivos: 0 };

  const chartData = useMemo(() => {
    const counts = { ativa: 0, estoque: 0, em_recurso: 0, banida: 0, vendida: 0 };
    bms.forEach((b) => {
      if (counts[b.status] !== undefined) counts[b.status]++;
    });
    return [
      { name: "Ativas", qtd: counts.ativa },
      { name: "Estoque", qtd: counts.estoque },
      { name: "Recurso", qtd: counts.em_recurso },
      { name: "Banidas", qtd: counts.banida },
      { name: "Vendidas", qtd: counts.vendida },
    ];
  }, [bms]);

  const tendenciaMensal = useMemo(() => {
    const map = {};
    bms.forEach((b) => {
      if (!b.dataCompra) return;
      const m = b.dataCompra.slice(0, 7);
      map[m] = (map[m] || 0) + (Number(b.valor) || 0);
    });
    return Object.entries(map)
      .sort(([a], [b]) => (a > b ? 1 : -1))
      .slice(-6)
      .map(([m, valor]) => ({ mes: monthLabel ? monthLabel(m).split("/")[0].slice(0, 3) : m, valor }));
  }, [bms]);

  const fornecedorStats = useMemo(() => {
    return fornecedores.map((f) => {
      const relTodos = bms.filter((b) => b.fornecedor === f.nome);
      const relMes = bmsDoMes.filter((b) => b.fornecedor === f.nome);
      return {
        ...f,
        totalGeral: relTodos.length,
        gastoGeral: relTodos.reduce((s, b) => s + (Number(b.valor) || 0), 0),
        totalMes: relMes.length,
        gastoMes: relMes.reduce((s, b) => s + (Number(b.valor) || 0), 0),
      };
    });
  }, [fornecedores, bms, bmsDoMes]);

  const gastoPorFornecedorChart = useMemo(
    () =>
      [...fornecedorStats]
        .sort((a, b) => b.gastoMes - a.gastoMes)
        .filter((f) => f.gastoMes > 0)
        .slice(0, 8)
        .map((f) => ({ name: f.nome, valor: f.gastoMes })),
    [fornecedorStats]
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center gap-2" style={{ background: T.bg, color: T.ink }}>
        <Loader2 size={24} className="animate-spin" />
        <span className="pg-font-body text-sm">Carregando painel...</span>
      </div>
    );
  }

  const MesSelector = () => (
    <select
      value={mesSelecionado}
      onChange={(e) => setMesSelecionado(e.target.value)}
      className="px-3 py-2 rounded-lg text-sm pg-font-body outline-none"
      style={{ border: `1px solid ${T.border}`, background: T.surface, color: T.ink }}
    >
      <option value="todos">Todos os períodos</option>
      {mesesDisponiveis.map((m) => (
        <option key={m} value={m}>
          {monthLabel ? monthLabel(m) : m}
        </option>
      ))}
    </select>
  );

  const NAV_ITEMS = [
    { id: "dashboard", label: "Dashboard", icon: LayoutGrid },
    { id: "bms", label: "Ativos / BMs", icon: Boxes, count: stats.totalBMs },
    { id: "rodizio", label: "Rodízio", icon: Repeat },
    { id: "modelos", label: "Modelos de mensagem", icon: MessageSquare },
    { id: "financeiro", label: "Financeiro", icon: Wallet },
    { id: "fornecedores", label: "Fornecedores", icon: Building2 },
    { id: "historico", label: "Histórico", icon: History },
  ];
  const paginaAtual = NAV_ITEMS.find((n) => n.id === tab)?.label || "";

  const NavButton = ({ item, onClick }) => {
    const Icon = item.icon;
    const active = tab === item.id;
    return (
      <button
        onClick={onClick}
        className="w-full flex items-center gap-3 pl-3 pr-2.5 py-2 text-sm rounded-lg shrink-0 transition-colors"
        style={{
          background: active ? T.primary : "transparent",
          color: active ? "#fff" : T.inkSoft,
          fontWeight: active ? 600 : 500,
        }}
      >
        <Icon size={17} />
        <span className="flex-1 text-left">{item.label}</span>
        {typeof item.count === "number" && (
          <span className="pg-mono text-xs" style={{ color: active ? "rgba(255,255,255,0.85)" : T.inkFaint }}>{item.count}</span>
        )}
      </button>
    );
  };

  return (
    <div className="min-h-screen flex" style={{ background: T.bg, color: T.ink }}>
      <FontStyles />

      {/* Sidebar (desktop) */}
      <aside
        className="hidden md:flex flex-col w-60 shrink-0 border-r h-screen sticky top-0"
        style={{ background: T.rail, borderColor: T.borderSoft }}
      >
        <div className="flex items-center gap-2.5 px-4 h-16 border-b shrink-0" style={{ borderColor: T.borderSoft, background: T.surfaceAlt }}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white shrink-0" style={{ background: T.primary }}>
            <ShieldCheck size={17} />
          </div>
          <div className="leading-tight">
            <div className="pg-font-display font-bold text-sm tracking-tight">WA Base</div>
            <div className="text-[11px]" style={{ color: T.inkFaint }}>by alvr</div>
          </div>
        </div>

        <nav className="flex-1 flex flex-col gap-0.5 p-3 overflow-y-auto pg-scroll">
          {NAV_ITEMS.map((item) => (
            <NavButton key={item.id} item={item} onClick={() => setTab(item.id)} />
          ))}
        </nav>

        <div className="border-t" style={{ borderColor: T.borderSoft }}>
          <TrilhoCiclo bms={bms} T={T} />
        </div>

        <div className="p-3 border-t flex items-center gap-2 relative" style={{ borderColor: T.borderSoft }}>
          <button
            onClick={() => setShowColorPicker((s) => !s)}
            className="p-2 rounded-lg border"
            style={{ borderColor: T.border }}
            title="Escolher cor do painel"
          >
            <Palette size={16} />
          </button>
          {showColorPicker && (
            <ColorPickerPanel color={customColor} onChange={setCustomColor} T={T} onClose={() => setShowColorPicker(false)} />
          )}
          <button
            onClick={() => setThemeMode(themeMode === "light" ? "dark" : "light")}
            className="p-2 rounded-lg border"
            style={{ borderColor: T.border }}
            title="Alternar tema"
          >
            {themeMode === "light" ? <Moon size={16} /> : <Sun size={16} />}
          </button>
        </div>
      </aside>

      {/* Nav Mobile */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex" style={{ background: T.overlay }} onClick={() => setMobileNavOpen(false)}>
          <div className="w-64 h-full flex flex-col p-3" style={{ background: T.rail }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-2 px-1">
              <span className="pg-font-display font-bold text-sm">WA Base</span>
              <button onClick={() => setMobileNavOpen(false)}><X size={18} color={T.inkSoft} /></button>
            </div>
            {NAV_ITEMS.map((item) => (
              <NavButton key={item.id} item={item} onClick={() => { setTab(item.id); setMobileNavOpen(false); }} />
            ))}
          </div>
        </div>
      )}

      {/* Conteúdo Principal */}
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="flex items-center justify-between gap-3 px-4 md:px-8 h-16 border-b sticky top-0 z-30 backdrop-blur-md" style={{ background: T.bg + "EE", borderColor: T.borderSoft }}>
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => setMobileNavOpen(true)} className="md:hidden p-2 rounded-lg border" style={{ borderColor: T.border }}>
              <Menu size={18} />
            </button>
            <h2 className="pg-font-display font-semibold text-lg truncate">{paginaAtual}</h2>
          </div>
          <button
            onClick={() => { setEditingBm(null); setIsModalOpen(true); }}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white flex items-center gap-2 shrink-0 transition-shadow hover:shadow-lg"
            style={{ background: T.primary }}
          >
            <Plus size={18} /> <span className="hidden sm:inline">Novo Ativo</span>
          </button>
        </div>

        <main className="px-4 md:px-8 py-8 flex-1 min-w-0">
          {tab === "dashboard" && (
            <div className="flex flex-col gap-6">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <h1 className="pg-font-display text-2xl font-bold tracking-tight">Visão geral</h1>
                <MesSelector />
              </div>

              <HeroStat
                T={T}
                label="BMs ativas agora"
                value={stats.ativas}
                sub={
                  <>
                    {stats.taxaAtivas}% de operação
                    <br />
                    {stats.totalBMs} ativos no total
                  </>
                }
              />

              <StatStrip
                T={T}
                items={[
                  { label: "Total BMs/Ativos", value: stats.totalBMs },
                  { label: "Gasto no período", value: brl ? brl(gastoMes) : gastoMes, color: T.STATUS?.em_recurso?.fg },
                  { label: "Em estoque", value: stats.estoque, color: T.STATUS?.estoque?.fg },
                  { label: "Taxa de operação", value: `${stats.taxaAtivas}%` },
                ]}
              />

              <div className="rounded-xl p-6 border grid md:grid-cols-2 gap-6" style={{ background: T.surface, borderColor: T.borderSoft }}>
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Wallet size={16} color={T.primary} />
                    <span className="pg-font-display font-semibold text-sm">Orçamento — {monthLabel ? monthLabel(mesSelecionado) : mesSelecionado}</span>
                  </div>
                  <div className="flex items-end justify-between mb-2">
                    <span className="pg-tnum text-lg font-semibold">{brl ? brl(gastoMes) : gastoMes}</span>
                    <span className="text-xs" style={{ color: T.inkFaint }}>de {brl ? brl(metaAtual.orcamento || 0) : metaAtual.orcamento}</span>
                  </div>
                  <ProgressBar value={gastoMes} max={Number(metaAtual.orcamento) || 0} T={T} color={T.primary} />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Target size={16} color={T.primary} />
                    <span className="pg-font-display font-semibold text-sm">Meta de ativos conectados simultaneamente</span>
                  </div>
                  <div className="flex items-end justify-between mb-2">
                    <span className="pg-tnum text-lg font-semibold">{stats.ativas}</span>
                    <span className="text-xs" style={{ color: T.inkFaint }}>de {metaAtual.metaAtivos || 0}</span>
                  </div>
                  <ProgressBar value={stats.ativas} max={Number(metaAtual.metaAtivos) || 0} T={T} color={T.primary} />
                </div>

                <div className="md:col-span-2 pt-4 border-t flex flex-wrap items-end gap-3" style={{ borderColor: T.borderSoft }}>
                  <div className="flex-1 min-w-[160px]">
                    <label className="block text-xs font-medium mb-1.5" style={{ color: T.inkSoft }}>
                      Orçamento de {monthLabel ? monthLabel(mesSelecionado) : mesSelecionado} (R$)
                    </label>
                    <input
                      type="number"
                      value={orcamentoDraft}
                      onChange={(e) => setOrcamentoDraft(e.target.value)}
                      className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                      style={{ border: `1px solid ${T.border}`, background: T.surface, color: T.ink }}
                      placeholder="0,00"
                    />
                  </div>
                  <div className="flex-1 min-w-[160px]">
                    <label className="block text-xs font-medium mb-1.5" style={{ color: T.inkSoft }}>
                      Meta de ativos conectados
                    </label>
                    <input
                      type="number"
                      value={metaAtivosDraft}
                      onChange={(e) => setMetaAtivosDraft(e.target.value)}
                      className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                      style={{ border: `1px solid ${T.border}`, background: T.surface, color: T.ink }}
                      placeholder="0"
                    />
                  </div>
                  <button onClick={salvarMeta} className="px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ background: T.primary }}>
                    Salvar metas do mês
                  </button>
                </div>
              </div>

              <div className="grid lg:grid-cols-2 gap-6">
                <div className="rounded-xl p-6 border flex flex-col gap-4" style={{ background: T.surface, borderColor: T.borderSoft }}>
                  <span className="pg-font-display font-semibold text-sm">Distribuição por Status</span>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
                        <XAxis dataKey="name" stroke={T.inkSoft} fontSize={12} />
                        <YAxis stroke={T.inkSoft} fontSize={12} allowDecimals={false} />
                        <Tooltip contentStyle={{ background: T.surface, borderColor: T.border, color: T.ink }} />
                        <Bar dataKey="qtd" fill={T.primary} radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="rounded-xl p-6 border flex flex-col gap-4" style={{ background: T.surface, borderColor: T.borderSoft }}>
                  <span className="pg-font-display font-semibold text-sm">Tendência de gasto (últimos meses)</span>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={tendenciaMensal}>
                        <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
                        <XAxis dataKey="mes" stroke={T.inkSoft} fontSize={12} />
                        <YAxis stroke={T.inkSoft} fontSize={12} tickFormatter={(v) => `R$${v}`} />
                        <Tooltip formatter={(v) => brl ? brl(v) : v} contentStyle={{ background: T.surface, borderColor: T.border, color: T.ink }} />
                        <Line type="monotone" dataKey="valor" stroke={T.primary} strokeWidth={2.5} dot={{ r: 3 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>
          )}

          {tab === "bms" && (
            <PainelAtivos
              bms={bms}
              T={T}
              fornecedores={fornecedores}
              onEdit={(bm) => { setEditingBm(bm); setIsModalOpen(true); }}
              onDelete={(id, nome) => handleDeleteBM(id, nome)}
            />
          )}

          {tab === "rodizio" && (
            <PainelRodizio
              bms={bms}
              T={T}
              onMoverColuna={handleMoverColunaRodizio}
            />
          )}

          {tab === "modelos" && (
            <PainelModelos
              bms={bms}
              T={T}
              themeMode={themeMode}
              registrarHistorico={registrarHistorico}
            />
          )}

          {tab === "financeiro" && (
            <div className="flex flex-col gap-6">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <h1 className="pg-font-display text-2xl font-bold tracking-tight">Financeiro</h1>
                <MesSelector />
              </div>

              <StatStrip
                T={T}
                items={[
                  { label: "Orçamento do período", value: brl ? brl(metaAtual.orcamento || 0) : metaAtual.orcamento },
                  { label: "Gasto no período", value: brl ? brl(gastoMes) : gastoMes, color: T.primary },
                  {
                    label: "Saldo restante",
                    value: brl ? brl((Number(metaAtual.orcamento) || 0) - gastoMes) : (Number(metaAtual.orcamento) || 0) - gastoMes,
                    color: (Number(metaAtual.orcamento) || 0) - gastoMes < 0 ? "#A3402B" : T.STATUS?.ativa?.fg,
                  },
                  { label: "Ativos no período", value: bmsDoMes.length },
                ]}
              />

              <div className="rounded-xl p-6 border flex flex-col gap-4" style={{ background: T.surface, borderColor: T.borderSoft }}>
                <span className="pg-font-display font-semibold text-sm">Gasto por fornecedor — {monthLabel ? monthLabel(mesSelecionado) : mesSelecionado}</span>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={gastoPorFornecedorChart}>
                      <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false} />
                      <XAxis dataKey="name" stroke={T.inkSoft} fontSize={11} />
                      <YAxis stroke={T.inkSoft} fontSize={11} tickFormatter={(v) => `R$${v}`} />
                      <Tooltip formatter={(v) => brl ? brl(v) : v} contentStyle={{ background: T.surface, borderColor: T.border, color: T.ink }} />
                      <Bar dataKey="valor" fill={T.primary} radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {tab === "fornecedores" && (
            <div className="flex flex-col gap-6">
              <form onSubmit={handleAddFornecedor} className="p-6 rounded-xl border flex flex-col md:flex-row gap-4 items-end" style={{ background: T.surface, borderColor: T.borderSoft }}>
                <div className="flex-1 w-full">
                  <label className="block text-xs font-medium mb-1.5" style={{ color: T.inkSoft }}>Nome do Fornecedor *</label>
                  <input required value={fornNome} onChange={(e) => setFornNome(e.target.value)} placeholder="Ex: Lucas Contingência" className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={{ border: `1px solid ${T.border}`, background: T.surface, color: T.ink }} />
                </div>
                <div className="flex-1 w-full">
                  <label className="block text-xs font-medium mb-1.5" style={{ color: T.inkSoft }}>Contato / Link</label>
                  <input value={fornContato} onChange={(e) => setFornContato(e.target.value)} placeholder="Telegram / WhatsApp" className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={{ border: `1px solid ${T.border}`, background: T.surface, color: T.ink }} />
                </div>
                <button type="submit" className="w-full md:w-auto px-5 py-2 rounded-lg text-sm font-medium text-white" style={{ background: T.primary }}>Cadastrar</button>
              </form>

              <div className="rounded-xl border overflow-x-auto" style={{ background: T.surface, borderColor: T.borderSoft }}>
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b" style={{ borderColor: T.borderSoft, color: T.inkSoft }}>
                      <th className="p-4">Nome</th>
                      <th className="p-4">Contato</th>
                      <th className="p-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y" style={{ borderColor: T.borderSoft }}>
                    {fornecedores.map((f) => (
                      <tr key={f.id}>
                        <td className="p-4 font-medium">{f.nome}</td>
                        <td className="p-4" style={{ color: T.inkSoft }}>{f.contato || "—"}</td>
                        <td className="p-4 text-right">
                          <button onClick={() => handleDeleteFornecedor(f.id, f.nome)} className="p-1 text-red-500 hover:opacity-70">Remover</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === "historico" && (
            <div className="flex flex-col gap-4">
              <div className="rounded-xl border overflow-hidden" style={{ background: T.surface, borderColor: T.borderSoft }}>
                <div className="p-4 border-b font-medium text-sm" style={{ borderColor: T.borderSoft, color: T.inkSoft }}>
                  Atividades e Alterações Registradas
                </div>
                <div className="divide-y" style={{ borderColor: T.borderSoft }}>
                  {historico.length === 0 ? (
                    <div className="p-8 text-center text-sm" style={{ color: T.inkFaint }}>Nenhum evento gravado até o momento.</div>
                  ) : (
                    historico.map((h) => (
                      <div key={h.id} className="p-4 flex flex-col sm:flex-row justify-between sm:items-center gap-1 text-sm">
                        <div>
                          <span className="font-semibold mr-2" style={{ color: T.primary }}>[{h.acao}]</span>
                          <span style={{ color: T.ink }}>{h.detalhes}</span>
                        </div>
                        <span className="text-xs pg-tnum" style={{ color: T.inkFaint }}>
                          {h.timestamp ? new Date(h.timestamp).toLocaleString("pt-BR") : "—"}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {isModalOpen && (
        <BMModal
          initial={editingBm}
          fornecedores={fornecedores}
          T={T}
          onClose={() => { setIsModalOpen(false); setEditingBm(null); }}
          onSave={handleSaveBM}
        />
      )}
    </div>
  );
}
