// helper d'assemblage de classes (équivalent minimal de clsx)
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}