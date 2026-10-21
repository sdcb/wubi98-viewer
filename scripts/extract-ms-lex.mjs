// Parses the Microsoft Wubi system dictionary (ChsWubiNew.lex) into a TSV.
// Run locally on Windows only: node scripts/extract-ms-lex.mjs
import { readFileSync, writeFileSync } from 'node:fs'

const src = process.argv[2] ?? 'C:\\Windows\\InputMethod\\CHS\\ChsWubiNew.lex'
const out = process.argv[3] ?? 'data-src/ms-wubi.tsv'
const b = readFileSync(src)
if (b.toString('latin1', 0, 8) !== 'imscwubi') throw new Error('not an imscwubi lex file')

// Record layout: u16 len | u16 weight | u16 codeLen | 4 x u16 code | utf16le word | u16 0
const lines = []
let p = 0xa8
while (p + 2 <= b.length) {
  const len = b.readUInt16LE(p)
  if (len === 0) break
  const weight = b.readUInt16LE(p + 2)
  const codeLen = b.readUInt16LE(p + 4)
  const code = b.toString('utf16le', p + 6, p + 6 + codeLen * 2)
  const word = b.toString('utf16le', p + 14, p + len - 2)
  lines.push(`${code}\t${word}\t${weight}`)
  p += len
}
writeFileSync(out, lines.join('\n') + '\n')
console.log(`extracted ${lines.length} entries -> ${out}`)
