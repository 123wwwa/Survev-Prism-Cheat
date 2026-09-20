import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addLicenseNotice } from '../scripts/license-notice.mjs';
test('prepends provenance without altering imports, code or existing notices', () => {
  const code = '/* third-party notice */\nimport { x } from "./hash.js";\nexport { x };';
  const options = { upstreamCommit: 'a'.repeat(40), modifiedAt: '2026-09-20T12:00:00.000Z' };
  const result = addLicenseNotice(code, options);
  assert.ok(result.startsWith('/*!\n * SPDX-License-Identifier: GPL-3.0-or-later'));
  assert.ok(result.includes(options.upstreamCommit));
  assert.ok(result.includes(options.modifiedAt));
  assert.equal(result.slice(result.indexOf(' */\n') + 4), code);
  assert.throws(() => addLicenseNotice(code, { ...options, upstreamCommit: '*/' }));
  assert.throws(() => addLicenseNotice(code, { ...options, modifiedAt: 'invalid' }));
});
