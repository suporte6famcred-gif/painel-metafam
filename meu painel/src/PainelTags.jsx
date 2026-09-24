import React, { useState, useMemo } from "react";
import { Tag as TagIcon, Plus, Pencil, Trash2, Boxes, Search, X, Check, Download, AlertTriangle } from "lucide-react";
import { db } from "./firebase";
import { doc, setDoc, deleteDoc, writeBatch } from "firebase/firestore";
import {
  AnimStyles, TagChip, TAG_PRESETS, useTagsCatalog, useCountUp, uid, rgba, inputCls, inputStyleFor,
} from "./painelShared";

/* =====================================================================
   ABA TAGS — coleção "tags": { id, nome, cor }
   Os ativos continuam guardando as tags pelo NOME (bm.tags = ["Analise", ...]),
   então nada do que já existe quebra.
   ===================================================================== */

async function gravarLote(ops) {
  // ops: [{ ref, data }] → merge em lotes de 400
  for (let i = 0; i < ops.length; i += 400) {
    const batch = writeBatch(db);
    ops.slice(i, i + 400).forEach((o) => batch.set(o.ref, o.data, { merge: true }));
    await batch.commit();
  }
}

function Numero({ value, className, style }) {
  const v = useCountUp(value, 700);
  return <span className={className} style={style}>{Math.round(v)}</span>;
}

/* ---------------- modal: atribuir tag a ativos ---------------- */
function AtribuirModal({ tag, bms, porNome, T, onClose, onSave }) {
  const [sel, setSel] = useState(() => new Set(bms.filter((b) => (b.tags || []).includes(tag.nome)).map((b) => b.id)));
  const [q, setQ] = useState("");
  const [modo, setModo] = useState("todos");
  const inicial = useMemo(() => new Set(bms.filter((b) => (b.tags || []).includes(tag.nome)).map((b) => b.id)), [bms, tag.nome]);

  const lista = bms.filter((b) => {
    if (q && !`${b.nome} ${b.telefone || ""}`.toLowerCase().includes(q.toLowerCase())) return false;
    if (modo === "com" && !sel.has(b.id)) return false;
    if (modo === "sem" && sel.has(b.id)) return false;
    return true;
  });

  const toggle = (id) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const marcarVisiveis = (on) => setSel((s) => { const n = new Set(s); lista.forEach((b) => (on ? n.add(b.id) : n.delete(b.id))); return n; });
  const mudou = sel.size !== inicial.size || [...sel].some((id) => !inicial.has(id));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: T.overlay }}>
      <div className="pa-pop-in w-full max-w-2xl rounded-xl border flex flex-col max-h-[88vh]" style={{ background: T.surface, color: T.ink, borderColor: T.border }}>
        <div className="flex items-center justify-between border-b px-6 py-4" style={{ borderColor: T.borderSoft }}>
          <div className="flex items-center gap-3 min-w-0">
            <h3 className="pg-font-display text-lg font-semibold">Atribuir tag</h3>
            <TagChip nome={tag.nome} cor={tag.cor} T={T} />
          </div>
          <button onClick={onClose} className="p-1 hover:opacity-70"><X size={20} /></button>
        </div>

        <div className="p-4 flex flex-col gap-3 border-b" style={{ borderColor: T.borderSoft }}>
          <div className="flex gap-2 flex-wrap">
            <div className="flex-1 min-w-[200px] flex items-center gap-2 border rounded-lg px-3 py-1.5" style={{ borderColor: T.border }}>
              <Search size={16} style={{ color: T.inkFaint }} />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar ativo…" className="w-full bg-transparent text-sm outline-none" style={{ color: T.ink }} />
            </div>
            <div className="inline-flex p-0.5 rounded-lg border" style={{ borderColor: T.border }}>
              {[["todos", "Todos"], ["com", "Com a tag"], ["sem", "Sem a tag"]].map(([id, l]) => (
                <button key={id} onClick={() => setModo(id)} className="px-3 py-1 rounded-md text-xs transition-colors" style={{ background: modo === id ? tag.cor : "transparent", color: modo === id ? "#fff" : T.inkSoft, fontWeight: modo === id ? 600 : 500 }}>
                  {l}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between text-xs" style={{ color: T.inkSoft }}>
            <span>{sel.size} de {bms.length} ativos com esta tag</span>
            <span className="flex gap-3">
              <button onClick={() => marcarVisiveis(true)} className="underline" style={{ color: T.primary }}>Marcar visíveis ({lista.length})</button>
              <button onClick={() => marcarVisiveis(false)} className="underline" style={{ color: T.primary }}>Desmarcar visíveis</button>
            </span>
          </div>
        </div>

        <div className="overflow-y-auto pg-scroll flex-1 divide-y" style={{ borderColor: T.borderSoft }}>
          {lista.length === 0 && <div className="p-8 text-center text-sm" style={{ color: T.inkFaint }}>Nenhum ativo encontrado.</div>}
          {lista.map((b) => {
            const on = sel.has(b.id);
            const st = T.STATUS[b.status] || T.STATUS.estoque;
            return (
              <label key={b.id} className="flex items-center gap-3 px-6 py-2.5 cursor-pointer transition-colors" style={{ borderColor: T.borderSoft, background: on ? rgba(tag.cor, 0.08) : "transparent" }}>
                <input type="checkbox" checked={on} onChange={() => toggle(b.id)} style={{ accentColor: tag.cor }} />
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-medium truncate">{b.nome}</span>
                  <span className="flex items-center gap-1 mt-1 flex-wrap">
                    {(b.tags || []).filter((t) => t !== tag.nome).slice(0, 4).map((t) => <TagChip key={t} nome={t} cor={porNome[t]?.cor} T={T} />)}
                  </span>
                </span>
                <span className="inline-flex items-center gap-1.5 text-xs shrink-0" style={{ color: st.fg }}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: st.fg }} /> {st.label}
                </span>
              </label>
            );
          })}
        </div>

        <div className="flex justify-end gap-3 border-t px-6 py-4" style={{ borderColor: T.borderSoft }}>
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ background: T.borderSoft, color: T.inkSoft }}>Cancelar</button>
          <button disabled={!mudou} onClick={() => onSave(tag, sel, inicial)} className="px-5 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-40 transition-shadow hover:shadow-lg" style={{ background: tag.cor }}>
            Salvar atribuições
          </button>
        </div>
      </div>
    </div>
  );
}

/* =====================================================================
   COMPONENTE PRINCIPAL
   props: bms, T, registrarHistorico
   ===================================================================== */
export default function PainelTags({ bms, T, registrarHistorico }) {
  const { tags, porNome, loading, erro } = useTagsCatalog();
  const [form, setForm] = useState({ id: "", nome: "", cor: TAG_PRESETS[0] });
  const [busca, setBusca] = useState("");
  const [ordem, setOrdem] = useState("nome");
  const [atribuindo, setAtribuindo] = useState(null);
  const [ocupado, setOcupado] = useState(false);

  const uso = useMemo(() => {
    const m = {};
    bms.forEach((b) => (b.tags || []).forEach((t) => (m[t] = (m[t] || 0) + 1)));
    return m;
  }, [bms]);

  const orfas = useMemo(() => Object.keys(uso).filter((n) => !porNome[n]).sort(), [uso, porNome]);
  const semTag = bms.filter((b) => !(b.tags || []).length).length;
  const emUso = tags.filter((t) => uso[t.nome]).length;

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return tags
      .filter((t) => !q || t.nome.toLowerCase().includes(q))
      .sort((a, b) => (ordem === "uso" ? (uso[b.nome] || 0) - (uso[a.nome] || 0) : a.nome.localeCompare(b.nome)));
  }, [tags, busca, ordem, uso]);

  const editando = !!form.id;
  const resetForm = () => setForm({ id: "", nome: "", cor: TAG_PRESETS[tags.length % TAG_PRESETS.length] });

  /* ---- ações ---- */
  const salvarTag = async (e) => {
    e.preventDefault();
    const nome = form.nome.trim();
    if (!nome) return;
    if (tags.some((t) => t.id !== form.id && t.nome.toLowerCase() === nome.toLowerCase())) return alert(`Já existe uma tag chamada "${nome}".`);
    setOcupado(true);
    try {
      if (editando) {
        const antigo = tags.find((t) => t.id === form.id);
        await setDoc(doc(db, "tags", form.id), { id: form.id, nome, cor: form.cor, criadoEm: antigo?.criadoEm || new Date().toISOString() });
        if (antigo && antigo.nome !== nome) {
          const ops = bms.filter((b) => (b.tags || []).includes(antigo.nome)).map((b) => ({
            ref: doc(db, "bms", b.id),
            data: { tags: b.tags.map((t) => (t === antigo.nome ? nome : t)) },
          }));
          await gravarLote(ops);
        }
        await registrarHistorico?.("Edição de Tag", `Tag "${antigo?.nome}" → "${nome}"`);
      } else {
        const id = uid();
        await setDoc(doc(db, "tags", id), { id, nome, cor: form.cor, criadoEm: new Date().toISOString() });
        await registrarHistorico?.("Nova Tag", `Tag "${nome}" criada`);
      }
      setForm({ id: "", nome: "", cor: TAG_PRESETS[(tags.length + 1) % TAG_PRESETS.length] });
    } finally {
      setOcupado(false);
    }
  };

  const excluirTag = async (t) => {
    const n = uso[t.nome] || 0;
    if (!confirm(n ? `Excluir a tag "${t.nome}" e removê-la de ${n} ativo(s)?` : `Excluir a tag "${t.nome}"?`)) return;
    setOcupado(true);
    try {
      const ops = bms.filter((b) => (b.tags || []).includes(t.nome)).map((b) => ({ ref: doc(db, "bms", b.id), data: { tags: b.tags.filter((x) => x !== t.nome) } }));
      await gravarLote(ops);
      await deleteDoc(doc(db, "tags", t.id));
      await registrarHistorico?.("Exclusão de Tag", `Tag "${t.nome}" excluída (${n} ativo(s))`);
      if (form.id === t.id) resetForm();
    } finally {
      setOcupado(false);
    }
  };

  const importarOrfas = async () => {
    setOcupado(true);
    try {
      await Promise.all(
        orfas.map((nome, i) => {
          const id = uid();
          return setDoc(doc(db, "tags", id), { id, nome, cor: TAG_PRESETS[(tags.length + i) % TAG_PRESETS.length], criadoEm: new Date().toISOString() });
        })
      );
      await registrarHistorico?.("Importação de Tags", `${orfas.length} tag(s) existentes foram catalogadas`);
    } finally {
      setOcupado(false);
    }
  };

  const salvarAtribuicao = async (tag, sel, inicial) => {
    const ops = [];
    bms.forEach((b) => {
      const tinha = inicial.has(b.id);
      const quer = sel.has(b.id);
      if (tinha === quer) return;
      const atual = b.tags || [];
      ops.push({ ref: doc(db, "bms", b.id), data: { tags: quer ? [...atual, tag.nome] : atual.filter((x) => x !== tag.nome) } });
    });
    setOcupado(true);
    try {
      await gravarLote(ops);
      await registrarHistorico?.("Atribuição de Tag", `Tag "${tag.nome}" agora em ${sel.size} ativo(s)`);
      setAtribuindo(null);
    } finally {
      setOcupado(false);
    }
  };

  const kpis = [
    { label: "Tags criadas", value: tags.length },
    { label: "Em uso", value: emUso, color: T.STATUS.ativa.fg },
    { label: "Sem uso", value: tags.length - emUso, color: T.STATUS.estoque.fg },
    { label: "Ativos sem tag", value: semTag, color: semTag ? T.STATUS.em_recurso.fg : undefined },
  ];

  return (
    <div className="flex flex-col gap-6" style={{ "--pa-accent": T.primary }}>
      <AnimStyles />

      <div className="rounded-xl border grid grid-cols-2 lg:grid-cols-4 overflow-hidden pa-fade" style={{ background: T.surface, borderColor: T.borderSoft }}>
        {kpis.map((k, i) => (
          <div key={k.label} className="p-5" style={{ borderRight: i < 3 ? `1px solid ${T.borderSoft}` : "none" }}>
            <div className="text-xs mb-1.5" style={{ color: T.inkSoft }}>{k.label}</div>
            <Numero value={k.value} className="pg-mono text-2xl font-semibold" style={{ color: k.color || T.ink }} />
          </div>
        ))}
      </div>

      {erro && (
        <div className="p-4 rounded-xl border flex items-start gap-3 text-sm" style={{ borderColor: T.STATUS.banida.fg + "55" }}>
          <AlertTriangle size={20} className="shrink-0" style={{ color: T.STATUS.banida.fg }} />
          <div>Não foi possível carregar as tags: <b>{erro}</b><div style={{ color: T.inkSoft }}>Libere leitura e escrita da coleção "tags" nas regras do Firestore.</div></div>
        </div>
      )}

      {orfas.length > 0 && (
        <div className="pa-fade p-4 rounded-xl border flex items-center gap-4 flex-wrap" style={{ borderColor: rgba(T.primary, 0.35), background: rgba(T.primary, 0.06) }}>
          <TagIcon size={20} style={{ color: T.primary }} />
          <div className="text-sm flex-1 min-w-[220px]">
            Seus ativos já usam <b>{orfas.length}</b> tag(s) que ainda não têm cor: <span style={{ color: T.inkSoft }}>{orfas.slice(0, 6).join(", ")}{orfas.length > 6 ? "…" : ""}</span>
          </div>
          <button disabled={ocupado} onClick={importarOrfas} className="px-4 py-2 rounded-lg text-sm font-medium text-white flex items-center gap-2 disabled:opacity-50 transition-shadow hover:shadow-lg" style={{ background: T.primary }}>
            <Download size={16} /> Importar e colorir
          </button>
        </div>
      )}

      <div className="grid lg:grid-cols-[340px_1fr] gap-6 items-start">
        {/* formulário */}
        <form onSubmit={salvarTag} className="pa-fade rounded-xl border p-5 flex flex-col gap-4 lg:sticky lg:top-24" style={{ background: T.surface, borderColor: T.borderSoft, animationDelay: "60ms" }}>
          <div className="flex items-center justify-between">
            <h3 className="pg-font-display font-semibold">{editando ? "Editar tag" : "Nova tag"}</h3>
            {editando && <button type="button" onClick={resetForm} className="text-xs underline" style={{ color: T.primary }}>Cancelar edição</button>}
          </div>

          <div className="rounded-lg py-6 flex items-center justify-center" style={{ background: rgba(form.cor, 0.07), border: `1px dashed ${rgba(form.cor, 0.4)}` }}>
            <TagChip nome={form.nome.trim() || "Pré-visualização"} cor={form.cor} T={T} size="lg" />
          </div>

          <label className="pg-font-body block">
            <span className="block text-xs font-medium mb-1.5" style={{ color: T.inkSoft }}>Nome da tag</span>
            <input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} maxLength={30} placeholder="Ex: Modelo cadastrado" className={inputCls} style={inputStyleFor(T)} />
          </label>

          <div>
            <span className="block text-xs font-medium mb-2" style={{ color: T.inkSoft }}>Cor</span>
            <div className="grid grid-cols-6 gap-2">
              {TAG_PRESETS.map((c) => (
                <button key={c} type="button" onClick={() => setForm({ ...form, cor: c })} className="pa-chip h-8 rounded-lg flex items-center justify-center" style={{ background: c, boxShadow: form.cor.toLowerCase() === c.toLowerCase() ? `0 0 0 2px ${T.surface}, 0 0 0 4px ${c}` : "none" }}>
                  {form.cor.toLowerCase() === c.toLowerCase() && <Check size={15} color="#fff" />}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 mt-3">
              <input type="color" value={form.cor} onChange={(e) => setForm({ ...form, cor: e.target.value })} className="h-9 w-14 rounded-lg cursor-pointer shrink-0" />
              <input value={form.cor} onChange={(e) => setForm({ ...form, cor: e.target.value })} maxLength={7} className={inputCls + " pg-mono"} style={inputStyleFor(T)} />
            </div>
          </div>

          <button type="submit" disabled={ocupado || !form.nome.trim()} className="px-4 py-2.5 rounded-lg text-sm font-medium text-white flex items-center justify-center gap-2 disabled:opacity-50 transition-shadow hover:shadow-lg" style={{ background: form.cor }}>
            {editando ? <><Check size={16} /> Salvar alterações</> : <><Plus size={16} /> Criar tag</>}
          </button>
        </form>

        {/* lista */}
        <div className="flex flex-col gap-4">
          <div className="flex gap-2 flex-wrap">
            <div className="flex-1 min-w-[200px] flex items-center gap-2 border rounded-lg px-3 py-2" style={{ borderColor: T.border, background: T.surface }}>
              <Search size={16} style={{ color: T.inkFaint }} />
              <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar tag…" className="w-full bg-transparent text-sm outline-none" style={{ color: T.ink }} />
            </div>
            <select value={ordem} onChange={(e) => setOrdem(e.target.value)} className="px-3 py-2 rounded-lg text-sm" style={inputStyleFor(T)}>
              <option value="nome">Ordem alfabética</option>
              <option value="uso">Mais usadas</option>
            </select>
          </div>

          {loading ? (
            <div className="p-10 text-center text-sm" style={{ color: T.inkFaint }}>Carregando tags…</div>
          ) : lista.length === 0 ? (
            <div className="rounded-xl border p-12 text-center flex flex-col items-center gap-3 pa-fade" style={{ background: T.surface, borderColor: T.borderSoft, color: T.inkFaint }}>
              <TagIcon size={30} />
              <span className="text-sm">{tags.length === 0 ? "Nenhuma tag criada. Use o formulário ao lado para criar a primeira." : "Nenhuma tag encontrada."}</span>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {lista.map((t, i) => {
                const n = uso[t.nome] || 0;
                const pct = bms.length ? Math.round((n / bms.length) * 100) : 0;
                return (
                  <div key={t.id} className="pa-fade pa-lift rounded-xl border p-4 flex flex-col gap-3" style={{ background: T.surface, borderColor: form.id === t.id ? t.cor : T.borderSoft, animationDelay: `${Math.min(i, 12) * 35}ms` }}>
                    <div className="flex items-start justify-between gap-2">
                      <TagChip nome={t.nome} cor={t.cor} T={T} size="lg" />
                      <span className="pg-mono text-xs mt-1.5" style={{ color: T.inkFaint }}>{t.cor}</span>
                    </div>
                    <div>
                      <div className="flex items-center justify-between text-xs mb-1.5" style={{ color: T.inkSoft }}>
                        <span>{n} ativo{n === 1 ? "" : "s"}</span>
                        <span className="pg-mono">{pct}%</span>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: T.borderSoft }}>
                        <div className="h-full rounded-full pa-bar" style={{ width: `${pct}%`, background: t.cor }} />
                      </div>
                    </div>
                    <div className="flex gap-1.5 pt-2 border-t" style={{ borderColor: T.borderSoft }}>
                      <button onClick={() => setAtribuindo(t)} className="pa-chip flex-1 px-3 py-1.5 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5" style={{ background: rgba(t.cor, 0.12), color: t.cor }}>
                        <Boxes size={14} /> Atribuir
                      </button>
                      <button onClick={() => { setForm({ id: t.id, nome: t.nome, cor: t.cor }); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="pa-chip p-2 rounded-lg" style={{ color: T.primary, background: T.borderSoft }} title="Editar"><Pencil size={14} /></button>
                      <button onClick={() => excluirTag(t)} className="pa-chip p-2 rounded-lg text-red-500" style={{ background: T.borderSoft }} title="Excluir"><Trash2 size={14} /></button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {atribuindo && (
        <AtribuirModal tag={atribuindo} bms={bms} porNome={porNome} T={T} onClose={() => setAtribuindo(null)} onSave={salvarAtribuicao} />
      )}
    </div>
  );
}
