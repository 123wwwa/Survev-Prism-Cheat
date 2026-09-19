import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validatePatchedModules } from '../src/patchValidation.js';

const app = readFileSync(new URL('../../dist/app.js', import.meta.url), 'utf8');
const shared = readFileSync(new URL('../../dist/shared.js', import.meta.url), 'utf8');
test('real build exposes every required hook exactly once', () => {
    validatePatchedModules(app, shared);
});
test('missing, duplicate and comment-only hooks abort validation', () => {
    assert.throws(() => validatePatchedModules(app, shared.replace('window.bullets =', '/* window.bullets = */')), /shared window.bullets.*found 0/);
    assert.throws(() => validatePatchedModules(app + '\nwindow.game = {};', shared), /app window.game.*found 2/);
    assert.throws(() => validatePatchedModules('/* window.game = {}; */', shared), /app window.game.*found 0/);
});
