import React, { useState, useEffect, useMemo } from "react";
import {
  LayoutGrid, Boxes, Phone, Wallet, Target, Package, TrendingUp,
  AlertTriangle, Ban, Clock, Check, PieChart as PieChartIcon,
  Activity,
} from "lucide-react";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";
import { db } from "./firebase";
import { doc, setDoc } from "firebase/firestore";
import { AnimStyles, rgba, inputCls, inputStyleFor } from "./painelShared";

/* =====================================================================
   DASHBOARD NOVO — com tabs internas (Geral | Ativos | Telefonia)
   props: bms, numeros, metas, mesSelecionado, setMesSelecionado,
          mesesDisponiveis, monthLabel, T, registrarHistorico
   ===================================================================== */

const STATUS_BM_ORDEM = ["ativa", "estoque", "em_recurso", "banida", "vendida"];
const STATUS_NUM_ORDEM = ["conectado", "em_analise", "banido"];

/* cores dos status de telefonia (independentes dos de BM) */
const corStatusNum = (T, s) => {
  if (s === "conectado") return T.STATUS.ativa.fg;
  if (s === "em_analise") return T.STATUS.em_recurso.fg;
  if (s === "banido") return T.STATUS.banida.fg;
  return T.inkSoft;
};
const labelStatusNum = { conectado: "Conectado", em_analise: "Em análise", banido: "Banido" };

/* ---------------- utilitário ---------------- */
const brl = (n) => (Number(n) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/* ---------------- Hero lado a lado ---------------- */
function HeroDuplo({ valorBM, valorNum, subBM, subNum, T }) {
  return (
    <div className="grid md:grid-cols-2 gap-4">
      <div
        className="pa-fade rounded-xl p-6 flex flex-col justify-between gap-3"
        style={{ background: T.primary, backgroundImage: `linear-gradient(135deg, ${T.primary}, ${rgba(T.primary, 0.75)})`, minHeight: 140 }}
      >
        <div className="flex items-center justify-between">
          <div className="text-sm" style={{ color: "rgba(255,255,255,0.85)" }}>BMs ativas agora</div>
          <Boxes size={18} color="rgba(255,255,255,0.7)" />
        </div>
        <div className="pg-font-display pg-mono text-5xl font-bold text-white leading-none">{valorBM}</div>
        <div className="text-xs leading-snug" style={{ color: "rgba(255,255,255,0.85)" }}>{subBM}</div>
      </div>

      <div
        className="pa-fade rounded-xl p-6 flex flex-col justify-between gap-3"
        style={{ background: T.STATUS.ativa.fg, backgroundImage: `linear-gradient(135deg, ${T.STATUS.ativa.fg}, ${rgba(T.STATUS.ativa.fg, 0.75)})`, minHeight: 140, animationDelay: "60ms" }}
      >
        <div className="flex items-center justify-between">
          <div className="text-sm" style={{ color: "rgba(255,255,255,0.85)" }}>Números conectados</div>
          <Phone size={18} color="rgba(255,255,255,0.7)" />
        </div>
        <div className="pg-font-display pg-mono text-5xl font-bold text-white leading-none">{valorNum}</div>
        <div className="text-xs leading-snug" style={{ color: "rgba(255,255,255,0.85)" }}>{subNum}</div>
      </div>
    </div>
  );
}

/* ---------------- KPI ---------------- */
function Kpi({ label, value, fmt, color, icon: Icon, delay, T, sub }) {
  return (
    <div className="pa-fade rounded-xl border p-4 flex flex-col gap-1.5" style={{ background: T.surface, borderColor: T.borderSoft, animationDelay: `${delay}ms` }}>
      <div className="flex items-center justify-between text-xs" style={{ color: T.inkSoft }}>
        <span>{label}</span>
        {Icon && <Icon size={15} style={{ color: color || T.primary }} />}
      </div>
      <div className="pg-mono text-2xl font-semibold" style={{ color: color || T.ink }}>{fmt ? fmt(value) : value}</div>
      {sub && <div className="text-[11px]" style={{ color: T.inkFaint }}>{sub}</div>}
    </div>
  );
}

/* ---------------- Bloco de metas ---------------- */
function BlocoMetas({ mes, meta, gasto, ativos, onSave, T, tipo }) {
  // tipo: "bms" | "telefonia"
  const isBM = tipo === "bms";
  const orcamentoKey = isBM ? "orcamento" : "orcamentoTelefonia";
  const metaKey = isBM ? "metaAtivos" : "metaNumeros";

  const [orc, setOrc] = useState(meta[orcamentoKey] ?? "");
  const [m, setM] = useState(meta[metaKey] ?? "");

  useEffect(() => {
    setOrc(meta[orcamentoKey] ?? "");
    setM(meta[metaKey] ?? "");
  }, [meta, orcamentoKey, metaKey]);

  const orcNum = Number(meta[orcamentoKey]) || 0;
  const metaNum = Number(meta[metaKey]) || 0;
  const pctOrc = orcNum > 0 ? Math.min(100, Math.round((gasto / orcNum) * 100)) : 0;
  const pctMeta = metaNum > 0 ? Math.min(100, Math.round((ativos / metaNum) * 100)) : 0;
  const overOrc = orcNum > 0 && gasto > orcNum;

  return (
    <div className="pa-fade rounded-xl border p-5 flex flex-col gap-4" style={{ background: T.surface, borderColor: T.borderSoft }}>
      <div className="grid md:grid-cols-2 gap-5">
        {/* Orçamento */}
        <div>
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg" style={{ background: rgba(T.primary, 0.12), color: T.primary }}>
                <Wallet size={14} />
              </span>
              <span className="pg-font-display font-semibold text-sm">
                Orçamento — {mes}
              </span>
            </div>
            <span className="pg-mono text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: rgba(overOrc ? "#A3402B" : T.primary, 0.12), color: overOrc ? "#A3402B" : T.primary }}>
              {orcNum > 0 ? `${pctOrc}%` : "—"}
            </span>
          </div>
          <div className="flex items-end justify-between mb-2">
            <span className="pg-tnum text-lg font-semibold">{brl(gasto)}</span>
            <span className="text-xs" style={{ color: T.inkFaint }}>de {brl(orcNum)}</span>
          </div>
          <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: T.borderSoft }}>
            <div className="pa-bar h-full rounded-full" style={{ width: `${pctOrc}%`, background: overOrc ? "#A3402B" : T.primary }} />
          </div>
        </div>

        {/* Meta */}
        <div>
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg" style={{ background: rgba(T.primary, 0.12), color: T.primary }}>
                <Target size={14} />
              </span>
              <span className="pg-font-display font-semibold text-sm">
                {isBM ? "Meta de BMs ativas" : "Meta de números conectados"}
              </span>
            </div>
            <span className="pg-mono text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: rgba(T.primary, 0.12), color: T.primary }}>
              {metaNum > 0 ? `${pctMeta}%` : "—"}
            </span>
          </div>
          <div className="flex items-end justify-between mb-2">
            <span className="pg-tnum text-lg font-semibold">{ativos}</span>
            <span className="text-xs" style={{ color: T.inkFaint }}>de {metaNum}</span>
          </div>
          <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: T.borderSoft }}>
            <div className="pa-bar h-full rounded-full" style={{ width: `${pctMeta}%`, background: T.primary }} />
          </div>
        </div>
      </div>

      <div className="pt-4 border-t flex flex-wrap items-end gap-3" style={{ borderColor: T.borderSoft }}>
        <div className="flex-1 min-w-[160px]">
          <label className="pg-font-body block">
            <span className="block text-xs font-medium mb-1.5" style={{ color: T.inkSoft }}>
              {isBM ? `Orçamento de ativos (R$)` : `Orçamento de telefonia (R$)`}
            </span>
            <input type="number" value={orc} onChange={(e) => setOrc(e.target.value)} className={inputCls} style={inputStyleFor(T)} placeholder="0,00" />
          </label>
        </div>
        <div className="flex-1 min-w-[160px]">
          <label className="pg-font-body block">
            <span className="block text-xs font-medium mb-1.5" style={{ color: T.inkSoft }}>
              {isBM ? "Meta de BMs ativas" : "Meta de números conectados"}
            </span>
            <input type="number" value={m} onChange={(e) => setM(e.target.value)} className={inputCls} style={inputStyleFor(T)} placeholder="0" />
          </label>
        </div>
        <button
          onClick={() => onSave({ [orcamentoKey]: Number(orc) || 0, [metaKey]: Number(m) || 0 })}
          className="pa-chip px-4 py-2 rounded-lg text-sm font-medium text-white transition-shadow hover:shadow-lg"
          style={{ background: T.primary }}
        >
          Salvar
        </button>
      </div>
    </div>
  );
}

/* ---------------- Alertas ---------------- */
function Alertas({ bms, numeros, T }) {
  const alertas = [];

  const ativosParados = bms.filter((b) => {
    if (b.status !== "estoque" || !b.dataCompra) return false;
    const dias = Math.floor((Date.now() - new Date(b.dataCompra)) / 86400000);
    return dias > 15;
  }).length;
  if (ativosParados > 0) alertas.push({ icone: AlertTriangle, texto: `${ativosParados} ativo(s) em estoque há mais de 15 dias`, cor: T.STATUS.em_recurso.fg });

  const numsBanidos = numeros.filter((n) => n.status === "banido").length;
  if (numsBanidos > 0) alertas.push({ icone: Ban, texto: `${numsBanidos} número(s) banido(s)`, cor: T.STATUS.banida.fg });

  const numsAnalise = numeros.filter((n) => n.status === "em_analise").length;
  if (numsAnalise > 0) alertas.push({ icone: Clock, texto: `${numsAnalise} número(s) em análise`, cor: T.STATUS.em_recurso.fg });

  const numsParados = numeros.filter((n) => {
    if (n.status !== "conectado" || !n.atualizadoEm) return false;
    const dias = Math.floor((Date.now() - new Date(n.atualizadoEm)) / 86400000);
    return dias > 30;
  }).length;
  if (numsParados > 0) alertas.push({ icone: Clock, texto: `${numsParados} número(s) sem alteração há mais de 30 dias`, cor: T.inkSoft });

  if (alertas.length === 0) return null;

  return (
    <div className="pa-fade grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {alertas.map((a, i) => {
        const Icon = a.icone;
        return (
          <div
            key={i}
            className="rounded-xl border p-4 flex items-center gap-3"
            style={{ background: rgba(a.cor, 0.06), borderColor: rgba(a.cor, 0.35) }}
          >
            <span className="p-2 rounded-lg shrink-0" style={{ background: rgba(a.cor, 0.15), color: a.cor }}>
              <Icon size={16} />
            </span>
            <span className="text-xs font-medium" style={{ color: T.ink }}>{a.texto}</span>
          </div>
        );
      })}
    </div>
  );
}

/* =====================================================================
   COMPONENTE PRINCIPAL
   ===================================================================== */
export default function DashboardNovo({
  bms, numeros, metas, mesSelecionado, setMesSelecionado,
  mesesDisponiveis, monthLabel, T, registrarHistorico,
}) {
  const [tabInterna, setTabInterna] = useState("geral"); // "geral" | "ativos" | "telefonia"

  const metaAtual = metas[mesSelecionado] || { orcamento: 0, metaAtivos: 0, orcamentoTelefonia: 0, metaNumeros: 0 };

  /* ---- stats de BMs ---- */
  const statsBM = useMemo(() => {
    let gasto = 0, ativas = 0, estoque = 0;
    const contagem = { ativa: 0, estoque: 0, em_recurso: 0, banida: 0, vendida: 0 };
    bms.forEach((b) => {
      gasto += Number(b.valor) || 0;
      if (contagem[b.status] !== undefined) contagem[b.status]++;
      if (b.status === "ativa") ativas++;
      if (b.status === "estoque") estoque++;
    });
    const filtradosMes = mesSelecionado === "todos" ? bms : bms.filter((b) => (b.dataCompra || "").startsWith(mesSelecionado));
    const gastoMes = filtradosMes.reduce((s, b) => s + (Number(b.valor) || 0), 0);
    return { total: bms.length, gasto, gastoMes, ativas, estoque, contagem };
  }, [bms, mesSelecionado]);

  /* ---- stats de Telefonia ---- */
  const statsNum = useMemo(() => {
    const contagem = { conectado: 0, em_analise: 0, banido: 0 };
    let custoMensal = 0;
    numeros.forEach((n) => {
      if (contagem[n.status] !== undefined) contagem[n.status]++;
      custoMensal += Number(n.valor) || 0;
    });
    const filtradosMes = mesSelecionado === "todos" ? numeros : numeros.filter((n) => (n.dataCompra || "").startsWith(mesSelecionado));
    const custoMes = filtradosMes.reduce((s, n) => s + (Number(n.valor) || 0), 0);
    return { total: numeros.length, contagem, custoMensal, custoMes };
  }, [numeros, mesSelecionado]);

  /* ---- gráficos ---- */
  const chartBMs = useMemo(() => STATUS_BM_ORDEM.map((k) => ({
    name: T.STATUS[k].label, qtd: statsBM.contagem[k] || 0, cor: T.STATUS[k].fg,
  })), [statsBM, T]);

  const chartNums = useMemo(() => STATUS_NUM_ORDEM.map((k) => ({
    name: labelStatusNum[k], qtd: statsNum.contagem[k] || 0, cor: corStatusNum(T, k),
  })), [statsNum, T]);

  const tendencia = useMemo(() => {
    const mapBM = {};
    const mapNum = {};
    bms.forEach((b) => {
      if (!b.dataCompra) return;
      const m = b.dataCompra.slice(0, 7);
      mapBM[m] = (mapBM[m] || 0) + (Number(b.valor) || 0);
    });
    numeros.forEach((n) => {
      if (!n.dataCompra) return;
      const m = n.dataCompra.slice(0, 7);
      mapNum[m] = (mapNum[m] || 0) + (Number(n.valor) || 0);
    });
    const meses = Array.from(new Set([...Object.keys(mapBM), ...Object.keys(mapNum)])).sort().slice(-6);
    return meses.map((m) => ({
      mes: monthLabel(m).split(" ")[0].slice(0, 3),
      BMs: mapBM[m] || 0,
      Telefonia: mapNum[m] || 0,
    }));
  }, [bms, numeros, monthLabel]);

  const custoOperadora = useMemo(() => {
    const m = {};
    numeros.forEach((n) => {
      const op = n.operadora || "Sem operadora";
      m[op] = (m[op] || 0) + (Number(n.valor) || 0);
    });
    return Object.entries(m).map(([name, value]) => ({ name, value })).filter((x) => x.value > 0).sort((a, b) => b.value - a.value);
  }, [numeros]);

  const CORES_PIZZA = ["#0B4C82", "#1F7A4D", "#7A3FA0", "#A3402B", "#0E7C86", "#B8862F", "#C23B6B", "#57667A"];

  /* ---- salvar metas ---- */
  const salvarMeta = async (patch) => {
    await setDoc(doc(db, "metas", mesSelecionado), { ...metaAtual, ...patch }, { merge: true });
    await registrarHistorico?.("Atualização de meta", `Meta de ${monthLabel(mesSelecionado)} atualizada`);
  };

  const MesSelector = () => (
    <select
      value={mesSelecionado}
      onChange={(e) => setMesSelecionado(e.target.value)}
      className="px-3 py-2 rounded-lg text-sm pg-font-body"
      style={inputStyleFor(T)}
    >
      <option value="todos">Todos os períodos</option>
      {mesesDisponiveis.map((m) => (
        <option key={m} value={m}>{monthLabel(m)}</option>
      ))}
    </select>
  );

  /* ---- Aba tabs internas ---- */
  const TabsInternas = () => (
    <div className="inline-flex p-1 rounded-lg border" style={{ borderColor: T.border, background: T.surface }}>
      {[
        { id: "geral", label: "Geral", icon: Activity },
        { id: "ativos", label: "Ativos / BMs", icon: Boxes },
        { id: "telefonia", label: "Telefonia", icon: Phone },
      ].map((t) => {
        const Icon = t.icon;
        const on = tabInterna === t.id;
        return (
          <button
            key={t.id}
            onClick={() => setTabInterna(t.id)}
            className="px-4 py-1.5 rounded-md text-sm font-medium transition-colors inline-flex items-center gap-2"
            style={{ background: on ? T.primary : "transparent", color: on ? "#fff" : T.inkSoft }}
          >
            <Icon size={14} /> {t.label}
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      <AnimStyles />

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="pg-font-display text-2xl font-bold tracking-tight">Visão geral</h1>
        <MesSelector />
      </div>

      {/* Tabs internas */}
      <TabsInternas />

      {/* Hero duplo — sempre visível */}
      <HeroDuplo
        T={T}
        valorBM={statsBM.ativas}
        valorNum={statsNum.contagem.conectado}
        subBM={`${statsBM.total} BMs cadastradas · ${statsBM.total > 0 ? ((statsBM.ativas / statsBM.total) * 100).toFixed(1) : 0}% em operação`}
        subNum={`${statsNum.total} números cadastrados · custo mensal ${brl(statsNum.custoMensal)}`}
      />

      {/* TAB GERAL */}
      {tabInterna === "geral" && (
        <div className="flex flex-col gap-6">
          <Alertas bms={bms} numeros={numeros} T={T} />

          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            <Kpi T={T} delay={0} label="Total de BMs" value={statsBM.total} icon={Boxes} />
            <Kpi T={T} delay={50} label="Total de Números" value={statsNum.total} icon={Phone} color={T.STATUS.ativa.fg} />
            <Kpi T={T} delay={100} label="Gasto de ativos no mês" value={statsBM.gastoMes} fmt={brl} icon={Wallet} color={T.STATUS.em_recurso.fg} />
            <Kpi T={T} delay={150} label="Custo de telefonia no mês" value={statsNum.custoMes} fmt={brl} icon={Wallet} color={T.STATUS.ativa.fg} />
            <Kpi T={T} delay={200} label="BMs em estoque" value={statsBM.estoque} icon={Package} sub="aguardando ativação" />
            <Kpi T={T} delay={250} label="Números em análise" value={statsNum.contagem.em_analise} icon={Clock} sub="aguardando aprovação" />
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            <div className="pa-fade rounded-xl p-6 border flex flex-col gap-4" style={{ background: T.surface, borderColor: T.borderSoft }}>
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg" style={{ background: rgba(T.primary, 0.12), color: T.primary }}>
                  <TrendingUp size={14} />
                </span>
                <span className="pg-font-display font-semibold text-sm">Tendência de gasto (últimos meses)</span>
              </div>
              <div className="h-64">
                {tendencia.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-sm" style={{ color: T.inkFaint }}>Sem dados suficientes ainda.</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={tendencia}>
                      <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
                      <XAxis dataKey="mes" stroke={T.inkSoft} fontSize={12} />
                      <YAxis stroke={T.inkSoft} fontSize={12} tickFormatter={(v) => `R$${v}`} />
                      <Tooltip formatter={(v) => brl(v)} contentStyle={{ background: T.surface, borderColor: T.border, color: T.ink }} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Line type="monotone" dataKey="BMs" stroke={T.primary} strokeWidth={2.5} dot={{ r: 3 }} />
                      <Line type="monotone" dataKey="Telefonia" stroke={T.STATUS.ativa.fg} strokeWidth={2.5} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            <div className="pa-fade rounded-xl p-6 border flex flex-col gap-4" style={{ background: T.surface, borderColor: T.borderSoft }}>
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg" style={{ background: rgba(T.primary, 0.12), color: T.primary }}>
                  <PieChartIcon size={14} />
                </span>
                <span className="pg-font-display font-semibold text-sm">Custo por operadora</span>
              </div>
              <div className="h-64">
                {custoOperadora.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-sm" style={{ color: T.inkFaint }}>Nenhum número com operadora cadastrada.</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={custoOperadora}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        innerRadius={45}
                        paddingAngle={2}
                        label={(entry) => `${entry.name}`}
                      >
                        {custoOperadora.map((_, i) => (
                          <Cell key={i} fill={CORES_PIZZA[i % CORES_PIZZA.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v) => brl(v)} contentStyle={{ background: T.surface, borderColor: T.border, color: T.ink }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB ATIVOS */}
      {tabInterna === "ativos" && (
        <div className="flex flex-col gap-6">
          <BlocoMetas
            mes={monthLabel(mesSelecionado)}
            meta={metaAtual}
            gasto={statsBM.gastoMes}
            ativos={statsBM.ativas}
            onSave={salvarMeta}
            T={T}
            tipo="bms"
          />

          <div className="grid lg:grid-cols-2 gap-6">
            <div className="pa-fade rounded-xl p-6 border flex flex-col gap-4" style={{ background: T.surface, borderColor: T.borderSoft }}>
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg" style={{ background: rgba(T.primary, 0.12), color: T.primary }}>
                  <PieChartIcon size={14} />
                </span>
                <span className="pg-font-display font-semibold text-sm">Distribuição de BMs por status</span>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartBMs}>
                    <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
                    <XAxis dataKey="name" stroke={T.inkSoft} fontSize={11} />
                    <YAxis stroke={T.inkSoft} fontSize={11} allowDecimals={false} />
                    <Tooltip contentStyle={{ background: T.surface, borderColor: T.border, color: T.ink }} cursor={{ fill: rgba(T.primary, 0.06) }} />
                    <Bar dataKey="qtd" radius={[6, 6, 0, 0]}>
                      {chartBMs.map((d, i) => <Cell key={i} fill={d.cor} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="pa-fade rounded-xl p-6 border flex flex-col gap-4" style={{ background: T.surface, borderColor: T.borderSoft }}>
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg" style={{ background: rgba(T.primary, 0.12), color: T.primary }}>
                  <TrendingUp size={14} />
                </span>
                <span className="pg-font-display font-semibold text-sm">Gasto de BMs por mês</span>
              </div>
              <div className="h-64">
                {tendencia.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-sm" style={{ color: T.inkFaint }}>Sem dados.</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={tendencia}>
                      <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
                      <XAxis dataKey="mes" stroke={T.inkSoft} fontSize={12} />
                      <YAxis stroke={T.inkSoft} fontSize={12} tickFormatter={(v) => `R$${v}`} />
                      <Tooltip formatter={(v) => brl(v)} contentStyle={{ background: T.surface, borderColor: T.border, color: T.ink }} />
                      <Bar dataKey="BMs" fill={T.primary} radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB TELEFONIA */}
      {tabInterna === "telefonia" && (
        <div className="flex flex-col gap-6">
          <BlocoMetas
            mes={monthLabel(mesSelecionado)}
            meta={metaAtual}
            gasto={statsNum.custoMes}
            ativos={statsNum.contagem.conectado}
            onSave={salvarMeta}
            T={T}
            tipo="telefonia"
          />

          <div className="grid lg:grid-cols-2 gap-6">
            <div className="pa-fade rounded-xl p-6 border flex flex-col gap-4" style={{ background: T.surface, borderColor: T.borderSoft }}>
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg" style={{ background: rgba(T.primary, 0.12), color: T.primary }}>
                  <PieChartIcon size={14} />
                </span>
                <span className="pg-font-display font-semibold text-sm">Distribuição de números por status</span>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartNums}>
                    <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
                    <XAxis dataKey="name" stroke={T.inkSoft} fontSize={11} />
                    <YAxis stroke={T.inkSoft} fontSize={11} allowDecimals={false} />
                    <Tooltip contentStyle={{ background: T.surface, borderColor: T.border, color: T.ink }} cursor={{ fill: rgba(T.primary, 0.06) }} />
                    <Bar dataKey="qtd" radius={[6, 6, 0, 0]}>
                      {chartNums.map((d, i) => <Cell key={i} fill={d.cor} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="pa-fade rounded-xl p-6 border flex flex-col gap-4" style={{ background: T.surface, borderColor: T.borderSoft }}>
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg" style={{ background: rgba(T.primary, 0.12), color: T.primary }}>
                  <PieChartIcon size={14} />
                </span>
                <span className="pg-font-display font-semibold text-sm">Custo por operadora</span>
              </div>
              <div className="h-64">
                {custoOperadora.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-sm" style={{ color: T.inkFaint }}>Sem dados.</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={custoOperadora}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        innerRadius={45}
                        paddingAngle={2}
                        label={(entry) => entry.name}
                      >
                        {custoOperadora.map((_, i) => (
                          <Cell key={i} fill={CORES_PIZZA[i % CORES_PIZZA.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v) => brl(v)} contentStyle={{ background: T.surface, borderColor: T.border, color: T.ink }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
