import type { DefaultCategoryKey } from '../schemas'

// Automatic category for a new expense, from its description (pure; the procedure is
// `categories.suggest`). First what the group already decided (its history), then keywords of
// common Argentine stores and words, mapped to the built-in categories. No match → no suggestion.

/** Lowercase, without accents, punctuation or extra spaces: "Súper  Día!" → "super dia". */
export function normalizeDescription(text: string) {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9ñ]+/g, ' ')
    .trim()
}

// Words that say nothing about what the expense was ("cena con Tuke" ~ "cena con Manu").
const STOPWORDS = new Set(['a', 'al', 'con', 'de', 'del', 'el', 'en', 'la', 'las', 'lo', 'los', 'para', 'por', 'un', 'una', 'y'])

function significantWords(normalized: string) {
  return new Set(normalized.split(' ').filter((w) => w.length > 1 && !STOPWORDS.has(w) && !/^\d+$/.test(w)))
}

export type PastExpense = { description: string; categoryId: string }

/**
 * Category of the most similar past expense of the group (`history` newest first). Same
 * description (ignoring case, accents and punctuation) wins; otherwise the one sharing the most
 * words, if they share at least half of them ("cena con Tuke" ~ "cena con Manu"). Ties → newest.
 */
export function suggestFromHistory(description: string, history: PastExpense[]): string | null {
  const target = normalizeDescription(description)
  const words = significantWords(target)
  if (!target) return null
  let best: { categoryId: string; score: number } | null = null
  for (const past of history) {
    const normalized = normalizeDescription(past.description)
    if (normalized === target) return past.categoryId
    const pastWords = significantWords(normalized)
    const shared = [...words].filter((w) => pastWords.has(w)).length
    const score = shared / Math.max(words.size, pastWords.size, 1)
    if (shared > 0 && score >= 0.5 && (!best || score > best.score)) best = { categoryId: past.categoryId, score }
  }
  return best?.categoryId ?? null
}

// Keywords (already normalized) per built-in category. A keyword matches whole words; one that
// starts with "^" only at the start of the description ("Día" the supermarket, not "medio día").
const KEYWORDS: Record<Exclude<DefaultCategoryKey, 'OTHER'>, string[]> = {
  GROCERIES: [
    'coto',
    '^dia',
    'super dia',
    'supermercado dia',
    'carrefour',
    'jumbo',
    'disco',
    'vea',
    'changomas',
    'la anonima',
    'walmart',
    'easy',
    'makro',
    'vital',
    'diarco',
    'super',
    'supermercado',
    'super chino',
    'chino',
    'almacen',
    'verduleria',
    'verdura',
    'verduras',
    'fruta',
    'frutas',
    'carniceria',
    'carne',
    'fiambreria',
    'dietetica',
    'mercado',
    'compras del super',
    'autoservicio',
    'kiosco',
    'kiosko',
  ],
  TRANSPORT: [
    'uber',
    'cabify',
    'didi',
    'taxi',
    'remis',
    'colectivo',
    'bondi',
    'subte',
    'sube',
    'tren',
    'micro',
    'peaje',
    'peajes',
    'nafta',
    'combustible',
    'gasoil',
    'ypf',
    'shell',
    'axion',
    'puma',
    'estacionamiento',
    'cochera',
    'parking',
    'vuelo',
    'vuelos',
    'pasaje',
    'pasajes',
    'aerolineas',
    'aerolineas argentinas',
    'flybondi',
    'jetsmart',
    'buquebus',
    'ferry',
    'alquiler de auto',
    'lavadero',
    'gomeria',
    'mecanico',
    'vtv',
  ],
  FOOD: [
    'cena',
    'almuerzo',
    'desayuno',
    'merienda',
    'comida',
    'resto',
    'restaurant',
    'restaurante',
    'parrilla',
    'asado',
    'pizza',
    'pizzeria',
    'empanadas',
    'sushi',
    'hamburguesa',
    'hamburguesas',
    'burger',
    'burger king',
    'mcdonald',
    'mcdonalds',
    'mc donalds',
    'mostaza',
    'helado',
    'heladeria',
    'cafe',
    'cafeteria',
    'starbucks',
    'havanna',
    'medialunas',
    'facturas',
    'panaderia',
    'rappi',
    'pedidosya',
    'pedidos ya',
    'delivery',
    'milanesas',
    'pastas',
  ],
  LODGING: [
    'airbnb',
    'booking',
    'hotel',
    'hostel',
    'hostal',
    'cabana',
    'cabanas',
    'alojamiento',
    'hospedaje',
    'posada',
    'apart',
    'camping',
    'despegar',
    'estadia',
  ],
  ENTERTAINMENT: [
    'cine',
    'teatro',
    'boliche',
    'bar',
    'birra',
    'birras',
    'cerveza',
    'cervezas',
    'cerveceria',
    'tragos',
    'vino',
    'fernet',
    'recital',
    'show',
    'entradas',
    'entrada',
    'museo',
    'bowling',
    'karaoke',
    'escape room',
    'cumple',
    'futbol',
    'cancha',
    'paddle',
    'padel',
    'excursion',
    'tour',
  ],
  SHOPPING: [
    'mercadolibre',
    'mercado libre',
    'amazon',
    'shein',
    'temu',
    'aliexpress',
    'zara',
    'falabella',
    'fravega',
    'garbarino',
    'musimundo',
    'ropa',
    'zapatillas',
    'regalo',
    'regalos',
    'farmacia',
    'farmacity',
    'libreria',
    'libro',
    'libros',
    'ferreteria',
    'electrodomestico',
    'decoracion',
  ],
  SERVICES: [
    'netflix',
    'spotify',
    'disney',
    'hbo',
    'hbo max',
    'youtube premium',
    'amazon prime',
    'prime video',
    'paramount',
    'star plus',
    'apple music',
    'icloud',
    'google one',
    'chatgpt',
    'edenor',
    'edesur',
    'metrogas',
    'naturgy',
    'camuzzi',
    'aysa',
    'personal',
    'movistar',
    'claro',
    'telecentro',
    'fibertel',
    'flow',
    'directv',
    'internet',
    'wifi',
    'luz',
    'gas',
    'agua',
    'expensas',
    'abl',
    'seguro',
    'telefono',
    'celular',
    'abono',
    'gimnasio',
    'gym',
  ],
}

const KEYWORD_LIST = Object.entries(KEYWORDS).flatMap(([key, words]) =>
  words.map((word) => ({ key: key as DefaultCategoryKey, phrase: word.replace(/^\^/, ''), atStart: word.startsWith('^') })),
)

/**
 * Built-in category (`defaultKey`) the description's keywords point to, or null. With several
 * matches, the one that appears first wins ("Uber al súper" → transport); at the same place, the
 * longest ("Amazon Prime" → services, not shopping).
 */
export function suggestDefaultKey(description: string): DefaultCategoryKey | null {
  const padded = ` ${normalizeDescription(description)} `
  let best: { key: DefaultCategoryKey; at: number; length: number } | null = null
  for (const { key, phrase, atStart } of KEYWORD_LIST) {
    const at = padded.indexOf(` ${phrase} `)
    if (at === -1 || (atStart && at !== 0)) continue
    if (!best || at < best.at || (at === best.at && phrase.length > best.length)) best = { key, at, length: phrase.length }
  }
  return best?.key ?? null
}
