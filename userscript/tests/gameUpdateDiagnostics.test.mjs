import test from 'node:test';
import assert from 'node:assert/strict';
import { observeGameUpdates } from '../src/gameUpdateDiagnostics.js';

test('diagnostics preserve receiver, arguments and return values and bound history', () => {
    const game = { m_processGameUpdate(msg, extra) { assert.equal(this, game); return extra; } };
    const report = observeGameUpdates(game);
    assert.equal(observeGameUpdates(game), undefined);
    for (let i = 0; i < 20; i++) assert.equal(game.m_processGameUpdate({}, 42), 42);
    assert.equal(report.updates, 20);
    assert.equal(report.recent.length, 8);
});

test('first failure is recorded once and the original error is rethrown', () => {
    const error = new TypeError('missing player');
    const logs = [];
    const game = { m_processGameUpdate() { throw error; } };
    const report = observeGameUpdates(game, (...args) => logs.push(args));
    const msg = { fullObjects: [{ __id: 9, __type: 1, name: 'private' }] };
    assert.throws(() => game.m_processGameUpdate(msg), value => value === error);
    assert.throws(() => game.m_processGameUpdate(msg), value => value === error);
    assert.equal(logs.length, 1);
    assert.equal(report.failure.update, 1);
    assert.equal(report.recent[0].full.sample[0].id, 9);
    assert.ok(!JSON.stringify(report).includes('private'));
});
