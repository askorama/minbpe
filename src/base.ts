import fs from 'node:fs'
import unicode from 'npm:unicode-properties'

/**
 * Given a list of integers, return a dictionary of counts of consecutive pairs
 * Example: [1, 2, 3, 1, 2] -> {(1, 2): 2, (2, 3): 1, (3, 1): 1}
 * Optionally allows to update an existing dictionary of counts
 */
export function getStats(
  ids: number[],
  counts: Map<string, number> = new Map(),
): Map<string, number> {
  for (let i = 0; i < ids.length - 1; i++) {
    const pair = `${ids[i]},${ids[i + 1]}`
    const currentCount = counts.get(pair) || 0
    counts.set(pair, currentCount + 1)
  }
  return counts
}

/**
 * In the list of integers (ids), replace all consecutive occurrences
 * of pair with the new integer token idx
 * Example: ids=[1, 2, 3, 1, 2], pair=(1, 2), idx=4 -> [4, 3, 4]
 */
export function merge(ids: number[], pair: [number, number], idx: number): number[] {
  const newIds: number[] = []
  let i = 0
  while (i < ids.length) {
    if (i < ids.length - 1 && ids[i] === pair[0] && ids[i + 1] === pair[1]) {
      newIds.push(idx)
      i += 2
    } else {
      newIds.push(ids[i])
      i++
    }
  }
  return newIds
}

function replaceControlCharacters(s: string): string {
  let chars = ''
  for (const ch of s) {
    if (unicode.getCategory(ch.charCodeAt(0))[0] !== 'C') {
      chars += ch
    } else {
      chars += `\\u${ch.charCodeAt(0).toString(16).padStart(4, '0')}`
    }
  }
  return chars
}

function renderToken(t: Uint8Array): string {
  const decoder = new TextDecoder('utf-8')
  let s = decoder.decode(t)
  s = replaceControlCharacters(s)
  return s
}

export abstract class Tokenizer {
  merges: Map<string, number>
  vocab: Map<number, Uint8Array>
  pattern: string

  constructor() {
    this.merges = new Map()
    this.vocab = this.buildVocab()
    this.pattern = ''
  }

  abstract train(text: string, vocabSize: number, verbose?: boolean): void
  abstract encode(text: string): number[]
  abstract decode(ids: number[]): string

  private buildVocab(): Map<number, Uint8Array> {
    const vocab = new Map<number, Uint8Array>()
    for (let idx = 0; idx < 256; idx++) {
      vocab.set(idx, new Uint8Array([idx]))
    }
    this.merges.forEach((idx, key) => {
      const [p0, p1] = key.split(',').map(Number)
      const combined = new Uint8Array([...vocab.get(p0)!, ...vocab.get(p1)!])
      vocab.set(idx, combined)
    })
    return vocab
  }

  save(filePrefix: string): void {
    const modelFile = `${filePrefix}.model`
    fs.writeFileSync(modelFile, `minbpe v1\n${this.pattern}\n`)
    this.merges.forEach((_value, key) => {
      fs.appendFileSync(modelFile, `${key.replace(',', ' ')}\n`)
    })

    const vocabFile = `${filePrefix}.vocab`
    const invertedMerges = new Map<number, string>()
    this.merges.forEach((value, key) => invertedMerges.set(value, key))
    const vocabFileStream = fs.createWriteStream(vocabFile, { encoding: 'utf-8' })
    this.vocab.forEach((token, idx) => {
      const s = renderToken(token)
      if (invertedMerges.has(idx)) {
        const [idx0, idx1] = invertedMerges.get(idx)!.split(',').map(Number)
        const s0 = renderToken(this.vocab.get(idx0)!)
        const s1 = renderToken(this.vocab.get(idx1)!)
        vocabFileStream.write(`[${s0}][${s1}] -> [${s}] ${idx}\n`)
      } else {
        vocabFileStream.write(`[${s}] ${idx}\n`)
      }
    })
    vocabFileStream.close()
  }

  load(modelFile: string): void {
    const data = fs.readFileSync(modelFile, { encoding: 'utf-8' }).split('\n')
    const version = data.shift()
    if (version !== 'minbpe v1') throw new Error('Unsupported model version')
    this.pattern = data.shift()!
    this.merges.clear()
    let idx = 256
    data.forEach((line) => {
      if (line.trim().length === 0) return
      const [idx1, idx2] = line.split(' ').map(Number)
      this.merges.set(`${idx1},${idx2}`, idx++)
    })
    this.vocab = this.buildVocab()
  }
}
