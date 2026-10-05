// Traducción ES -> EN en el cliente (MyMemory). Funciona en todas las páginas:
// traduce los nodos de texto de <main> sin tocar el DOM, así que revertir es
// restaurar el texto original y no rompe botones, anclas ni el iframe de comentarios.

const API = 'https://api.mymemory.translated.net/get';
const CONTACT = 'juanenlopez1459@gmail.com';
const SEP = '\n||||\n';
const MAX_CHUNK = 450; // MyMemory admite ~500 caracteres por petición
const SKIP_TAGS = new Set(['CODE', 'PRE', 'SCRIPT', 'STYLE', 'SVG', 'BUTTON', 'TIME', 'IFRAME', 'TEXTAREA']);

const btn = document.getElementById('translate-btn') as HTMLButtonElement | null;
const originals = new Map<Text, string>();
let translated = false;
let busy = false;

function collectNodes(root: Node): Text[] {
  const out: Text[] = [];
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const t = node.textContent ?? '';
      if (/\p{L}{2,}/u.test(t)) out.push(node as Text);
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as Element;
      if (SKIP_TAGS.has(el.tagName.toUpperCase()) || el.classList.contains('tag') || el.classList.contains('comments')) return;
      el.childNodes.forEach(walk);
    }
  };
  walk(root);
  return out;
}

async function request(q: string): Promise<string> {
  const res = await fetch(`${API}?q=${encodeURIComponent(q)}&langpair=es|en&de=${CONTACT}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  const text = data?.responseData?.translatedText as string | undefined;
  if (data?.responseStatus !== 200 || !text || /MYMEMORY WARNING/i.test(text)) {
    throw new Error('Cuota agotada o respuesta inválida');
  }
  return text;
}

async function translateBatch(texts: string[]): Promise<string[]> {
  if (texts.length === 1) return [await request(texts[0])];
  const parts = (await request(texts.join(SEP))).split(/\s*\|\|\|\|\s*/);
  if (parts.length === texts.length) return parts.map((p) => p.trim());
  // El traductor alteró el separador: traducir uno a uno para no desalinear
  return Promise.all(texts.map((t) => request(t)));
}

function makeBatches(texts: string[]): number[][] {
  const batches: number[][] = [];
  let cur: number[] = [];
  let len = 0;
  texts.forEach((t, i) => {
    if (cur.length && len + t.length + SEP.length > MAX_CHUNK) {
      batches.push(cur);
      cur = [];
      len = 0;
    }
    cur.push(i);
    len += t.length + SEP.length;
  });
  if (cur.length) batches.push(cur);
  return batches;
}

const dateOriginals = new Map<Element, string>();

function localizeDates(lang: 'en-GB') {
  document.querySelectorAll('main time[datetime]').forEach((el) => {
    const d = new Date(el.getAttribute('datetime') ?? '');
    if (isNaN(d.getTime())) return;
    dateOriginals.set(el, el.textContent ?? '');
    el.textContent = d.toLocaleDateString(lang, { year: 'numeric', month: 'long', day: 'numeric' });
  });
}

function revert() {
  originals.forEach((text, node) => { node.textContent = text; });
  originals.clear();
  dateOriginals.forEach((text, el) => { el.textContent = text; });
  dateOriginals.clear();
  document.documentElement.lang = 'es';
}

async function run<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        results[i] = await fn(items[i]);
      }
    }),
  );
  return results;
}

async function translatePage() {
  const main = document.querySelector('main');
  if (!main) return;

  const nodes = collectNodes(main);
  const raw = nodes.map((n) => n.textContent ?? '');
  const trimmed = raw.map((t) => t.trim());
  const batches = makeBatches(trimmed);

  const out = await run(batches, 3, (idxs) => translateBatch(idxs.map((i) => trimmed[i])));

  nodes.forEach((n) => originals.set(n, n.textContent ?? ''));
  batches.forEach((idxs, b) => {
    idxs.forEach((nodeIdx, k) => {
      const lead = raw[nodeIdx].match(/^\s*/)?.[0] ?? '';
      const trail = raw[nodeIdx].match(/\s*$/)?.[0] ?? '';
      nodes[nodeIdx].textContent = lead + out[b][k] + trail;
    });
  });
  localizeDates('en-GB');
  document.documentElement.lang = 'en';
}

function setBtn(label: string, disabled = false, title?: string) {
  if (!btn) return;
  btn.textContent = label;
  btn.disabled = disabled;
  if (title) btn.title = title;
}

btn?.addEventListener('click', async () => {
  if (busy) return;
  if (translated) {
    revert();
    translated = false;
    setBtn('EN', false, 'Translate to English');
    return;
  }

  busy = true;
  setBtn('...', true);
  try {
    await translatePage();
    translated = true;
    setBtn('ES', false, 'Volver al español');
  } catch {
    revert();
    setBtn('ERR', false, 'No se pudo traducir ahora mismo. Inténtalo más tarde.');
    setTimeout(() => setBtn('EN', false, 'Translate to English'), 3000);
  } finally {
    busy = false;
  }
});
