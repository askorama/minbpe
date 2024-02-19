import { getStats, merge, Tokenizer } from './base.ts'

export class BasicTokenizer extends Tokenizer {
  constructor() {
    super()
  }

  train(text: string, vocabSize: number, verbose = false): void {
    if (vocabSize < 256) {
      throw new Error('Vocab size must be at least 256')
    }
    const numMerges = vocabSize - 256
    const textBytes = new TextEncoder().encode(text)
    let ids = Array.from(textBytes)

    const merges: { [key: string]: number } = {}
    const vocab: { [key: number]: Uint8Array } = {}

    for (let idx = 0; idx < 256; idx++) {
      vocab[idx] = new Uint8Array([idx])
    }
    for (let i = 0; i < numMerges; i++) {
      const stats = getStats(ids)
      // @todo: avoid conversion to object
      const statsObj = Object.fromEntries(stats.entries())
      const pair =
        Object.entries(statsObj).reduce((a, b) => (statsObj[a[0]] > statsObj[b[0]] ? a : b))[0]
      const newIdx = 256 + i
      ids = merge(ids, pair.split(',').map(Number) as [number, number], newIdx)
      merges[pair] = newIdx
      const [p0, p1] = pair.split(',').map(Number)
      vocab[newIdx] = new Uint8Array([...vocab[p0], ...vocab[p1]])
      if (verbose) {
        console.log(
          `merge ${i + 1}/${numMerges}: ${pair} -> ${newIdx} (${
            new TextDecoder().decode(vocab[newIdx])
          }) had ${statsObj[pair]} occurrences`,
        )
      }
    }

    this.merges = new Map(Object.entries(merges))
    this.vocab = new Map(Object.entries(vocab).map(([k, v]) => [Number(k), v]))
  }

  decode(ids: number[]): string {
    const textBytes = ids.reduce((acc, id) => {
      const token = this.vocab.get(id)
      if (token) {
        return new Uint8Array([...acc, ...token])
      } else {
        return acc
      }
    }, new Uint8Array())
    return new TextDecoder().decode(textBytes)
  }

  encode(text: string): number[] {
    const textBytes = new TextEncoder().encode(text)
    // @todo: avoid conversion to object
    const mergesObj = Object.fromEntries(this.merges.entries())
    let ids = Array.from(textBytes)
    while (ids.length >= 2) {
      const stats = getStats(ids)
      const pair =
        Object.entries(stats).reduce((a, b) => (mergesObj[a[0]] < mergesObj[b[0]] ? a : b))[0]
      if (!(pair in this.merges)) {
        break
      }

      const idx = mergesObj[pair]
      ids = merge(ids, pair.split(',').map(Number) as [number, number], idx)
    }
    return ids
  }
}
