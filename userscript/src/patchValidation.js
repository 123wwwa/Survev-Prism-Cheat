import { parse } from 'acorn';
import { validateMatches } from '../../scripts/patch-validation.mjs';

const specs = [
    ...['game', 'basicDataInfo', 'pieTimerClass'].map(name => ({ module: 'app', name, type: 'AssignmentExpression', expectedMatches: 1 })),
    ...['mapColorizing', 'initGameControls'].map(name => ({ module: 'app', name, type: 'CallExpression', expectedMatches: 1 })),
    ...['bullets', 'explosions', 'guns', 'throwable', 'objects'].map(name => ({ module: 'shared', name, type: 'AssignmentExpression', expectedMatches: 1 })),
];

// Inspect executable syntax, so comments and strings cannot satisfy a check.
export function validatePatchedModules(app, shared) {
    const nodes = {};
    for (const [name, code] of Object.entries({ app, shared })) {
        nodes[name] = [];
        const pending = [parse(code, { ecmaVersion: 'latest', sourceType: 'module' })];
        while (pending.length) {
            const node = pending.pop();
            nodes[name].push(node);
            for (const value of Object.values(node)) {
                if (Array.isArray(value)) pending.push(...value.filter(item => item?.type));
                else if (value?.type) pending.push(value);
            }
        }
    }
    const errors = [];
    for (const spec of specs) {
        const matches = nodes[spec.module].filter(node => {
            if (node.type !== spec.type || (node.type === 'AssignmentExpression' && node.operator !== '=')) return false;
            const member = node.left || node.callee;
            return member?.type === 'MemberExpression' && member.object?.name === 'window' &&
                (member.computed ? member.property.value : member.property.name) === spec.name;
        });
        try { validateMatches(matches, { ...spec, name: `${spec.module} window.${spec.name}` }); }
        catch (error) { errors.push(error.message); }
    }
    if (errors.length) throw new Error(`Patched module validation failed:\n${errors.join('\n')}`);
}
