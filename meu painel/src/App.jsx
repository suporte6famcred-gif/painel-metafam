import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  LayoutGrid,
  Boxes,
  Building2,
  Plus,
  Search,
  X,
  Pencil,
  Trash2,
  Loader2,
  AlertCircle,
  Sun,
  Moon,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

/* ---------- design tokens ---------- */
const THEMES = {
  light: {
    bg: "#F3F6FA",
    surface: "#FFFFFF",
    ink: "#0F2338",
    inkSoft: "#51617A",
    inkFaint: "#8B9AB2",
    border: "#DFE6EF",
    borderSoft: "#EBF0F5",
    primary: "#0B4C82",
    primaryDark: "#082F52",
    primarySoft: "#E4EEF7",
    gold: "#A8791F",
    goldSoft: "#F5EEDC",
    overlay: "rgba(10,20,35,0.45)",
    hoverRow: "rgba(11,76,130,0.035)",
    STATUS: {
      ativa: { label: "Ativa", fg: "#256B45", bg: "#E1F1E7" },
      em_recurso: { label: "Em recurso", fg: "#A8791F", bg: "#F5EEDC" },
      banida: { label: "Banida", fg: "#A3402B", bg: "#F6E4DE" },
      estoque: { label: "Em estoque", fg: "#4E6072", bg: "#E8EDF2" },
      vendida: { label: "Vendida", fg: "#5F4E93", bg: "#EAE5F3" },
    },
  },
  dark: {
    bg: "#0A1420",
    surface: "#101C2C",
    ink: "#E9F0F8",
    inkSoft: "#93A6BE",
    inkFaint: "#5E7086",
    border: "#213247",
    borderSoft: "#182636",
    primary: "#4E93D4",
    primaryDark: "#0B4C82",
    primarySoft: "#16283C",
    gold: "#D6AA52",
    goldSoft: "#2B2416",
    overlay: "rgba(3,8,15,0.6)",
    hoverRow: "rgba(255,255,255,0.03)",
    STATUS: {
      ativa: { label: "Ativa", fg: "#6FCB94", bg: "#153826" },
      em_recurso: { label: "Em recurso", fg: "#E3BA6C", bg: "#2E2413" },
      banida: { label: "Banida", fg: "#E58868", bg: "#341F17" },
      estoque: { label: "Em estoque", fg: "#A9BACD", bg: "#1B2837" },
      vendida: { label: "Vendida", fg: "#B6A4E6", bg: "#241D38" },
    },
  },
};

const uid = () => Math.random().toString(36).slice(2, 10);
const brl = (n) =>
  (Number(n) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDate = (d) => {
  if (!d) return "—";
  const dt = new Date(d + "T00:00:00");
  if (isNaN(dt)) return d;
  return dt.toLocaleDateString("pt-BR");
};

const emptyBM = () => ({
  id: uid(),
  nome: "",
  telefone: "",
  status: "estoque",
  fornecedor: "",
  dataCompra: "",
  valor: "",
  dataConexao: "",
  observacoes: "",
});

/* ---------- font import ---------- */
function FontStyles() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600;700&display=swap');
      .pg-font-display { font-family: 'Space Grotesk', sans-serif; }
      .pg-font-body { font-family: 'Inter', sans-serif; }
      .pg-tnum { font-variant-numeric: tabular-nums; }
      .pg-scroll::-webkit-scrollbar { height: 8px; width: 8px; }
      .pg-scroll::-webkit-scrollbar-thumb { background: rgba(128,128,128,0.3); border-radius: 8px; }
    `}</style>
  );
}

/* ---------- storage (Adaptado para Vercel/Browser padrão via localStorage) ---------- */
const BMS_KEY = "gestao-ativos:bms";
const FORN_KEY = "gestao-ativos:fornecedores";
const THEME_KEY = "gestao-ativos:theme";

async function loadAll() {
  const out = { bms: [], fornecedores: [], theme: "light" };
  try {
    if (typeof window !== "undefined") {
      const bmsStr = localStorage.getItem(BMS_KEY);
      if (bmsStr) out.bms = JSON.parse(bmsStr);

      const fornStr = localStorage.getItem(FORN_KEY);
      if (fornStr) out.fornecedores = JSON.parse(fornStr);

      const themeStr = localStorage.getItem(THEME_KEY);
      if (themeStr) out.theme = themeStr;
    }
  } catch (e) {
    console.error("Erro ao carregar dados do localStorage:", e);
  }
  return out;
}

async function saveBMs(bms) {
  if (typeof window !== "undefined") {
    localStorage.setItem(BMS_KEY, JSON.stringify(bms));
  }
}
async function saveFornecedores(f) {
  if (typeof window !== "undefined") {
    localStorage.setItem(FORN_KEY, JSON.stringify(f));
  }
}
async function saveTheme(theme) {
  if (typeof window !== "undefined") {
    localStorage.setItem(THEME_KEY, theme);
  }
}

/* ---------- small UI atoms ---------- */
function Badge({ status, T }) {
  const s = T.STATUS[status] || T.STATUS.estoque;
  return (
    <span
      className="pg-font-body inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium"
      style={{ color: s.fg, background: s.bg }}
    >
      {s.label}
    </span>
  );
}

function Field({ label, T, children }) {
  return (
    <label className="pg-font-body block">
      <span className="block text-xs font-medium mb-1.5" style={{ color: T.inkSoft }}>
        {label}
      </span>
      {children}
    </label>
  );
}

const inputCls =
  "w-full rounded-lg px-3 py-2 text-sm outline-none transition-colors pg-font-body";
const inputStyleFor = (T) => ({
  border: `1px solid ${T.border}`,
  background: T.surface,
  color: T.ink,
});

/* ---------- KPI card ---------- */
function KPI({ label, value, T, accent }) {
  return (
    <div
      className="rounded-2xl p-5 flex flex-col gap-1"
      style={{ background: T.surface, border: `1px solid ${T.borderSoft}` }}
    >
      <span className="pg-font-body text-xs font-medium" style={{ color: T.inkSoft }}>
        {label}
      </span>
      <span
        className="pg-font-display pg-tnum text-2xl font-semibold"
        style={{ color: accent || T.ink }}
      >
        {value}
      </span>
    </div>
  );
}

/* ---------- BM form modal ---------- */
function BMModal({ initial, fornecedores, T, onClose, onSave }) {
  const [f, setF] = useState(initial || emptyBM());
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(f);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: T.overlay }}
    >
      <div
        className="w-full max-w-lg rounded-2xl p-6 shadow-2xl flex flex-col gap-5 max-h-[90vh] overflow-y-auto pg-scroll"
        style={{ background: T.surface, color: T.ink }}
      >
        <div className="flex items-center justify-between">
          <h3 className="pg-font-display text-lg font-semibold">
            {initial?.id ? "Editar BM" : "Nova BM / Perfil"}
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:opacity-70 transition-opacity"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Field label="Nome da BM / Ativo" T={T}>
            <input
              required
              value={f.nome}
              onChange={set("nome")}
              placeholder="Ex: BM 01 - BM Principal"
              className={inputCls}
              style={inputStyleFor(T)}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Telefone / WhatsApp" T={T}>
              <input
                value={f.telefone}
                onChange={set("telefone")}
                placeholder="(00) 00000-0000"
                className={inputCls}
                style={inputStyleFor(T)}
              />
            </Field>

            <Field label="Status" T={T}>
              <select
                value={f.status}
                onChange={set("status")}
                className={inputCls}
                style={inputStyleFor(T)}
              >
                <option value="estoque">Em estoque</option>
                <option value="ativa">Ativa</option>
                <option value="em_recurso">Em recurso</option>
                <option value="banida">Banida</option>
                <option value="vendida">Vendida</option>
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Fornecedor" T={T}>
              <select
                value={f.fornecedor}
                onChange={set("fornecedor")}
                className={inputCls}
                style={inputStyleFor(T)}
              >
                <option value="">Selecione...</option>
                {fornecedores.map((forn) => (
                  <option key={forn.id || forn.nome} value={forn.nome}>
                    {forn.nome}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Valor de Compra (R$)" T={T}>
              <input
                type="number"
                step="0.01"
                value={f.valor}
                onChange={set("valor")}
                placeholder="0,00"
                className={inputCls}
                style={inputStyleFor(T)}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Data da Compra" T={T}>
              <input
                type="date"
                value={f.dataCompra}
                onChange={set("dataCompra")}
                className={inputCls}
                style={inputStyleFor(T)}
              />
            </Field>

            <Field label="Data da Conexão" T={T}>
              <input
                type="date"
                value={f.dataConexao}
                onChange={set("dataConexao")}
                className={inputCls}
                style={inputStyleFor(T)}
              />
            </Field>
          </div>

          <Field label="Observações / Anotações" T={T}>
            <textarea
              rows={3}
              value={f.observacoes}
              onChange={set("observacoes")}
              placeholder="Detalhes sobre o contingenciamento, perfil, etc."
              className={inputCls}
              style={inputStyleFor(T)}
            />
          </Field>

          <div className="flex justify-end gap-3 mt-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              style={{ background: T.borderSoft, color: T.inkSoft }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-lg text-sm font-medium transition-opacity text-white"
              style={{ background: T.primary }}
            >
              Salvar Ativo
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ---------- Fornecedores View ---------- */
function FornecedoresTab({ fornecedores, bms, T, onSaveFornecedores }) {
  const [nome, setNome] = useState("");
  const [contato, setContato] = useState("");

  const handleAdd = (e) => {
    e.preventDefault();
    if (!nome.trim()) return;
    const next = [...fornecedores, { id: uid(), nome, contato }];
    onSaveFornecedores(next);
    setNome("");
    setContato("");
  };

  const handleDelete = (id) => {
    if (confirm("Deseja remover este fornecedor?")) {
      const next = fornecedores.filter((f) => f.id !== id);
      onSaveFornecedores(next);
    }
  };

  const statsFornecedor = useMemo(() => {
    const map = {};
    bms.forEach((b) => {
      if (!b.fornecedor) return;
      if (!map[b.fornecedor]) {
        map[b.fornecedor] = { total: 0, gasto: 0, banidas: 0, ativas: 0 };
      }
      map[b.fornecedor].total += 1;
      map[b.fornecedor].gasto += Number(b.valor) || 0;
      if (b.status === "banida") map[b.fornecedor].banidas += 1;
      if (b.status === "ativa") map[b.fornecedor].ativas += 1;
    });
    return map;
  }, [bms]);

  return (
    <div className="flex flex-col gap-6">
      <div
        className="rounded-2xl p-6"
        style={{ background: T.surface, border: `1px solid ${T.borderSoft}` }}
      >
        <h3 className="pg-font-display text-lg font-semibold mb-4">
          Cadastrar Novo Fornecedor
        </h3>
        <form onSubmit={handleAdd} className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[200px]">
            <Field label="Nome do Fornecedor" T={T}>
              <input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: Pedro Contingência"
                className={inputCls}
                style={inputStyleFor(T)}
              />
            </Field>
          </div>
          <div className="flex-1 min-w-[200px]">
            <Field label="Contato / Link" T={T}>
              <input
                value={contato}
                onChange={(e) => setContato(e.target.value)}
                placeholder="@telegram / Whatsapp"
                className={inputCls}
                style={inputStyleFor(T)}
              />
            </Field>
          </div>
          <button
            type="submit"
            className="px-5 py-2.5 rounded-lg text-sm font-medium text-white flex items-center gap-2 transition-opacity"
            style={{ background: T.primary }}
          >
            <Plus size={18} /> Adicionar
          </button>
        </form>
      </div>

      <div
        className="rounded-2xl overflow-hidden"
        style={{ background: T.surface, border: `1px solid ${T.borderSoft}` }}
      >
        <div className="p-5 border-b" style={{ borderColor: T.borderSoft }}>
          <h3 className="pg-font-display text-lg font-semibold">
            Lista de Fornecedores Cadastrados
          </h3>
        </div>
        <div className="overflow-x-auto pg-scroll">
          <table className="w-full text-left text-sm pg-font-body">
            <thead>
              <tr className="border-b" style={{ borderColor: T.borderSoft, color: T.inkSoft }}>
                <th className="py-3.5 px-5 font-semibold">Fornecedor</th>
                <th className="py-3.5 px-5 font-semibold">Contato</th>
                <th className="py-3.5 px-5 font-semibold text-center">Qtd. BMs</th>
                <th className="py-3.5 px-5 font-semibold text-center">Taxa de Banimento</th>
                <th className="py-3.5 px-5 font-semibold text-right">Total Investido</th>
                <th className="py-3.5 px-5 font-semibold text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: T.borderSoft }}>
              {fornecedores.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center" style={{ color: T.inkFaint }}>
                    Nenhum fornecedor cadastrado até o momento.
                  </td>
                </tr>
              ) : (
                fornecedores.map((f) => {
                  const st = statsFornecedor[f.nome] || { total: 0, gasto: 0, banidas: 0, ativas: 0 };
                  const taxaBan = st.total > 0 ? ((st.banidas / st.total) * 100).toFixed(1) : "0.0";
                  return (
                    <tr
                      key={f.id}
                      className="transition-colors"
                      style={{ hover: { background: T.hoverRow } }}
                    >
                      <td className="py-4 px-5 font-medium">{f.nome}</td>
                      <td className="py-4 px-5" style={{ color: T.inkSoft }}>
                        {f.contato || "—"}
                      </td>
                      <td className="py-4 px-5 text-center pg-tnum">{st.total}</td>
                      <td className="py-4 px-5 text-center pg-tnum">
                        <span
                          className="px-2 py-0.5 rounded text-xs font-semibold"
                          style={{
                            background: Number(taxaBan) > 30 ? T.STATUS.banida.bg : T.STATUS.ativa.bg,
                            color: Number(taxaBan) > 30 ? T.STATUS.banida.fg : T.STATUS.ativa.fg,
                          }}
                        >
                          {taxaBan}%
                        </span>
                      </td>
                      <td className="py-4 px-5 text-right font-medium pg-tnum">
                        {brl(st.gasto)}
                      </td>
                      <td className="py-4 px-5 text-right">
                        <button
                          onClick={() => handleDelete(f.id)}
                          className="p-1.5 rounded-lg transition-colors hover:bg-red-500/10 text-red-500"
                          title="Remover"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ---------- Main Component ---------- */
export default function PainelGestaoAtivos() {
  const [themeMode, setThemeMode] = useState("light");
  const [bms, setBms] = useState([]);
  const [fornecedores, setFornecedores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("dashboard"); // 'dashboard' | 'bms' | 'fornecedores'

  // Modal control
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBm, setEditingBm] = useState(null);

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");

  const T = THEMES[themeMode] || THEMES.light;

  useEffect(() => {
    loadAll().then((data) => {
      setBms(data.bms);
      setFornecedores(data.fornecedores);
      setThemeMode(data.theme);
      setLoading(false);
    });
  }, []);

  const handleToggleTheme = () => {
    const next = themeMode === "light" ? "dark" : "light";
    setThemeMode(next);
    saveTheme(next);
  };

  const handleSaveBM = (bmData) => {
    let next;
    if (editingBm) {
      next = bms.map((b) => (b.id === bmData.id ? bmData : b));
    } else {
      next = [bmData, ...bms];
    }
    setBms(next);
    saveBMs(next);
    setIsModalOpen(false);
    setEditingBm(null);
  };

  const handleDeleteBM = (id) => {
    if (confirm("Tem certeza que deseja remover este ativo?")) {
      const next = bms.filter((b) => b.id !== id);
      setBms(next);
      saveBMs(next);
    }
  };

  const handleSaveFornecedores = (newList) => {
    setFornecedores(newList);
    saveFornecedores(newList);
  };

  // KPI Computations
  const stats = useMemo(() => {
    const totalBMs = bms.length;
    let gastoTotal = 0;
    let ativas = 0;
    let estoque = 0;
    let banidas = 0;

    bms.forEach((b) => {
      gastoTotal += Number(b.valor) || 0;
      if (b.status === "ativa") ativas++;
      if (b.status === "estoque") estoque++;
      if (b.status === "banida") banidas++;
    });

    const taxaAtivas = totalBMs > 0 ? ((ativas / totalBMs) * 100).toFixed(1) : 0;

    return { totalBMs, gastoTotal, ativas, estoque, banidas, taxaAtivas };
  }, [bms]);

  // Chart Data
  const chartData = useMemo(() => {
    const counts = {
      ativa: 0,
      estoque: 0,
      em_recurso: 0,
      banida: 0,
      vendida: 0,
    };
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

  // Filtered list
  const filteredBMs = useMemo(() => {
    return bms.filter((b) => {
      const matchSearch =
        b.nome.toLowerCase().includes(search.toLowerCase()) ||
        (b.fornecedor && b.fornecedor.toLowerCase().includes(search.toLowerCase())) ||
        (b.telefone && b.telefone.includes(search));
      const matchStatus = statusFilter === "todos" || b.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [bms, search, statusFilter]);

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: T.bg, color: T.ink }}
      >
        <FontStyles />
        <div className="flex items-center gap-3">
          <Loader2 size={24} className="animate-spin" />
          <span className="pg-font-body text-sm font-medium">Carregando painel...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen transition-colors duration-200" style={{ background: T.bg, color: T.ink }}>
      <FontStyles />

      {/* Header */}
      <header
        className="border-b sticky top-0 z-40 backdrop-blur-md"
        style={{ background: T.surface + "EE", borderColor: T.borderSoft }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img src={LOGO_SRC} alt="Logo" className="w-8 h-8 rounded-lg object-cover" />
            <span className="pg-font-display font-bold text-lg tracking-tight">
              Gestão de Ativos
            </span>
          </div>

          {/* Nav tabs */}
          <nav className="flex items-center gap-1">
            <button
              onClick={() => setTab("dashboard")}
              className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                tab === "dashboard" ? "font-semibold" : ""
              }`}
              style={{
                background: tab === "dashboard" ? T.primarySoft : "transparent",
                color: tab === "dashboard" ? T.primary : T.inkSoft,
              }}
            >
              <LayoutGrid size={18} />
              <span className="hidden sm:inline">Dashboard</span>
            </button>

            <button
              onClick={() => setTab("bms")}
              className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                tab === "bms" ? "font-semibold" : ""
              }`}
              style={{
                background: tab === "bms" ? T.primarySoft : "transparent",
                color: tab === "bms" ? T.primary : T.inkSoft,
              }}
            >
              <Boxes size={18} />
              <span className="hidden sm:inline">BMs & Perfis</span>
            </button>

            <button
              onClick={() => setTab("fornecedores")}
              className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                tab === "fornecedores" ? "font-semibold" : ""
              }`}
              style={{
                background: tab === "fornecedores" ? T.primarySoft : "transparent",
                color: tab === "fornecedores" ? T.primary : T.inkSoft,
              }}
            >
              <Building2 size={18} />
              <span className="hidden sm:inline">Fornecedores</span>
            </button>
          </nav>

          <div className="flex items-center gap-3">
            <button
              onClick={handleToggleTheme}
              className="p-2 rounded-lg transition-colors border"
              style={{ borderColor: T.border, color: T.inkSoft }}
              title="Alternar Tema"
            >
              {themeMode === "light" ? <Moon size={18} /> : <Sun size={18} />}
            </button>

            <button
              onClick={() => {
                setEditingBm(null);
                setIsModalOpen(true);
              }}
              className="px-4 py-2 rounded-lg text-sm font-medium text-white flex items-center gap-2 transition-opacity shadow-sm"
              style={{ background: T.primary }}
            >
              <Plus size={18} />
              <span className="hidden sm:inline">Novo Ativo</span>
            </button>
          </div>
        </div>
      </header>

      {/* Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {tab === "dashboard" && (
          <div className="flex flex-col gap-8">
            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KPI label="Total de BMs" value={stats.totalBMs} T={T} />
              <KPI label="Investimento Total" value={brl(stats.gastoTotal)} T={T} accent={T.gold} />
              <KPI label="BMs Ativas" value={stats.ativas} T={T} accent={T.STATUS.ativa.fg} />
              <KPI label="Taxa de Operação" value={`${stats.taxaAtivas}%`} T={T} />
            </div>

            {/* Graphic and Status Summary */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div
                className="lg:col-span-2 rounded-2xl p-6 flex flex-col gap-4"
                style={{ background: T.surface, border: `1px solid ${T.borderSoft}` }}
              >
                <h3 className="pg-font-display text-base font-semibold">
                  Distribuição de Status dos Ativos
                </h3>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
                      <XAxis dataKey="name" stroke={T.inkSoft} fontSize={12} />
                      <YAxis stroke={T.inkSoft} fontSize={12} allowDecimals={false} />
                      <Tooltip
                        contentStyle={{
                          background: T.surface,
                          borderColor: T.border,
                          borderRadius: "8px",
                          color: T.ink,
                        }}
                      />
                      <Bar dataKey="qtd" fill={T.primary} radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div
                className="rounded-2xl p-6 flex flex-col gap-4"
                style={{ background: T.surface, border: `1px solid ${T.borderSoft}` }}
              >
                <h3 className="pg-font-display text-base font-semibold">Resumo do Estoque</h3>
                <div className="flex flex-col gap-3">
                  {Object.entries(T.STATUS).map(([key, st]) => {
                    const count = bms.filter((b) => b.status === key).length;
                    return (
                      <div
                        key={key}
                        className="flex items-center justify-between p-3 rounded-xl"
                        style={{ background: T.bg }}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ background: st.fg }}
                          />
                          <span className="text-sm font-medium pg-font-body">{st.label}</span>
                        </div>
                        <span className="pg-font-display font-bold pg-tnum">{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === "bms" && (
          <div className="flex flex-col gap-6">
            {/* Filters Bar */}
            <div
              className="rounded-2xl p-4 flex flex-wrap gap-4 items-center justify-between"
              style={{ background: T.surface, border: `1px solid ${T.borderSoft}` }}
            >
              <div className="flex items-center gap-3 flex-1 min-w-[240px]">
                <div className="relative flex-1">
                  <Search
                    size={18}
                    className="absolute left-3 top-1/2 -translate-y-1/2"
                    style={{ color: T.inkFaint }}
                  />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar por nome, fornecedor ou telefone..."
                    className="w-full pl-9 pr-4 py-2 rounded-lg text-sm outline-none pg-font-body"
                    style={inputStyleFor(T)}
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-3 py-2 rounded-lg text-sm outline-none pg-font-body"
                  style={inputStyleFor(T)}
                >
                  <option value="todos">Todos os Status</option>
                  <option value="ativa">Ativa</option>
                  <option value="estoque">Em estoque</option>
                  <option value="em_recurso">Em recurso</option>
                  <option value="banida">Banida</option>
                  <option value="vendida">Vendida</option>
                </select>
              </div>
            </div>

            {/* Table */}
            <div
              className="rounded-2xl overflow-hidden"
              style={{ background: T.surface, border: `1px solid ${T.borderSoft}` }}
            >
              <div className="overflow-x-auto pg-scroll">
                <table className="w-full text-left text-sm pg-font-body">
                  <thead>
                    <tr className="border-b" style={{ borderColor: T.borderSoft, color: T.inkSoft }}>
                      <th className="py-3.5 px-5 font-semibold">Ativo / BM</th>
                      <th className="py-3.5 px-5 font-semibold">Status</th>
                      <th className="py-3.5 px-5 font-semibold">Fornecedor</th>
                      <th className="py-3.5 px-5 font-semibold">Telefone</th>
                      <th className="py-3.5 px-5 font-semibold">Dt. Compra</th>
                      <th className="py-3.5 px-5 font-semibold text-right">Valor</th>
                      <th className="py-3.5 px-5 font-semibold text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y" style={{ borderColor: T.borderSoft }}>
                    {filteredBMs.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center" style={{ color: T.inkFaint }}>
                          Nenhum ativo encontrado.
                        </td>
                      </tr>
                    ) : (
                      filteredBMs.map((bm) => (
                        <tr key={bm.id} className="transition-colors hover:bg-black/5 dark:hover:bg-white/5">
                          <td className="py-4 px-5 font-medium">
                            <div>{bm.nome}</div>
                            {bm.observacoes && (
                              <div className="text-xs truncate max-w-xs" style={{ color: T.inkFaint }}>
                                {bm.observacoes}
                              </div>
                            )}
                          </td>
                          <td className="py-4 px-5">
                            <Badge status={bm.status} T={T} />
                          </td>
                          <td className="py-4 px-5" style={{ color: T.inkSoft }}>
                            {bm.fornecedor || "—"}
                          </td>
                          <td className="py-4 px-5 pg-tnum" style={{ color: T.inkSoft }}>
                            {bm.telefone || "—"}
                          </td>
                          <td className="py-4 px-5 pg-tnum" style={{ color: T.inkSoft }}>
                            {fmtDate(bm.dataCompra)}
                          </td>
                          <td className="py-4 px-5 text-right font-medium pg-tnum">
                            {brl(bm.valor)}
                          </td>
                          <td className="py-4 px-5 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => {
                                  setEditingBm(bm);
                                  setIsModalOpen(true);
                                }}
                                className="p-1.5 rounded-lg transition-colors hover:opacity-70"
                                title="Editar"
                              >
                                <Pencil size={16} />
                              </button>
                              <button
                                onClick={() => handleDeleteBM(bm.id)}
                                className="p-1.5 rounded-lg transition-colors text-red-500 hover:opacity-70"
                                title="Remover"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {tab === "fornecedores" && (
          <FornecedoresTab
            fornecedores={fornecedores}
            bms={bms}
            T={T}
            onSaveFornecedores={handleSaveFornecedores}
          />
        )}
      </main>

      {/* Modal Form */}
      {isModalOpen && (
        <BMModal
          initial={editingBm}
          fornecedores={fornecedores}
          T={T}
          onClose={() => {
            setIsModalOpen(false);
            setEditingBm(null);
          }}
          onSave={handleSaveBM}
        />
      )}
    </div>
  );
}
