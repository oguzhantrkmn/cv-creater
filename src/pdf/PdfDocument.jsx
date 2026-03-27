import React from 'react'
import './PdfFonts'
import PdfClassic from './PdfClassic'

export default function PdfDocument({ cvData, template }) {
  return <PdfClassic cvData={cvData} />
}
