// Polyfill Buffer for @react-pdf/renderer in the browser
import { Buffer as NodeBuffer } from 'buffer'
if (typeof globalThis.Buffer === 'undefined') {
  globalThis.Buffer = NodeBuffer
}

import { Font } from '@react-pdf/renderer'

Font.registerHyphenationCallback(w => [w])

// Roboto v51 TTF — fetched from Google Fonts CDN (CORS-enabled).
// These variable-font TTF slices include full Latin + Latin-Extended
// (covers Turkish: ğ Ğ ş Ş ı İ ç Ç ö Ö ü Ü)
const G = 'https://fonts.gstatic.com/s/roboto/v51'

Font.register({
  family: 'Roboto',
  fonts: [
    {
      src: `${G}/KFOMCnqEu92Fr1ME7kSn66aGLdTylUAMQXC89YmC2DPNWuaabVmUiA_0lFQm.ttf`,
      fontWeight: 300,
    },
    {
      src: `${G}/KFOMCnqEu92Fr1ME7kSn66aGLdTylUAMQXC89YmC2DPNWubEbVmUiA_0lFQm.ttf`,
      fontWeight: 400,
    },
    {
      src: `${G}/KFOMCnqEu92Fr1ME7kSn66aGLdTylUAMQXC89YmC2DPNWub2bVmUiA_0lFQm.ttf`,
      fontWeight: 500,
    },
    {
      src: `${G}/KFOMCnqEu92Fr1ME7kSn66aGLdTylUAMQXC89YmC2DPNWuYjalmUiA_0lFQm.ttf`,
      fontWeight: 700,
    },
  ],
})
