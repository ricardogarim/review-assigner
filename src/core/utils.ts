export const sameLogin = (a: string | undefined, b: string): boolean => a?.toLowerCase() === b.toLowerCase();

export const unique = <T>(items: T[]): T[] => [...new Set(items)];

export const today = (): string => new Date().toISOString().slice(0, 10);
