import React, { useState, useEffect, useMemo, useRef, useCallback, memo } from "react";
import { Search, GripVertical, Inbox, Zap, Moon, Clock, Phone, X, Layers } from "lucide-react";
import { AnimStyles, useCountUp, usePersistentState, rgba, inputStyleFor } from "./painelShared";

/* =====================================================================
   RODÍZIO DE USO — versão refinada
   props: bms, T, onMoverColuna(bm, novaColuna)   (mesmas do painel antigo)

   Por que o arrastar antigo travava:
   - Card e Coluna eram declarados DENTRO do componente → a cada dragover
     o React desmontava e remontava todos os cards, cancelando o arraste.
   - O item só "pulava" de coluna depois da ida e volta ao Firestore.
   Aqui: arraste por ponteiros (sem HTML5 drag), card "fantasma" movido direto
   no DOM a 60fps, componentes estáveis e atualização otimista.
   ===================================================================== */

const COLUNAS = [
  { key: "disponivel", titulo: "Disponível", sub: "Prontas para entrar em uso", icon: Inbox, tone: "primary" },
  { key: "em_uso", titulo: "Em uso hoje", sub: "Operando agora", icon: Zap, tone: "ativa" },
  { key: "descanso", titulo: "Em descanso", sub: "Recuperando qualidade", icon: Moon, tone: "em_recurso" },
];
const COL_KEYS = COLUNAS.map((c) => c.key);
const corCol = (T, c) => (c.tone === "primary" ? T.primary : T.STATUS[c.tone].fg);

const PESO_QUALIDADE = { alta: 3, media: 2, baixa: 1 };
const hojeISO = () => new Date().toISOString().split("T")[0];

function diasDesde(dataISO) {
  if (!dataISO) return null;
  return Math.floor((new Date(hojeISO() + "T00:00:00") - new Date(dataISO + "T00:00:00")) / 86400000);
}
function usosNosUltimosDias(hist, dias) {
  if (!hist || !hist.length) return 0;
  const lim = new Date();
  lim.setDate(lim.getDate() - dias);
  return hist.filter((d) => new Date(d + "T00:00:00") >= lim).length;
}
// só ordena a sugestão dentro de "Disponível" — nunca decide a coluna
function calcularScore(bm) {
  const dias = diasDesde(bm.ultimoUsoRodizio);
  return (PESO_QUALIDADE[bm.qualidade] || 2) * 10 + (dias === null ? 14 : Math.min(dias, 14)) - usosNosUltimosDias(bm.historicoUsoRodizio, 7) * 6;
}
function ultimos7(hist) {
  const cnt = {};
  (hist || []).forEach((d) => (cnt[d] = (cnt[d] || 0) + 1));
  const out = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    out.push(cnt[d.toISOString().slice(0, 10)] || 0);
  }
  return out;
}
function splitNome(nome) {
  const m = String(nome || "").match(/^(.*?)\s*[•·]\s*(.+)$/);
  return m ? { badge: m[1], nome: m[2] } : { badge: null, nome: nome || "Sem nome" };
}

const cmpNome = (a, b) => (a.nome || "").localeCompare(b.nome || "");
const ORDENS = {
  sugestao: (col) => (col === "disponivel" ? (a, b) => calcularScore(b) - calcularScore(a) : cmpNome),
  parado: () => (a, b) => (diasDesde(b.ultimoUsoRodizio) ?? 9999) - (diasDesde(a.ultimoUsoRodizio) ?? 9999),
  nome: () => cmpNome,
};

function RodizioStyles() {
  return (
    <style>{`
      @keyframes prFlash{0%{box-shadow:0 0 0 0 var(--pr-c)}30%{box-shadow:0 0 0 5px var(--pr-c)}100%{box-shadow:0 0 0 0 transparent}}
      @keyframes prPulse{0%,100%{opacity:.6}50%{opacity:1}}
      .pr-flash{animation:prFlash 1.2s ease-out}
      .pr-dropzone{animation:prPulse 1.1s ease-in-out infinite}
      .pr-card{position:relative;cursor:grab;transition:transform .18s cubic-bezier(.2,.7,.2,1),box-shadow .18s,border-color .18s,opacity .15s}
      .pr-card:hover{transform:translateY(-2px);box-shadow:0 12px 24px -16px rgba(0,0,0,.55)}
      .pr-card:active{cursor:grabbing}
      .pr-actions{position:absolute;left:0;right:0;bottom:0;opacity:0;pointer-events:none;transition:opacity .15s}
      .pr-card:hover .pr-actions,.pr-card:focus-within .pr-actions{opacity:1;pointer-events:auto}
      .pr-dragging .pr-card:hover{transform:none;box-shadow:none}
      .pr-dragging .pr-actions{display:none}
      [data-grip]{touch-action:none}
      @media (hover:none){.pr-actions{position:static;opacity:1;pointer-events:auto;margin-top:8px}}
      @media (prefers-reduced-motion:reduce){.pr-flash,.pr-dropzone{animation:none!important}.pr-card{transition:none!important}}
    `}</style>
  );
}

/* ---------------- peças visuais ---------------- */
function Sinal({ qualidade, T }) {
  const cfg = T.QUALIDADE[qualidade] || T.QUALIDADE.media;
  const nivel = qualidade === "alta" ? 3 : qualidade === "baixa" ? 1 : 2;
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold shrink-0" style={{ color: cfg.fg }}>
      <span className="inline-flex items-end gap-[2px]">
        {[1, 2, 3].map((i) => (
          <span key={i} className="w-[3px] rounded-sm" style={{ height: `${i * 3 + 2}px`, background: i <= nivel ? cfg.fg : rgba(cfg.fg, 0.2) }} />
        ))}
      </span>
      {cfg.label}
    </span>
  );
}

function Numero({ value, className, style }) {
  const v = useCountUp(value, 700);
  return <span className={className} style={style}>{Math.round(v)}</span>;
}

/* Visual do card (usado no card da lista e no "fantasma" que segue o mouse) */
function CardVisual({ bm, coluna, T, rank, ghost, onMover }) {
  const dias = diasDesde(bm.ultimoUsoRodizio);
  const usos7 = usosNosUltimosDias(bm.historicoUsoRodizio, 7);
  const dots = ultimos7(bm.historicoUsoRodizio);
  const { badge, nome } = splitNome(bm.nome);
  const q = T.QUALIDADE[bm.qualidade || "media"] || T.QUALIDADE.media;

  return (
    <div
      className={ghost ? "" : "pr-card"}
      style={{
        background: T.surface,
        border: `1px solid ${ghost ? T.primary : T.borderSoft}`,
        borderRadius: 12,
        overflow: "hidden",
        boxShadow: ghost ? `0 0 0 2px ${rgba(T.primary, 0.25)}` : "none",
      }}
    >
      <span className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ background: q.fg }} />
      <div className="p-3 pl-4 flex flex-col gap-2.5">
        <div className="flex items-start gap-2">
          <span data-grip className="mt-0.5 -ml-1 shrink-0 cursor-grab" style={{ color: T.inkFaint }}>
            <GripVertical size={16} />
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              {badge && (
                <span className="pg-mono text-[10px] px-1.5 py-px rounded" style={{ background: T.borderSoft, color: T.inkSoft }}>{badge}</span>
              )}
              {rank && (
                <span className="text-[10px] font-semibold px-1.5 py-px rounded" style={{ background: rgba(T.primary, 0.14), color: T.primary }}>Sugestão #{rank}</span>
              )}
              {bm.status === "estoque" && (
                <span className="text-[10px] px-1.5 py-px rounded" style={{ background: rgba(T.STATUS.estoque.fg, 0.14), color: T.STATUS.estoque.fg }}>Estoque</span>
              )}
            </div>
            <div className="text-sm font-medium leading-snug" style={{ color: T.ink, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
              {nome}
            </div>
          </div>
          <Sinal qualidade={bm.qualidade || "media"} T={T} />
        </div>

        <div className="flex items-center justify-between gap-2 h-[26px]">
          <span className="inline-flex items-center gap-1.5 text-xs min-w-0" style={{ color: coluna === "em_uso" ? T.STATUS.ativa.fg : T.inkFaint }}>
            <Clock size={12} className="shrink-0" />
            <span className="truncate">{dias === null ? "Nunca usada" : dias === 0 ? "Usada hoje" : `Usada há ${dias}d`}</span>
            {bm.telefone && (
              <span className="hidden xl:inline-flex items-center gap-1 pg-mono text-[11px]" style={{ color: T.inkFaint }}>
                <Phone size={10} /> {bm.telefone}
              </span>
            )}
          </span>
          <span className="inline-flex items-center gap-2 shrink-0" title={`${usos7} uso(s) nos últimos 7 dias`}>
            <span className="inline-flex items-end gap-[2px] h-4">
              {dots.map((n, i) => (
                <span key={i} className="w-[4px] rounded-sm" style={{ height: n ? 14 : 5, background: n ? T.primary : T.borderSoft, opacity: n ? Math.min(1, 0.55 + n * 0.2) : 1 }} />
              ))}
            </span>
            <span className="pg-mono text-[11px]" style={{ color: T.inkSoft }}>{usos7}/7d</span>
          </span>
        </div>
      </div>

      {!ghost && onMover && (
        <div className="pr-actions flex gap-1.5 p-2 border-t" style={{ background: T.surface, borderColor: T.borderSoft }}>
          {COLUNAS.filter((c) => c.key !== coluna).map((c) => (
            <button
              key={c.key}
              onClick={() => onMover(bm, c.key)}
              className="flex-1 py-1.5 rounded-lg text-[11px] font-medium inline-flex items-center justify-center gap-1.5 transition-colors"
              style={{ background: rgba(corCol(T, c), 0.1), color: corCol(T, c) }}
              title={`Mover para ${c.titulo}`}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: corCol(T, c) }} /> {c.titulo}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const CardRodizio = memo(function CardRodizio({ bm, coluna, T, rank, arrastandoId, recente, onDown, onMover, idx }) {
  const isDrag = arrastandoId === bm.id;
  const cor = T.QUALIDADE[bm.qualidade || "media"]?.fg || T.primary;
  return (
    <div
      id={`pr-card-${bm.id}`}
      tabIndex={0}
      onPointerDown={(e) => onDown(e, bm)}
      className={`pa-fade ${recente === bm.id ? "pr-flash" : ""}`}
      style={{ "--pr-c": rgba(cor, 0.45), animationDelay: `${Math.min(idx, 10) * 30}ms`, opacity: isDrag ? 0.3 : 1, borderRadius: 12, outline: "none", position: "relative", userSelect: "none" }}
    >
      <CardVisual bm={bm} coluna={coluna} T={T} rank={rank} onMover={onMover} />
    </div>
  );
});

function Coluna({ cfg, T, itens, total, filtrando, sobre, arrastando, boxRef, listRef, children }) {
  const cor = corCol(T, cfg);
  const Icon = cfg.icon;
  const alvo = arrastando && sobre === cfg.key;
  const podeReceber = arrastando && arrastando.from !== cfg.key;
  return (
    <div
      ref={boxRef}
      className="rounded-2xl border flex flex-col overflow-hidden transition-all duration-200"
      style={{
        background: alvo && podeReceber ? rgba(cor, 0.07) : T.surfaceAlt,
        borderColor: alvo && podeReceber ? cor : T.borderSoft,
        boxShadow: alvo && podeReceber ? `0 0 0 3px ${rgba(cor, 0.18)}, 0 18px 40px -22px ${rgba(cor, 0.6)}` : "none",
      }}
    >
      <div className="h-[3px]" style={{ background: cor }} />
      <div className="p-4 flex items-center gap-3">
        <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: rgba(cor, 0.14), color: cor }}>
          <Icon size={18} />
        </span>
        <div className="flex-1 min-w-0">
          <div className="pg-font-display font-semibold text-sm">{cfg.titulo}</div>
          <div className="text-xs truncate" style={{ color: T.inkFaint }}>{cfg.sub}</div>
        </div>
        <span className="pg-mono text-sm font-semibold px-2.5 py-1 rounded-full" style={{ background: rgba(cor, 0.14), color: cor }}>
          <Numero value={itens.length} />
          {filtrando && <span className="opacity-60">/{total}</span>}
        </span>
      </div>

      <div ref={listRef} className="px-3 pb-3 flex flex-col gap-2.5 overflow-y-auto pg-scroll min-h-[240px]" style={{ maxHeight: "calc(100vh - 360px)" }}>
        {children}
        {podeReceber && (
          <div className="pr-dropzone rounded-xl border-2 border-dashed py-6 text-center text-xs font-medium" style={{ borderColor: cor, color: cor, background: rgba(cor, alvo ? 0.12 : 0.04) }}>
            Solte aqui para mover para “{cfg.titulo}”
          </div>
        )}
        {!arrastando && itens.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center gap-2 py-10 text-center" style={{ color: T.inkFaint }}>
            <Icon size={26} style={{ opacity: 0.5 }} />
            <span className="text-xs max-w-[190px]">{filtrando && total > 0 ? "Nenhuma BM com esse filtro." : "Arraste uma BM até aqui."}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function Kpi({ label, value, sub, cor, icon: Icon, delay, T }) {
  return (
    <div className="pa-fade rounded-xl border p-4 flex items-center gap-3" style={{ background: T.surface, borderColor: T.borderSoft, animationDelay: `${delay}ms` }}>
      <span className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: rgba(cor, 0.13), color: cor }}>
        <Icon size={19} />
      </span>
      <div className="min-w-0">
        <div className="text-xs" style={{ color: T.inkSoft }}>{label}</div>
        <Numero value={value} className="pg-mono text-2xl font-semibold leading-tight" style={{ color: T.ink }} />
        {sub && <span className="text-[11px] ml-2" style={{ color: T.inkFaint }}>{sub}</span>}
      </div>
    </div>
  );
}

/* =====================================================================
   COMPONENTE PRINCIPAL
   ===================================================================== */
export default function PainelRodizio({ bms, T, onMoverColuna }) {
  const [busca, setBusca] = useState("");
  const [fQual, setFQual] = useState([]);
  const [ordem, setOrdem] = usePersistentState("wa_rodizio_ordem", "sugestao");
  const [otimista, setOtimista] = useState({});
  const [arrastando, setArrastando] = useState(null); // { bm, from, w } — definido uma vez no início do arraste
  const [sobre, setSobre] = useState(null);
  const [recente, setRecente] = useState(null);

  const ghostRef = useRef(null);
  const boxRefs = useRef({});
  const listRefs = useRef({});
  const st = useRef({ pending: null, active: false, x: 0, y: 0, over: null, raf: 0 });
  const otimistaRef = useRef({});
  const onMoverRef = useRef(onMoverColuna);
  otimistaRef.current = otimista;
  onMoverRef.current = onMoverColuna;

  /* ---- coluna efetiva: camada otimista por cima do que veio do Firestore ---- */
  const colunaBase = (b) => (COL_KEYS.includes(b.colunaRodizio) ? b.colunaRodizio : "disponivel");

  useEffect(() => {
    // limpa overrides quando o Firestore já refletiu a mudança
    setOtimista((o) => {
      let mudou = false;
      const n = { ...o };
      bms.forEach((b) => { if (n[b.id] && n[b.id] === b.colunaRodizio) { delete n[b.id]; mudou = true; } });
      return mudou ? n : o;
    });
  }, [bms]);

  const moverPara = useCallback((bm, coluna) => {
    const atual = otimistaRef.current[bm.id] || (COL_KEYS.includes(bm.colunaRodizio) ? bm.colunaRodizio : "disponivel");
    if (atual === coluna) return;
    setOtimista((o) => ({ ...o, [bm.id]: coluna }));
    setRecente(bm.id);
    setTimeout(() => setRecente((r) => (r === bm.id ? null : r)), 1400);
    setTimeout(() => document.getElementById(`pr-card-${bm.id}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" }), 80);
    setTimeout(() => setOtimista((o) => { if (o[bm.id] !== coluna) return o; const n = { ...o }; delete n[bm.id]; return n; }), 6000);
    Promise.resolve(onMoverRef.current(bm, coluna)).catch((err) => {
      console.error("Erro ao mover no rodízio:", err);
      setOtimista((o) => { const n = { ...o }; delete n[bm.id]; return n; });
    });
  }, []);

  /* ---- arraste por ponteiros ---- */
  useEffect(() => {
    const s = st.current;

    const loop = () => {
      if (!s.active) return;
      const g = ghostRef.current;
      if (g && s.pending) {
        g.style.transform = `translate3d(${s.x - s.pending.ox}px, ${s.y - s.pending.oy}px, 0) rotate(2deg) scale(1.03)`;
        g.style.visibility = "visible";
      }
      let over = null;
      for (const k of COL_KEYS) {
        const box = boxRefs.current[k];
        if (!box) continue;
        const r = box.getBoundingClientRect();
        if (s.x >= r.left && s.x <= r.right && s.y >= r.top && s.y <= r.bottom) { over = k; break; }
      }
      if (over !== s.over) { s.over = over; setSobre(over); }
      const list = over && listRefs.current[over];
      if (list) {
        const lr = list.getBoundingClientRect();
        const zone = 60;
        if (s.y < lr.top + zone) list.scrollTop -= Math.ceil(12 * (1 - Math.max(0, s.y - lr.top) / zone));
        else if (s.y > lr.bottom - zone) list.scrollTop += Math.ceil(12 * (1 - Math.max(0, lr.bottom - s.y) / zone));
      }
      if (s.y < 70) window.scrollBy(0, -14);
      else if (s.y > window.innerHeight - 70) window.scrollBy(0, 14);
      s.raf = requestAnimationFrame(loop);
    };

    const finish = (commit) => {
      const p = s.pending;
      const over = s.over;
      s.pending = null;
      if (!s.active) return;
      s.active = false;
      s.over = null;
      cancelAnimationFrame(s.raf);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
      setArrastando(null);
      setSobre(null);
      if (commit && over && p) moverPara(p.bm, over);
    };

    const move = (e) => {
      const p = s.pending;
      if (!p) return;
      if (!s.active) {
        if (Math.hypot(e.clientX - p.sx, e.clientY - p.sy) < 5) return;
        s.active = true;
        s.x = e.clientX;
        s.y = e.clientY;
        document.body.style.userSelect = "none";
        document.body.style.cursor = "grabbing";
        setArrastando({ bm: p.bm, from: p.from, w: p.w });
        s.raf = requestAnimationFrame(loop);
      }
      s.x = e.clientX;
      s.y = e.clientY;
    };
    const up = () => finish(true);
    const cancel = () => finish(false);
    const key = (e) => { if (e.key === "Escape") finish(false); };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
    window.addEventListener("blur", cancel);
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
      window.removeEventListener("blur", cancel);
      window.removeEventListener("keydown", key);
      cancelAnimationFrame(s.raf);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };
  }, [moverPara]);

  const onDown = useCallback((e, bm) => {
    if (e.button !== undefined && e.button !== 0) return;
    if (e.target.closest("button,a,input,select")) return;
    if (e.pointerType === "touch" && !e.target.closest("[data-grip]")) return; // no toque, arrasta pelo ícone ⋮⋮
    const r = e.currentTarget.getBoundingClientRect();
    const from = otimistaRef.current[bm.id] || (COL_KEYS.includes(bm.colunaRodizio) ? bm.colunaRodizio : "disponivel");
    st.current.pending = { bm, from, sx: e.clientX, sy: e.clientY, ox: e.clientX - r.left, oy: e.clientY - r.top, w: r.width };
  }, []);

  /* ---- dados ---- */
  const grupos = useMemo(() => {
    const g = { disponivel: [], em_uso: [], descanso: [] };
    bms.filter((b) => b.status === "ativa" || b.status === "estoque").forEach((b) => g[otimista[b.id] || colunaBase(b)].push(b));
    return g;
  }, [bms, otimista]);

  const filtrando = !!busca.trim() || fQual.length > 0;

  const visiveis = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const r = {};
    COL_KEYS.forEach((k) => {
      r[k] = grupos[k]
        .filter((b) => (!q || `${b.nome} ${b.telefone || ""}`.toLowerCase().includes(q)) && (!fQual.length || fQual.includes(b.qualidade || "media")))
        .sort((ORDENS[ordem] || ORDENS.sugestao)(k));
    });
    return r;
  }, [grupos, busca, fQual, ordem]);

  const ranking = useMemo(() => {
    const m = {};
    [...grupos.disponivel].sort((a, b) => calcularScore(b) - calcularScore(a)).slice(0, 3).forEach((b, i) => (m[b.id] = i + 1));
    return m;
  }, [grupos.disponivel]);

  const elegiveis = grupos.disponivel.length + grupos.em_uso.length + grupos.descanso.length;
  const dispAlta = grupos.disponivel.filter((b) => (b.qualidade || "media") === "alta").length;
  const usos7Total = [...grupos.disponivel, ...grupos.em_uso, ...grupos.descanso].reduce((s, b) => s + usosNosUltimosDias(b.historicoUsoRodizio, 7), 0);
  const contaQual = (k) => [...grupos.disponivel, ...grupos.em_uso, ...grupos.descanso].filter((b) => (b.qualidade || "media") === k).length;

  return (
    <div className={`flex flex-col gap-5 ${arrastando ? "pr-dragging" : ""}`}>
      <AnimStyles />
      <RodizioStyles />

      <div className="pa-fade">
        <h1 className="pg-font-display text-2xl font-bold tracking-tight">Rodízio de uso</h1>
        <p className="text-sm mt-1" style={{ color: T.inkSoft }}>
          Arraste as BMs entre as colunas ou use os botões que aparecem ao passar o mouse. Qualidade e uso recente são só referência — quem decide é você.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi T={T} delay={0} label="BMs no rodízio" value={elegiveis} icon={Layers} cor={T.primary} />
        <Kpi T={T} delay={50} label="Prontas de alta qualidade" value={dispAlta} sub={`de ${grupos.disponivel.length} disponíveis`} icon={Inbox} cor={T.STATUS.ativa.fg} />
        <Kpi T={T} delay={100} label="Em uso hoje" value={grupos.em_uso.length} icon={Zap} cor={T.STATUS.ativa.fg} />
        <Kpi T={T} delay={150} label="Usos nos últimos 7 dias" value={usos7Total} icon={Clock} cor={T.STATUS.em_recurso.fg} />
      </div>

      <div className="pa-fade flex flex-wrap items-center gap-2.5" style={{ animationDelay: "120ms" }}>
        <div className="flex-1 min-w-[220px] max-w-md flex items-center gap-2 border rounded-lg px-3 py-2 transition-shadow focus-within:shadow-md" style={{ borderColor: T.border, background: T.surface }}>
          <Search size={16} style={{ color: T.inkFaint }} />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar BM ou telefone…" className="w-full bg-transparent text-sm outline-none" style={{ color: T.ink }} />
          {busca && <button onClick={() => setBusca("")}><X size={14} style={{ color: T.inkFaint }} /></button>}
        </div>

        {["alta", "media", "baixa"].map((k) => {
          const on = fQual.includes(k);
          const fg = T.QUALIDADE[k].fg;
          return (
            <button key={k} onClick={() => setFQual((f) => (on ? f.filter((x) => x !== k) : [...f, k]))} className="pa-chip px-3 py-1.5 rounded-full text-xs font-medium inline-flex items-center gap-1.5" style={{ background: on ? fg : rgba(fg, 0.1), color: on ? "#fff" : fg }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: on ? "#fff" : fg }} />
              {T.QUALIDADE[k].label} <span className="pg-mono opacity-80">{contaQual(k)}</span>
            </button>
          );
        })}

        <select value={ordem} onChange={(e) => setOrdem(e.target.value)} className="px-3 py-2 rounded-lg text-sm" style={inputStyleFor(T)}>
          <option value="sugestao">Ordenar: sugestão do rodízio</option>
          <option value="parado">Ordenar: mais tempo sem uso</option>
          <option value="nome">Ordenar: nome (A–Z)</option>
        </select>

        {filtrando && (
          <button onClick={() => { setBusca(""); setFQual([]); }} className="text-xs underline" style={{ color: T.primary }}>Limpar filtros</button>
        )}
        <span className="ml-auto text-[11px] hidden md:block" style={{ color: T.inkFaint }}>Esc cancela o arraste</span>
      </div>

      <div className="grid lg:grid-cols-3 gap-5 items-start">
        {COLUNAS.map((cfg) => (
          <Coluna
            key={cfg.key}
            cfg={cfg}
            T={T}
            itens={visiveis[cfg.key]}
            total={grupos[cfg.key].length}
            filtrando={filtrando}
            sobre={sobre}
            arrastando={arrastando}
            boxRef={(el) => { boxRefs.current[cfg.key] = el; }}
            listRef={(el) => { listRefs.current[cfg.key] = el; }}
          >
            {visiveis[cfg.key].map((bm, i) => (
              <CardRodizio
                key={bm.id}
                bm={bm}
                coluna={cfg.key}
                T={T}
                idx={i}
                rank={cfg.key === "disponivel" && ordem === "sugestao" && !filtrando ? ranking[bm.id] : undefined}
                arrastandoId={arrastando?.bm.id}
                recente={recente}
                onDown={onDown}
                onMover={moverPara}
              />
            ))}
          </Coluna>
        ))}
      </div>

      {/* card "fantasma" que acompanha o cursor (movido direto no DOM, sem re-render) */}
      {arrastando && (
        <div
          ref={ghostRef}
          className="fixed left-0 top-0 z-[100] pointer-events-none"
          style={{ width: arrastando.w, visibility: "hidden", willChange: "transform", filter: "drop-shadow(0 18px 28px rgba(0,0,0,0.35))" }}
        >
          <div className="relative">
            <CardVisual bm={arrastando.bm} coluna={arrastando.from} T={T} ghost />
          </div>
        </div>
      )}
    </div>
  );
}
