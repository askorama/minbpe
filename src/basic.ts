import { getStats, merge, Tokenizer } from './base.ts'

export class BasicTokenizer extends Tokenizer {
  constructor() {
    super()
  }

  train(text: string, vocabSize: number, verbose = true): void {
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
      if (stats.size === 0) {
        console.log('No more pairs to merge.')
        break
      }
      const statsObj = Object.fromEntries(stats.entries())
      const pair = Object.entries(statsObj).reduce((a, b) => (statsObj[a[0]] > statsObj[b[0]] ? a : b))[0]
      const newIdx = 256 + i
      ids = merge(ids, pair.split(',').map(Number) as [number, number], newIdx)
      merges[pair] = newIdx
      const [p0, p1] = pair.split(',').map(Number)
      vocab[newIdx] = new Uint8Array([...vocab[p0], ...vocab[p1]])
      if (verbose) {
        console.log(`Merge #${i + 1}: Pair [${pair}] -> New ID ${newIdx}`)
        console.log(`Updated ids: ${ids}`)
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
    let ids = Array.from(textBytes)

    let canMerge = true
    while (canMerge) {
      canMerge = false
      const newIds: number[] = []
      let i = 0

      while (i < ids.length) {
        let merged = false
        for (const [pairStr, newId] of this.merges) {
          const pair = pairStr.split(',').map(Number)
          if (i < ids.length - 1 && ids[i] === pair[0] && ids[i + 1] === pair[1]) {
            newIds.push(newId)
            i += 2
            merged = true
            canMerge = true
            break
          }
        }
        if (!merged) {
          newIds.push(ids[i])
          i++
        }
      }

      ids = newIds
    }

    return ids
  }
}
