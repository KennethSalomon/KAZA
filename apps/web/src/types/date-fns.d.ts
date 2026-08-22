declare module 'date-fns' {
  export function format(date: Date | number | string, formatStr: string, options?: { locale?: unknown }): string;
  export function parseISO(argument: string): Date;
  export function subDays(date: Date | number, amount: number): Date;
  export function addDays(date: Date | number, amount: number): Date;
  export function isBefore(date: Date | number, dateToCompare: Date | number): boolean;
  export function isAfter(date: Date | number, dateToCompare: Date | number): boolean;
  export function startOfDay(date: Date | number): Date;
  export function endOfDay(date: Date | number): Date;
  export function differenceInDays(dateLeft: Date | number, dateRight: Date | number): number;
  export function isSameDay(dateLeft: Date | number, dateRight: Date | number): boolean;
  export function formatDistance(date: Date | number, baseDate: Date | number, options?: { addSuffix?: boolean; locale?: unknown }): string;
  export function parse(dateString: string, formatString: string, referenceDate?: Date | number, options?: { locale?: unknown }): Date;
}

declare module 'date-fns/locale' {
  export const fr: { code: string; formatDistance: unknown; formatLong: unknown; formatRelative: unknown; match: unknown };
  export const frSN: { code: string; formatDistance: unknown; formatLong: unknown; formatRelative: unknown; match: unknown };
}
