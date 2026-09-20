import { activePanDefense } from '../src/panDefense.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile, readdir } from 'node:fs/promises';
import { parse } from 'acorn';

const src = new URL('../src/', import.meta.url);
async function loadModule(file, context) {
    const code = await readFile(new URL(file, src), 'utf8');
    const ast = parse(code, { ecmaVersion: 'latest', sourceType: 'module' });
    const edits = ast.body.flatMap(node => node.type === 'ImportDeclaration' ? [{ start: node.start, end: node.end }] :
        node.type === 'ExportNamedDeclaration' && node.declaration ? [{ start: node.start, end: node.declaration.start }] : []);
    let executable = code;
    for (const edit of edits.reverse()) executable = executable.slice(0, edit.start) + executable.slice(edit.end);
    vm.runInContext(executable, context);
}
function walk(node, visit) {
    if (!node?.type) return;
    visit(node);
    for (const value of Object.values(node)) {
        if (Array.isArray(value)) value.forEach(item => walk(item, visit));
        else if (value?.type) walk(value, visit);
    }
}

test('every direct game property used by the userscript exists in the current unminified Game class', async () => {
    const code = await readFile(new URL('../../dist/app.js', import.meta.url), 'utf8');
    const ast = parse(code, { ecmaVersion: 'latest', sourceType: 'module' });
    let gameClass;
    walk(ast, node => { if (node.type === 'VariableDeclarator' && node.id.name === 'Game') gameClass = node.init; });
    assert.ok(gameClass);
    const properties = new Set();
    walk(gameClass, node => {
        if (node.type === 'PropertyDefinition' || node.type === 'MethodDefinition') properties.add(node.key.name);
        if (node.type === 'MemberExpression' && node.object.type === 'ThisExpression' && !node.computed) properties.add(node.property.name);
    });
    const files = [...(await readdir(src)).filter(n => n.endsWith('.js')),
        ...(await readdir(new URL('plugins/', src))).filter(n => n.endsWith('.js')).map(n => `plugins/${n}`)];
    let checked = 0;
    for (const file of files) {
        const script = parse(await readFile(new URL(file, src), 'utf8'), { ecmaVersion: 'latest', sourceType: 'module' });
        walk(script, node => {
            if (node.type === 'MemberExpression' && !node.computed && node.object.type === 'MemberExpression' && node.object.property.name === 'game') {
                assert.ok(properties.has(node.property.name), `${file}: unknown game.${node.property.name}`);
                checked++;
            }
        });
    }
    assert.ok(checked > 50);
});

test('team and weapon lookups work with only current m_ player data', async () => {
    const context = vm.createContext({ activePanDefense, state: {}, unsafeWindow: {
        game: { m_playerBarn: { teamInfo: { red: { playerIds: [7] } } } },
        guns: { mp5: { bulletType: 'bullet_mp5' } }, bullets: { bullet_mp5: { speed: 85 } },
    } });
    await loadModule('utils.js', context);
    assert.equal(context.getTeam({ __id: 7 }), 'red');
    assert.equal(context.findBullet(context.findWeap({ m_netData: { m_activeWeapon: 'mp5' } })).speed, 85);
});

test('input override reads m_touch, m_inputBinds and m_localData and returns the original input message', async () => {
    const context = vm.createContext({ activePanDefense, state: {}, unsafeWindow: {
        innerWidth: 100, innerHeight: 100, lastAimPos: { clientX: 70, clientY: 60 },
        game: { m_touch: { shotDetected: true }, m_inputBinds: { isBindDown: () => false },
            m_activePlayer: { m_localData: { m_curWeapIdx: 0 } } },
    } });
    await loadModule('overrideInputs.js', context);
    const message = { touchMoveActive: true, toMouseDir: { x: 0, y: 0 }, addInput() {} };
    assert.equal(context.unsafeWindow.initGameControls(message), message);
    assert.ok(Number.isFinite(message.toMouseDir.x) && message.toMouseDir.x !== 0);
    assert.equal(message.toMouseLen, 18);
});

test('zoom hooks target real m_zoom and m_targetZoom descriptors', async () => {
    const camera = { m_zoom: 1.5, m_targetZoom: 1.5 };
    const context = vm.createContext({ state: { isZoomEnabled: true }, unsafeWindow: { game: {
        m_camera: camera, m_activePlayer: { m_localData: { m_scope: '1xscope', m_inventory: {} } },
    } } });
    await loadModule('plugins/betterZoom.js', context);
    context.betterZoom();
    camera.m_targetZoom = 1.5;
    assert.equal(camera.m_zoom, 1.05);
    assert.equal(Object.hasOwn(camera, 'zoom'), false);
    assert.equal(Object.hasOwn(camera, 'targetZoom'), false);
});
