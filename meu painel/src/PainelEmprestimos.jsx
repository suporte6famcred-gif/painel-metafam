import React, { useState, useEffect, useMemo } from "react";
import {
  ArrowLeftRight, Plus, Search, X, Check, ChevronDown, ChevronUp,
  Download, LayoutGrid, List, SlidersHorizontal, Eye, Clock, AlertTriangle,
  CheckCircle2, Undo2, Smartphone,
} from "lucide-react";
import { db } from "./firebase";
import {
  collection, onSnapshot, doc, setDoc, deleteDoc, updateDoc,
} from "firebase/firestore";
import {
  AnimStyles, Dropdown, useCountUp, usePersistentState,
  rgba, inputCls, inputStyleFor, uid, fmtData,
} from "./painelShared";

/* =====================================================================
   PAINEL DE EMPRÉSTIMOS DE CHIPS
   - Coleção: "emprestimos"
   - Ao criar: chip vai para status "emprestado"
   - Ao devolver: grava dataDevolucaoReal e chip volta para "disponivel"
   - Sub-abas: Ativos | Histórico
   ===================================================================== */

const PRAZO_COR = {
  devolvido: "ativa",
  ok: "ativa",
  atencao: "em_recurso",
  hoje: "em_recurso",
  atrasado: "banida",
};

/* Calcula status do prazo (estilo Trello) */
export function getStatusPrazo(e) {
  if (e.dataDevolucaoReal) return { key: "devolvido", label: "Devolvido", dias: null };
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const prev = new Date((e.dataPrevistaDevolucao || "") + "T00:00:00");
  if (isNaN(prev.getTime())) return { key: "ok", label: "Sem prazo", dias: null };
  const dias = Math.round((prev - hoje) / 86400000);
  if (dias < 0) return { key: "atrasado", label: `Atrasado (${Math.abs(dias)}d)`, dias };
  if (dias === 0) return { key: "hoje", label: "Vence hoje", dias };
  if (dias <= 3) return { key: "atencao", label: `${dias}d restantes`, dias };
  return { key: "ok", label: `${dias}d restantes`, dias };
}

const F0 = { prazo: [], operador: [] };

function PrazoPill({ emp, T }) {
  const s = getStatusPrazo(emp);
  const cor = T.ST
