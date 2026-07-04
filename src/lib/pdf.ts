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

export async function extractPdfText(blob: Blob): Promise<string> {
  const pdfjsLib = await loadPdfjs()
  const arrayBuffer = await blob.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  let text = ''
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    text += (content.items as any[]).map(item => item.str).join(' ') + '\n'
  }
  return text
}
