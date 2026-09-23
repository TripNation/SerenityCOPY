/**
 * Serenity Hub - Multi-Language Automatic Translation Engine
 * Translates global chat messages between:
 * - en: English (General)
 * - id: Indonesian
 * - tl: Tagalog / Filipino (Philippines)
 * - vi: Vietnamese (Vietnam)
 * - pt: Portuguese (Brazilian)
 */

const translationCache = new Map();
const CACHE_MAX = 500;

const SUPPORTED_LANGS = [
  { code: 'en', name: 'English', room: 'general' },
  { code: 'id', name: 'Indonesian', room: 'indonesian' },
  { code: 'tl', name: 'Tagalog', room: 'philippines' },
  { code: 'vi', name: 'Vietnamese', room: 'vietnam' },
  { code: 'pt', name: 'Portuguese', room: 'brazilian' },
  { code: 'es', name: 'Spanish', room: 'spanish' }
];

/**
 * Translates text into target language code
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

  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(clean)}&langpair=autodetect|${targetLang}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'SerenityHub-Translator/1.0'
      }
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      return clean;
    }

    const data = await res.json();
    let translated = '';

    if (data.matches && data.matches.length > 0) {
      for (const m of data.matches) {
        if (m.translation && m.translation.trim().length > 0 && m.translation !== clean) {
          const t = m.translation.trim();
          if (!t.toUpperCase().includes('PLEASE SELECT') && !t.toUpperCase().includes('MYMEMORY WARNING')) {
            translated = t;
            break;
          }
        }
      }
    }

    if (!translated && data.responseData && data.responseData.translatedText) {
      const respT = data.responseData.translatedText.trim();
      if (!respT.toUpperCase().includes('PLEASE SELECT') && !respT.toUpperCase().includes('MYMEMORY WARNING')) {
        translated = respT;
      }
    }

    const result = (translated && translated.length > 0) ? translated : clean;

    if (translationCache.size >= CACHE_MAX) {
      const firstKey = translationCache.keys().next().value;
      translationCache.delete(firstKey);
    }
    translationCache.set(cacheKey, result);

    return result;
  } catch (err) {
    // If translation service is slow or times out, return original text safely
    return clean;
  }
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
    id: clean,
    tl: clean,
    vi: clean,
    pt: clean,
    es: clean
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
