# Minbpe

This package is a port of [https://github.com/karpathy/minbpe](https://github.com/karpathy/minbpe)](https://github.com/karpathy/minbpe) in pure JavaScript. Right now, it only supports server environments, but we will also grant support for browsers too.

## Usage

Install **minbpe** with npm:

```sh
npm i minbpe
```

Use in your JavaScript file:

```js
import { BasicTokenizer } from 'minbpe'

const tokenizer = new BasicTokenizer()
const text = 'The quick brown fox jumps over the lazy dog'

// optionally train a tokenizer:
// tokenizer.train(text, 256 + 3)

const ids = tokenizer.encode(text)
const decoded = tokenizer.decode(ids)
```

## Progress status

- [x] Base Tokenizer
- [ ] Regex Tokenizer (_work in progress_)
- [ ] GPT4 Tokenizer (_work in progress_)

- [x] Node.js support
- [x] Deno support
- [x] Bun support
- [ ] Cloudflare Workers support (_work in progress_)  

# License
[Apache 2.0](./LICENSE.md)