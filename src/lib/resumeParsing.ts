import { extractPdfTextWithPageCount } from './pdf'
import type { PdfVisualInfo } from './pdf'

export interface ParsedResumeFile {
  text: string
  fileName: string
  fileType: 'pdf' | 'docx' | 'txt'
  // Only known precisely for PDF (from the actual page count). For docx/txt
  // this is a rough estimate from word count, since we don't render the file.
  pageCount: number
  pageCountIsEstimate: boolean
  // Only populated for PDF — derived from the file's actual internal
  // structure (fonts, positions, images), not just extracted text. DOCX/TXT
  // parsing (mammoth / raw text) discards this information entirely.
  visualInfo?: PdfVisualInfo
}

const WORDS_PER_PAGE_ESTIMATE = 550

export async function parseResumeFile(file: File): Promise<ParsedResumeFile> {
  const name = file.name.toLowerCase()

  if (file.type === 'application/pdf' || name.endsWith('.pdf')) {
    const { text, pageCount, visualInfo } = await extractPdfTextWithPageCount(file)
    return { text, fileName: file.name, fileType: 'pdf', pageCount, pageCountIsEstimate: false, visualInfo }
  }

  if (name.endsWith('.docx') || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    const mammoth = await import('mammoth')
    const arrayBuffer = await file.arrayBuffer()
    const result = await mammoth.extractRawText({ arrayBuffer })
    const text = result.value
    const wordCount = text.trim().split(/\s+/).filter(Boolean).length
    const pageCount = Math.max(1, Math.round(wordCount / WORDS_PER_PAGE_ESTIMATE))
    return { text, fileName: file.name, fileType: 'docx', pageCount, pageCountIsEstimate: true }
  }

  if (name.endsWith('.txt') || file.type === 'text/plain') {
    const text = await file.text()
    const wordCount = text.trim().split(/\s+/).filter(Boolean).length
    const pageCount = Math.max(1, Math.round(wordCount / WORDS_PER_PAGE_ESTIMATE))
    return { text, fileName: file.name, fileType: 'txt', pageCount, pageCountIsEstimate: true }
  }

  throw new Error('Unsupported file type. Please upload a PDF, DOCX, or TXT file.')
}
