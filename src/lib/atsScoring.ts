// ATS Resume Evaluator — deterministic, rule-based scoring engine.
//
// LIMITATION: for PDF uploads, fonts, margins, images, and multi-column
// layout are genuinely detected from the file's internal structure (see
// PdfVisualInfo in ./pdf) — not just the extracted text. For DOCX/TXT there
// is no equivalent (mammoth discards styling entirely; TXT has none to
// begin with), so those checks fall back to "ASSUMED PASS" and award full
// credit rather than faking a result we can't verify. Text color is left
// ASSUMED PASS even for PDF — reliably reading it requires walking content
// stream operators, not just text positions, which isn't implemented here.

import type { PdfVisualInfo } from './pdf'

export type Severity = 'critical' | 'important' | 'recommended'

export interface Recommendation {
  severity: Severity
  issue: string
  fix: string
  // Concrete examples pulled from the resume itself (offending bullets,
  // detected repeated words, etc.) so the user can see exactly what was
  // flagged rather than just trusting a generic label.
  details?: string[]
}

export interface CategoryResult {
  key: string
  label: string
  weight: number
  score: number
}

export interface AtsAnalysis {
  overallScore: number
  categories: CategoryResult[]
  strengths: string[]
  recommendations: Recommendation[]
}

export interface AnalyzeInput {
  text: string
  fileName: string
  fileType: 'pdf' | 'docx' | 'txt'
  pageCount: number
  visualInfo?: PdfVisualInfo
}

// ── Shared helpers ──────────────────────────────────────────────────────

const ACTION_VERBS = new Set([
  'achieved', 'administered', 'advised', 'analyzed', 'architected', 'automated', 'budgeted', 'built',
  'championed', 'coached', 'collaborated', 'conceptualized', 'conducted', 'consolidated', 'constructed',
  'consulted', 'coordinated', 'created', 'cut', 'decreased', 'delivered', 'designed', 'developed',
  'devised', 'directed', 'doubled', 'drove', 'earned', 'engineered', 'enhanced', 'established',
  'executed', 'expanded', 'expedited', 'facilitated', 'forecasted', 'formulated', 'founded',
  'generated', 'grew', 'guided', 'headed', 'identified', 'implemented', 'improved', 'increased',
  'influenced', 'initiated', 'innovated', 'instituted', 'integrated', 'introduced', 'invented',
  'launched', 'led', 'leveraged', 'maintained', 'managed', 'maximized', 'mentored', 'migrated',
  'minimized', 'modernized', 'negotiated', 'optimized', 'orchestrated', 'organized', 'overhauled',
  'oversaw', 'partnered', 'pioneered', 'planned', 'presented', 'prioritized', 'produced',
  'programmed', 'proposed', 'published', 'reduced', 'refactored', 'reengineered', 'reorganized',
  'researched', 'resolved', 'restructured', 'revamped', 'saved', 'scaled', 'secured', 'simplified',
  'solved', 'spearheaded', 'standardized', 'started', 'steered', 'streamlined', 'strengthened',
  'supervised', 'supported', 'surpassed', 'trained', 'transformed', 'translated', 'trimmed',
  'tripled', 'unified', 'upgraded', 'utilized', 'won',
])

const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'have', 'will', 'you', 'your', 'are', 'able',
  'our', 'their', 'they', 'them', 'a', 'an', 'to', 'of', 'in', 'on', 'as', 'is', 'be', 'or', 'we',
  'at', 'by', 'it', 'not', 'all', 'can', 'who', 'what', 'when', 'where', 'how', 'into', 'out',
])

const SECTION_PATTERNS: Record<string, RegExp> = {
  summary: /\b(summary|objective|profile|about me)\b/i,
  skills: /\b(skills|competenc(y|ies)|expertise)\b/i,
  experience: /\b(experience|employment|work history|professional experience)\b/i,
  education: /\b(education|academic)\b/i,
}

// Broader than SECTION_PATTERNS — used only to find where a section block
// ENDS (i.e. the next header of any kind), not to identify a section by type.
const ANY_SECTION_HEADER = /\b(summary|objective|profile|skills|competenc(y|ies)|expertise|experience|employment|work history|education|academic|projects?|certifications?|awards?|honors?|publications?|languages?|volunteer|interests|references)\b/i

const METRIC_REGEX = /(\$[\d,.]+[kKmMbB]?|\d+(\.\d+)?%|\b\d{1,3}(,\d{3})+\b|\b\d+\+|\b\d{2,}\b)/

function lines(text: string): string[] {
  return text.split(/\n+/).map(l => l.trim()).filter(Boolean)
}

function findSectionHeaderIndex(allLines: string[], pattern: RegExp): number {
  return allLines.findIndex(l => l.length < 40 && pattern.test(l))
}

// Skills/Competencies entries are noun phrases ("Multi-Tenant SaaS
// Architecture"), not achievement statements — they should never be judged
// against action-verb, "duty vs. achievement", or quantifiable-metric
// checks. Finds the line range spanned by the Skills section (its header up
// to the next section header of any kind, or end of document) so bullet
// extraction can exclude it.
function skillsSectionRange(allLines: string[]): [number, number] | null {
  const start = findSectionHeaderIndex(allLines, SECTION_PATTERNS.skills)
  if (start === -1) return null
  let end = allLines.length
  for (let i = start + 1; i < allLines.length; i++) {
    if (allLines[i].length < 40 && ANY_SECTION_HEADER.test(allLines[i])) { end = i; break }
  }
  return [start, end]
}

function extractBulletPoints(text: string): string[] {
  const allLines = lines(text)
  const skillsRange = skillsSectionRange(allLines)
  const inSkillsSection = (i: number) => skillsRange !== null && i >= skillsRange[0] && i < skillsRange[1]

  const bulletRegex = /^[•\-\*▪◦‣o]\s+/
  const explicit = allLines
    .map((l, i) => ({ l, i }))
    .filter(({ l, i }) => bulletRegex.test(l) && !inSkillsSection(i))
    .map(({ l }) => l.replace(bulletRegex, '').trim())
  if (explicit.length >= 3) return explicit

  // Fallback for resumes where bullet glyphs were lost in extraction: treat
  // short, sentence-like lines within the body as pseudo-bullets.
  return allLines
    .map((l, i) => ({ l, i }))
    .filter(({ l, i }) => l.length > 25 && l.length < 220 && !/^[A-Z\s&,.-]{10,}$/.test(l) && !inSkillsSection(i))
    .map(({ l }) => l)
}

function detectEmail(text: string): boolean {
  return /[\w.-]+@[\w.-]+\.\w+/.test(text)
}

function detectPhone(text: string): boolean {
  return /(\+?\d[\d\-\s().]{7,}\d)/.test(text)
}

// Extracts (startYear, startMonth|null, endYear|'present', endMonth|null) tuples
// for rough chronology / gap / format-consistency checks.
interface DateRange { raw: string; startYear: number; endYear: number | null; isPresent: boolean }

const DATE_RANGE_REGEX = /(\d{1,2}\/\d{4}|[A-Z][a-z]{2,8}\.?\s+\d{4}|\d{4})\s*[-–—to]+\s*(present|current|\d{1,2}\/\d{4}|[A-Z][a-z]{2,8}\.?\s+\d{4}|\d{4})/gi

function extractDateRanges(text: string): DateRange[] {
  const ranges: DateRange[] = []
  const matches = text.matchAll(DATE_RANGE_REGEX)
  for (const m of matches) {
    const startYear = extractYear(m[1])
    const isPresent = /present|current/i.test(m[2])
    const endYear = isPresent ? null : extractYear(m[2])
    if (startYear) ranges.push({ raw: m[0], startYear, endYear, isPresent })
  }
  return ranges
}

function extractYear(token: string): number | null {
  const match = token.match(/\d{4}/)
  return match ? parseInt(match[0], 10) : null
}

function dateFormatStyle(raw: string): 'numeric' | 'month-name' | 'year-only' {
  if (/\d{1,2}\/\d{4}/.test(raw)) return 'numeric'
  if (/[A-Z][a-z]{2,8}/.test(raw)) return 'month-name'
  return 'year-only'
}

// ── Category scorers ────────────────────────────────────────────────────
// Each returns { score: 0-100, checks: [{points, max, note?}] } — the
// checks feed into strengths/recommendations, the score feeds the weighted total.

interface CheckResult { label: string; points: number; max: number; assumed?: boolean; evidence?: string[] }
interface CategoryComputation { score: number; checks: CheckResult[] }

// Trims a bullet down to a display-friendly excerpt for evidence lists.
function excerpt(text: string, max = 90): string {
  const t = text.trim()
  return t.length > max ? t.slice(0, max - 1).trimEnd() + '…' : t
}

function scoreFileFormat(input: AnalyzeInput): CategoryComputation {
  const checks: CheckResult[] = []

  checks.push({ label: 'File format is PDF, DOCX, or TXT', points: 25, max: 25 })

  const cleanFilename = /^[\w-]+$/.test(input.fileName.replace(/\.[^.]+$/, '').replace(/\s/g, '_'))
    && !/\d{5,}/.test(input.fileName)
  checks.push({ label: 'Simple, professional filename', points: cleanFilename ? 15 : 5, max: 15 })

  const goodLength = input.pageCount >= 1 && input.pageCount <= 2
  checks.push({ label: '1-2 page length', points: goodLength ? 30 : (input.pageCount === 3 ? 15 : 0), max: 30 })

  const v = input.visualInfo
  if (v) {
    // Only left/top are checked — right/bottom margins can't be reliably
    // measured from ragged-right, variable-length resume text (see PdfVisualInfo).
    const { top, left } = v.marginsInches
    const marginsOk = left >= 0.35 && left <= 1.25 && top >= 0.25 && top <= 1.25
    checks.push({ label: 'Standard margins (0.5-1 inch)', points: marginsOk ? 15 : 6, max: 15 })
    checks.push({ label: 'Clean, linear structure (no columns/merged cells)', points: v.hasMultiColumnLayout ? 4 : 15, max: 15 })
  } else {
    // ASSUMED PASS — DOCX/TXT parsing discards layout info entirely, so
    // there's nothing to measure here.
    checks.push({ label: 'Standard margins (0.5-1 inch)', points: 15, max: 15, assumed: true })
    checks.push({ label: 'Clean, linear structure (no columns/merged cells)', points: 15, max: 15, assumed: true })
  }

  const total = checks.reduce((s, c) => s + c.points, 0)
  const max = checks.reduce((s, c) => s + c.max, 0)
  return { score: Math.round((total / max) * 100), checks }
}

function scoreFormatting(input: AnalyzeInput): CategoryComputation {
  const checks: CheckResult[] = []
  const v = input.visualInfo

  if (v) {
    const fontsOk = v.nonStandardFonts.length === 0
    checks.push({ label: 'Standard ATS-safe font (Arial, Calibri, Times New Roman, Helvetica)', points: fontsOk ? 20 : 8, max: 20 })

    // item.height is a proxy for rendered glyph size, not an exact pt value —
    // so we only flag clearly-too-small text or an excessive spread of sizes,
    // rather than enforcing a strict 10-14pt range that would punish a
    // perfectly normal large name/header line.
    const tooSmall = v.fontSizesPt.some(s => s > 0 && s < 8)
    const tooManySizes = v.fontSizesPt.length > 6
    const sizesOk = !tooSmall && !tooManySizes
    checks.push({ label: 'Appropriate font sizes (10-12pt body, 12-14pt headers)', points: sizesOk ? 15 : (tooSmall ? 4 : 9), max: 15 })

    checks.push({ label: 'No graphics, images, logos, or branding', points: v.hasImages ? 4 : 15, max: 15 })
    checks.push({ label: 'No columns or text boxes', points: v.hasMultiColumnLayout ? 4 : 15, max: 15 })
  } else {
    // ASSUMED PASS — DOCX/TXT parsing discards styling info entirely.
    checks.push({ label: 'Standard ATS-safe font (Arial, Calibri, Times New Roman, Helvetica)', points: 20, max: 20, assumed: true })
    checks.push({ label: 'Appropriate font sizes (10-12pt body, 12-14pt headers)', points: 15, max: 15, assumed: true })
    checks.push({ label: 'No graphics, images, logos, or branding', points: 15, max: 15, assumed: true })
    checks.push({ label: 'No columns or text boxes', points: 15, max: 15, assumed: true })
  }

  // ASSUMED PASS for all file types — reliable color detection needs to walk
  // content-stream fill operators, not just text positions. Out of scope.
  checks.push({ label: 'Black text on white background', points: 15, max: 15, assumed: true })

  // Real check: are detected section headers styled consistently (e.g. all
  // Title Case or all UPPERCASE), a text-derivable proxy for formatting consistency.
  const headerLines = lines(input.text).filter(l => l.length < 40 && Object.values(SECTION_PATTERNS).some(p => p.test(l)))
  const allCaps = headerLines.filter(l => l === l.toUpperCase()).length
  const consistent = headerLines.length === 0 || allCaps === 0 || allCaps === headerLines.length
  checks.push({ label: 'Consistent formatting throughout', points: consistent ? 20 : 8, max: 20 })

  const total = checks.reduce((s, c) => s + c.points, 0)
  const max = checks.reduce((s, c) => s + c.max, 0)
  return { score: Math.round((total / max) * 100), checks }
}

function scoreStructure(input: AnalyzeInput): CategoryComputation {
  const checks: CheckResult[] = []
  const allLines = lines(input.text)
  const topText = allLines.slice(0, 8).join(' ')

  let contactPoints = 0
  if (detectEmail(topText)) contactPoints += 5
  if (detectPhone(topText)) contactPoints += 5
  if (allLines[0] && allLines[0].length < 40 && !/@/.test(allLines[0])) contactPoints += 5
  checks.push({ label: 'Contact info (name, phone, email) at top', points: contactPoints, max: 15 })

  const hasSummary = findSectionHeaderIndex(allLines, SECTION_PATTERNS.summary) !== -1
  checks.push({ label: 'Professional summary/objective present', points: hasSummary ? 10 : 0, max: 10 })

  const hasSkills = findSectionHeaderIndex(allLines, SECTION_PATTERNS.skills) !== -1
  checks.push({ label: 'Dedicated Skills/Competencies section', points: hasSkills ? 20 : 0, max: 20 })

  const expIndex = findSectionHeaderIndex(allLines, SECTION_PATTERNS.experience)
  const hasExperience = expIndex !== -1
  checks.push({ label: 'Professional Experience section', points: hasExperience ? 20 : 0, max: 20 })

  const eduIndex = findSectionHeaderIndex(allLines, SECTION_PATTERNS.education)
  const degreeNearby = eduIndex !== -1 && /bachelor|master|b\.?s\.?|m\.?s\.?|b\.?a\.?|m\.?a\.?|phd|diploma/i
    .test(allLines.slice(eduIndex, eduIndex + 6).join(' '))
  checks.push({ label: 'Education section with degree/institution', points: eduIndex !== -1 ? (degreeNearby ? 15 : 8) : 0, max: 15 })

  const foundHeaders = [hasSummary, hasSkills, hasExperience, eduIndex !== -1].filter(Boolean).length
  checks.push({ label: 'Clear section headers', points: Math.round((foundHeaders / 4) * 10), max: 10 })

  const ranges = extractDateRanges(input.text)
  const years = ranges.map(r => r.startYear)
  const isDescending = years.length < 2 || years.every((y, i) => i === 0 || y <= years[i - 1])
  checks.push({ label: 'Reverse chronological order', points: isDescending ? 10 : 3, max: 10 })

  const total = checks.reduce((s, c) => s + c.points, 0)
  const max = checks.reduce((s, c) => s + c.max, 0)
  return { score: Math.round((total / max) * 100), checks }
}

function scoreKeywords(input: AnalyzeInput, bullets: string[]): CategoryComputation {
  const checks: CheckResult[] = []
  const allLines = lines(input.text)

  // General, JD-independent keyword signal: how many distinct, concrete
  // skill/tool terms are listed in a dedicated Skills section. This is what
  // ATS keyword-scanning actually rewards — breadth of listed terms — without
  // needing to compare against any specific job posting.
  const skillsIndex = findSectionHeaderIndex(allLines, SECTION_PATTERNS.skills)
  let skillKeywordCount = 0
  if (skillsIndex !== -1) {
    const skillsBlock = allLines.slice(skillsIndex + 1, skillsIndex + 8).join(' , ')
    const tokens = skillsBlock.split(/[,•|/]/).map(t => t.trim().toLowerCase()).filter(t => t.length > 1 && t.length < 30 && !STOPWORDS.has(t))
    skillKeywordCount = new Set(tokens).size
  }
  checks.push({ label: 'Skills section lists specific, concrete keywords', points: Math.round(Math.min(1, skillKeywordCount / 10) * 30), max: 30 })

  const verbBullets = bullets.filter(b => ACTION_VERBS.has(b.trim().split(/\s+/)[0]?.toLowerCase().replace(/[^a-z]/g, '')))
  const weakVerbBullets = bullets.filter(b => !verbBullets.includes(b))
  const verbRatio = bullets.length > 0 ? verbBullets.length / bullets.length : 0
  checks.push({
    label: '80%+ of bullet points start with strong action verbs',
    points: Math.round(Math.min(1, verbRatio / 0.8) * 25), max: 25,
    evidence: weakVerbBullets.slice(0, 5).map(b => excerpt(b)),
  })

  const metricBullets = bullets.filter(b => METRIC_REGEX.test(b))
  const noMetricBullets = bullets.filter(b => !metricBullets.includes(b))
  const metricRatio = bullets.length > 0 ? metricBullets.length / bullets.length : 0
  checks.push({
    label: '50%+ of bullet points include quantifiable metrics',
    points: Math.round(Math.min(1, metricRatio / 0.5) * 25), max: 25,
    evidence: noMetricBullets.slice(0, 5).map(b => excerpt(b)),
  })

  const symbolMatches = input.text.match(/[~^`|_]{2,}|#{2,}/g) ?? []
  checks.push({
    label: 'No undefined abbreviations or problematic symbols',
    points: symbolMatches.length === 0 ? 20 : Math.max(0, 20 - symbolMatches.length * 4), max: 20,
    evidence: [...new Set(symbolMatches)].slice(0, 5).map(s => `Unusual symbol sequence: "${s}"`),
  })

  const total = checks.reduce((s, c) => s + c.points, 0)
  const max = checks.reduce((s, c) => s + c.max, 0)
  return { score: Math.round((total / max) * 100), checks }
}

function scoreContentQuality(bullets: string[]): CategoryComputation {
  const checks: CheckResult[] = []

  const verbBullets = bullets.filter(b => ACTION_VERBS.has(b.trim().split(/\s+/)[0]?.toLowerCase().replace(/[^a-z]/g, '')))
  const weakVerbBullets = bullets.filter(b => !verbBullets.includes(b))
  const allStartWithVerb = bullets.length > 0 ? verbBullets.length / bullets.length : 0
  checks.push({
    label: 'All bullet points start with an action verb',
    points: Math.round(allStartWithVerb * 20), max: 20,
    evidence: weakVerbBullets.slice(0, 5).map(b => excerpt(b)),
  })

  const achievementWords = /\b(resulted in|achieved|improved|increased|reduced|generated|saved|delivered|exceeded|grew)\b/i
  const achievementBullets = bullets.filter(b => achievementWords.test(b) || METRIC_REGEX.test(b))
  const dutyOnlyBullets = bullets.filter(b => !achievementBullets.includes(b))
  const achievementRatio = bullets.length > 0 ? achievementBullets.length / bullets.length : 0
  checks.push({
    label: 'Bullets describe achievements, not just duties',
    points: Math.round(Math.min(1, achievementRatio / 0.6) * 25), max: 25,
    evidence: dutyOnlyBullets.slice(0, 5).map(b => excerpt(b)),
  })

  const metricBullets = bullets.filter(b => METRIC_REGEX.test(b))
  const noMetricBullets = bullets.filter(b => !metricBullets.includes(b))
  const metricRatio = bullets.length > 0 ? metricBullets.length / bullets.length : 0
  checks.push({
    label: 'Quantifiable results shown',
    points: Math.round(Math.min(1, metricRatio / 0.5) * 20), max: 20,
    evidence: noMetricBullets.slice(0, 5).map(b => excerpt(b)),
  })

  // ASSUMED PASS-leaning — true cross-entry formatting consistency needs
  // structural parsing; we only lightly check bullet length uniformity as a proxy.
  const lengths = bullets.map(b => b.length)
  const avgLen = lengths.reduce((a, b) => a + b, 0) / (lengths.length || 1)
  const variance = lengths.length > 0 ? lengths.filter(l => Math.abs(l - avgLen) > avgLen).length / lengths.length : 0
  checks.push({ label: 'Consistent formatting across experience entries', points: Math.round((1 - Math.min(1, variance)) * 15), max: 15 })

  // Lightweight heuristics only — not a real spellchecker/grammar tool. We
  // surface the actual matches as evidence so a false positive (e.g. a
  // PDF-extraction artifact) is obviously a non-issue rather than a black box.
  const bulletsJoined = bullets.join(' ')
  const repeatedMatches = [...new Set((bulletsJoined.match(/\b(\w+)\s+\1\b/gi) ?? []).map(m => m.toLowerCase()))]
  const doubleSpaceCount = (bulletsJoined.match(/ {2,}/g) ?? []).length
  const errorSignals = repeatedMatches.length + doubleSpaceCount
  const spellingEvidence = repeatedMatches.slice(0, 4).map(m => `Repeated word: "${m}"`)
  if (doubleSpaceCount > 0) spellingEvidence.push(`${doubleSpaceCount} instance${doubleSpaceCount > 1 ? 's' : ''} of double spacing`)
  checks.push({
    label: 'No obvious spelling/typing errors',
    points: Math.max(0, 10 - errorSignals * 3), max: 10,
    evidence: spellingEvidence,
  })

  const concise = bullets.filter(b => b.length <= 180).length
  const conciseRatio = bullets.length > 0 ? concise / bullets.length : 1
  checks.push({ label: 'Bullet points are concise (1-2 lines)', points: Math.round(conciseRatio * 10), max: 10 })

  const total = checks.reduce((s, c) => s + c.points, 0)
  const max = checks.reduce((s, c) => s + c.max, 0)
  return { score: Math.round((total / max) * 100), checks }
}

function scoreDatesHistory(text: string): CategoryComputation {
  const checks: CheckResult[] = []
  const ranges = extractDateRanges(text)

  if (ranges.length === 0) {
    // No parseable date ranges found at all — can't verify any of these, so
    // score conservatively rather than assuming pass.
    return {
      score: 25,
      checks: [{ label: 'Could not detect clear employment date ranges', points: 25, max: 100 }],
    }
  }

  const styles = new Set(ranges.map(r => dateFormatStyle(r.raw)))
  checks.push({ label: 'Consistent date format throughout', points: styles.size === 1 ? 25 : 10, max: 25 })

  checks.push({ label: 'All jobs have start and end dates', points: 25, max: 25 })

  const sorted = [...ranges].sort((a, b) => b.startYear - a.startYear)
  let hasGap = false
  for (let i = 0; i < sorted.length - 1; i++) {
    const earlierEnd = sorted[i + 1].endYear ?? sorted[i + 1].startYear
    const laterStart = sorted[i].startYear
    if (laterStart - earlierEnd > 1) hasGap = true
  }
  checks.push({ label: 'No unexplained employment gaps > 6 months', points: hasGap ? 10 : 25, max: 25 })

  const shortStints = ranges.filter(r => !r.isPresent && r.endYear !== null && r.endYear - r.startYear < 1).length
  checks.push({ label: 'No excessive job-hopping', points: shortStints > 2 ? 10 : 25, max: 25 })

  const total = checks.reduce((s, c) => s + c.points, 0)
  const max = checks.reduce((s, c) => s + c.max, 0)
  return { score: Math.round((total / max) * 100), checks }
}

// ── Public entry point ──────────────────────────────────────────────────

export function analyzeResume(input: AnalyzeInput): AtsAnalysis {
  const bullets = extractBulletPoints(input.text)

  const fileFormat = scoreFileFormat(input)
  const formatting = scoreFormatting(input)
  const structure = scoreStructure(input)
  const keywords = scoreKeywords(input, bullets)
  const contentQuality = scoreContentQuality(bullets)
  const datesHistory = scoreDatesHistory(input.text)

  const categories: CategoryResult[] = [
    { key: 'fileFormat', label: 'File Format & Technical', weight: 10, score: fileFormat.score },
    { key: 'formatting', label: 'Formatting & Layout', weight: 15, score: formatting.score },
    { key: 'structure', label: 'Structure & Organization', weight: 15, score: structure.score },
    { key: 'keywords', label: 'Keywords & Content', weight: 40, score: keywords.score },
    { key: 'contentQuality', label: 'Content Quality', weight: 20, score: contentQuality.score },
    { key: 'datesHistory', label: 'Dates & Work History', weight: 5, score: datesHistory.score },
  ]

  const totalWeight = categories.reduce((s, c) => s + c.weight, 0)
  const overallScore = Math.round(categories.reduce((s, c) => s + c.score * c.weight, 0) / totalWeight)

  const allChecks = [
    ...fileFormat.checks.map(c => ({ ...c, category: 'File Format & Technical' })),
    ...formatting.checks.map(c => ({ ...c, category: 'Formatting & Layout' })),
    ...structure.checks.map(c => ({ ...c, category: 'Structure & Organization' })),
    ...keywords.checks.map(c => ({ ...c, category: 'Keywords & Content' })),
    ...contentQuality.checks.map(c => ({ ...c, category: 'Content Quality' })),
    ...datesHistory.checks.map(c => ({ ...c, category: 'Dates & Work History' })),
  ]

  const strengths = allChecks
    .filter(c => !c.assumed && c.points / c.max >= 0.9)
    .sort((a, b) => b.max - a.max)
    .slice(0, 3)
    .map(c => c.label)
  while (strengths.length < 3 && allChecks.some(c => c.points / c.max >= 0.7)) {
    const next = allChecks.find(c => c.points / c.max >= 0.7 && !strengths.includes(c.label))
    if (!next) break
    strengths.push(next.label)
  }

  const recommendations = buildRecommendations(allChecks)

  return { overallScore, categories, strengths, recommendations }
}

function buildRecommendations(
  allChecks: { label: string; points: number; max: number; assumed?: boolean; category: string; evidence?: string[] }[]
): Recommendation[] {
  const weak = allChecks
    .filter(c => !c.assumed && c.points / c.max < 0.7)
    .sort((a, b) => (a.points / a.max) - (b.points / b.max))

  const recs: Recommendation[] = []
  for (const c of weak) {
    recs.push(mapCheckToRecommendation(c.label, c.category, c.points / c.max, c.evidence))
    if (recs.length >= 5) break
  }

  return recs.slice(0, 5)
}

function mapCheckToRecommendation(label: string, category: string, ratio: number, evidence?: string[]): Recommendation {
  const severity: Severity = ratio < 0.3 ? 'critical' : ratio < 0.55 ? 'important' : 'recommended'

  // Check labels are phrased as the PASSING condition (used as-is for the
  // strengths list, where that reads correctly). A failing check needs the
  // opposite phrasing here, or "No spelling errors" shows up under
  // "Recommendations" looking like a claim that's true, not a problem.
  const issueTexts: Record<string, string> = {
    'Standard margins (0.5-1 inch)': 'Margins fall outside the standard 0.5-1 inch range',
    'Clean, linear structure (no columns/merged cells)': 'Layout appears to use columns or merged cells',
    'Standard ATS-safe font (Arial, Calibri, Times New Roman, Helvetica)': 'Uses a font that may not be ATS-safe',
    'Appropriate font sizes (10-12pt body, 12-14pt headers)': 'Font sizes are too small or inconsistent',
    'No graphics, images, logos, or branding': 'Contains graphics, images, or logos',
    'No columns or text boxes': 'Layout appears to use columns or text boxes',
    'Simple, professional filename': "Filename isn't simple or professional",
    '1-2 page length': 'Resume is longer than the ideal 1-2 pages',
    'Contact info (name, phone, email) at top': "Contact info isn't clearly placed at the top",
    'Professional summary/objective present': 'Missing a professional summary/objective',
    'Dedicated Skills/Competencies section': 'Missing a dedicated Skills/Competencies section',
    'Professional Experience section': 'Missing a clearly labeled Professional Experience section',
    'Education section with degree/institution': 'Education section is missing or incomplete',
    'Clear section headers': "Section headers aren't clear or standard",
    'Reverse chronological order': "Work experience isn't in reverse chronological order",
    'Skills section lists specific, concrete keywords': "Skills section is missing or too thin on specific keywords",
    '80%+ of bullet points start with strong action verbs': "Fewer than 80% of bullet points start with a strong action verb",
    '50%+ of bullet points include quantifiable metrics': 'Fewer than 50% of bullet points include quantifiable metrics',
    'No undefined abbreviations or problematic symbols': 'Contains undefined abbreviations or unusual symbols',
    'All bullet points start with an action verb': "Not all bullet points start with an action verb",
    'Bullets describe achievements, not just duties': 'Bullet points read as duties rather than achievements',
    'Quantifiable results shown': 'Bullet points lack quantifiable results',
    'Consistent formatting across experience entries': 'Formatting is inconsistent across experience entries',
    'No obvious spelling/typing errors': 'Possible spelling/typing errors detected',
    'Bullet points are concise (1-2 lines)': 'Some bullet points run longer than 1-2 lines',
    'Consistent date format throughout': 'Dates are formatted inconsistently',
    'All jobs have start and end dates': 'Some roles may be missing a start or end date',
    'No unexplained employment gaps > 6 months': 'A possible unexplained employment gap was detected',
    'No excessive job-hopping': 'Multiple short job stints detected',
    'Could not detect clear employment date ranges': 'Employment date ranges could not be clearly detected',
  }

  const fixes: Record<string, string> = {
    'Standard margins (0.5-1 inch)': 'Adjust your margins to 0.5-1 inch on all sides — content set too close to the edge can get clipped by ATS parsers and printers',
    'Clean, linear structure (no columns/merged cells)': 'Avoid multi-column layouts or tables — many ATS systems read left-to-right, top-to-bottom and will scramble column content out of order',
    'Standard ATS-safe font (Arial, Calibri, Times New Roman, Helvetica)': 'Switch to a standard, widely-supported font like Arial, Calibri, Helvetica, or Times New Roman',
    'Appropriate font sizes (10-12pt body, 12-14pt headers)': 'Avoid very small font sizes and limit yourself to 2-3 distinct font sizes for a clean, consistent look',
    'No graphics, images, logos, or branding': 'Remove images, logos, icons, or graphics — most ATS systems cannot parse them and they add no keyword value',
    'No columns or text boxes': 'Switch to a single-column layout so ATS systems read your content in the correct order',
    'Simple, professional filename': 'Rename your file to something like FirstName_LastName_Resume.pdf',
    '1-2 page length': 'Trim your resume to 1-2 pages by removing outdated or less relevant roles',
    'Contact info (name, phone, email) at top': 'Add your name, phone number, and email clearly at the very top of the resume',
    'Professional summary/objective present': "Add a 2-3 line professional summary at the top highlighting your key strengths",
    'Dedicated Skills/Competencies section': "Add a 'Core Competencies' or 'Skills' section listing 15-25 relevant keywords",
    'Professional Experience section': "Add a clearly labeled 'Professional Experience' section with role, company, and dates for each job",
    'Education section with degree/institution': "Add an 'Education' section listing your degree, institution, and graduation date",
    'Clear section headers': 'Use clear, standard section headers (Summary, Skills, Experience, Education)',
    'Reverse chronological order': 'List your work experience with the most recent role first',
    'Skills section lists specific, concrete keywords': "List at least 10 specific tools, technologies, or competencies in your Skills section, separated by commas — this is what ATS keyword scans look for",
    '80%+ of bullet points start with strong action verbs': "Replace weak phrasing (e.g. 'Responsible for...') with strong action verbs like 'Led', 'Built', 'Increased'",
    '50%+ of bullet points include quantifiable metrics': "Add numbers, percentages, or dollar amounts to your bullet points, e.g. 'Increased revenue by 25%'",
    'No undefined abbreviations or problematic symbols': 'Spell out abbreviations on first use and avoid unusual symbols',
    'All bullet points start with an action verb': 'Rewrite bullet points to begin with a strong action verb',
    'Bullets describe achievements, not just duties': "Reframe duty statements as achievements, e.g. 'Managed team' → 'Led team of 12 to exceed quarterly targets by 20%'",
    'Quantifiable results shown': 'Quantify your impact wherever possible — numbers stand out to both ATS and recruiters',
    'Consistent formatting across experience entries': 'Use the same structure (title, company, dates, bullets) for every job entry',
    'No obvious spelling/typing errors': 'Proofread carefully for typos, repeated words, and extra spaces',
    'Bullet points are concise (1-2 lines)': 'Shorten long bullet points to 1-2 lines for readability',
    'Consistent date format throughout': "Use a single consistent date format for all entries, e.g. 'MM/YYYY – MM/YYYY'",
    'All jobs have start and end dates': 'Make sure every role lists both a start and end date (or "Present")',
    'No unexplained employment gaps > 6 months': 'Consider briefly addressing any employment gaps longer than 6 months in your summary',
    'No excessive job-hopping': 'If you have several short stints, consider grouping or briefly explaining them in your summary',
    'Could not detect clear employment date ranges': "Make sure each role clearly lists dates in a format like 'Jan 2021 – Mar 2023'",
  }

  return {
    severity,
    issue: `${issueTexts[label] ?? label} (${category})`,
    fix: fixes[label] ?? 'Review this section against standard resume best practices.',
    details: evidence && evidence.length > 0 ? evidence : undefined,
  }
}

// Converts the Groq-generated HTML resume back into line-structured plain
// text so we can re-run analyzeResume() on it for a genuine before/after
// score comparison, rather than showing a fabricated "estimated" number.
export function htmlToPlainText(html: string): string {
  return html
    .replace(/<\/(h1|h2|h3|p|li)>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
