import { get_encoding } from 'npm:tiktoken'
import { RegexTokenizer } from './regex.ts'

// Helper function to reconstruct the merge forest
function bpe(
  mergeableRanks: Map<string, number>,
  token: Uint8Array,
  maxRank?: number,
): Uint8Array[] {
  let parts = Array.from(token, (b) => new Uint8Array([b]))
  while (true) {
    let minIdx: number | null = null
    let minRank: number | null = null
    for (let i = 0; i < parts.length - 1; i++) {
      const pairKey = parts[i].join(',') + ',' + parts[i + 1].join(',')
      const rank = mergeableRanks.get(pairKey)
      if (rank !== undefined && (minRank === null || rank < minRank)) {
        minIdx = i
        minRank = rank
      }
    }
    if (minRank === null || (maxRank !== undefined && minRank >= maxRank)) {
      break
    }
    if (minIdx === null) throw new Error('Min index should not be null')
    parts = [
      ...parts.slice(0, minIdx),
      new Uint8Array([...parts[minIdx], ...parts[minIdx + 1]]),
      ...parts.slice(minIdx + 2),
    ]
  }
  return parts
}

// Function to recover merges
function recoverMerges(mergeableRanks: Map<string, number>): Map<string, number> {
  const merges = new Map<string, number>()
  mergeableRanks.forEach((rank, tokenKey) => {
    const token = new Uint8Array(tokenKey.split(',').map((b) => parseInt(b)))
    if (token.length === 1) return // skip raw bytes
    const pair = bpe(mergeableRanks, token, rank)
    if (pair.length !== 2) throw new Error('Pair length should be 2')
    const ix0 = mergeableRanks.get(pair[0].join(','))
    const ix1 = mergeableRanks.get(pair[1].join(','))
    if (ix0 === undefined || ix1 === undefined) throw new Error('Indexes should be defined')
    merges.set(`${ix0},${ix1}`, rank)
  })
  return merges
}

export class GPT4Tokenizer extends RegexTokenizer {
  private byteShuffle: Map<number, number>
  private inverseByteShuffle: Map<number, number>

  constructor() {
    super()
    const enc = get_encoding('cl100k_base')
    const mergeableRanks = enc.mergeableRanks
    this.merges = recoverMerges(mergeableRanks)
    // Reconstruct the vocab from the merges
    this.vocab = new Map<number, Uint8Array>()
    for (let idx = 0; idx < 256; idx++) {
      this.vocab.set(idx, new Uint8Array([idx]))
    }
    this.merges.forEach((idx, key) => {
      const [p0, p1] = key.split(',').map((k) => parseInt(k))
      if (!this.vocab.has(p0) || !this.vocab.has(p1)) {
        throw new Error('Vocab indexes should be defined')
      }
      this.vocab.set(idx, new Uint8Array([...this.vocab.get(p0)!, ...this.vocab.get(p1)!]))
    })
    // Byte shuffle handling
    this.byteShuffle = new Map<number, number>()
    this.inverseByteShuffle = new Map<number, number>()
    for (let i = 0; i < 256; i++) {
      this.byteShuffle.set(i, mergeableRanks.get(i.toString())!) // Assuming mergeableRanks has byte shuffles
      this.inverseByteShuffle.set(mergeableRanks.get(i.toString())!, i)
    }
  }

  _encodeChunk(textBytes: Uint8Array): number[] {
    // Before processing bytes, permute them
    const shuffledBytes = new Uint8Array(textBytes.map((b) => this.byteShuffle.get(b)!))
    const ids = super._encodeChunk(shuffledBytes)
    return ids
  }

  decode(ids: number[]): string {
    // Un-permute the bytes before decoding
    const textBytes = ids.reduce((acc, id) => {
      const token = this.vocab.get(id)
      if (token) {
        return new Uint8Array([
          ...acc,
          ...token.map((b) => this.inverseByteShuffle.get(b)!),
        ])
      }
      return acc
    }, new Uint8Array())
    return new TextDecoder().decode(textBytes)
  }

  // This is a pretrained tokenizer; it is not intended to be trained
  train(text: string, vocabSize: number, verbose: boolean = false): void {
    throw new Error('GPT4Tokenizer cannot be trained.')
  }

  // Save/load would require some thought
  save(filePrefix: string): void {
    throw new Error('GPT4Tokenizer cannot be saved.')
  }

  load(modelFile: string): void {
    throw new Error('GPT4Tokenizer cannot be loaded.')
  }
}
