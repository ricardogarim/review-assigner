import assert from 'node:assert/strict';
import { test } from 'node:test';

import { parseCodeowners, slotsFor, teamOf } from './codeowners';

const text = `
# comment
/packages/* @RocketChat/Architecture
/packages/rest-typings/ @RocketChat/Architecture @RocketChat/backend
/apps/meteor/client/ @RocketChat/frontend
/apps/meteor/server @RocketChat/backend
/apps/meteor/server/lib/omnichannel @RocketChat/omnichannel
apps/meteor/server/startup/migrations @RocketChat/Architecture
/docs/x.md @someone
`;
const rules = parseCodeowners(text);
const teams = (files: string[]) => slotsFor(rules, files).map((s) => s.teams);

test('teamOf turns an org team into its lowercase slug and keeps a user owner', () => {
	assert.equal(teamOf('@RocketChat/Architecture'), 'architecture');
	assert.equal(teamOf('@someone'), '@someone');
});

test('last matching line wins', () => {
	assert.deepEqual(teams(['apps/meteor/server/lib/omnichannel/a.ts']), [['omnichannel']]);
	assert.deepEqual(teams(['apps/meteor/server/methods/b.ts']), [['backend']]);
});

test('dir/* matches direct children only', () => {
	assert.deepEqual(teams(['packages/x/y.ts']), []);
	assert.deepEqual(teams(['packages/README.md']), [['architecture']]);
});

test('one slot per matched line, deduplicated', () => {
	assert.deepEqual(teams(['apps/meteor/client/a.tsx', 'apps/meteor/client/views/b.tsx']), [['frontend']]);
});

test('several owners on a line are one slot', () => {
	assert.deepEqual(teams(['packages/rest-typings/src/a.ts']), [['architecture', 'backend']]);
});

test('unowned files give no slot', () => {
	assert.deepEqual(teams(['yarn.lock', 'apps/meteor/app/x.ts']), []);
});

test('user owner is a one-person slot', () => {
	assert.deepEqual(teams(['docs/x.md']), [['@someone']]);
});

test('unanchored pattern matches anywhere under it', () => {
	assert.deepEqual(teams(['apps/meteor/server/startup/migrations/v1.ts']), [['architecture']]);
});

test('slot pattern is the CODEOWNERS pattern', () => {
	assert.deepEqual(slotsFor(rules, ['apps/meteor/client/a.tsx']), [{ pattern: '/apps/meteor/client/', teams: ['frontend'] }]);
});
