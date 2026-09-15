import React, { useState, useEffect, useMemo } from "react";
import {
  LayoutGrid,
  Boxes,
  Building2,
  History,
  Wallet,
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
  Filter,
  Tag as TagIcon,
  Palette,
  Target,
  Check,
  Repeat,
  RotateCcw,
  Menu,
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
import {
  collection,
  onSnapshot,
  doc,
  setDoc,
  deleteDoc,
  addDoc,
} from "firebase/firestore";

/* ---------------- cor personalizada: utilitários ---------------- */
function hexToRgb(hex) {
  let h = (hex || "#0B4C82").replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const num = parseInt(h, 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}
function rgba(hex, alpha) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

const COLOR_PRESETS = [
  "#0B4C82", // azul
  "#1F7A4D", // verde
  "#7A3FA0", // roxo
  "#A3402B", // terracota
  "#0E7C86", // teal
  "#B8862F", // dourado
  "#C23B6B", // pink
  "#3A3A3A", // grafite
];

const THEMES = {
  light: {
    bg: "#F1F3F5",
    surface: "#FFFFFF",
    surfaceAlt: "#F7F8FA",
    rail: "#FFFFFF",
    ink: "#131A22",
    inkSoft: "#57667A",
    inkFaint: "#96A3B3",
    border: "#E1E6EB",
    borderSoft: "#EBEEF1",
    overlay: "rgba(10,16,24,0.5)",
    STATUS: {
      ativa: { label: "Ativa", fg: "#1F7A4D" },
      em_recurso: { label: "Em recurso", fg: "#A8791F" },
      banida: { label: "Banida", fg: "#A3402B" },
      estoque: { label: "Em estoque", fg: "#57667A" },
      vendida: { label: "Vendida", fg: "#6A4FA0" },
    },
    QUALIDADE: {
      alta: { label: "Alta", fg: "#1F7A4D" },
      media: { label: "Média", fg: "#A8791F" },
      baixa: { label: "Baixa", fg: "#A3402B" },
    },
  },
  dark: {
    bg: "#0A0E14",
    surface: "#10151D",
    surfaceAlt: "#141A23",
    rail: "#0D1219",
    ink: "#E8ECF1",
    inkSoft: "#8B98A8",
    inkFaint: "#586374",
    border: "#1E2733",
    borderSoft: "#161D26",
    overlay: "rgba(3,6,10,0.65)",
    STATUS: {
      ativa: { label: "Ativa", fg: "#5FD08B" },
      em_recurso: { label: "Em recurso", fg: "#E3BA6C" },
      banida: { label: "Banida", fg: "#E58868" },
      estoque: { label: "Em estoque", fg: "#93A2B5" },
      vendida: { label: "Vendida", fg: "#B29CE8" },
    },
    QUALIDADE: {
      alta: { label: "Alta", fg: "#5FD08B" },
      media: { label: "Média", fg: "#E3BA6C" },
      baixa: { label: "Baixa", fg: "#E58868" },
    },
  },
};

const uid = () => Math.random().toString(36).slice(2, 10);
const brl = (n) =>
  (Number(n) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const hojeYYYYMM = () => new Date().toISOString().slice(0, 7);
const hojeISO = () => new Date().toISOString().split("T")[0];
const monthLabel = (m) => {
  if (m === "todos") return "Todos os períodos";
  const [y, mo] = m.split("-");
  const dt = new Date(Number(y), Number(mo) - 1, 1);
  const label = dt.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return label.charAt(0).toUpperCase() + label.slice(1);
};

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
  tags: [],
  qualidade: "media",
  ultimoUsoRodizio: "",
  historicoUsoRodizio: [],
});

function FontStyles() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');
      .pg-font-display { font-family: 'Space Grotesk', sans-serif; }
      .pg-font-body { font-family: 'Inter', sans-serif; }
      .pg-font-mono { font-family: 'JetBrains Mono', monospace; }
      .pg-tnum { font-variant-numeric: tabular-nums; }
      .pg-mono { font-family: 'JetBrains Mono', monospace; font-variant-numeric: tabular-nums; }
      .pg-scroll::-webkit-scrollbar { height: 8px; width: 8px; }
      .pg-scroll::-webkit-scrollbar-thumb { background: rgba(128,128,128,0.3); border-radius: 8px; }
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
    <span className="inline-flex items-center gap-1.5 text-xs font-medium" style={{ color: cfg.fg }}>
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: cfg.fg }} />
      {cfg.label}
    </span>
  );
}

/* Barras de sinal — reflete a "qualidade do WABA" no vocabulário do próprio domínio */
function QualidadeBadge({ qualidade, T }) {
  const cfg = T.QUALIDADE[qualidade] || T.QUALIDADE.media;
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

/* Fita de indicadores — números sempre em mono, separados por traço fino (não cards repetidos) */
function StatStrip({ items, T }) {
  return (
    <div className="rounded-xl border flex flex-wrap overflow-hidden" style={{ borderColor: T.borderSoft, background: T.surface }}>
      {items.map((it, i) => (
        <div
          key={it.label}
          className="flex-1 min-w-[150px] p-5"
          style={{ borderRight: i < items.length - 1 ? `1px solid ${T.borderSoft}` : "none" }}
        >
          <div className="text-xs mb-1.5" style={{ color: T.inkSoft }}>{it.label}</div>
          <div className="pg-mono text-2xl font-semibold" style={{ color: it.color || T.ink }}>{it.value}</div>
        </div>
      ))}
    </div>
  );
}

/* Trilho do ciclo de vida do ativo — o único elemento "ousado" e específico do domínio */
const CICLO_ORDEM = ["estoque", "ativa", "em_recurso", "banida", "vendida"];
function TrilhoCiclo({ bms, T }) {
  const contagens = useMemo(() => {
    const c = { estoque: 0, ativa: 0, em_recurso: 0, banida: 0, vendida: 0 };
    bms.forEach((b) => { if (c[b.status] !== undefined) c[b.status]++; });
    return c;
  }, [bms]);
  const max = Math.max(1, ...CICLO_ORDEM.map((k) => contagens[k]));
  return (
    <div className="px-4 py-4">
      <div className="text-xs mb-3" style={{ color: T.inkFaint }}>Fluxo de ativos</div>
      <div className="flex flex-col gap-2.5">
        {CICLO_ORDEM.map((k) => {
          const cfg = T.STATUS[k];
          const pct = Math.max(6, (contagens[k] / max) * 100);
          return (
            <div key={k} className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: cfg.fg }} />
              <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: T.borderSoft }}>
                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: cfg.fg }} />
              </div>
              <span className="pg-mono text-xs w-5 text-right shrink-0" style={{ color: T.inkSoft }}>{contagens[k]}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ProgressBar({ value, max, T, color }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const over = max > 0 && value > max;
  return (
    <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: T.borderSoft }}>
      <div
        className="h-full rounded-full transition-all"
        style={{ width: `${pct}%`, background: over ? "#A3402B" : color }}
      />
    </div>
  );
}

/* ---------------- editor de tags (chips) ---------------- */
function TagsInput({ value, onChange, T }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const t = draft.trim();
    if (t && !value.includes(t)) onChange([...value, t]);
    setDraft("");
  };
  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {value.map((t) => (
          <span
            key={t}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs"
            style={{ background: T.primarySoft, color: T.primary }}
          >
            {t}
            <button
              type="button"
              onClick={() => onChange(value.filter((x) => x !== t))}
              className="hover:opacity-60"
            >
              <X size={11} />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              add();
            }
          }}
          placeholder="Digite uma tag e pressione Enter"
          className={inputCls}
          style={inputStyleFor(T)}
        />
        <button
          type="button"
          onClick={add}
          className="px-3 rounded-lg text-sm font-medium shrink-0"
          style={{ background: T.primarySoft, color: T.primary }}
        >
          Adicionar
        </button>
      </div>
    </div>
  );
}

/* ---------------- seletor de cor ---------------- */
function ColorPickerPanel({ color, onChange, T, onClose }) {
  return (
    <div
      className="absolute right-0 top-12 z-50 w-64 rounded-xl p-4 border"
      style={{ background: T.surface, border: `1px solid ${T.borderSoft}` }}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="pg-font-display text-sm font-semibold" style={{ color: T.ink }}>
          Cor do painel
        </span>
        <button onClick={onClose}>
          <X size={16} color={T.inkSoft} />
        </button>
      </div>
      <div className="grid grid-cols-4 gap-2 mb-3">
        {COLOR_PRESETS.map((c) => (
          <button
            key={c}
            onClick={() => onChange(c)}
            className="h-9 rounded-lg flex items-center justify-center"
            style={{ background: c }}
          >
            {c.toLowerCase() === color.toLowerCase() && <Check size={15} color="#fff" />}
          </button>
        ))}
      </div>
      <label className="pg-font-body text-xs font-medium block mb-1.5" style={{ color: T.inkSoft }}>
        Cor personalizada
      </label>
      <input
        type="color"
        value={color}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-9 rounded-lg cursor-pointer"
      />
    </div>
  );
}

/* ---------------- Modal do Ativo (BM) ---------------- */
function BMModal({ initial, fornecedores, T, onClose, onSave }) {
  const [f, setF] = useState(initial || emptyBM());
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(f);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: T.overlay }}>
      <div
        className="w-full max-w-lg rounded-xl p-6 border flex flex-col gap-5 max-h-[90vh] overflow-y-auto pg-scroll"
        style={{ background: T.surface, color: T.ink, borderColor: T.border }}
      >
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
              <input
                value={f.fornecedor}
                onChange={set("fornecedor")}
                placeholder="Nome do fornecedor"
                list="fornecedores-datalist"
                className={inputCls}
                style={inputStyleFor(T)}
              />
              <datalist id="fornecedores-datalist">
                {fornecedores.map((forn) => (
                  <option key={forn.id} value={forn.nome} />
                ))}
              </datalist>
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

          <Field label="Qualidade do WABA" T={T}>
            <select value={f.qualidade || "media"} onChange={set("qualidade")} className={inputCls} style={inputStyleFor(T)}>
              <option value="alta">Alta</option>
              <option value="media">Média</option>
              <option value="baixa">Baixa</option>
            </select>
          </Field>

          <Field label="Tags" T={T}>
            <TagsInput value={f.tags || []} onChange={(tags) => setF({ ...f, tags })} T={T} />
          </Field>

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

/* ---------------- Rodízio: utilitários de pontuação ---------------- */
const PESO_QUALIDADE = { alta: 3, media: 2, baixa: 1 };

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
  const diasFator = dias === null ? 14 : Math.min(dias, 14); // nunca usada = topo da fila
  const usos7d = usosNosUltimosDias(bm.historicoUsoRodizio, 7);
  return pesoQ * 10 + diasFator - usos7d * 6;
}

/* ---------------- Painel de Rodízio (kanban de disponibilidade) ---------------- */
function PainelRodizio({ bms, T, onMarcarUso, onDesfazerUso }) {
  const elegiveis = useMemo(
    () => bms.filter((b) => b.status === "ativa" || b.status === "estoque"),
    [bms]
  );

  const emUsoHoje = useMemo(
    () => elegiveis.filter((b) => b.ultimoUsoRodizio === hojeISO()),
    [elegiveis]
  );

  const emDescanso = useMemo(
    () =>
      elegiveis.filter((b) => {
        if (b.ultimoUsoRodizio === hojeISO()) return false;
        const usos7d = usosNosUltimosDias(b.historicoUsoRodizio, 7);
        return b.qualidade === "baixa" || usos7d >= 3;
      }),
    [elegiveis]
  );

  const disponiveis = useMemo(() => {
    const idsExcluidos = new Set([...emUsoHoje, ...emDescanso].map((b) => b.id));
    return elegiveis
      .filter((b) => !idsExcluidos.has(b.id))
      .map((b) => ({ ...b, _score: calcularScore(b) }))
      .sort((a, b) => b._score - a._score);
  }, [elegiveis, emUsoHoje, emDescanso]);

  const Coluna = ({ titulo, cor, itens, children }) => (
    <div className="flex-1 min-w-[260px] rounded-xl border flex flex-col" style={{ background: T.surface, borderColor: T.borderSoft }}>
      <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: T.borderSoft }}>
        <span className="pg-font-display font-semibold text-sm flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: cor }} />
          {titulo}
        </span>
        <span className="text-xs pg-tnum px-2 py-0.5 rounded-full" style={{ background: T.borderSoft, color: T.inkSoft }}>
          {itens.length}
        </span>
      </div>
      <div className="p-3 flex flex-col gap-2 max-h-[70vh] overflow-y-auto pg-scroll">
        {itens.length === 0 ? (
          <div className="p-6 text-center text-xs" style={{ color: T.inkFaint }}>
            Nenhuma BM aqui no momento.
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );

  const Card = ({ bm, acao }) => {
    const dias = diasDesde(bm.ultimoUsoRodizio);
    const usos7d = usosNosUltimosDias(bm.historicoUsoRodizio, 7);
    return (
      <div className="p-3 rounded-xl border flex flex-col gap-2" style={{ borderColor: T.borderSoft, background: T.bg }}>
        <div className="flex items-start justify-between gap-2">
          <span className="text-sm font-medium leading-tight">{bm.nome}</span>
          <QualidadeBadge qualidade={bm.qualidade || "media"} T={T} />
        </div>
        <div className="flex items-center gap-3 text-xs" style={{ color: T.inkFaint }}>
          <span>{dias === null ? "Nunca usada" : `Usada há ${dias}d`}</span>
          <span>•</span>
          <span>{usos7d} uso(s) em 7d</span>
        </div>
        {acao}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="pg-font-display text-xl font-semibold">Rodízio de uso</h1>
          <p className="text-sm mt-1" style={{ color: T.inkSoft }}>
            Prioridade calculada pela qualidade do WABA e pela frequência de uso recente — você decide quantas entram hoje.
          </p>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-4">
        <Coluna titulo="Disponível" cor={T.primary} itens={disponiveis}>
          {disponiveis.map((bm) => (
            <Card
              key={bm.id}
              bm={bm}
              acao={
                <button
                  onClick={() => onMarcarUso(bm)}
                  className="w-full py-1.5 rounded-lg text-xs font-medium text-white flex items-center justify-center gap-1.5"
                  style={{ background: T.primary }}
                >
                  <Repeat size={13} /> Usar hoje
                </button>
              }
            />
          ))}
        </Coluna>

        <Coluna titulo="Em uso hoje" cor={T.STATUS.ativa.fg} itens={emUsoHoje}>
          {emUsoHoje.map((bm) => (
            <Card
              key={bm.id}
              bm={bm}
              acao={
                <button
                  onClick={() => onDesfazerUso(bm)}
                  className="w-full py-1.5 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5"
                  style={{ background: T.borderSoft, color: T.inkSoft }}
                >
                  <RotateCcw size={13} /> Desfazer
                </button>
              }
            />
          ))}
        </Coluna>

        <Coluna titulo="Em descanso" cor={T.STATUS.em_recurso.fg} itens={emDescanso}>
          {emDescanso.map((bm) => (
            <Card key={bm.id} bm={bm} acao={null} />
          ))}
        </Coluna>
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
  const [metas, setMetas] = useState({}); // { "2026-09": { orcamento, metaAtivos } }
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("dashboard");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBm, setEditingBm] = useState(null);

  // Filtros - Ativos
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [fornecedorFilter, setFornecedorFilter] = useState("todos");
  const [selectedTags, setSelectedTags] = useState([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Mês em foco (Dashboard + Financeiro)
  const [mesSelecionado, setMesSelecionado] = useState(hojeYYYYMM());
  const [orcamentoDraft, setOrcamentoDraft] = useState("");
  const [metaAtivosDraft, setMetaAtivosDraft] = useState("");

  const [fornNome, setFornNome] = useState("");
  const [fornContato, setFornContato] = useState("");

  // preferências salvas localmente (por usuário/navegador)
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
    const base = THEMES[themeMode];
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
      const data = snapshot.docs.map((d) => ({ id: d.id, tags: [], qualidade: "media", ultimoUsoRodizio: "", historicoUsoRodizio: [], ...d.data() }));
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
      `Meta de ${monthLabel(mesSelecionado)}: orçamento ${brl(orcamentoDraft)}, meta de ativos ${metaAtivosDraft || 0}`
    );
  };

  const handleSaveBM = async (bmData) => {
    const isEdit = Boolean(bmData.id);
    const bmId = bmData.id || uid();
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

  // ---- Rodízio: marcar/desfazer uso do dia (não altera status nem outros campos da BM) ----
  const handleMarcarUsoRodizio = async (bm) => {
    const historicoAtual = bm.historicoUsoRodizio || [];
    const novoHistorico = [...historicoAtual, hojeISO()].slice(-60);
    await setDoc(
      doc(db, "bms", bm.id),
      { ultimoUsoRodizio: hojeISO(), historicoUsoRodizio: novoHistorico },
      { merge: true }
    );
    await registrarHistorico("Rodízio", `BM "${bm.nome}" marcada como usada em ${new Date().toLocaleDateString("pt-BR")}`);
  };

  const handleDesfazerUsoRodizio = async (bm) => {
    const novoHistorico = (bm.historicoUsoRodizio || []).filter((d) => d !== hojeISO());
    await setDoc(
      doc(db, "bms", bm.id),
      { ultimoUsoRodizio: "", historicoUsoRodizio: novoHistorico },
      { merge: true }
    );
    await registrarHistorico("Rodízio", `Uso de hoje desfeito para a BM "${bm.nome}"`);
  };

  const exportarCSV = () => {
    if (filteredBMs.length === 0) return alert("Nenhum dado para exportar.");
    const headers = ["ID,Nome,Status,Telefone,Fornecedor,Valor,Data Compra,Data Conexao,Tags,Observacoes"];
    const rows = filteredBMs.map(
      (b) =>
        `"${b.id}","${b.nome || ""}","${b.status || ""}","${b.telefone || ""}","${b.fornecedor || ""}","${b.valor || 0}","${b.dataCompra || ""}","${b.dataConexao || ""}","${(b.tags || []).join("; ")}","${(b.observacoes || "").replace(/"/g, '""')}"`
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

  const bmsInativasEstoque = useMemo(() => {
    const hoje = new Date();
    return bms.filter((b) => {
      if (b.status !== "estoque" || !b.dataCompra) return false;
      const dataC = new Date(b.dataCompra);
      const diffDias = Math.floor((hoje - dataC) / (1000 * 60 * 60 * 24));
      return diffDias > 15;
    });
  }, [bms]);

  const allTags = useMemo(() => {
    const s = new Set();
    bms.forEach((b) => (b.tags || []).forEach((t) => s.add(t)));
    return Array.from(s).sort();
  }, [bms]);

  const fornecedorNomes = useMemo(() => {
    const s = new Set(fornecedores.map((f) => f.nome));
    bms.forEach((b) => b.fornecedor && s.add(b.fornecedor));
    return Array.from(s).filter(Boolean).sort();
  }, [fornecedores, bms]);

  const mesesDisponiveis = useMemo(() => {
    const s = new Set([hojeYYYYMM()]);
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
      .map(([m, valor]) => ({ mes: monthLabel(m).split("/")[0].slice(0, 3), valor }));
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

  const filteredBMs = useMemo(() => {
    return bms.filter((b) => {
      const matchSearch =
        (b.nome || "").toLowerCase().includes(search.toLowerCase()) ||
        (b.fornecedor || "").toLowerCase().includes(search.toLowerCase()) ||
        (b.telefone || "").toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === "todos" || b.status === statusFilter;
      const matchFornecedor = fornecedorFilter === "todos" || b.fornecedor === fornecedorFilter;
      const matchTags = selectedTags.length === 0 || (b.tags || []).some((t) => selectedTags.includes(t));
      let matchData = true;
      if (startDate && b.dataCompra) matchData = matchData && b.dataCompra >= startDate;
      if (endDate && b.dataCompra) matchData = matchData && b.dataCompra <= endDate;
      return matchSearch && matchStatus && matchFornecedor && matchTags && matchData;
    });
  }, [bms, search, statusFilter, fornecedorFilter, selectedTags, startDate, endDate]);

  const limparFiltrosAtivos = () => {
    setSearch("");
    setStatusFilter("todos");
    setFornecedorFilter("todos");
    setSelectedTags([]);
    setStartDate("");
    setEndDate("");
  };
  const filtrosAtivosCount =
    (search ? 1 : 0) +
    (statusFilter !== "todos" ? 1 : 0) +
    (fornecedorFilter !== "todos" ? 1 : 0) +
    selectedTags.length +
    (startDate ? 1 : 0) +
    (endDate ? 1 : 0);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center gap-2" style={{ background: T.bg, color: T.ink }}>
        <Loader2 size={24} className="animate-spin" />
        <span className="pg-font-body text-sm">Carregando painel de ativos...</span>
      </div>
    );
  }

  const MesSelector = () => (
    <select
      value={mesSelecionado}
      onChange={(e) => setMesSelecionado(e.target.value)}
      className="px-3 py-2 rounded-lg text-sm pg-font-body"
      style={inputStyleFor(T)}
    >
      <option value="todos">Todos os períodos</option>
      {mesesDisponiveis.map((m) => (
        <option key={m} value={m}>
          {monthLabel(m)}
        </option>
      ))}
    </select>
  );

  const NAV_ITEMS = [
    { id: "dashboard", label: "Dashboard", icon: LayoutGrid },
    { id: "bms", label: "Ativos / BMs", icon: Boxes, count: stats.totalBMs },
    { id: "rodizio", label: "Rodízio", icon: Repeat },
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
        className="w-full flex items-center gap-3 pl-3 pr-2.5 py-2 text-sm rounded-lg shrink-0"
        style={{
          background: active ? T.primarySoft : "transparent",
          color: active ? T.primary : T.inkSoft,
          fontWeight: active ? 600 : 500,
          borderLeft: active ? `2px solid ${T.primary}` : "2px solid transparent",
        }}
      >
        <Icon size={17} />
        <span className="flex-1 text-left">{item.label}</span>
        {typeof item.count === "number" && (
          <span className="pg-mono text-xs" style={{ color: active ? T.primary : T.inkFaint }}>{item.count}</span>
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
        <div className="flex items-center gap-2.5 px-4 h-16 border-b shrink-0" style={{ borderColor: T.borderSoft }}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white shrink-0" style={{ background: T.primary }}>
            <ShieldCheck size={17} />
          </div>
          <div className="leading-tight">
            <div className="pg-font-display font-bold text-sm">WA Base</div>
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

      {/* Nav mobile */}
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
            <div className="border-t mt-2 pt-2" style={{ borderColor: T.borderSoft }}>
              <TrilhoCiclo bms={bms} T={T} />
            </div>
          </div>
        </div>
      )}

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
            className="px-4 py-2 rounded-lg text-sm font-medium text-white flex items-center gap-2 shrink-0"
            style={{ background: T.primary }}
          >
            <Plus size={18} /> <span className="hidden sm:inline">Novo Ativo</span>
          </button>
        </div>

        <main className="px-4 md:px-8 py-8 flex-1 min-w-0">
        {bmsInativasEstoque.length > 0 && (
          <div className="mb-6 p-4 rounded-xl border flex items-center gap-3" style={{ borderColor: T.STATUS.em_recurso.fg + "55", color: T.STATUS.em_recurso.fg }}>
            <AlertTriangle size={20} className="shrink-0" />
            <div className="text-sm" style={{ color: T.ink }}>
              <strong>Atenção:</strong> Você tem <b>{bmsInativasEstoque.length}</b> ativo(s) no estoque há mais de 15 dias sem ativação.
            </div>
          </div>
        )}

        {tab === "dashboard" && (
          <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <h1 className="pg-font-display text-xl font-semibold">Visão geral</h1>
              <MesSelector />
            </div>

            <StatStrip
              T={T}
              items={[
                { label: "Total BMs/Ativos", value: stats.totalBMs },
                { label: "Gasto no período", value: brl(gastoMes), color: T.STATUS.em_recurso.fg },
                { label: "BMs ativas agora", value: stats.ativas, color: T.STATUS.ativa.fg },
                { label: "Taxa de operação", value: `${stats.taxaAtivas}%` },
              ]}
            />

            {/* Metas do mês */}
            <div className="rounded-xl p-6 border grid md:grid-cols-2 gap-6" style={{ background: T.surface, borderColor: T.borderSoft }}>
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Wallet size={16} color={T.primary} />
                  <span className="pg-font-display font-semibold text-sm">Orçamento — {monthLabel(mesSelecionado)}</span>
                </div>
                <div className="flex items-end justify-between mb-2">
                  <span className="pg-tnum text-lg font-semibold">{brl(gastoMes)}</span>
                  <span className="text-xs" style={{ color: T.inkFaint }}>de {brl(metaAtual.orcamento || 0)}</span>
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
                  <Field label={`Orçamento de ${monthLabel(mesSelecionado)} (R$)`} T={T}>
                    <input type="number" value={orcamentoDraft} onChange={(e) => setOrcamentoDraft(e.target.value)} className={inputCls} style={inputStyleFor(T)} placeholder="0,00" />
                  </Field>
                </div>
                <div className="flex-1 min-w-[160px]">
                  <Field label="Meta de ativos conectados" T={T}>
                    <input type="number" value={metaAtivosDraft} onChange={(e) => setMetaAtivosDraft(e.target.value)} className={inputCls} style={inputStyleFor(T)} placeholder="0" />
                  </Field>
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
                  {tendenciaMensal.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-sm" style={{ color: T.inkFaint }}>
                      Sem dados suficientes ainda.
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={tendenciaMensal}>
                        <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
                        <XAxis dataKey="mes" stroke={T.inkSoft} fontSize={12} />
                        <YAxis stroke={T.inkSoft} fontSize={12} tickFormatter={(v) => `R$${v}`} />
                        <Tooltip formatter={(v) => brl(v)} contentStyle={{ background: T.surface, borderColor: T.border, color: T.ink }} />
                        <Line type="monotone" dataKey="valor" stroke={T.primary} strokeWidth={2.5} dot={{ r: 3 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === "bms" && (
          <div className="flex flex-col gap-4">
            <div className="p-4 rounded-xl border flex flex-col gap-4" style={{ background: T.surface, borderColor: T.borderSoft }}>
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
                <select value={fornecedorFilter} onChange={(e) => setFornecedorFilter(e.target.value)} className="px-3 py-2 rounded-lg text-sm" style={inputStyleFor(T)}>
                  <option value="todos">Todos os Fornecedores</option>
                  {fornecedorNomes.map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
                <button onClick={exportarCSV} className="px-4 py-2 rounded-lg text-sm font-medium border flex items-center justify-center gap-2" style={{ borderColor: T.border, color: T.ink }}>
                  <Download size={16} /> Exportar CSV
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-2 border-t text-xs" style={{ borderColor: T.borderSoft, color: T.inkSoft }}>
                <span className="flex items-center gap-1 font-semibold"><Filter size={14} /> Filtro Compra:</span>
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="px-2 py-1 rounded border text-xs" style={inputStyleFor(T)} />
                <span>até</span>
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="px-2 py-1 rounded border text-xs" style={inputStyleFor(T)} />
                {filtrosAtivosCount > 0 && (
                  <button onClick={limparFiltrosAtivos} className="underline ml-2" style={{ color: T.primary }}>
                    Limpar todos os filtros ({filtrosAtivosCount})
                  </button>
                )}
              </div>

              {allTags.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 pt-2 border-t" style={{ borderColor: T.borderSoft }}>
                  <span className="flex items-center gap-1 text-xs font-semibold" style={{ color: T.inkSoft }}>
                    <TagIcon size={14} /> Tags:
                  </span>
                  {allTags.map((t) => {
                    const active = selectedTags.includes(t);
                    return (
                      <button
                        key={t}
                        onClick={() =>
                          setSelectedTags((prev) => (active ? prev.filter((x) => x !== t) : [...prev, t]))
                        }
                        className="px-2.5 py-1 rounded-full text-xs font-medium"
                        style={{
                          background: active ? T.primary : T.primarySoft,
                          color: active ? "#fff" : T.primary,
                        }}
                      >
                        {t}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="rounded-xl border overflow-x-auto pg-scroll" style={{ background: T.surface, borderColor: T.borderSoft }}>
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b" style={{ borderColor: T.borderSoft, color: T.inkSoft }}>
                    <th className="p-4">Ativo</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Tags</th>
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
                      <td colSpan="8" className="p-8 text-center" style={{ color: T.inkFaint }}>Nenhum ativo localizado com os filtros aplicados.</td>
                    </tr>
                  ) : (
                    filteredBMs.map((bm) => (
                      <tr key={bm.id}>
                        <td className="p-4 font-medium">{bm.nome}</td>
                        <td className="p-4"><StatusBadge status={bm.status} T={T} /></td>
                        <td className="p-4">
                          <div className="flex flex-wrap gap-1 max-w-[160px]">
                            {(bm.tags || []).map((t) => (
                              <span key={t} className="px-2 py-0.5 rounded-full text-[11px]" style={{ background: T.primarySoft, color: T.primary }}>
                                {t}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="p-4" style={{ color: T.inkSoft }}>{bm.telefone || "—"}</td>
                        <td className="p-4" style={{ color: T.inkSoft }}>{bm.fornecedor || "—"}</td>
                        <td className="p-4 pg-tnum" style={{ color: T.inkSoft }}>{bm.dataCompra ? new Date(bm.dataCompra + "T00:00:00").toLocaleDateString("pt-BR") : "—"}</td>
                        <td className="p-4 text-right pg-tnum font-medium">{brl(bm.valor)}</td>
                        <td className="p-4 text-right whitespace-nowrap">
                          <button onClick={() => { setEditingBm(bm); setIsModalOpen(true); }} className="p-1.5 mr-1 rounded" style={{ color: T.primary }}>
                            <Pencil size={16} />
                          </button>
                          <button onClick={() => handleDeleteBM(bm.id, bm.nome)} className="p-1.5 rounded text-red-500">
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

        {tab === "financeiro" && (
          <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <h1 className="pg-font-display text-xl font-semibold">Financeiro</h1>
              <MesSelector />
            </div>

            <StatStrip
              T={T}
              items={[
                { label: "Orçamento do período", value: brl(metaAtual.orcamento || 0) },
                { label: "Gasto no período", value: brl(gastoMes), color: T.primary },
                {
                  label: "Saldo restante",
                  value: brl((Number(metaAtual.orcamento) || 0) - gastoMes),
                  color: (Number(metaAtual.orcamento) || 0) - gastoMes < 0 ? "#A3402B" : T.STATUS.ativa.fg,
                },
                { label: "Ativos no período", value: bmsDoMes.length },
              ]}
            />

            <div className="rounded-xl p-6 border flex flex-col gap-4" style={{ background: T.surface, borderColor: T.borderSoft }}>
              <span className="pg-font-display font-semibold text-sm">Gasto por fornecedor — {monthLabel(mesSelecionado)}</span>
              {gastoPorFornecedorChart.length === 0 ? (
                <div className="h-56 flex items-center justify-center text-sm" style={{ color: T.inkFaint }}>
                  Nenhum gasto registrado neste período.
                </div>
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={gastoPorFornecedorChart}>
                      <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false} />
                      <XAxis dataKey="name" stroke={T.inkSoft} fontSize={11} />
                      <YAxis stroke={T.inkSoft} fontSize={11} tickFormatter={(v) => `R$${v}`} />
                      <Tooltip formatter={(v) => brl(v)} contentStyle={{ background: T.surface, borderColor: T.border, color: T.ink }} />
                      <Bar dataKey="valor" fill={T.primary} radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div className="rounded-xl border overflow-x-auto pg-scroll" style={{ background: T.surface, borderColor: T.borderSoft }}>
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b" style={{ borderColor: T.borderSoft, color: T.inkSoft }}>
                    <th className="p-4">Fornecedor</th>
                    <th className="p-4 text-right">Ativos no período</th>
                    <th className="p-4 text-right">Gasto no período</th>
                    <th className="p-4 text-right">Total histórico</th>
                    <th className="p-4 text-right">Gasto histórico</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: T.borderSoft }}>
                  {fornecedorStats.length === 0 ? (
                    <tr><td colSpan="5" className="p-8 text-center" style={{ color: T.inkFaint }}>Nenhum fornecedor cadastrado.</td></tr>
                  ) : (
                    [...fornecedorStats]
                      .sort((a, b) => b.gastoGeral - a.gastoGeral)
                      .map((f) => (
                        <tr key={f.id}>
                          <td className="p-4 font-medium">{f.nome}</td>
                          <td className="p-4 text-right pg-tnum">{f.totalMes}</td>
                          <td className="p-4 text-right pg-tnum font-medium">{brl(f.gastoMes)}</td>
                          <td className="p-4 text-right pg-tnum" style={{ color: T.inkSoft }}>{f.totalGeral}</td>
                          <td className="p-4 text-right pg-tnum" style={{ color: T.inkSoft }}>{brl(f.gastoGeral)}</td>
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
            <form onSubmit={handleAddFornecedor} className="p-6 rounded-xl border flex flex-col md:flex-row gap-4 items-end" style={{ background: T.surface, borderColor: T.borderSoft }}>
              <div className="flex-1 w-full"><Field label="Nome do Fornecedor *" T={T}><input required value={fornNome} onChange={(e) => setFornNome(e.target.value)} placeholder="Ex: Lucas Contingência" className={inputCls} style={inputStyleFor(T)} /></Field></div>
              <div className="flex-1 w-full"><Field label="Contato / Link" T={T}><input value={fornContato} onChange={(e) => setFornContato(e.target.value)} placeholder="Telegram / WhatsApp" className={inputCls} style={inputStyleFor(T)} /></Field></div>
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

        {tab === "rodizio" && (
          <PainelRodizio
            bms={bms}
            T={T}
            onMarcarUso={handleMarcarUsoRodizio}
            onDesfazerUso={handleDesfazerUsoRodizio}
          />
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
