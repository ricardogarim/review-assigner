export type PrRef = { repo: string; number: number } | { unwatched: string };

export function parsePrRef(arg: string | undefined, repos: string[]): PrRef | undefined {
	const bare = arg?.match(/^#?(\d+)$/);
	if (bare) {
		return { repo: repos[0], number: Number(bare[1]) };
	}
	const match = arg?.match(/github\.com\/([^/\s]+\/[^/\s]+)\/pull\/(\d+)/) ?? arg?.match(/^([\w.-]+(?:\/[\w.-]+)?)#(\d+)$/);
	if (!match) {
		return undefined;
	}
	const name = match[1].toLowerCase();
	const repo = repos.find((r) => r.toLowerCase() === name || r.split('/')[1].toLowerCase() === name);
	return repo ? { repo, number: Number(match[2]) } : { unwatched: match[1] };
}
