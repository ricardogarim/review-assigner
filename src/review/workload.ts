import { prLabel } from '../card/labels';
import type { PrRecord, Reviewer } from '../core/types';

const DAY = 24 * 60 * 60 * 1000;

const STATUS: Record<Reviewer['status'], string> = {
	pending: '',
	approved: 'approved',
	changes_requested: 'changes requested',
	commented: 'commented',
};

type Row = { name: string; away: boolean; prs: string[] };

function prEntry(record: PrRecord, reviewer: Reviewer, now: number): string {
	const notes = [STATUS[reviewer.status], record.requestedAt ? `${Math.floor((now - record.requestedAt) / DAY)}d` : ''].filter(Boolean);
	return `[${prLabel(record.repo, record.number)}](${record.url})${notes.length ? ` (${notes.join(', ')})` : ''}`;
}

export function workloadText(records: PrRecord[], notAvailable: string[], now: number): string {
	const rows = new Map<string, Row>();
	for (const record of records) {
		if (record.state !== 'open') {
			continue;
		}
		for (const reviewer of record.reviewers) {
			if (reviewer.status === 'approved') {
				continue;
			}
			const login = reviewer.ghLogin?.toLowerCase();
			const key = login ?? `rc:${reviewer.rcUserId}`;
			const row = rows.get(key) ?? {
				name: reviewer.rcUsername ?? reviewer.ghLogin ?? '',
				away: !!login && notAvailable.includes(login),
				prs: [],
			};
			row.prs.push(prEntry(record, reviewer, now));
			rows.set(key, row);
		}
	}
	if (!rows.size) {
		return 'No open reviews.';
	}
	const lines = [...rows.values()]
		.sort((a, b) => b.prs.length - a.prs.length || a.name.localeCompare(b.name))
		.map((row) => `*${row.name}*${row.away ? ' (out of office)' : ''}: ${row.prs.length} · ${row.prs.join(', ')}`);
	return ['Open reviews, counting only PRs sent with `/review`:', ...lines].join('\n');
}
