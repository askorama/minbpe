import { getStats, merge, Tokenizer } from './base.ts'

// deno-lint-ignore no-unused-vars
const GPT2_SPLIT_PATTERN =
  `'(?:[sdmt]|ll|ve|re)| ?\\p{L}+| ?\\p{N}+| ?[^\\s\\p{L}\\p{N}]+|\\s+(?!\\S)|\\s+`
const GPT4_SPLIT_PATTERN =
  `'(?:[sdmt]|ll|ve|re)|[^\\r\\n\\p{L}\\p{N}]?+\\p{L}+|\\p{N}{1,3}| ?[^\\s\\p{L}\\p{N}]++[\\r\\n]*|\\s*[\\r\\n]|\\s+(?!\\S)|\\s+`

export class RegexTokenizer extends Tokenizer {
  pattern: string
  private compiledPattern: RegExp

  constructor() {
    super()
    this.pattern = GPT4_SPLIT_PATTERN
    this.compiledPattern = new RegExp(this.pattern, 'gu')
  }

  train(text: string, vocabSize: number, verbose = false): void {
    if (vocabSize < 256) {
      throw new Error('Vocab size must be at least 256')
    }
    const numMerges = vocabSize - 256
    const textChunks = text.match(this.compiledPattern) || []
    let ids = textChunks.map((chunk) => Array.from(new TextEncoder().encode(chunk)))

    const merges: { [key: string]: number } = {}
    const vocab: { [key: number]: Uint8Array } = {}
    for (let idx = 0; idx < 256; idx++) {
      vocab[idx] = new Uint8Array([idx])
    }
    for (let i = 0; i < numMerges; i++) {
      const stats: { [key: string]: number } = {}
      ids.forEach((chunkIds) => {
        // @todo: avoid conversion to map
        const mapStat = new Map(Object.entries(chunkIds))
        getStats(chunkIds, mapStat)
      })

      const pair = Object.entries(stats).reduce((a, b) => (stats[a[0]] > stats[b[0]] ? a : b))[0]
      const idx = 256 + i

      ids = ids.map((chunkIds) =>
        merge(chunkIds, pair.split(',').map(Number) as [number, number], idx)
      )

      merges[pair] = idx
      const [p0, p1] = pair.split(',').map(Number)
      vocab[idx] = new Uint8Array([...vocab[p0], ...vocab[p1]])

      if (verbose) {
        console.log(`merge ${i + 1}/${numMerges}: ${pair} -> ${idx} had ${stats[pair]} occurrences`)
      }
    }

    this.merges = new Map(Object.entries(merges))
    this.vocab = new Map(Object.entries(vocab))
  }

  decode(ids: number[]): string {
    const textBytes = ids.reduce((acc, id) => {
      const token = this.vocab.get(id)
      return token ? new Uint8Array([...acc, ...token]) : acc
    }, new Uint8Array())
    return new TextDecoder().decode(textBytes)
  }

  private _encodeChunk(textBytes: Uint8Array): number[] {
    let ids = Array.from(textBytes)
    while (ids.length >= 2) {
      const stats = getStats(ids)
      // @todo: avoid conversion to object
      const mergesObj = Object.fromEntries(this.merges.entries())
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

  encode(text: string): number[] {
    const textChunks = text.match(this.compiledPattern) || []
    let ids: number[] = []
    textChunks.forEach((chunk) => {
      const chunkBytes = new TextEncoder().encode(chunk)
      const chunkIds = this._encodeChunk(chunkBytes)
      ids = ids.concat(chunkIds)
    })
    return ids
  }
}
