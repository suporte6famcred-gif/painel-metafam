import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  FileText, 
  Users, 
  DollarSign, 
  Plus, 
  Trash2, 
  Edit, 
  Save, 
  X,
  Search,
  CheckCircle,
  AlertCircle
} from 'lucide-react';

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

/* ---------- Componente Principal ---------- */
function App() {
  const [bms, setBms] = useState([]);
  const [fornecedores, setFornecedores] = useState([]);
  const [loading, setLoading] = useState(true);

  // Carrega os dados ao iniciar a aplicação
  useEffect(() => {
    async function fetchData() {
      const data = await loadAll();
      setBms(data.bms || []);
      setFornecedores(data.fornecedores || []);
      setLoading(false);
    }
    fetchData();
  }, []);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans">
      {/* Header */}
      <header className="bg-slate-800 border-b border-slate-700 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Building2 className="w-8 h-8 text-blue-500" />
          <h1 className="text-xl font-bold text-white">Gestão de Ativos - Meta Fam</h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-6 max-w-7xl mx-auto space-y-6">
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <p className="text-slate-400">Carregando dados...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Card BM */}
            <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold flex items-center space-x-2">
                  <FileText className="w-5 h-5 text-blue-400" />
                  <span>Boletins de Medição (BMs)</span>
                </h2>
                <span className="bg-blue-500/10 text-blue-400 px-3 py-1 rounded-full text-xs font-semibold">
                  {bms.length} Registros
                </span>
              </div>
              <p className="text-slate-400 text-sm">
                Gerencie aqui os boletins e medições ativas.
              </p>
            </div>

            {/* Card Fornecedores */}
            <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold flex items-center space-x-2">
                  <Users className="w-5 h-5 text-emerald-400" />
                  <span>Fornecedores</span>
                </h2>
                <span className="bg-emerald-500/10 text-emerald-400 px-3 py-1 rounded-full text-xs font-semibold">
                  {fornecedores.length} Cadastrados
                </span>
              </div>
              <p className="text-slate-400 text-sm">
                Gerencie a lista de fornecedores e parceiros cadastrados.
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;

