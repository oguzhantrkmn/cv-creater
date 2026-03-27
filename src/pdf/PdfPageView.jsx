import React, { useEffect, useState, useRef } from 'react'
import { pdf } from '@react-pdf/renderer'

let pdfJsLoaded = false
let pdfJs = null

async function loadPdfJs() {
  if (pdfJsLoaded) return pdfJs
  const mod = await import('pdfjs-dist')
  // CDN worker matching the installed version
  mod.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${mod.version}/pdf.worker.min.js`
  pdfJs = mod
  pdfJsLoaded = true
  return pdfJs
}

async function renderPdfToDataUrls(blob, pageScale = 1.6) {
  const lib = await loadPdfJs()
  const buf = await blob.arrayBuffer()
  const doc = await lib.getDocument({ data: new Uint8Array(buf) }).promise
  const urls = []
  for (let p = 1; p <= doc.numPages; p++) {
    const page  = await doc.getPage(p)
    const vp    = page.getViewport({ scale: pageScale })
    const canvas = document.createElement('canvas')
    canvas.width  = vp.width
    canvas.height = vp.height
    await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise
    urls.push(canvas.toDataURL('image/png'))
    page.cleanup()
  }
  return urls
}

/**
 * PdfPageView
 * Renders a @react-pdf/renderer Document to page images and shows them
 * side-by-side when there are 2 pages.
 *
 * Props:
 *   pdfDocument  – React element returned by <PdfDocument cvData={…} />
 *   scale        – render scale (default 1.6 – crisp on retina)
 *   pageHeight   – CSS height of each page image (default 560)
 */
export default function PdfPageView({ pdfDocument, scale = 1.6, pageHeight = 560 }) {
  const [pages, setPages]   = useState([])
  const [status, setStatus] = useState('idle') // idle | loading | done | error
  const [errMsg, setErrMsg] = useState('')
  const runId = useRef(0)

  useEffect(() => {
    if (!pdfDocument) return
    const myRun = ++runId.current
    setStatus('loading')
    setPages([])

    ;(async () => {
      try {
        const blob = await pdf(pdfDocument).toBlob()
        if (runId.current !== myRun) return
        const dataUrls = await renderPdfToDataUrls(blob, scale)
        if (runId.current !== myRun) return
        setPages(dataUrls)
        setStatus('done')
      } catch (e) {
        if (runId.current !== myRun) return
        console.error('PdfPageView render error:', e)
        setErrMsg(e?.message || 'Bilinmeyen hata')
        setStatus('error')
      }
    })()

    return () => { runId.current++ }
  }, [pdfDocument, scale])

  if (status === 'idle') return null

  if (status === 'loading') {
    return (
      <div style={loadingWrap}>
        <div style={spinner} />
        <p style={{ color: '#666', margin: 0, fontSize: 14 }}>PDF önizlemesi hazırlanıyor…</p>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div style={{ ...loadingWrap, flexDirection: 'column', gap: 8 }}>
        <p style={{ color: '#ef4444', margin: 0, fontSize: 14, fontWeight: 600 }}>Önizleme yüklenemedi</p>
        <p style={{ color: '#888', margin: 0, fontSize: 12 }}>{errMsg}</p>
      </div>
    )
  }

  const isTwoPage = pages.length === 2

  return (
    <div style={{
      display: 'flex',
      flexDirection: isTwoPage ? 'row' : 'column',
      gap: 20,
      justifyContent: 'center',
      alignItems: 'flex-start',
      padding: '24px 16px',
      backgroundColor: '#e2e8f0',
      borderRadius: 12,
      overflowX: 'auto',
      minHeight: pageHeight + 48,
    }}>
      {pages.map((src, i) => (
        <div
          key={i}
          style={{
            boxShadow: '0 6px 28px rgba(0,0,0,0.22)',
            borderRadius: 3,
            overflow: 'hidden',
            flexShrink: 0,
            backgroundColor: '#fff',
            position: 'relative',
          }}
        >
          {pages.length > 1 && (
            <div style={{
              position: 'absolute', top: 8, right: 10,
              backgroundColor: 'rgba(0,0,0,0.4)',
              color: '#fff', fontSize: 10, borderRadius: 4,
              padding: '2px 7px', zIndex: 1,
            }}>
              {i + 1} / {pages.length}
            </div>
          )}
          <img
            src={src}
            alt={`Sayfa ${i + 1}`}
            style={{ display: 'block', height: pageHeight, width: 'auto' }}
          />
        </div>
      ))}
    </div>
  )
}

const loadingWrap = {
  display: 'flex',
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 14,
  padding: '40px 24px',
  backgroundColor: '#e2e8f0',
  borderRadius: 12,
  minHeight: 200,
}

const spinner = {
  width: 28,
  height: 28,
  borderRadius: '50%',
  border: '3px solid #cbd5e1',
  borderTopColor: '#3b82f6',
  animation: 'spin 0.8s linear infinite',
}
