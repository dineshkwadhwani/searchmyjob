const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_RE = /^[+\d][\d\s()-]{6,}$/

export function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim())
}

export function isValidPhone(value: string): boolean {
  return PHONE_RE.test(value.trim())
}

export function isValidDate(value: string): boolean {
  if (!value) return true
  return !isNaN(new Date(value).getTime())
}

export function isValidNumber(value: string | number | undefined): boolean {
  if (value === undefined || value === '') return true
  return !isNaN(Number(value))
}
