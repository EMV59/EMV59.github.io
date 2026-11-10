/**
 * Small shared helpers used by several classes.
 * Kept in a separate file so that the class files stay focused on the domain.
 */

/** Thrown when an object would be created or changed with invalid data. */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

/** Throws if the string is empty or contains only spaces. Returns the value unchanged. */
export function requireNonEmpty(value: string, field: string): string {
  if (value.trim() === '') {
    throw new ValidationError(`${field} must not be empty`);
  }
  return value;
}

/** Throws unless the value is a finite number greater than zero. */
export function requirePositive(value: number, field: string): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new ValidationError(`${field} must be a positive number, got ${value}`);
  }
  return value;
}

/** Rounds to 2 decimal places: 86.666… → 86.67. */
export function roundTo2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** `2026-10-05T…` → `'2026-10-05'`. */
export function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
