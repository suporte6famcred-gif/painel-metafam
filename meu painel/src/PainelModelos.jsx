import React, { useState, useEffect, useMemo } from "react";
import {
  MessageSquare,
  Plus,
  Search,
  X,
  Pencil,
  Trash2,
  Check,
  AlertTriangle,
  Copy,
  Ban,
  Lock,
  ExternalLink,
  Phone,
  Reply,
  Image as ImageIcon,
  Video,
  FileText,
} from "lucide-react";
import { db } from "./firebase";
import { collection, onSnapshot, doc, setDoc, deleteDoc } from "firebase/firestore";

/* =====================================================================
   PAINEL DE MODELOS DE MENSAGEM
   - Coleção Firestore nova: "modelos"
   - Campos novos (opcionais) nos docs de "bms": limiteModelos,
     modelosBloqueado, modelosBloqueioMotivo  (gravados com merge)
   - Não altera nenhum outro fluxo do site.
   ===================================================================== */

const LIMITE_PADRAO = 250; // 250 nomes por WABA sem verificação; 6.000 com Business verificado

const CATEGORIAS = {
  MARKETING: "Marketing",
  UTILITY: "Utilidade",
  AUTHENTICATION: "Autenticação",
};

const IDIOMAS = {
  pt_BR: "Português (BR)",
  pt_PT: "Português (PT)",
  en_US: "Inglês (EUA)",
  es: "Espanhol",
};

// Mesmos estados que o WhatsApp Manager mostra na lista de modelos
const STATUS_MODELO = {
  APPROVED: { label: "Ativo", tone: "ok" },
  IN_REVIEW: { label: "Em análise", tone: "warn" },
  REJECTED: { label: "Rejeitado", tone: "bad" },
  PAUSED: { label: "Pausado", tone: "warn" },
  DISABLED: { label: "Desativado", tone: "bad" },
};

const QUALIDADE_MODELO = {
  pending: "Qualidade pendente",
  high: "Alta qualidade",
  medium: "Média qualidade",
  low: "Baixa qualidade",
};

// Limites de conteúdo da Meta
const LIM = { cabecalho: 60, corpo: 1024, rodape: 60, botao: 25, botoes: 10, url: 2, telefone: 1 };

const uid = () => Math.random().toString(36).slice(2, 10);

const inputCls = "w-full rounded-lg px-3 py-2 text-sm outline-none transition-colors pg-font-body";
const inputStyleFor = (T) => ({
  border: `1px solid ${T.border}`,
  background: T.surface,
  color: T.ink,
});

const nomeMeta = (s) =>
  String(s || "")
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");

const fmtData = (iso) => (iso ? new Date(iso).toLocaleDateString("pt-BR") : "—");

const emptyModelo = () => ({
  id: "",
  nome: "",
  categoria: "UTILITY",
  idioma: "pt_BR",
  cabecalhoTipo: "NONE",
  cabecalhoTexto: "",
  cabecalhoMidiaUrl: "",
  cabecalhoMidiaNome: "",
  corpo: "",
  rodape: "",
  botoes: [],
  canais: {},
  criadoEm: "",
  atualizadoEm: "",
});

const toneColor = (T, tone) =>
  tone === "ok" ? T.STATUS.ativa.fg : tone === "warn" ? T.STATUS.em_recurso.fg : tone === "bad" ? T.STATUS.banida.fg : T.STATUS.estoque.fg;

/* Um canal (BM) pode cadastrar mais modelos? */
function analisarCanal(bm, usados) {
  const limite = Number(bm.limiteModelos) || LIMITE_PADRAO;
  let motivo = null;
  if (bm.modelosBloqueado) motivo = bm.modelosBloqueioMotivo || "Bloqueado manualmente";
  else if (bm.status === "banida") motivo = "BM banida";
  else if (bm.status === "vendida") motivo = "BM vendida";
  else if (bm.status === "em_recurso") motivo = "BM em recurso";
  else if (usados >= limite) motivo = "Limite de modelos atingido";
  return { limite, usados, pode: !motivo, motivo };
}

/* ---------------- pedaços visuais ---------------- */
function Field({ label, T, hint, children }) {
  return (
    <label className="pg-font-body block">
      <span className="flex items-center justify-between text-xs font-medium mb-1.5" style={{ color: T.inkSoft }}>
        <span>{label}</span>
        {hint && <span style={{ color: T.inkFaint, fontWeight: 400 }}>{hint}</span>}
      </span>
      {children}
    </label>
  );
}

function StatusModelo({ reg, T }) {
  const cfg = STATUS_MODELO[reg.status] || STATUS_MODELO.IN_REVIEW;
  let cor = toneColor(T, cfg.tone);
  let qual = null;
  if (reg.status === "APPROVED") {
    const q = reg.qualidade || "pending";
    qual = QUALIDADE_MODELO[q];
    cor = q === "high" ? T.STATUS.ativa.fg : q === "medium" ? T.STATUS.em_recurso.fg : q === "low" ? T.STATUS.banida.fg : T.STATUS.estoque.fg;
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap" style={{ color: cor }}>
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: cor }} />
      {cfg.label}
      {qual && (
        <span style={{ color: T.inkSoft, fontWeight: 400 }}>
          – {qual}
        </span>
      )}
    </span>
  );
}

function Pill({ children, T, color }) {
  const c = color || T.primary;
  return (
    <span className="px-2 py-0.5 rounded-full text-[11px] whitespace-nowrap" style={{ background: c + "1F", color: c }}>
      {children}
    </span>
  );
}

/* Formatação do WhatsApp: *negrito* _itálico_ ~tachado~ e destaque de {{variáveis}} */
function fmt(text) {
  const parts = String(text || "").split(/(\*[^*\n]+\*|_[^_\n]+_|~[^~\n]+~|\{\{\d+\}\})/g);
  return parts.map((p, i) => {
    if (/^\*[^*\n]+\*$/.test(p)) return <strong key={i}>{p.slice(1, -1)}</strong>;
    if (/^_[^_\n]+_$/.test(p)) return <em key={i}>{p.slice(1, -1)}</em>;
    if (/^~[^~\n]+~$/.test(p)) return <s key={i}>{p.slice(1, -1)}</s>;
    if (/^\{\{\d+\}\}$/.test(p))
      return (
        <span key={i} style={{ background: "rgba(0,128,105,0.18)", borderRadius: 4, padding: "0 3px" }}>
          {p}
        </span>
      );
    return <span key={i}>{p}</span>;
  });
}

const ICONE_BOTAO = { QUICK_REPLY: Reply, URL: ExternalLink, PHONE: Phone };
const ROTULO_BOTAO = { QUICK_REPLY: "Resposta rápida", URL: "Link (URL)", PHONE: "Ligar" };

/* Prévia igual à do WhatsApp Manager: fundo do chat, balão, rodapé e botões */
function PreviewWhatsApp({ m, T, themeMode }) {
  const dark = themeMode === "dark";
  const chatBg = dark ? "#0B141A" : "#ECE5DD";
  const bubble = dark ? "#1F2C34" : "#FFFFFF";
  const txt = dark ? "#E9EDEF" : "#111B21";
  const soft = dark ? "#8696A0" : "#667781";
  const link = dark ? "#53BDEB" : "#027EB5";
  const HeaderIcon = m.cabecalhoTipo === "VIDEO" ? Video : m.cabecalhoTipo === "DOCUMENT" ? FileText : ImageIcon;
  const temMidia = !!m.cabecalhoMidiaUrl;

  return (
    <div className="rounded-xl p-4" style={{ background: chatBg }}>
      <div className="max-w-[300px] mx-auto flex flex-col gap-1">
        <div className="rounded-lg overflow-hidden shadow-sm" style={{ background: bubble, color: txt }}>
          {["IMAGE", "VIDEO", "DOCUMENT"].includes(m.cabecalhoTipo) && (
            <div className="h-32 flex items-center justify-center overflow-hidden" style={{ background: dark ? "#2A3942" : "#D9DDE0", color: soft }}>
              {m.cabecalhoTipo === "IMAGE" && temMidia ? (
                <img src={m.cabecalhoMidiaUrl} alt="Prévia do cabeçalho" className="w-full h-full object-cover" />
              ) : m.cabecalhoTipo === "VIDEO" && temMidia ? (
                <video src={m.cabecalhoMidiaUrl} className="w-full h-full object-cover" muted playsInline />
              ) : m.cabecalhoTipo === "DOCUMENT" && temMidia ? (
                <div className="flex flex-col items-center gap-1.5 px-3 text-center">
                  <FileText size={30} />
                  <span className="text-[10px] leading-tight break-all line-clamp-2">{m.cabecalhoMidiaNome || "documento.pdf"}</span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-1.5" style={{ color: soft }}>
                  <HeaderIcon size={34} />
                  <span className="text-[10px]">Sem arquivo anexado</span>
                </div>
              )}
            </div>
          )}
          <div className="px-3 pt-2 pb-1.5 text-[13.5px] leading-snug">
            {m.cabecalhoTipo === "TEXT" && m.cabecalhoTexto && (
              <div className="font-semibold mb-1">{fmt(m.cabecalhoTexto)}</div>
            )}
            <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
              {m.corpo ? fmt(m.corpo) : <span style={{ color: soft }}>O texto do modelo aparece aqui…</span>}
            </div>
            {m.rodape && (
              <div className="mt-1.5 text-xs" style={{ color: soft }}>
                {m.rodape}
              </div>
            )}
            <div className="text-[10px] text-right mt-0.5" style={{ color: soft }}>
              12:00
            </div>
          </div>
        </div>
        {(m.botoes || []).map((b, i) => {
          const Icon = ICONE_BOTAO[b.tipo] || Reply;
          return (
            <div key={i} className="rounded-lg shadow-sm py-2 px-3 flex items-center justify-center gap-2 text-[13px] font-medium" style={{ background: bubble, color: link }}>
              <Icon size={14} />
              {b.texto || ROTULO_BOTAO[b.tipo]}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* Limite de segurança para anexar mídia embutida (base64) no documento do Firestore.
   Um documento inteiro não pode passar de ~1 MiB, então deixamos folga generosa. */
const LIMITE_ANEXO = 700 * 1024;

/* Campo de anexo do cabeçalho: aceita URL colada OU upload de arquivo (vira base64) */
function CabecalhoMidia({ f, setF, T }) {
  const tipo = f.cabecalhoTipo;
  const accept = tipo === "IMAGE" ? "image/*" : tipo === "VIDEO" ? "video/*" : ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx";
  const isDataUrl = (f.cabecalhoMidiaUrl || "").startsWith("data:");

  const anexar = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > LIMITE_ANEXO) {
      alert(`Esse arquivo tem ${(file.size / 1024 / 1024).toFixed(1)} MB — o limite para anexar aqui é ~700 KB. Use o campo de URL acima para arquivos maiores (hospede em algum link público).`);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setF((prev) => ({ ...prev, cabecalhoMidiaUrl: reader.result, cabecalhoMidiaNome: file.name }));
    reader.onerror = () => alert("Não foi possível ler esse arquivo.");
    reader.readAsDataURL(file);
  };

  const remover = () => setF((prev) => ({ ...prev, cabecalhoMidiaUrl: "", cabecalhoMidiaNome: "" }));

  return (
    <div className="flex flex-col gap-2 mt-2 p-3 rounded-lg border border-dashed" style={{ borderColor: T.border }}>
      <input
        value={isDataUrl ? "" : f.cabecalhoMidiaUrl}
        onChange={(e) => setF((prev) => ({ ...prev, cabecalhoMidiaUrl: e.target.value, cabecalhoMidiaNome: "" }))}
        placeholder="Cole a URL pública do arquivo (https://…)"
        disabled={isDataUrl}
        className={inputCls}
        style={{ ...inputStyleFor(T), opacity: isDataUrl ? 0.5 : 1 }}
      />

      <div className="flex items-center gap-2 flex-wrap">
        <label className="px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer border inline-flex items-center gap-1.5" style={{ borderColor: T.border, color: T.inkSoft }}>
          <input type="file" accept={accept} className="hidden" onChange={anexar} />
          {tipo === "IMAGE" ? <ImageIcon size={13} /> : tipo === "VIDEO" ? <Video size={13} /> : <FileText size={13} />}
          Anexar arquivo…
        </label>

        {f.cabecalhoMidiaUrl && (
          <>
            {isDataUrl && (
              <span className="text-xs truncate max-w-[160px]" style={{ color: T.inkSoft }} title={f.cabecalhoMidiaNome}>
                {f.cabecalhoMidiaNome || "arquivo anexado"}
              </span>
            )}
            <button type="button" onClick={remover} className="text-xs text-red-500 shrink-0">
              Remover
            </button>
          </>
        )}
      </div>

      {isDataUrl && tipo === "IMAGE" && (
        <img src={f.cabecalhoMidiaUrl} alt="" className="h-16 w-16 object-cover rounded-lg border" style={{ borderColor: T.borderSoft }} />
      )}

      <p className="text-[11px] leading-relaxed" style={{ color: T.inkFaint }}>
        Anexos ficam salvos direto no modelo (até ~700 KB — bom para imagens). Para vídeos, documentos ou arquivos maiores, prefira colar uma URL pública: é também o formato que a Meta exige na hora de cadastrar o modelo de verdade.
      </p>
    </div>
  );
}

/* ---------------- modal: criar / editar modelo ---------------- */
function ModeloModal({ initial, modelos, bms, porCanal, T, themeMode, onClose, onSave }) {
  const [f, setF] = useState(() => ({ ...emptyModelo(), ...initial, botoes: initial?.botoes || [], canais: { ...(initial?.canais || {}) } }));
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const editando = !!initial?.id;
  const canaisOriginais = initial?.canais || {};

  const nVars = new Set((f.corpo.match(/\{\{\d+\}\}/g) || [])).size;
  const nUrl = f.botoes.filter((b) => b.tipo === "URL").length;
  const nTel = f.botoes.filter((b) => b.tipo === "PHONE").length;

  const addBotao = (tipo) => setF({ ...f, botoes: [...f.botoes, { tipo, texto: "", valor: "" }] });
  const setBotao = (i, k, v) => setF({ ...f, botoes: f.botoes.map((b, j) => (j === i ? { ...b, [k]: v } : b)) });
  const delBotao = (i) => setF({ ...f, botoes: f.botoes.filter((_, j) => j !== i) });

  const toggleCanal = (bmId, on) => {
    const canais = { ...f.canais };
    if (on) canais[bmId] = { status: "IN_REVIEW", qualidade: "pending", atualizadoEm: new Date().toISOString() };
    else delete canais[bmId];
    setF({ ...f, canais });
  };
  const setCanal = (bmId, k, v) =>
    setF({ ...f, canais: { ...f.canais, [bmId]: { ...f.canais[bmId], [k]: v, atualizadoEm: new Date().toISOString() } } });

  const submit = (e) => {
    e.preventDefault();
    const nome = nomeMeta(f.nome);
    if (!nome) return alert("Informe o nome do modelo (letras minúsculas, números e _).");
    if (!f.corpo.trim()) return alert("O corpo da mensagem é obrigatório.");
    if (modelos.some((m) => m.id !== f.id && m.nome === nome && m.idioma === f.idioma)) {
      return alert(`Já existe um modelo "${nome}" em ${IDIOMAS[f.idioma]}. Mude o nome ou o idioma.`);
    }
    onSave({ ...f, nome });
  };

  const canaisOrdenados = [...bms].sort((a, b) => (a.nome || "").localeCompare(b.nome || ""));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: T.overlay }}>
      <div
        className="w-full max-w-4xl rounded-xl border flex flex-col max-h-[92vh]"
        style={{ background: T.surface, color: T.ink, borderColor: T.border }}
      >
        <div className="flex items-center justify-between border-b px-6 py-4 shrink-0" style={{ borderColor: T.borderSoft }}>
          <h3 className="pg-font-display text-lg font-semibold">{editando ? "Editar modelo" : "Novo modelo de mensagem"}</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:opacity-70">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={submit} className="flex flex-col min-h-0 flex-1">
          <div className="grid md:grid-cols-[1fr_320px] gap-6 p-6 overflow-y-auto pg-scroll min-h-0">
            <div className="flex flex-col gap-4 min-w-0">
              <Field label="Nome do modelo *" T={T} hint="minúsculas, números e _">
                <input
                  required
                  value={f.nome}
                  onChange={(e) => setF({ ...f, nome: nomeMeta(e.target.value) })}
                  placeholder="ex: confirmacao_pedido_v2"
                  className={inputCls + " pg-mono"}
                  style={inputStyleFor(T)}
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Categoria" T={T}>
                  <select value={f.categoria} onChange={set("categoria")} className={inputCls} style={inputStyleFor(T)}>
                    {Object.entries(CATEGORIAS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Idioma" T={T}>
                  <select value={f.idioma} onChange={set("idioma")} className={inputCls} style={inputStyleFor(T)}>
                    {Object.entries(IDIOMAS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              <Field label="Cabeçalho (opcional)" T={T}>
                <div className="flex flex-col gap-2">
                  <select
                    value={f.cabecalhoTipo}
                    onChange={(e) =>
                      setF((prev) => ({
                        ...prev,
                        cabecalhoTipo: e.target.value,
                        cabecalhoMidiaUrl: "",
                        cabecalhoMidiaNome: "",
                      }))
                    }
                    className={inputCls}
                    style={inputStyleFor(T)}
                  >
                    <option value="NONE">Nenhum</option>
                    <option value="TEXT">Texto</option>
                    <option value="IMAGE">Imagem</option>
                    <option value="VIDEO">Vídeo</option>
                    <option value="DOCUMENT">Documento</option>
                  </select>
                  {f.cabecalhoTipo === "TEXT" && (
                    <input
                      maxLength={LIM.cabecalho}
                      value={f.cabecalhoTexto}
                      onChange={set("cabecalhoTexto")}
                      placeholder="Texto do cabeçalho"
                      className={inputCls}
                      style={inputStyleFor(T)}
                    />
                  )}
                  {["IMAGE", "VIDEO", "DOCUMENT"].includes(f.cabecalhoTipo) && <CabecalhoMidia f={f} setF={setF} T={T} />}
                </div>
              </Field>

              <Field label="Corpo da mensagem *" T={T} hint={`${f.corpo.length}/${LIM.corpo} · ${nVars} variável(is)`}>
                <textarea
                  required
                  rows={6}
                  maxLength={LIM.corpo}
                  value={f.corpo}
                  onChange={set("corpo")}
                  placeholder={"Olá {{1}}, seu pedido {{2}} foi confirmado.\nUse *negrito*, _itálico_ e ~tachado~."}
                  className={inputCls}
                  style={inputStyleFor(T)}
                />
              </Field>

              <Field label="Rodapé (opcional)" T={T} hint={`${f.rodape.length}/${LIM.rodape}`}>
                <input maxLength={LIM.rodape} value={f.rodape} onChange={set("rodape")} placeholder="Ex: Responda SAIR para não receber mais" className={inputCls} style={inputStyleFor(T)} />
              </Field>

              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium" style={{ color: T.inkSoft }}>
                    Botões (opcional) · {f.botoes.length}/{LIM.botoes}
                  </span>
                  <div className="flex gap-1.5">
                    <button type="button" disabled={f.botoes.length >= LIM.botoes} onClick={() => addBotao("QUICK_REPLY")} className="px-2.5 py-1 rounded-md text-xs disabled:opacity-40" style={{ background: T.borderSoft, color: T.inkSoft }}>
                      + Resposta rápida
                    </button>
                    <button type="button" disabled={f.botoes.length >= LIM.botoes || nUrl >= LIM.url} onClick={() => addBotao("URL")} className="px-2.5 py-1 rounded-md text-xs disabled:opacity-40" style={{ background: T.borderSoft, color: T.inkSoft }}>
                      + URL
                    </button>
                    <button type="button" disabled={f.botoes.length >= LIM.botoes || nTel >= LIM.telefone} onClick={() => addBotao("PHONE")} className="px-2.5 py-1 rounded-md text-xs disabled:opacity-40" style={{ background: T.borderSoft, color: T.inkSoft }}>
                      + Telefone
                    </button>
                  </div>
                </div>
                {f.botoes.map((b, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <span className="text-[11px] w-24 shrink-0" style={{ color: T.inkFaint }}>
                      {ROTULO_BOTAO[b.tipo]}
                    </span>
                    <input maxLength={LIM.botao} value={b.texto} onChange={(e) => setBotao(i, "texto", e.target.value)} placeholder="Texto do botão" className={inputCls} style={inputStyleFor(T)} />
                    {b.tipo !== "QUICK_REPLY" && (
                      <input value={b.valor} onChange={(e) => setBotao(i, "valor", e.target.value)} placeholder={b.tipo === "URL" ? "https://…" : "+55…"} className={inputCls} style={inputStyleFor(T)} />
                    )}
                    <button type="button" onClick={() => delBotao(i)} className="p-1.5 text-red-500 hover:opacity-70 shrink-0">
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-xs font-medium" style={{ color: T.inkSoft }}>
                  Canais onde este modelo está cadastrado
                </span>
                <div className="rounded-lg border divide-y max-h-64 overflow-y-auto pg-scroll" style={{ borderColor: T.border }}>
                  {canaisOrdenados.length === 0 && (
                    <div className="p-4 text-sm text-center" style={{ color: T.inkFaint }}>
                      Nenhum ativo cadastrado ainda.
                    </div>
                  )}
                  {canaisOrdenados.map((bm) => {
                    const marcado = !!f.canais[bm.id];
                    const jaEra = !!canaisOriginais[bm.id];
                    const a = analisarCanal(bm, porCanal[bm.id]?.nomes.size || 0);
                    // não deixa incluir em canal sem vaga; quem já tinha continua editável
                    const travado = !a.pode && !jaEra && !marcado;
                    return (
                      <div key={bm.id} className="p-3 flex flex-col gap-2" style={{ borderColor: T.borderSoft, opacity: travado ? 0.6 : 1 }}>
                        <label className="flex items-center gap-2.5 text-sm cursor-pointer">
                          <input type="checkbox" disabled={travado} checked={marcado} onChange={(e) => toggleCanal(bm.id, e.target.checked)} />
                          <span className="font-medium flex-1 truncate">{bm.nome}</span>
                          <span className="pg-mono text-xs" style={{ color: T.inkFaint }}>
                            {a.usados}/{a.limite}
                          </span>
                          {!a.pode && (
                            <span className="text-[11px] flex items-center gap-1" style={{ color: T.STATUS.banida.fg }}>
                              <Lock size={11} /> {a.motivo}
                            </span>
                          )}
                        </label>
                        {marcado && (
                          <div className="grid grid-cols-2 gap-2 pl-6">
                            <select value={f.canais[bm.id].status} onChange={(e) => setCanal(bm.id, "status", e.target.value)} className={inputCls} style={inputStyleFor(T)}>
                              {Object.entries(STATUS_MODELO).map(([k, v]) => (
                                <option key={k} value={k}>
                                  {v.label}
                                </option>
                              ))}
                            </select>
                            <select value={f.canais[bm.id].qualidade || "pending"} onChange={(e) => setCanal(bm.id, "qualidade", e.target.value)} className={inputCls} style={inputStyleFor(T)}>
                              {Object.entries(QUALIDADE_MODELO).map(([k, v]) => (
                                <option key={k} value={k}>
                                  {v}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="md:sticky md:top-0 self-start flex flex-col gap-2">
              <span className="text-xs font-medium" style={{ color: T.inkSoft }}>
                Prévia
              </span>
              <PreviewWhatsApp m={f} T={T} themeMode={themeMode} />
            </div>
          </div>

          <div className="flex justify-end gap-3 border-t px-6 py-4 shrink-0" style={{ borderColor: T.borderSoft }}>
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ background: T.borderSoft, color: T.inkSoft }}>
              Cancelar
            </button>
            <button type="submit" className="px-5 py-2 rounded-lg text-sm font-medium text-white transition-shadow hover:shadow-lg" style={{ background: T.primary }}>
              Salvar modelo
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ---------------- modal: configurar canal (limite / bloqueio) ---------------- */
function CanalConfigModal({ bm, usados, T, onClose, onSave }) {
  const [limite, setLimite] = useState(bm.limiteModelos || LIMITE_PADRAO);
  const [bloqueado, setBloqueado] = useState(!!bm.modelosBloqueado);
  const [motivo, setMotivo] = useState(bm.modelosBloqueioMotivo || "");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: T.overlay }}>
      <div className="w-full max-w-md rounded-xl p-6 border flex flex-col gap-5" style={{ background: T.surface, color: T.ink, borderColor: T.border }}>
        <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: T.borderSoft }}>
          <h3 className="pg-font-display text-lg font-semibold truncate">Cadastro de modelos · {bm.nome}</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:opacity-70">
            <X size={20} />
          </button>
        </div>
        <Field label="Limite de modelos deste canal" T={T} hint={`${usados} em uso`}>
          <input type="number" min="1" value={limite} onChange={(e) => setLimite(e.target.value)} className={inputCls} style={inputStyleFor(T)} />
        </Field>
        <p className="text-xs -mt-2" style={{ color: T.inkFaint }}>
          A Meta permite 250 modelos por conta sem Business verificado e 6.000 com verificação. Ajuste aqui conforme o canal.
        </p>
        <label className="flex items-center gap-2.5 text-sm cursor-pointer">
          <input type="checkbox" checked={bloqueado} onChange={(e) => setBloqueado(e.target.checked)} />
          Bloquear novos cadastros neste canal
        </label>
        {bloqueado && (
          <Field label="Motivo (aparece no painel)" T={T}>
            <input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex: Meta bloqueou a criação de modelos" className={inputCls} style={inputStyleFor(T)} />
          </Field>
        )}
        <div className="flex justify-end gap-3 border-t pt-4" style={{ borderColor: T.borderSoft }}>
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ background: T.borderSoft, color: T.inkSoft }}>
            Cancelar
          </button>
          <button
            onClick={() => onSave(bm, { limiteModelos: Number(limite) || LIMITE_PADRAO, modelosBloqueado: bloqueado, modelosBloqueioMotivo: bloqueado ? motivo : "" })}
            className="px-5 py-2 rounded-lg text-sm font-medium text-white transition-shadow hover:shadow-lg"
            style={{ background: T.primary }}
          >
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- gaveta de detalhes ---------------- */
function DetalheModelo({ m, bmPorId, T, themeMode, onClose, onEdit, onDuplicate, onDelete }) {
  const regs = Object.entries(m.canais || {});
  return (
    <div className="fixed inset-0 z-50 flex justify-end" style={{ background: T.overlay }} onClick={onClose}>
      <div
        className="w-full max-w-md h-full overflow-y-auto pg-scroll border-l p-6 flex flex-col gap-5"
        style={{ background: T.surface, color: T.ink, borderColor: T.border }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="pg-mono text-base font-semibold break-all">{m.nome}</h3>
            <div className="flex flex-wrap gap-1.5 mt-2">
              <Pill T={T}>{CATEGORIAS[m.categoria] || m.categoria}</Pill>
              <Pill T={T} color={T.inkSoft}>
                {IDIOMAS[m.idioma] || m.idioma}
              </Pill>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:opacity-70 shrink-0">
            <X size={20} />
          </button>
        </div>

        <PreviewWhatsApp m={m} T={T} themeMode={themeMode} />

        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium" style={{ color: T.inkSoft }}>
            Canais ({regs.length})
          </span>
          {regs.length === 0 ? (
            <div className="text-sm" style={{ color: T.inkFaint }}>
              Este modelo ainda não está cadastrado em nenhum canal.
            </div>
          ) : (
            <div className="rounded-lg border divide-y" style={{ borderColor: T.border }}>
              {regs.map(([id, r]) => (
                <div key={id} className="p-3 flex items-center justify-between gap-3 text-sm" style={{ borderColor: T.borderSoft }}>
                  <span className="font-medium truncate">{bmPorId[id]?.nome || "Canal removido"}</span>
                  <StatusModelo reg={r} T={T} />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="text-xs" style={{ color: T.inkFaint }}>
          Criado em {fmtData(m.criadoEm)} · Última edição {fmtData(m.atualizadoEm)}
        </div>

        <div className="flex gap-2 mt-auto pt-4 border-t" style={{ borderColor: T.borderSoft }}>
          <button onClick={onEdit} className="flex-1 px-4 py-2 rounded-lg text-sm font-medium text-white flex items-center justify-center gap-2" style={{ background: T.primary }}>
            <Pencil size={15} /> Editar
          </button>
          <button onClick={onDuplicate} className="px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2" style={{ background: T.borderSoft, color: T.inkSoft }}>
            <Copy size={15} /> Duplicar
          </button>
          <button onClick={onDelete} className="px-3 py-2 rounded-lg text-sm text-red-500" style={{ background: T.borderSoft }}>
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

/* =====================================================================
   COMPONENTE PRINCIPAL
   props: bms, T, themeMode, registrarHistorico
   ===================================================================== */
export default function PainelModelos({ bms, T, themeMode, registrarHistorico }) {
  const [modelos, setModelos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [sub, setSub] = useState("modelos");

  const [search, setSearch] = useState("");
  const [fCategoria, setFCategoria] = useState("todos");
  const [fStatus, setFStatus] = useState("todos");
  const [fIdioma, setFIdioma] = useState("todos");
  const [fCanal, setFCanal] = useState("todos");
  const [fVaga, setFVaga] = useState("todos"); // aba Canais: todos | aptos | sem_vaga

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [detalhe, setDetalhe] = useState(null); // id do modelo aberto na gaveta
  const [canalConfig, setCanalConfig] = useState(null);

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "modelos"),
      (snap) => {
        setModelos(snap.docs.map((d) => ({ id: d.id, botoes: [], canais: {}, ...d.data() })));
        setLoading(false);
      },
      (err) => {
        console.error("Erro ao ler modelos:", err);
        setErro(err.message || "Sem permissão para ler a coleção 'modelos'.");
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  const bmPorId = useMemo(() => Object.fromEntries(bms.map((b) => [b.id, b])), [bms]);

  // por canal: nomes distintos (o limite da Meta conta nomes, não idiomas) e lista de modelos
  const porCanal = useMemo(() => {
    const map = {};
    bms.forEach((b) => (map[b.id] = { nomes: new Set(), modelos: [] }));
    modelos.forEach((m) =>
      Object.keys(m.canais || {}).forEach((id) => {
        if (map[id]) {
          map[id].nomes.add(m.nome);
          map[id].modelos.push(m);
        }
      })
    );
    return map;
  }, [bms, modelos]);

  const canais = useMemo(
    () =>
      bms
        .map((bm) => ({ bm, ...analisarCanal(bm, porCanal[bm.id]?.nomes.size || 0) }))
        .sort((a, b) => (a.bm.nome || "").localeCompare(b.bm.nome || "")),
    [bms, porCanal]
  );

  const stats = useMemo(() => {
    let emAnalise = 0;
    let rejeitados = 0;
    modelos.forEach((m) =>
      Object.values(m.canais || {}).forEach((r) => {
        if (r.status === "IN_REVIEW") emAnalise++;
        if (r.status === "REJECTED" || r.status === "DISABLED") rejeitados++;
      })
    );
    return {
      total: modelos.length,
      aptos: canais.filter((c) => c.pode && c.bm.status !== "estoque").length,
      semVaga: canais.filter((c) => !c.pode).length,
      emAnalise,
      rejeitados,
    };
  }, [modelos, canais]);

  const filtrados = useMemo(() => {
    const q = search.trim().toLowerCase();
    return modelos
      .filter((m) => {
        if (q && !`${m.nome} ${m.corpo}`.toLowerCase().includes(q)) return false;
        if (fCategoria !== "todos" && m.categoria !== fCategoria) return false;
        if (fIdioma !== "todos" && m.idioma !== fIdioma) return false;
        const regs = Object.entries(m.canais || {});
        if (fCanal !== "todos" && !regs.some(([id]) => id === fCanal)) return false;
        if (fStatus !== "todos" && !regs.some(([id, r]) => (fCanal === "todos" || id === fCanal) && r.status === fStatus)) return false;
        return true;
      })
      .sort((a, b) => String(b.atualizadoEm || "").localeCompare(String(a.atualizadoEm || "")));
  }, [modelos, search, fCategoria, fIdioma, fCanal, fStatus]);

  const canaisFiltrados = useMemo(() => {
    const q = search.trim().toLowerCase();
    return canais.filter((c) => {
      if (q && !`${c.bm.nome} ${c.bm.telefone || ""}`.toLowerCase().includes(q)) return false;
      if (fVaga === "aptos" && !c.pode) return false;
      if (fVaga === "sem_vaga" && c.pode) return false;
      return true;
    });
  }, [canais, search, fVaga]);

  /* ---- ações ---- */
  const handleSave = async (dados) => {
    const agora = new Date().toISOString();
    const id = dados.id || uid();
    const isEdit = !!dados.id;
    const payload = {
      ...dados,
      id,
      botoes: dados.botoes || [],
      canais: dados.canais || {},
      criadoEm: dados.criadoEm || agora,
      atualizadoEm: agora,
    };
    await setDoc(doc(db, "modelos", id), payload);
    await registrarHistorico?.(
      isEdit ? "Edição de Modelo" : "Novo Modelo",
      `Modelo "${dados.nome}" (${IDIOMAS[dados.idioma] || dados.idioma}) em ${Object.keys(payload.canais).length} canal(is)`
    );
    setModalOpen(false);
    setEditing(null);
  };

  const handleDelete = async (m) => {
    if (!confirm(`Remover o modelo "${m.nome}" (${IDIOMAS[m.idioma] || m.idioma}) de todos os canais?`)) return;
    await deleteDoc(doc(db, "modelos", m.id));
    await registrarHistorico?.("Exclusão de Modelo", `Modelo "${m.nome}" (${m.idioma}) foi removido.`);
    setDetalhe(null);
  };

  const handleSaveCanal = async (bm, cfg) => {
    await setDoc(doc(db, "bms", bm.id), cfg, { merge: true });
    await registrarHistorico?.(
      "Config. de Modelos do Canal",
      `Canal "${bm.nome}": limite ${cfg.limiteModelos}${cfg.modelosBloqueado ? `, cadastro bloqueado (${cfg.modelosBloqueioMotivo || "sem motivo"})` : ""}`
    );
    setCanalConfig(null);
  };

  const abrirNovo = () => {
    setEditing(null);
    setModalOpen(true);
  };
  const abrirEdicao = (m) => {
    setDetalhe(null);
    setEditing(m);
    setModalOpen(true);
  };
  const duplicar = (m) => {
    setDetalhe(null);
    setEditing({ ...m, id: "", nome: `${m.nome}_v2`, canais: {}, criadoEm: "", atualizadoEm: "" });
    setModalOpen(true);
  };

  const modeloDetalhe = detalhe ? modelos.find((m) => m.id === detalhe) : null;

  const selCls = "rounded-lg px-3 py-2 text-sm outline-none pg-font-body";

  return (
    <div className="flex flex-col gap-6">
      {/* topo: abas + ação */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="inline-flex p-1 rounded-lg border" style={{ borderColor: T.border, background: T.surface }}>
          {[
            { id: "modelos", label: "Modelos" },
            { id: "canais", label: "Canais" },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setSub(t.id)}
              className="px-4 py-1.5 rounded-md text-sm"
              style={{ background: sub === t.id ? T.primary : "transparent", color: sub === t.id ? "#fff" : T.inkSoft, fontWeight: sub === t.id ? 600 : 500 }}
            >
              {t.label}
            </button>
          ))}
        </div>
        <button onClick={abrirNovo} className="px-4 py-2 rounded-lg text-sm font-medium text-white flex items-center gap-2 transition-shadow hover:shadow-lg" style={{ background: T.primary }}>
          <Plus size={18} /> Novo modelo
        </button>
      </div>

      {/* resumo */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Modelos registrados", value: stats.total },
          { label: "Canais aptos a cadastrar", value: stats.aptos, color: T.STATUS.ativa.fg },
          { label: "Canais sem vaga ou bloqueados", value: stats.semVaga, color: stats.semVaga ? T.STATUS.banida.fg : undefined },
          { label: "Em análise · rejeitados", value: `${stats.emAnalise} · ${stats.rejeitados}`, color: T.STATUS.em_recurso.fg },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border p-4" style={{ background: T.surface, borderColor: T.borderSoft }}>
            <div className="text-xs" style={{ color: T.inkSoft }}>
              {s.label}
            </div>
            <div className="pg-font-display text-2xl font-bold pg-tnum mt-1" style={{ color: s.color || T.ink }}>
              {s.value}
            </div>
          </div>
        ))}
      </div>

      {erro && (
        <div className="p-4 rounded-xl border flex items-start gap-3 text-sm" style={{ borderColor: T.STATUS.banida.fg + "55" }}>
          <AlertTriangle size={20} className="shrink-0" style={{ color: T.STATUS.banida.fg }} />
          <div>
            Não foi possível carregar os modelos: <b>{erro}</b>
            <div style={{ color: T.inkSoft }}>Confira se as regras do Firestore permitem leitura e escrita na coleção "modelos".</div>
          </div>
        </div>
      )}

      {/* filtros */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: T.inkFaint }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={sub === "modelos" ? "Buscar por nome ou texto do modelo" : "Buscar canal por nome ou telefone"}
            className={inputCls}
            style={{ ...inputStyleFor(T), paddingLeft: 36 }}
          />
        </div>
        {sub === "modelos" ? (
          <>
            <select value={fCategoria} onChange={(e) => setFCategoria(e.target.value)} className={selCls} style={inputStyleFor(T)}>
              <option value="todos">Todas as categorias</option>
              {Object.entries(CATEGORIAS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
            <select value={fStatus} onChange={(e) => setFStatus(e.target.value)} className={selCls} style={inputStyleFor(T)}>
              <option value="todos">Todos os status</option>
              {Object.entries(STATUS_MODELO).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </select>
            <select value={fIdioma} onChange={(e) => setFIdioma(e.target.value)} className={selCls} style={inputStyleFor(T)}>
              <option value="todos">Todos os idiomas</option>
              {Object.entries(IDIOMAS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
            <select value={fCanal} onChange={(e) => setFCanal(e.target.value)} className={selCls} style={inputStyleFor(T)}>
              <option value="todos">Todos os canais</option>
              {canais.map((c) => (
                <option key={c.bm.id} value={c.bm.id}>
                  {c.bm.nome}
                </option>
              ))}
            </select>
          </>
        ) : (
          <select value={fVaga} onChange={(e) => setFVaga(e.target.value)} className={selCls} style={inputStyleFor(T)}>
            <option value="todos">Todos os canais</option>
            <option value="aptos">Podem cadastrar</option>
            <option value="sem_vaga">Sem vaga ou bloqueados</option>
          </select>
        )}
      </div>

      {loading ? (
        <div className="p-10 text-center text-sm" style={{ color: T.inkFaint }}>
          Carregando modelos…
        </div>
      ) : sub === "modelos" ? (
        /* ------------- lista de modelos (estilo WhatsApp Manager) ------------- */
        <div className="rounded-xl border overflow-x-auto pg-scroll" style={{ background: T.surface, borderColor: T.borderSoft }}>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b" style={{ borderColor: T.borderSoft, color: T.inkSoft }}>
                <th className="p-4 font-medium">Nome e idioma</th>
                <th className="p-4 font-medium">Categoria</th>
                <th className="p-4 font-medium">Status</th>
                <th className="p-4 font-medium">Canais</th>
                <th className="p-4 font-medium">Última edição</th>
                <th className="p-4 text-right font-medium">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: T.borderSoft }}>
              {filtrados.length === 0 ? (
                <tr>
                  <td colSpan="6" className="p-10 text-center" style={{ color: T.inkFaint }}>
                    {modelos.length === 0 ? (
                      <div className="flex flex-col items-center gap-3">
                        <MessageSquare size={28} />
                        Nenhum modelo registrado. Cadastre o primeiro para acompanhar em quais canais ele está.
                      </div>
                    ) : (
                      "Nenhum modelo com os filtros aplicados."
                    )}
                  </td>
                </tr>
              ) : (
                filtrados.map((m) => {
                  const regs = Object.entries(m.canais || {});
                  const resumo = {};
                  regs.forEach(([, r]) => (resumo[r.status] = (resumo[r.status] || 0) + 1));
                  return (
                    <tr key={m.id} onClick={() => setDetalhe(m.id)} className="cursor-pointer hover:opacity-90">
                      <td className="p-4">
                        <div className="pg-mono font-medium">{m.nome}</div>
                        <div className="text-xs mt-0.5" style={{ color: T.inkFaint }}>
                          {IDIOMAS[m.idioma] || m.idioma}
                        </div>
                      </td>
                      <td className="p-4">
                        <Pill T={T}>{CATEGORIAS[m.categoria] || m.categoria}</Pill>
                      </td>
                      <td className="p-4">
                        {regs.length === 0 ? (
                          <span style={{ color: T.inkFaint }}>—</span>
                        ) : (
                          <div className="flex flex-col gap-0.5">
                            {Object.entries(resumo).map(([st, n]) => (
                              <span key={st} className="inline-flex items-center gap-1.5 text-xs font-medium" style={{ color: toneColor(T, STATUS_MODELO[st]?.tone) }}>
                                <span className="w-1.5 h-1.5 rounded-full" style={{ background: toneColor(T, STATUS_MODELO[st]?.tone) }} />
                                {n} {STATUS_MODELO[st]?.label.toLowerCase()}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="p-4">
                        <div className="flex flex-wrap gap-1 max-w-[260px]">
                          {regs.slice(0, 3).map(([id]) => (
                            <Pill key={id} T={T} color={T.inkSoft}>
                              {bmPorId[id]?.nome || "removido"}
                            </Pill>
                          ))}
                          {regs.length > 3 && <Pill T={T} color={T.inkSoft}>+{regs.length - 3}</Pill>}
                          {regs.length === 0 && <span style={{ color: T.inkFaint }}>—</span>}
                        </div>
                      </td>
                      <td className="p-4 pg-tnum" style={{ color: T.inkSoft }}>
                        {fmtData(m.atualizadoEm)}
                      </td>
                      <td className="p-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => abrirEdicao(m)} className="p-1.5 mr-1 rounded" style={{ color: T.primary }}>
                          <Pencil size={16} />
                        </button>
                        <button onClick={() => handleDelete(m)} className="p-1.5 rounded text-red-500">
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
      ) : (
        /* ------------- canais: quem tem o quê e quem não pode mais cadastrar ------------- */
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {canaisFiltrados.length === 0 && (
            <div className="md:col-span-2 xl:col-span-3 p-10 text-center text-sm" style={{ color: T.inkFaint }}>
              Nenhum canal encontrado.
            </div>
          )}
          {canaisFiltrados.map(({ bm, usados, limite, pode, motivo }) => {
            const pct = Math.min(100, Math.round((usados / limite) * 100));
            const corBarra = pct >= 100 ? T.STATUS.banida.fg : pct >= 85 ? T.STATUS.em_recurso.fg : T.primary;
            const lista = porCanal[bm.id]?.modelos || [];
            return (
              <div key={bm.id} className="rounded-xl border p-5 flex flex-col gap-4" style={{ background: T.surface, borderColor: T.borderSoft }}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{bm.nome}</div>
                    <div className="text-xs mt-0.5 flex items-center gap-2" style={{ color: T.inkFaint }}>
                      {bm.telefone || "sem telefone"}
                      <span className="inline-flex items-center gap-1" style={{ color: (T.STATUS[bm.status] || T.STATUS.estoque).fg }}>
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: (T.STATUS[bm.status] || T.STATUS.estoque).fg }} />
                        {(T.STATUS[bm.status] || T.STATUS.estoque).label}
                      </span>
                    </div>
                  </div>
                  <button onClick={() => setCanalConfig(bm)} className="p-1.5 rounded shrink-0" style={{ color: T.primary }} title="Configurar limite e bloqueio">
                    <Pencil size={16} />
                  </button>
                </div>

                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span style={{ color: T.inkSoft }}>Modelos cadastrados</span>
                    <span className="pg-mono">
                      {usados}/{limite}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: T.borderSoft }}>
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: corBarra }} />
                  </div>
                </div>

                {pode ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium" style={{ color: T.STATUS.ativa.fg }}>
                    <Check size={14} /> Pode cadastrar ({limite - usados} vaga{limite - usados === 1 ? "" : "s"})
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium" style={{ color: T.STATUS.banida.fg }}>
                    <Ban size={14} /> Não pode cadastrar · {motivo}
                  </span>
                )}

                <div className="flex flex-wrap gap-1 pt-3 border-t" style={{ borderColor: T.borderSoft }}>
                  {lista.length === 0 && (
                    <span className="text-xs" style={{ color: T.inkFaint }}>
                      Nenhum modelo neste canal.
                    </span>
                  )}
                  {lista.slice(0, 8).map((m) => (
                    <button key={m.id} onClick={() => setDetalhe(m.id)} title={`${m.nome} · ${IDIOMAS[m.idioma] || m.idioma}`}>
                      <Pill T={T}>{m.nome}</Pill>
                    </button>
                  ))}
                  {lista.length > 8 && <Pill T={T} color={T.inkSoft}>+{lista.length - 8}</Pill>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modalOpen && (
        <ModeloModal
          initial={editing}
          modelos={modelos}
          bms={bms}
          porCanal={porCanal}
          T={T}
          themeMode={themeMode}
          onClose={() => {
            setModalOpen(false);
            setEditing(null);
          }}
          onSave={handleSave}
        />
      )}

      {modeloDetalhe && (
        <DetalheModelo
          m={modeloDetalhe}
          bmPorId={bmPorId}
          T={T}
          themeMode={themeMode}
          onClose={() => setDetalhe(null)}
          onEdit={() => abrirEdicao(modeloDetalhe)}
          onDuplicate={() => duplicar(modeloDetalhe)}
          onDelete={() => handleDelete(modeloDetalhe)}
        />
      )}

      {canalConfig && (
        <CanalConfigModal
          bm={canalConfig}
          usados={porCanal[canalConfig.id]?.nomes.size || 0}
          T={T}
          onClose={() => setCanalConfig(null)}
          onSave={handleSaveCanal}
        />
      )}
    </div>
  );
}
