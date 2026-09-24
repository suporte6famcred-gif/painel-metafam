import React, { useState, useMemo } from "react";

const PESO_QUALIDADE = { alta: 3, media: 2, baixa: 1 };
const COLUNAS_RODIZIO = [
  { key: "disponivel", label: "Disponível" },
  { key: "em_uso", label: "Em uso hoje" },
  { key: "descanso", label: "Em descanso" },
];

function hojeISO() {
  return new Date().toISOString().split("T")[0];
}

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

export function PainelRodizio({ bms, T, onMoverColuna }) {
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
            Arraste as BMs entre as colunas (ou use os botões no card).
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
