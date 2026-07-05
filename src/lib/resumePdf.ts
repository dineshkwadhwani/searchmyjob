import pdfMake from 'pdfmake/build/pdfmake'
import vfsFonts from 'pdfmake/build/vfs_fonts'
import type { Content, TDocumentDefinitions } from 'pdfmake/interfaces'

// Renders resume HTML (h1/h2/h3/p/ul/li) directly to a PDF via pdfmake
// instead of the browser's print dialog. window.print()-based "Save as PDF"
// margins turned out to be unreliable across browsers/OS print paths (@page
// CSS support varies) — generating the PDF ourselves guarantees the exact
// margin regardless of the user's environment.

let fontsRegistered = false
function ensureFonts() {
  if (fontsRegistered) return
  pdfMake.addVirtualFileSystem(vfsFonts)
  fontsRegistered = true
}

const PAGE_MARGIN_PT = 54 // 0.75in — centered in the 0.5-1in ATS-friendly range
const PAGE_WIDTH_PT = 612 // US Letter
const RULE_WIDTH_PT = PAGE_WIDTH_PT - PAGE_MARGIN_PT * 2

function elementToPdfContent(el: Element): Content[] {
  const tag = el.tagName.toLowerCase()
  const text = (el.textContent ?? '').trim()

  switch (tag) {
    case 'h1':
      if (!text) return []
      return [
        { text, fontSize: 20, bold: true, margin: [0, 0, 0, 4] },
        { canvas: [{ type: 'line', x1: 0, y1: 0, x2: RULE_WIDTH_PT, y2: 0, lineWidth: 1.5, lineColor: '#333333' }], margin: [0, 0, 0, 10] },
      ]
    case 'h2':
      if (!text) return []
      return [
        { text, fontSize: 13, bold: true, margin: [0, 10, 0, 2] },
        { canvas: [{ type: 'line', x1: 0, y1: 0, x2: RULE_WIDTH_PT, y2: 0, lineWidth: 0.75, lineColor: '#aaaaaa' }], margin: [0, 0, 0, 4] },
      ]
    case 'h3':
      return text ? [{ text, fontSize: 11, bold: true, margin: [0, 6, 0, 1] }] : []
    case 'ul': {
      const items = Array.from(el.children)
        .filter(li => li.tagName.toLowerCase() === 'li')
        .map(li => (li.textContent ?? '').trim())
        .filter(Boolean)
      return items.length ? [{ ul: items, margin: [0, 2, 0, 6] }] : []
    }
    case 'p':
      return text ? [{ text, margin: [0, 2, 0, 4] }] : []
    default:
      return text ? [{ text, margin: [0, 2, 0, 2] }] : []
  }
}

function htmlToPdfContent(html: string): Content[] {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  return Array.from(doc.body.children).flatMap(elementToPdfContent)
}

export function downloadResumeAsPdf(html: string, filename: string): Promise<void> {
  ensureFonts()
  const docDefinition: TDocumentDefinitions = {
    pageSize: 'LETTER',
    pageMargins: [PAGE_MARGIN_PT, PAGE_MARGIN_PT, PAGE_MARGIN_PT, PAGE_MARGIN_PT],
    defaultStyle: { fontSize: 11, lineHeight: 1.3 },
    content: htmlToPdfContent(html),
  }
  return pdfMake.createPdf(docDefinition).download(filename)
}
