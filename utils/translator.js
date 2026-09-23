/**
 * Serenity Hub - High Performance Multi-Language Automatic Translation Engine
 * Translates global chat messages seamlessly between:
 * - en: English (General)
 * - es: Spanish (Spanish)
 * - id: Indonesian (Indonesian)
 * - tl: Tagalog / Filipino (Philippines)
 * - vi: Vietnamese (Vietnam)
 * - pt: Portuguese (Brazilian)
 */

const translationCache = new Map();
const CACHE_MAX = 1000;

const SUPPORTED_LANGS = [
  { code: 'en', name: 'English', room: 'general' },
  { code: 'es', name: 'Spanish', room: 'spanish' },
  { code: 'id', name: 'Indonesian', room: 'indonesian' },
  { code: 'tl', name: 'Tagalog', room: 'philippines' },
  { code: 'vi', name: 'Vietnamese', room: 'vietnam' },
  { code: 'pt', name: 'Portuguese', room: 'brazilian' }
];

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
];

function getRandomUserAgent() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

/**
 * Primary Engine: Google Translate (Instant, Free, Auto-Detect)
 */
async function translateWithGoogle(text, targetLang) {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3500);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': getRandomUserAgent(),
        'Accept': '*/*'
      }
    });
    clearTimeout(timeoutId);

    if (!res.ok) return null;
    const data = await res.json();
    if (Array.isArray(data) && Array.isArray(data[0])) {
      const translated = data[0].map(item => item[0]).filter(Boolean).join('').trim();
      return translated || null;
    }
  } catch (err) {
    clearTimeout(timeoutId);
  }
  return null;
}

/**
 * Secondary Engine: MyMemory API with Registered Email Quota
 */
async function translateWithMyMemory(text, targetLang) {
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=autodetect|${targetLang}&de=serenityhub2026@gmail.com`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3500);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'SerenityHub-Translator/2.0'
      }
    });
    clearTimeout(timeoutId);

    if (!res.ok) return null;
    const data = await res.json();

    if (data.matches && data.matches.length > 0) {
      for (const m of data.matches) {
        if (m.translation && m.translation.trim().length > 0 && m.translation.trim() !== text) {
          const t = m.translation.trim();
          if (!t.toUpperCase().includes('PLEASE SELECT') && !t.toUpperCase().includes('MYMEMORY WARNING')) {
            return t;
          }
        }
      }
    }

    if (data.responseData && data.responseData.translatedText) {
      const respT = data.responseData.translatedText.trim();
      if (!respT.toUpperCase().includes('PLEASE SELECT') && !respT.toUpperCase().includes('MYMEMORY WARNING')) {
        return respT;
      }
    }
  } catch (err) {
    clearTimeout(timeoutId);
  }
  return null;
}

/**
 * Translates text into target language code with multi-engine failover
 * @param {string} text 
 * @param {string} targetLang 
 * @returns {Promise<string>}
 */
async function translateText(text, targetLang) {
  if (!text || typeof text !== 'string') return '';
  const clean = text.trim();
  if (clean.length === 0) return '';

  const cacheKey = `${targetLang}:${clean.toLowerCase()}`;
  if (translationCache.has(cacheKey)) {
    return translationCache.get(cacheKey);
  }

  // 1. Try Primary Engine (Google Translate)
  let result = await translateWithGoogle(clean, targetLang);

  // 2. Try Secondary Engine (MyMemory) if primary failed
  if (!result || result === clean) {
    const fallback = await translateWithMyMemory(clean, targetLang);
    if (fallback && fallback.length > 0) {
      result = fallback;
    }
  }

  // Final fallback to clean input if all services unavailable
  const finalResult = (result && result.length > 0) ? result : clean;

  if (translationCache.size >= CACHE_MAX) {
    const firstKey = translationCache.keys().next().value;
    translationCache.delete(firstKey);
  }
  translationCache.set(cacheKey, finalResult);

  return finalResult;
}

/**
 * Translates message into all supported room languages simultaneously
 * @param {string} text 
 * @returns {Promise<Object>}
 */
async function translateMessageToAll(text) {
  const clean = String(text || '').trim();
  const translations = {
    original: clean,
    en: clean,
    es: clean,
    id: clean,
    tl: clean,
    vi: clean,
    pt: clean
  };

  if (!clean) return translations;

  try {
    const promises = SUPPORTED_LANGS.map(async (l) => {
      const trans = await translateText(clean, l.code);
      translations[l.code] = trans || clean;
    });

    await Promise.allSettled(promises);
  } catch (err) {
    console.error('[Translator] Error running multi-translation:', err.message);
  }

  return translations;
}

module.exports = {
  translateText,
  translateMessageToAll,
  SUPPORTED_LANGS
};
