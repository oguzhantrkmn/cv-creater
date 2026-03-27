// Polyfill Buffer for @react-pdf/renderer in the browser
import { Buffer as NodeBuffer } from 'buffer'
if (typeof globalThis.Buffer === 'undefined') {
  globalThis.Buffer = NodeBuffer
}

import { Font } from '@react-pdf/renderer'

Font.registerHyphenationCallback(w => [w])

// Local Roboto TTF fonts (bundled to avoid CSP / CDN fetch issues)
// Latin + Latin-Extended — covers Turkish: ğ Ğ ş Ş ı İ ç Ç ö Ö ü Ü
Font.register({
  family: 'Roboto',
  fonts: [
    { src: new URL('./fonts/roboto-300.ttf', import.meta.url).href, fontWeight: 300 },
    { src: new URL('./fonts/roboto-400.ttf', import.meta.url).href, fontWeight: 400 },
    { src: new URL('./fonts/roboto-500.ttf', import.meta.url).href, fontWeight: 500 },
    { src: new URL('./fonts/roboto-700.ttf', import.meta.url).href, fontWeight: 700 },
  ],
})
