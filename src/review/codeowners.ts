import type { Slot } from '../core/types';

export type Rule = {
	pattern: string;
	owners: string[];
};

export function parseCodeowners(text: string): Rule[] {
	const rules: Rule[] = [];
	for (const raw of text.split('\n')) {
		const line = raw.replace(/#.*$/, '').trim();
		if (!line) {
			continue;
		}
		const [pattern, ...owners] = line.split(/\s+/);
		rules.push({ pattern, owners });
	}
	return rules;
}

export function teamOf(owner: string): string {
	const slash = owner.indexOf('/');
	return slash === -1 ? owner : owner.slice(slash + 1).toLowerCase();
}

function globToRegExp(glob: string): RegExp {
	const part = (text: string) =>
		text
			.replace(/[.+^${}()|[\]\\]/g, '\\$&')
			.replace(/\*/g, '[^/]*')
			.replace(/\?/g, '[^/]');
	return new RegExp(`^${glob.split('**').map(part).join('.*')}(/.*)?$`);
}

function matches(pattern: string, file: string): boolean {
	const path = pattern.replace(/^\//, '');
	if (path.endsWith('/*')) {
		const dir = path.slice(0, -2);
		return file.startsWith(`${dir}/`) && !file.slice(dir.length + 1).includes('/');
	}
	const prefix = path.replace(/\/$/, '');
	if (prefix.includes('*') || prefix.includes('?')) {
		return globToRegExp(prefix).test(file);
	}
	return file === prefix || file.startsWith(`${prefix}/`);
}

export function slotsFor(rules: Rule[], files: string[]): Slot[] {
	const slots = new Map<string, Slot>();
	for (const file of files) {
		const owner = [...rules].reverse().find((rule) => matches(rule.pattern, file));
		if (!owner || slots.has(owner.pattern)) {
			continue;
		}
		if (owner.owners.length) {
			slots.set(owner.pattern, { pattern: owner.pattern, teams: owner.owners.map(teamOf) });
		}
	}
	return [...slots.values()];
}
