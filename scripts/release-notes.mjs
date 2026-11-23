// Prints the CHANGELOG.md section of one version, for the GitHub release body.
import { readFileSync } from 'node:fs';

const version = process.argv[2];
const changelog = readFileSync('CHANGELOG.md', 'utf8');
const start = changelog.indexOf(`## ${version}`);
if (start === -1) {
	console.log(`Release ${version}`);
} else {
	const next = changelog.indexOf('\n## ', start + 1);
	console.log(changelog.slice(start, next === -1 ? undefined : next).trim());
}
