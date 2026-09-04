/* ---------- storage ---------- */
const BMS_KEY = "gestao-ativos:bms";
const FORN_KEY = "gestao-ativos:fornecedores";

async function loadAll() {
  const out = { bms: [], fornecedores: [] };
  try {
    const bms = localStorage.getItem(BMS_KEY);
    if (bms) out.bms = JSON.parse(bms);
  } catch (e) {}
  try {
    const forn = localStorage.getItem(FORN_KEY);
    if (forn) out.fornecedores = JSON.parse(forn);
  } catch (e) {}
  return out;
}

async function saveBMs(bms) {
  try {
    localStorage.setItem(BMS_KEY, JSON.stringify(bms));
    return true;
  } catch (e) {
    return false;
  }
}

async function saveFornecedores(f) {
  try {
    localStorage.setItem(FORN_KEY, JSON.stringify(f));
    return true;
  } catch (e) {
    return false;
  }
}