export const position = p => ({ x: p?._x ?? p?.x, y: p?._y ?? p?.y });
const finite = p => Number.isFinite(p?.x) && Number.isFinite(p?.y);

export function angleFromMouse(origin, mouse, target) {
    if (![origin, mouse, target].every(finite)) return Infinity;
    const ax = mouse.x - origin.x, ay = mouse.y - origin.y;
    const bx = target.x - origin.x, by = target.y - origin.y;
    const length = Math.hypot(ax, ay) * Math.hypot(bx, by);
    if (length < 1e-8) return Infinity;
    return Math.acos(Math.max(-1, Math.min(1, (ax * bx + ay * by) / length))) * 180 / Math.PI;
}

// Obstacles already expose transformed world-space circles or axis-aligned boxes.
export function intersectsSegment(a, b, collider) {
    if (!finite(a) || !finite(b) || !collider) return true;
    const dx = b.x - a.x, dy = b.y - a.y;
    if (collider.type === 0) {
        if (!finite(collider.pos) || !Number.isFinite(collider.rad)) return true;
        const length2 = dx * dx + dy * dy;
        const t = length2 ? Math.max(0, Math.min(1, ((collider.pos.x - a.x) * dx + (collider.pos.y - a.y) * dy) / length2)) : 0;
        return Math.hypot(a.x + dx * t - collider.pos.x, a.y + dy * t - collider.pos.y) <= collider.rad;
    }
    if (collider.type === 1 && finite(collider.min) && finite(collider.max)) {
        let near = 0, far = 1;
        for (const axis of ['x', 'y']) {
            const delta = b[axis] - a[axis];
            if (Math.abs(delta) < 1e-10) {
                if (a[axis] < collider.min[axis] || a[axis] > collider.max[axis]) return false;
            } else {
                const t1 = (collider.min[axis] - a[axis]) / delta;
                const t2 = (collider.max[axis] - a[axis]) / delta;
                near = Math.max(near, Math.min(t1, t2));
                far = Math.min(far, Math.max(t1, t2));
                if (near > far) return false;
            }
        }
        return true;
    }
    return true;
}

export function clearShot(a, b, layer, obstacles) {
    if (!Array.isArray(obstacles) || !finite(a) || !finite(b)) return false;
    return !obstacles.some(o => o.active && !o.dead &&
        ((o.layer & 1) === (layer & 1) || (o.layer & 2 && layer & 2)) &&
        o.height >= 0.25 && intersectsSegment(a, b, o.collider));
}
