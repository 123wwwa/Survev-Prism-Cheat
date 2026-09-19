import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findMatches, patchValidationReport, resetPatchValidationReport } from '../scripts/patch-validation.mjs';

test('counts from zero without mutating a reusable regex and records failures', () => {
    resetPatchValidationReport();
    const pattern = /hook/g;
    pattern.lastIndex = 4;
    assert.equal(findMatches('hook', { name: 'hook', pattern, expectedMatches: 1 }).length, 1);
    assert.equal(pattern.lastIndex, 4);
    for (const input of ['', 'hook hook']) assert.throws(() => findMatches(input, { name: 'hook', pattern, expectedMatches: 1 }));
    assert.deepEqual(patchValidationReport.map(row => [row.status, row.actualMatches]), [['OK', 1], ['FAIL', 0], ['FAIL', 2]]);
    resetPatchValidationReport();
    assert.equal(patchValidationReport.length, 0);
});
