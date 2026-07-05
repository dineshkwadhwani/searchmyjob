import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

let pdfjsLibPromise: Promise<typeof import('pdfjs-dist')> | null = null
function loadPdfjs() {
  if (!pdfjsLibPromise) {
    pdfjsLibPromise = import('pdfjs-dist').then(lib => {
      lib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl
      return lib
    })
  }
  return pdfjsLibPromise
}

// Fonts pdf.js can confidently name (the standard 14 + common system fonts)
// or its generic CSS fallback families. Anything else is an embedded/custom
// font pdf.js couldn't identify — a reasonable proxy for "non-standard".
const ATS_SAFE_FONT_PATTERN = /helvetica|arial|calibri|times|georgia|verdana|garamond|cambria|tahoma|segoe|courier|sans-serif|serif|monospace/i

export interface PdfVisualInfo {
  fontFamilies: string[]
  nonStandardFonts: string[]
  fontSizesPt: number[]
  // Only left/top are reported — resume text virtually always starts right
  // at those edges, so "gap to edge" is a real margin measurement. Right and
  // bottom are NOT included: with ragged-right, variable-length text, "gap
  // to the far edge" mostly reflects how long the longest line/the resume
  // happens to be, not the document's actual margin — a short-line resume
  // with a real 0.5in right margin looks identical to one with a 3in margin.
  // We tried calibrating off long lines that approach the edge, but normal
  // resumes have long bullets that come close without truly reaching it,
  // producing false positives — not worth the false-flagging risk.
  marginsInches: { top: number; left: number }
  hasImages: boolean
  hasMultiColumnLayout: boolean
}

interface LineBounds { y: number; minX: number; maxX: number }

export async function extractPdfTextWithPageCount(blob: Blob): Promise<{ text: string; pageCount: number; visualInfo: PdfVisualInfo }> {
  const pdfjsLib = await loadPdfjs()
  const arrayBuffer = await blob.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise

  let text = ''
  const fontFamilies = new Set<string>()
  const nonStandardFonts = new Set<string>()
  const fontSizesPt = new Set<number>()
  let minLeft = Infinity, maxTop = -Infinity
  let pageHeightSum = 0
  let hasImages = false
  let columnSignals = 0

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    const [x0, y0, x1, y1] = page.view
    const pageWidth = x1 - x0
    const pageHeight = y1 - y0
    pageHeightSum += pageHeight

    // Reconstruct real line breaks from item Y-position (as before), and
    // collect each line's X-range along the way for margin + column checks.
    let lastY: number | null = null
    let line = ''
    let lineMinX = Infinity
    let lineMaxX = -Infinity
    const lineBounds: LineBounds[] = []

    const flushLine = (y: number) => {
      if (line.trim()) {
        text += line.trim() + '\n'
        lineBounds.push({ y, minX: lineMinX, maxX: lineMaxX })
      }
      line = ''
      lineMinX = Infinity
      lineMaxX = -Infinity
    }

    for (const item of content.items as any[]) {
      if (!item.str) continue
      const x = item.transform?.[4]
      const y = item.transform?.[5]
      if (lastY !== null && typeof y === 'number' && Math.abs(y - lastY) > 2) flushLine(lastY)
      line += item.str + ' '
      if (typeof x === 'number') {
        lineMinX = Math.min(lineMinX, x)
        lineMaxX = Math.max(lineMaxX, x + (item.width ?? 0))
        minLeft = Math.min(minLeft, x)
      }
      if (typeof y === 'number') {
        lastY = y
        maxTop = Math.max(maxTop, y + (item.height ?? 0))
      }
      // item.height approximates the glyph's rendered size in PDF points —
      // not an exact font-size read, but a solid proxy for flagging
      // extreme/inconsistent sizing.
      if (item.height) fontSizesPt.add(Math.round(item.height))

      const style = item.fontName ? (content.styles as any)?.[item.fontName] : null
      if (style?.fontFamily) {
        fontFamilies.add(style.fontFamily)
        if (!ATS_SAFE_FONT_PATTERN.test(style.fontFamily)) nonStandardFonts.add(style.fontFamily)
      }
    }
    if (lastY !== null) flushLine(lastY)
    text += '\n'

    // Multi-column heuristic: real 2-column layouts have a "left band" line
    // and a "right band" line landing at the same page height. Sequential
    // single-column sections never overlap in Y like that.
    const midX = x0 + pageWidth / 2
    const gutter = pageWidth * 0.05
    const leftLines = lineBounds.filter(l => l.maxX < midX - gutter)
    const rightLines = lineBounds.filter(l => l.minX > midX + gutter)
    for (const l of leftLines) {
      if (rightLines.some(r => Math.abs(r.y - l.y) < 3)) columnSignals++
    }

    const opList = await page.getOperatorList()
    if (opList.fnArray.includes(pdfjsLib.OPS.paintImageXObject) || opList.fnArray.includes(pdfjsLib.OPS.paintInlineImageXObject)) {
      hasImages = true
    }
  }

  const pageCount = pdf.numPages
  const avgPageHeight = pageHeightSum / pageCount

  const visualInfo: PdfVisualInfo = {
    fontFamilies: [...fontFamilies],
    nonStandardFonts: [...nonStandardFonts],
    fontSizesPt: [...fontSizesPt].sort((a, b) => a - b),
    marginsInches: {
      left: isFinite(minLeft) ? minLeft / 72 : 1,
      top: isFinite(maxTop) ? (avgPageHeight - maxTop) / 72 : 1,
    },
    hasImages,
    // A handful of coincidental left/right line pairs can happen on a
    // one-column page (e.g. a right-aligned date next to a job title) —
    // require several before concluding it's a real column layout.
    hasMultiColumnLayout: columnSignals >= 3,
  }

  return { text, pageCount, visualInfo }
}

export async function extractPdfText(blob: Blob): Promise<string> {
  const { text } = await extractPdfTextWithPageCount(blob)
  return text
}
