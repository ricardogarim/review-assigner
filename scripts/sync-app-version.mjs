// Rocket.Chat reads the app version from app.json; changesets only bumps package.json.
import { readFileSync, writeFileSync } from 'node:fs';

const { version } = JSON.parse(readFileSync('package.json', 'utf8'));
const app = JSON.parse(readFileSync('app.json', 'utf8'));
if (app.version !== version) {
	app.version = version;
	writeFileSync('app.json', `${JSON.stringify(app, null, 2)}\n`);
	console.log(`app.json version → ${version}`);
}
