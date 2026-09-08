import React, { useState, useEffect, useMemo } from "react";
import {
  LayoutGrid,
  Boxes,
  Building2,
  History,
  Plus,
  Search,
  X,
  Pencil,
  Trash2,
  Loader2,
  Sun,
  Moon,
  ShieldCheck,
  Download,
  AlertTriangle,
  Calendar,
  Filter,
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
import { db } from "./firebase";
import {
  collection,
  onSnapshot,
  doc,
  setDoc,
  deleteDoc,
  addDoc,
} from "firebase/firestore";

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
    primarySoft: "#E4EEF7",
    gold: "#A8791F",
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
    primarySoft: "#16283C",
    gold: "#D6AA52",
    overlay: "rgba(3,8,15,0.6)",
    hoverRow: "rgba(255,255,255,0.03)",
    STATUS: {
      ativa: { label: "Ativa", fg: "#6FCB94", bg: "#153826" },
      em_recurso: { label: "Em recurso", fg: "#E3BA6C", bg: "#2E2413" },
      banida: { label: "Banida", fg: "#E58868", bg: "#341F17" },
      estoque: { label: "Em estoque", fg: "#A9BACD", bg: "#1B2837" },
      vendida: { label: "Vendida", fg: "#5F4E93", bg: "#241D38" },
    },
  },
};

const uid = () => Math.random().toString(36).slice(2, 10);
const brl = (n) =>
  (Number(n) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const emptyBM = () => ({
  id: "",
  nome: "",
  telefone: "",
  status: "estoque",
  fornecedor: "",
  dataCompra: new Date().toISOString().split("T")[0],
  valor: "",
  dataConexao: "",
  observacoes: "",
});

function FontStyles() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600;700&display=swap');
      .pg-font-display { font-family: 'Space Grotesk', sans-serif; }
      .pg-font-body { font-family: 'Inter', sans-serif; }
      .pg-tnum { font-variant-numeric: tabular-nums; }
    `}</style>
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

const inputCls = "w-full rounded-lg px-3 py-2 text-sm outline-none transition-colors pg-font-body";
const inputStyleFor = (T) => ({
  border: `1px solid ${T.border}`,
  background: T.surface,
  color: T.ink,
});

function StatusBadge({ status, T }) {
  const cfg = T.STATUS[status] || T.STATUS.estoque;
  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
      style={{ backgroundColor: cfg.bg, color: cfg.fg }}
    >
      {cfg.label}
    </span>
  );
}

/* Modal do Ativo (BM) */
function BMModal({ initial, fornecedores, T, onClose, onSave }) {
  const [f, setF] = useState(initial || emptyBM());
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(f);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: T.overlay }}>
      <div className="w-full max-w-lg rounded-2xl p-6 shadow-2xl flex flex-col gap-5 max-h-[90vh] overflow-y-auto" style={{ background: T.surface, color: T.ink }}>
        <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: T.borderSoft }}>
          <h3 className="pg-font-display text-lg font-semibold">{initial?.id ? "Editar Ativo / BM" : "Novo Ativo / BM"}</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:opacity-70"><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Field label="Nome da BM / Identificador *" T={T}>
            <input required value={f.nome} onChange={set("nome")} placeholder="Ex: BM 01 - Perfil Principal" className={inputCls} style={inputStyleFor(T)} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Telefone / WhatsApp" T={T}>
              <input value={f.telefone} onChange={set("telefone")} placeholder="(00) 00000-0000" className={inputCls} style={inputStyleFor(T)} />
            </Field>
            <Field label="Status" T={T}>
              <select value={f.status} onChange={set("status")} className={inputCls} style={inputStyleFor(T)}>
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
              <select value={f.fornecedor} onChange={set("fornecedor")} className={inputCls} style={inputStyleFor(T)}>
                <option value="">Selecione...</option>
                {fornecedores.map((forn) => (
                  <option key={forn.id} value={forn.nome}>{forn.nome}</option>
                ))}
              </select>
            </Field>
            <Field label="Valor de Compra (R$)" T={T}>
              <input type="number" step="0.01" value={f.valor} onChange={set("valor")} placeholder="0,00" className={inputCls} style={inputStyleFor(T)} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Data da Compra" T={T}>
              <input type="date" value={f.dataCompra} onChange={set("dataCompra")} className={inputCls} style={inputStyleFor(T)} />
            </Field>
            <Field label="Data Conexão/Ativação" T={T}>
              <input type="date" value={f.dataConexao} onChange={set("dataConexao")} className={inputCls} style={inputStyleFor(T)} />
            </Field>
          </div>

          <Field label="Observações e Anotações Internas" T={T}>
            <textarea rows={3} value={f.observacoes} onChange={set("observacoes")} placeholder="Links de perfil, IDs adicionais, histórico de problemas..." className={inputCls} style={inputStyleFor(T)} />
          </Field>

          <div className="flex justify-end gap-3 mt-3 border-t pt-4" style={{ borderColor: T.borderSoft }}>
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ background: T.borderSoft, color: T.inkSoft }}>Cancelar</button>
            <button type="submit" className="px-5 py-2 rounded-lg text-sm font-medium text-white" style={{ background: T.primary }}>Salvar Ativo</button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* Componente Principal */
export default function PainelGestaoAtivos() {
  const [themeMode, setThemeMode] = useState("light");
  const [bms, setBms] = useState([]);
  const [fornecedores, setFornecedores] = useState([]);
  const [historico, setHistorico] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("dashboard");
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBm, setEditingBm] = useState(null);
  
  // Filtros
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [fornNome, setFornNome] = useState("");
  const [fornContato, setFornContato] = useState("");

  const T = THEMES[themeMode];

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
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setBms(data);
      setLoading(false);
    });

    const unsubForn = onSnapshot(collection(db, "fornecedores"), (snapshot) => {
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setFornecedores(data);
    });

    const unsubHist = onSnapshot(collection(db, "historico"), (snapshot) => {
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      data.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      setHistorico(data);
    });

    return () => {
      unsubBMs();
      unsubForn();
      unsubHist();
    };
  }, []);

  const handleSaveBM = async (bmData) => {
    const isEdit = Boolean(bmData.id);
    const bmId = bmData.id || uid();
    const payload = { ...bmData, id: bmId };

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
    const fId = uid();
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

  // Exportação CSV
  const exportarCSV = () => {
    if (filteredBMs.length === 0) return alert("Nenhum dado para exportar.");

    const headers = ["ID,Nome,Status,Telefone,Fornecedor,Valor,Data Compra,Data Conexao,Observacoes"];
    const rows = filteredBMs.map(b => 
      `"${b.id}","${b.nome || ''}","${b.status || ''}","${b.telefone || ''}","${b.fornecedor || ''}","${b.valor || 0}","${b.dataCompra || ''}","${b.dataConexao || ''}","${(b.observacoes || '').replace(/"/g, '""')}"`
    );

    const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `relatorio_ativos_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Cálculo de inatividade no estoque (> 15 dias)
  const bmsInativasEstoque = useMemo(() => {
    const hoje = new Date();
    return bms.filter(b => {
      if (b.status !== "estoque" || !b.dataCompra) return false;
      const dataC = new Date(b.dataCompra);
      const diffDias = Math.floor((hoje - dataC) / (1000 * 60 * 60 * 24));
      return diffDias > 15;
    });
  }, [bms]);

  const stats = useMemo(() => {
    let gastoTotal = 0, ativas = 0, estoque = 0, banidas = 0;
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

  const chartData = useMemo(() => {
    const counts = { ativa: 0, estoque: 0, em_recurso: 0, banida: 0, vendida: 0 };
    bms.forEach((b) => { if (counts[b.status] !== undefined) counts[b.status]++; });
    return [
      { name: "Ativas", qtd: counts.ativa },
      { name: "Estoque", qtd: counts.estoque },
      { name: "Recurso", qtd: counts.em_recurso },
      { name: "Banidas", qtd: counts.banida },
      { name: "Vendidas", qtd: counts.vendida },
    ];
  }, [bms]);

  const filteredBMs = useMemo(() => {
    return bms.filter((b) => {
      const matchSearch = (b.nome || "").toLowerCase().includes(search.toLowerCase()) ||
        (b.fornecedor || "").toLowerCase().includes(search.toLowerCase()) ||
        (b.telefone || "").toLowerCase().includes(search.toLowerCase());
      
      const matchStatus = statusFilter === "todos" || b.status === statusFilter;
      
      let matchData = true;
      if (startDate && b.dataCompra) matchData = matchData && b.dataCompra >= startDate;
      if (endDate && b.dataCompra) matchData = matchData && b.dataCompra <= endDate;

      return matchSearch && matchStatus && matchData;
    });
  }, [bms, search, statusFilter, startDate, endDate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center gap-2" style={{ background: T.bg, color: T.ink }}>
        <Loader2 size={24} className="animate-spin" />
        <span className="pg-font-body text-sm">Carregando painel de ativos...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: T.bg, color: T.ink }}>
      <FontStyles />
      <header className="border-b sticky top-0 z-40 backdrop-blur-md" style={{ background: T.surface + "EE", borderColor: T.borderSoft }}>
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white" style={{ background: T.primary }}>
              <ShieldCheck size={20} />
            </div>
            <span className="pg-font-display font-bold text-lg">Gestão Pro</span>
          </div>

          <nav className="flex items-center gap-1">
            <button onClick={() => setTab("dashboard")} className={`px-3 py-2 rounded-lg text-sm flex items-center gap-2 ${tab === "dashboard" ? "font-semibold" : ""}`} style={{ background: tab === "dashboard" ? T.primarySoft : "transparent", color: tab === "dashboard" ? T.primary : T.inkSoft }}>
              <LayoutGrid size={18} /> <span className="hidden md:inline">Dashboard</span>
            </button>
            <button onClick={() => setTab("bms")} className={`px-3 py-2 rounded-lg text-sm flex items-center gap-2 ${tab === "bms" ? "font-semibold" : ""}`} style={{ background: tab === "bms" ? T.primarySoft : "transparent", color: tab === "bms" ? T.primary : T.inkSoft }}>
              <Boxes size={18} /> <span className="hidden md:inline">Ativos / BMs</span>
            </button>
            <button onClick={() => setTab("fornecedores")} className={`px-3 py-2 rounded-lg text-sm flex items-center gap-2 ${tab === "fornecedores" ? "font-semibold" : ""}`} style={{ background: tab === "fornecedores" ? T.primarySoft : "transparent", color: tab === "fornecedores" ? T.primary : T.inkSoft }}>
              <Building2 size={18} /> <span className="hidden md:inline">Fornecedores</span>
            </button>
            <button onClick={() => setTab("historico")} className={`px-3 py-2 rounded-lg text-sm flex items-center gap-2 ${tab === "historico" ? "font-semibold" : ""}`} style={{ background: tab === "historico" ? T.primarySoft : "transparent", color: tab === "historico" ? T.primary : T.inkSoft }}>
              <History size={18} /> <span className="hidden md:inline">Histórico</span>
            </button>
          </nav>

          <div className="flex items-center gap-2">
            <button onClick={() => setThemeMode(themeMode === "light" ? "dark" : "light")} className="p-2 rounded-lg border" style={{ borderColor: T.border }}>
              {themeMode === "light" ? <Moon size={18} /> : <Sun size={18} />}
            </button>
            <button onClick={() => { setEditingBm(null); setIsModalOpen(true); }} className="px-4 py-2 rounded-lg text-sm font-medium text-white flex items-center gap-2" style={{ background: T.primary }}>
              <Plus size={18} /> <span className="hidden sm:inline">Novo Ativo</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Banner de Alerta de Estoque Parado */}
        {bmsInativasEstoque.length > 0 && (
          <div className="mb-6 p-4 rounded-xl border flex items-center gap-3" style={{ background: T.STATUS.em_recurso.bg, borderColor: T.gold, color: T.STATUS.em_recurso.fg }}>
            <AlertTriangle size={20} className="shrink-0" />
            <div className="text-sm">
              <strong>Atenção:</strong> Você tem <b>{bmsInativasEstoque.length}</b> ativo(s) no estoque há mais de 15 dias sem ativação.
            </div>
          </div>
        )}

        {tab === "dashboard" && (
          <div className="flex flex-col gap-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-5 rounded-2xl border" style={{ background: T.surface, borderColor: T.borderSoft }}>
                <span className="text-xs font-medium" style={{ color: T.inkSoft }}>Total BMs/Ativos</span>
                <div className="text-2xl font-bold pg-font-display mt-1">{stats.totalBMs}</div>
              </div>
              <div className="p-5 rounded-2xl border" style={{ background: T.surface, borderColor: T.borderSoft }}>
                <span className="text-xs font-medium" style={{ color: T.inkSoft }}>Investimento Acumulado</span>
                <div className="text-2xl font-bold pg-font-display mt-1" style={{ color: T.gold }}>{brl(stats.gastoTotal)}</div>
              </div>
              <div className="p-5 rounded-2xl border" style={{ background: T.surface, borderColor: T.borderSoft }}>
                <span className="text-xs font-medium" style={{ color: T.inkSoft }}>BMs Ativas</span>
                <div className="text-2xl font-bold pg-font-display mt-1" style={{ color: T.STATUS.ativa.fg }}>{stats.ativas}</div>
              </div>
              <div className="p-5 rounded-2xl border" style={{ background: T.surface, borderColor: T.borderSoft }}>
                <span className="text-xs font-medium" style={{ color: T.inkSoft }}>Taxa de Operação</span>
                <div className="text-2xl font-bold pg-font-display mt-1">{stats.taxaAtivas}%</div>
              </div>
            </div>

            <div className="rounded-2xl p-6 border flex flex-col gap-4" style={{ background: T.surface, borderColor: T.borderSoft }}>
              <span className="pg-font-display font-semibold text-sm">Distribuição por Status</span>
              <div className="h-72">
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
          </div>
        )}

        {tab === "bms" && (
          <div className="flex flex-col gap-4">
            <div className="p-4 rounded-2xl border flex flex-col gap-4" style={{ background: T.surface, borderColor: T.borderSoft }}>
              <div className="flex flex-col md:flex-row gap-3">
                <div className="flex-1 flex items-center gap-2 border rounded-lg px-3 py-1.5" style={{ borderColor: T.border }}>
                  <Search size={18} style={{ color: T.inkFaint }} />
                  <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome, fornecedor ou telefone..." className="w-full bg-transparent text-sm outline-none" style={{ color: T.ink }} />
                </div>
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-2 rounded-lg text-sm" style={inputStyleFor(T)}>
                  <option value="todos">Todos os Status</option>
                  <option value="ativa">Ativa</option>
                  <option value="estoque">Estoque</option>
                  <option value="em_recurso">Recurso</option>
                  <option value="banida">Banida</option>
                  <option value="vendida">Vendida</option>
                </select>
                <button onClick={exportarCSV} className="px-4 py-2 rounded-lg text-sm font-medium border flex items-center justify-center gap-2" style={{ borderColor: T.border, color: T.ink }}>
                  <Download size={16} /> Exportar CSV
                </button>
              </div>

              {/* Filtros por Data */}
              <div className="flex flex-wrap items-center gap-3 pt-2 border-t text-xs" style={{ borderColor: T.borderSoft, color: T.inkSoft }}>
                <span className="flex items-center gap-1 font-semibold"><Filter size={14} /> Filtro Compra:</span>
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="px-2 py-1 rounded border text-xs" style={inputStyleFor(T)} />
                <span>até</span>
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="px-2 py-1 rounded border text-xs" style={inputStyleFor(T)} />
                {(startDate || endDate) && (
                  <button onClick={() => { setStartDate(""); setEndDate(""); }} className="text-red-500 underline ml-2">Limpar datas</button>
                )}
              </div>
            </div>

            <div className="rounded-2xl border overflow-x-auto" style={{ background: T.surface, borderColor: T.borderSoft }}>
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b" style={{ borderColor: T.borderSoft, color: T.inkSoft }}>
                    <th className="p-4">Ativo</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Telefone</th>
                    <th className="p-4">Fornecedor</th>
                    <th className="p-4">Data Compra</th>
                    <th className="p-4 text-right">Valor</th>
                    <th className="p-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: T.borderSoft }}>
                  {filteredBMs.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="p-8 text-center" style={{ color: T.inkFaint }}>Nenhum ativo localizado com os filtros aplicados.</td>
                    </tr>
                  ) : (
                    filteredBMs.map((bm) => (
                      <tr key={bm.id} className="transition-colors hover:bg-opacity-50" style={{ ":hover": { background: T.hoverRow } }}>
                        <td className="p-4 font-medium">{bm.nome}</td>
                        <td className="p-4"><StatusBadge status={bm.status} T={T} /></td>
                        <td className="p-4" style={{ color: T.inkSoft }}>{bm.telefone || "—"}</td>
                        <td className="p-4" style={{ color: T.inkSoft }}>{bm.fornecedor || "—"}</td>
                        <td className="p-4 pg-tnum" style={{ color: T.inkSoft }}>{bm.dataCompra ? new Date(bm.dataCompra + "T00:00:00").toLocaleDateString("pt-BR") : "—"}</td>
                        <td className="p-4 text-right pg-tnum font-medium">{brl(bm.valor)}</td>
                        <td className="p-4 text-right">
                          <button onClick={() => { setEditingBm(bm); setIsModalOpen(true); }} className="p-1.5 mr-1 rounded hover:bg-opacity-10 hover:bg-black" style={{ color: T.primary }}>
                            <Pencil size={16} />
                          </button>
                          <button onClick={() => handleDeleteBM(bm.id, bm.nome)} className="p-1.5 rounded hover:bg-opacity-10 hover:bg-black text-red-500">
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === "fornecedores" && (
          <div className="flex flex-col gap-6">
            <form onSubmit={handleAddFornecedor} className="p-6 rounded-2xl border flex flex-col md:flex-row gap-4 items-end" style={{ background: T.surface, borderColor: T.borderSoft }}>
              <div className="flex-1 w-full"><Field label="Nome do Fornecedor *" T={T}><input required value={fornNome} onChange={(e) => setFornNome(e.target.value)} placeholder="Ex: Lucas Contingência" className={inputCls} style={inputStyleFor(T)} /></Field></div>
              <div className="flex-1 w-full"><Field label="Contato / Link" T={T}><input value={fornContato} onChange={(e) => setFornContato(e.target.value)} placeholder="Telegram / WhatsApp" className={inputCls} style={inputStyleFor(T)} /></Field></div>
              <button type="submit" className="w-full md:w-auto px-5 py-2 rounded-lg text-sm font-medium text-white" style={{ background: T.primary }}>Cadastrar</button>
            </form>

            <div className="rounded-2xl border overflow-x-auto" style={{ background: T.surface, borderColor: T.borderSoft }}>
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
                        <button onClick={() => handleDeleteFornecedor(f.id, f.nome)} className="p-1 text-red-500 hover:opacity-70"><Trash2 size={16} /></button>
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
            <div className="rounded-2xl border overflow-hidden" style={{ background: T.surface, borderColor: T.borderSoft }}>
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
