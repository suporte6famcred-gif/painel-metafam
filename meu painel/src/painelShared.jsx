import React, { useState, useEffect, useMemo, useRef } from "react";
import { X } from "lucide-react";
import { db } from "./firebase";
import { collection, onSnapshot, doc, setDoc } from "firebase/firestore";

/* =====================================================================
   Utilitários compartilhados pelos painéis novos (Ativos, Tags, Modelos)
   ===================================================================== */

export const brl = (n) => (Number(n) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const fmtData = (d) => (d ? new Date(String(d).slice(0, 10) + "T00:00:00").toLocaleDateString("pt-BR") : "—");
export const uid = () => Math.random().toString(36).slice(2, 10);

export function hexToRgb(hex) {
  let h = (hex || "#0B4C82").replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
export const rgba = (hex, a) => {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
};
export const lighten = (hex, amt) => {
  const { r, g, b } = hexToRgb(hex);
  const f = (v) => Math.round(v + (255 - v) * amt);
  return `rgb(${f(r)},${f(g)},${f(b)})`;
};
export const isDarkT = (T) => {
  const { r, g, b } = hexToRgb(T.surface);
  return (r * 299 + g * 587 + b * 114) / 1000 < 128;
};

export const TAG_PRESETS = [
  "#2563EB", "#0E7C86", "#1F7A4D", "#65A30D", "#B8862F", "#EA580C",
  "#DC2626", "#C23B6B", "#7A3FA0", "#4F46E5", "#0891B2", "#57667A",
];

export const inputCls = "w-full rounded-lg px-3 py-2 text-sm outline-none transition-colors pg-font-body";
export const inputStyleFor = (T) => ({ border: `1px solid ${T.border}`, background: T.surface, color: T.ink });

/* ---------------- animações (CSS) ---------------- */
export function AnimStyles() {
  return (
    <style>{`
      @keyframes paFadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
      @keyframes paPop{from{opacity:0;transform:scale(.95) translateY(-4px)}to{opacity:1;transform:none}}
      @keyframes paSlideUp{from{opacity:0;transform:translateY(28px)}to{opacity:1;transform:none}}
      @keyframes paPulse{0%,100%{box-shadow:0 0 0 0 var(--pa-pulse,rgba(0,0,0,.25))}50%{box-shadow:0 0 0 6px transparent}}
      .pa-fade{animation:paFadeUp .5s cubic-bezier(.2,.7,.2,1) both}
      .pa-pop-in{animation:paPop .16s ease-out both;transform-origin:top left}
      .pa-slide-up{animation:paSlideUp .32s cubic-bezier(.2,.7,.2,1) both}
      .pa-pulse{animation:paPulse 1.8s ease-in-out infinite}
      .pa-lift{transition:transform .22s cubic-bezier(.2,.7,.2,1),box-shadow .22s,border-color .22s}
      .pa-lift:hover{transform:translateY(-3px);box-shadow:0 14px 28px -16px rgba(0,0,0,.45)}
      .pa-row{transition:background .15s}
      .pa-row:hover{background:var(--pa-hover)}
      .pa-row:hover td:first-child{box-shadow:inset 3px 0 0 var(--pa-accent)}
      .pa-chip{transition:transform .15s,background .18s,color .18s,box-shadow .18s}
      .pa-chip:hover{transform:translateY(-1px)}
      .pa-chip:active{transform:scale(.95)}
      .pa-bar{transition:width .9s cubic-bezier(.2,.7,.2,1),background .3s}
      .pa-th{cursor:pointer;user-select:none;transition:color .15s}
      .pa-th:hover{color:var(--pa-accent)}
      @media (prefers-reduced-motion:reduce){
        .pa-fade,.pa-pop-in,.pa-slide-up,.pa-pulse{animation:none!important}
        .pa-bar,.pa-lift,.pa-chip,.pa-row{transition:none!important}
      }
    `}</style>
  );
}

/* ---------------- hooks ---------------- */
export function useCountUp(target, dur = 800) {
  const [v, setV] = useState(0);
  const cur = useRef(0);
  useEffect(() => {
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      cur.current = target;
      setV(target);
      return;
    }
    const from = cur.current;
    const start = performance.now();
    let raf;
    const tick = (t) => {
      const p = Math.min(1, (t - start) / dur);
      cur.current = from + (target - from) * (1 - Math.pow(1 - p, 3));
      setV(cur.current);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, dur]);
  return v;
}

export function usePersistentState(key, initial) {
  const [val, setVal] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : initial;
    } catch (e) {
      return initial;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(val));
    } catch (e) {}
  }, [key, val]);
  return [val, setVal];
}

/* Catálogo de tags (coleção "tags": { id, nome, cor }) */
export function useTagsCatalog() {
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "tags"),
      (snap) => {
        setTags(snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (a.nome || "").localeCompare(b.nome || "")));
        setLoading(false);
      },
      (e) => {
        console.error("Erro ao ler tags:", e);
        setErro(e.message || "Sem permissão para ler a coleção 'tags'.");
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);
  const porNome = useMemo(() => Object.fromEntries(tags.map((t) => [t.nome, t])), [tags]);
  return { tags, porNome, loading, erro };
}

/* ---------------- componentes ---------------- */
export function TagChip({ nome, cor, T, onRemove, onClick, active, size = "sm", title }) {
  const c = cor || T.primary;
  const dark = isDarkT(T);
  const txt = dark ? lighten(c, 0.4) : c;
  const big = size === "lg";
  return (
    <span
      title={title}
      onClick={onClick}
      className={`pa-chip inline-flex items-center gap-1.5 rounded-full font-medium whitespace-nowrap ${onClick ? "cursor-pointer" : ""}`}
      style={{
        padding: big ? "6px 14px" : "2px 9px",
        fontSize: big ? 14 : 11,
        background: active ? c : rgba(c, dark ? 0.22 : 0.12),
        color: active ? "#fff" : txt,
        boxShadow: `inset 0 0 0 1px ${rgba(c, active ? 0 : 0.28)}`,
      }}
    >
      <span className="rounded-full shrink-0" style={{ width: big ? 8 : 6, height: big ? 8 : 6, background: active ? "#fff" : c }} />
      {nome}
      {onRemove && (
        <button type="button" onClick={(e) => { e.stopPropagation(); onRemove(); }} className="hover:opacity-60">
          <X size={11} />
        </button>
      )}
    </span>
  );
}

/* Dropdown com clique-fora para fechar */
export function Dropdown({ renderTrigger, children, align = "left", T, width, up }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const h = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);
  return (
    <div ref={ref} className="relative">
      {renderTrigger({ open, toggle: () => setOpen((o) => !o) })}
      {open && (
        <div
          className={`pa-pop-in absolute z-40 rounded-xl border shadow-xl ${up ? "bottom-full mb-2" : "mt-2"}`}
          style={{ [align]: 0, minWidth: width || 220, background: T.surface, borderColor: T.border, color: T.ink }}
        >
          {typeof children === "function" ? children({ close: () => setOpen(false) }) : children}
        </div>
      )}
    </div>
  );
}

/* Editor de tags do modal do Ativo — usa o catálogo (nome + cor) e cria tags novas já com cor */
export function TagsInputCatalogo({ value, onChange, T }) {
  const { tags, porNome } = useTagsCatalog();
  const [draft, setDraft] = useState("");

  const toggle = (nome) => onChange(value.includes(nome) ? value.filter((x) => x !== nome) : [...value, nome]);

  const criar = async () => {
    const nome = draft.trim();
    setDraft("");
    if (!nome) return;
    const existente = tags.find((t) => t.nome.toLowerCase() === nome.toLowerCase());
    const final = existente ? existente.nome : nome;
    if (!existente) {
      const id = uid();
      try {
        await setDoc(doc(db, "tags", id), { id, nome, cor: TAG_PRESETS[tags.length % TAG_PRESETS.length], criadoEm: new Date().toISOString() });
      } catch (e) {
        console.error(e);
      }
    }
    if (!value.includes(final)) onChange([...value, final]);
  };

  const disponiveis = tags.filter((t) => !value.includes(t.nome));

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap gap-1.5 min-h-[28px]">
        {value.length === 0 && <span className="text-xs" style={{ color: T.inkFaint }}>Nenhuma tag neste ativo.</span>}
        {value.map((t) => (
          <TagChip key={t} nome={t} cor={porNome[t]?.cor} T={T} onRemove={() => toggle(t)} />
        ))}
      </div>
      {disponiveis.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-2 border-t" style={{ borderColor: T.borderSoft }}>
          {disponiveis.map((t) => (
            <span key={t.id} className="opacity-70 hover:opacity-100 transition-opacity">
              <TagChip nome={t.nome} cor={t.cor} T={T} onClick={() => toggle(t.nome)} title="Clique para adicionar" />
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              criar();
            }
          }}
          placeholder="Criar nova tag e pressionar Enter"
          className={inputCls}
          style={inputStyleFor(T)}
        />
        <button type="button" onClick={criar} className="px-3 rounded-lg text-sm font-medium shrink-0" style={{ background: T.primarySoft, color: T.primary }}>
          Adicionar
        </button>
      </div>
    </div>
  );
}
