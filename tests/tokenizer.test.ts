import { assertEquals } from 'https://deno.land/std@0.216.0/assert/assert_equals.ts'
// import { get_encoding } from 'npm:tiktoken'
import {
  BasicTokenizer,
  //GPT4Tokenizer,
  RegexTokenizer,
} from '../src/index.ts'

// const taylorswiftFile = new URL('./taylorswift.txt', import.meta.url).pathname
const testStrings = [
  '',
  '?',
  'hello world!!!? (안녕하세요!) lol123 😉',
  // await Deno.readTextFile(taylorswiftFile),
]

// @todo: enable other tokenizers
// const tokenizerFactories = [BasicTokenizer, RegexTokenizer, GPT4Tokenizer]
const tokenizerFactories = [BasicTokenizer]

for (const tokenizerFactory of tokenizerFactories) {
  for (const text of testStrings) {
    Deno.test(`Encode/decode identity with ${tokenizerFactory.name}`, () => {
      const tokenizer = new tokenizerFactory()
      const ids = tokenizer.encode(text)
      const decoded = tokenizer.decode(ids)
      assertEquals(text, decoded)
    })
  }
}

// for (const text of testStrings) {
//   Deno.test('GPT-4 TikToken equality', () => {
//     const tokenizer = new GPT4Tokenizer()
//     const enc = get_encoding('cl100k_base')
//     const tiktokenIds = enc.encode(text)
//     const gpt4TokenizerIds = tokenizer.encode(text)
//     assertEquals(gpt4TokenizerIds, tiktokenIds as unknown as number[])
//   })
// }

tokenizerFactories.slice(0, 2).forEach((tokenizerFactory) => {
  Deno.test(`Wikipedia example with ${tokenizerFactory.name}`, () => {
    const tokenizer = new tokenizerFactory()
    const text = 'aaabdaaabac'
    tokenizer.train(text, 256 + 3)
    const ids = tokenizer.encode(text)
    assertEquals(ids, [258, 100, 258, 97, 99])
    assertEquals(tokenizer.decode(tokenizer.encode(text)), text)
  })
})

Deno.test('Save and load', async () => {
  try {
    const tokenizer = new RegexTokenizer()
    const text = `The llama (/ˈlɑːmə/; Spanish pronunciation: [ˈʎama] or [ˈʝama])...`
    tokenizer.train(text, 256 + 64)
    assertEquals(tokenizer.decode(tokenizer.encode(text)), text)

    const ids = tokenizer.encode(text)

    tokenizer.save('test_tokenizer_tmp')

    const reloadedTokenizer = new RegexTokenizer()
    reloadedTokenizer.load('test_tokenizer_tmp.model')

    assertEquals(reloadedTokenizer.decode(ids), text)
    assertEquals(reloadedTokenizer.decode(reloadedTokenizer.encode(text)), text)
    assertEquals(reloadedTokenizer.encode(text), ids)

    await Deno.remove('test_tokenizer_tmp.model')
    await Deno.remove('test_tokenizer_tmp.vocab')
  } catch (e) {
    console.error(e)
  }
})
