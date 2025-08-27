import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

// Single-file React app using Tailwind CSS.
// Aesthetic: purple→pink gradient. EN → PT translator with 3000-char limit and history in localStorage.

const STORAGE_KEY = "translator_history_v1";
const CHAR_LIMIT = 3000;

function formatDate(dt = new Date()) {
  return dt.toLocaleString();
}

async function tryLibreTranslate(text) {
  const res = await fetch("https://libretranslate.com/translate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ q: text, source: "en", target: "pt", format: "text" })
  });
  if (!res.ok) throw new Error("LibreTranslate error");
  const data = await res.json();
  if (data?.translatedText) return data.translatedText;
  throw new Error("LibreTranslate invalid response");
}

async function tryMyMemory(text) {
  const url = new URL("https://api.mymemory.translated.net/get");
  url.searchParams.set("q", text);
  url.searchParams.set("langpair", "en|pt");
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error("MyMemory error");
  const data = await res.json();
  const t = data?.responseData?.translatedText;
  if (t) return t;
  throw new Error("MyMemory invalid response");
}

async function translateENtoPT(text) {
  // Try LibreTranslate first, then MyMemory as fallback
  try {
    return await tryLibreTranslate(text);
  } catch (e1) {
    try {
      return await tryMyMemory(text);
    } catch (e2) {
      // Final fallback: return original text with message
      return `⚠️ Falha ao traduzir automaticamente. Texto original mantido abaixo:\n\n${text}`;
    }
  }
}

export default function App() {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [history, setHistory] = useState([]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setHistory(JSON.parse(raw));
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    } catch {}
  }, [history]);

  const remaining = CHAR_LIMIT - input.length;
  const overLimit = input.length > CHAR_LIMIT;

  const filteredHistory = useMemo(() => {
    if (!query.trim()) return history;
    const q = query.toLowerCase();
    return history.filter(
      (h) => h.src.toLowerCase().includes(q) || h.dst.toLowerCase().includes(q)
    );
  }, [history, query]);

  async function handleTranslate() {
    setError("");
    setOutput("");
    const text = input.trim();
    if (!text) {
      setError("Digite um texto em inglês para traduzir.");
      return;
    }
    if (text.length > CHAR_LIMIT) {
      setError(`O texto excede o limite de ${CHAR_LIMIT} caracteres.`);
      return;
    }
    setLoading(true);
    try {
      const translated = await translateENtoPT(text);
      setOutput(translated);
      const item = {
        id: crypto.randomUUID(),
        when: Date.now(),
        src: text,
        dst: translated
      };
      setHistory((h) => [item, ...h].slice(0, 200)); // keep last 200
    } catch (e) {
      setError("Não foi possível traduzir agora. Tente novamente em instantes.");
    } finally {
      setLoading(false);
    }
  }

  function copyToClipboard(text) {
    navigator.clipboard.writeText(text);
  }

  function handleClearHistory() {
    if (confirm("Limpar todo o histórico?")) setHistory([]);
  }

  function loadIntoEditor(item) {
    setInput(item.src.slice(0, CHAR_LIMIT));
    setOutput(item.dst);
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-purple-700 via-fuchsia-600 to-pink-500 text-white">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight drop-shadow">
              EN → PT Tradutor
            </h1>
            <p className="opacity-90">Traduza textos do inglês para o português (até {CHAR_LIMIT} caracteres).</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setInput("");
                setOutput("");
                setError("");
              }}
              className="px-4 py-2 rounded-2xl bg-white/10 hover:bg-white/20 backdrop-blur shadow"
            >
              Novo
            </button>
            <button
              onClick={handleClearHistory}
              className="px-4 py-2 rounded-2xl bg-white/10 hover:bg-white/20 backdrop-blur shadow"
            >
              Limpar histórico
            </button>
          </div>
        </header>

        <main className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Editor */}
          <section className="bg-white/10 backdrop-blur rounded-2xl p-4 shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-semibold">Texto em inglês</h2>
              <span className={`text-xs px-2 py-1 rounded-full ${overLimit ? "bg-red-600" : "bg-black/30"}`}>
                {remaining} restantes
              </span>
            </div>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value.slice(0, CHAR_LIMIT + 100))}
              placeholder="Digite ou cole o texto em inglês aqui..."
              className="w-full h-52 md:h-64 resize-none rounded-xl p-3 text-black placeholder-black/50 bg-white focus:outline-none focus:ring-4 focus:ring-fuchsia-300"
              maxLength={CHAR_LIMIT}
            />
            {error && (
              <p className="mt-2 text-sm text-yellow-200">{error}</p>
            )}
            <div className="mt-3 flex items-center gap-2">
              <button
                onClick={handleTranslate}
                disabled={loading}
                className="px-5 py-2 rounded-2xl bg-black/70 hover:bg-black/80 disabled:opacity-60 shadow-lg"
              >
                {loading ? "Traduzindo..." : "Traduzir para PT-BR"}
              </button>
              <button
                onClick={() => copyToClipboard(input)}
                className="px-4 py-2 rounded-2xl bg-white/10 hover:bg-white/20"
              >
                Copiar original
              </button>
            </div>
          </section>

          {/* Resultado */}
          <section className="bg-white/10 backdrop-blur rounded-2xl p-4 shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-semibold">Tradução em português</h2>
              <button
                onClick={() => copyToClipboard(output)}
                className="text-xs px-3 py-1 rounded-2xl bg-white/10 hover:bg-white/20"
              >
                Copiar tradução
              </button>
            </div>
            <div className="h-52 md:h-64 overflow-auto rounded-xl bg-white p-3 text-black whitespace-pre-wrap">
              {output ? (
                <AnimatePresence mode="wait">
                  <motion.div
                    key={output}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.2 }}
                  >
                    {output}
                  </motion.div>
                </AnimatePresence>
              ) : (
                <p className="text-black/50">A tradução aparecerá aqui.</p>
              )}
            </div>
          </section>
        </main>

        {/* Histórico */}
        <section className="mt-8 bg-white/10 backdrop-blur rounded-2xl p-4 shadow-lg">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-3">
            <h2 className="font-semibold">Histórico de traduções</h2>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar no histórico..."
              className="w-full md:w-80 rounded-2xl px-3 py-2 bg-white text-black placeholder-black/50 focus:outline-none focus:ring-4 focus:ring-fuchsia-300"
            />
          </div>

          {filteredHistory.length === 0 ? (
            <p className="text-white/80">Sem traduções ainda.</p>
          ) : (
            <ul className="space-y-3">
              {filteredHistory.map((item) => (
                <li key={item.id} className="bg-black/30 rounded-xl p-3">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                    <div className="text-xs opacity-80">{formatDate(new Date(item.when))}</div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => loadIntoEditor(item)}
                        className="px-3 py-1 rounded-2xl bg-white/10 hover:bg-white/20 text-xs"
                      >
                        Reabrir
                      </button>
                      <button
                        onClick={() => copyToClipboard(item.dst)}
                        className="px-3 py-1 rounded-2xl bg-white/10 hover:bg-white/20 text-xs"
                      >
                        Copiar tradução
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                    <div className="bg-white rounded-lg p-3 text-black text-sm max-h-40 overflow-auto whitespace-pre-wrap">
                      <div className="font-semibold mb-1">Inglês</div>
                      {item.src}
                    </div>
                    <div className="bg-white rounded-lg p-3 text-black text-sm max-h-40 overflow-auto whitespace-pre-wrap">
                      <div className="font-semibold mb-1">Português</div>
                      {item.dst}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <footer className="mt-8 text-xs text-white/80 text-center">
          <p>
            Dica: sua privacidade importa. O texto pode ser enviado a serviços de tradução
            (LibreTranslate/MyMemory). Para uso offline, substitua por um serviço local.
          </p>
        </footer>
      </div>
    </div>
  );
}

