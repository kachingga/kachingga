import { describe, expect, test } from 'bun:test'
import { normalizeDescription, suggestDefaultKey, suggestFromHistory } from '../lib/categorySuggestion'

describe('normalizeDescription', () => {
  test('lowercase, without accents, punctuation or extra spaces', () => {
    expect(normalizeDescription('  Súper  Día!! ')).toBe('super dia')
    expect(normalizeDescription("McDonald's")).toBe('mcdonald s')
    expect(normalizeDescription('Cabaña')).toBe('cabana')
  })
})

describe('suggestFromHistory', () => {
  const history = [
    { description: 'Cena con Manu', categoryId: 'salidas' },
    { description: 'Coto', categoryId: 'super' },
    { description: 'Cena con Tuke', categoryId: 'comida' },
  ]

  test('same description (ignoring case, accents and punctuation) wins', () => {
    expect(suggestFromHistory('COTO.', history)).toBe('super')
    expect(suggestFromHistory('cena con tuke', history)).toBe('comida')
  })

  test('otherwise the most similar one; ties → the newest', () => {
    expect(suggestFromHistory('Coto Palermo', history)).toBe('super')
    expect(suggestFromHistory('Cena con Román', history)).toBe('salidas')
  })

  test('not similar enough → null', () => {
    expect(suggestFromHistory('Nafta', history)).toBeNull()
    expect(suggestFromHistory('Cena de fin de año en lo de la abuela', history)).toBeNull()
    expect(suggestFromHistory('con', history)).toBeNull()
    expect(suggestFromHistory('Coto', [])).toBeNull()
  })
})

describe('suggestDefaultKey', () => {
  test.each([
    ['Coto', 'GROCERIES'],
    ['Día', 'GROCERIES'],
    ['Carrefour Express', 'GROCERIES'],
    ['Uber al aeropuerto', 'TRANSPORT'],
    ['Cabify', 'TRANSPORT'],
    ['DiDi', 'TRANSPORT'],
    ['YPF', 'TRANSPORT'],
    ['Nafta Shell', 'TRANSPORT'],
    ['Axion', 'TRANSPORT'],
    ['cena con Tuke', 'FOOD'],
    ['Rappi', 'FOOD'],
    ['PedidosYa', 'FOOD'],
    ['Pedidos Ya', 'FOOD'],
    ["McDonald's", 'FOOD'],
    ['Netflix', 'SERVICES'],
    ['Spotify', 'SERVICES'],
    ['Edenor', 'SERVICES'],
    ['Metrogas', 'SERVICES'],
    ['Personal', 'SERVICES'],
    ['Movistar', 'SERVICES'],
    ['Airbnb Bariloche', 'LODGING'],
    ['Booking', 'LODGING'],
    ['Cabaña', 'LODGING'],
    ['Cine', 'ENTERTAINMENT'],
    ['Mercado Libre', 'SHOPPING'],
  ])('%s → %s', (description, key) => {
    expect(suggestDefaultKey(description)).toBe(key as ReturnType<typeof suggestDefaultKey>)
  })

  test('the first keyword wins; at the same place, the longest', () => {
    expect(suggestDefaultKey('Uber al súper')).toBe('TRANSPORT')
    expect(suggestDefaultKey('Súper y después Uber')).toBe('GROCERIES')
    expect(suggestDefaultKey('Amazon Prime')).toBe('SERVICES')
    expect(suggestDefaultKey('Amazon')).toBe('SHOPPING')
  })

  test('whole words only; "Día" only at the start', () => {
    expect(suggestDefaultKey('Gastos varios')).toBeNull() // "gas" inside "gastos" doesn't count
    expect(suggestDefaultKey('Regalo día de la madre')).toBe('SHOPPING')
    expect(suggestDefaultKey('Medio día de pileta')).toBeNull()
  })

  test('nothing matches → null', () => {
    expect(suggestDefaultKey('Varios')).toBeNull()
    expect(suggestDefaultKey('')).toBeNull()
  })
})
