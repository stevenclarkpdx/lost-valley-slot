export interface Rng {
  next(): number
  int(min: number, max: number): number
}

export function createSeededRng(seed: number): Rng {
  let state = seed >>> 0

  const next = (): number => {
    state += 0x6d2b79f5
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }

  return {
    next,
    int(min, max) {
      return Math.floor(next() * (max - min + 1)) + min
    },
  }
}
