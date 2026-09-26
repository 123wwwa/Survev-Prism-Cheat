const observed = new WeakSet();

// Keep only a few structural summaries; never retain packets, names or tokens.
export function observeGameUpdates(game, reportError = console.error) {
    if (!game || observed.has(game) || typeof game.m_processGameUpdate !== 'function') return;
    observed.add(game);
    const report = { updates: 0, recent: [], failure: null };
    const snapshot = () => ({
        activeId: game.m_activeId,
        localId: game.m_localId,
        activePlayerFound: Boolean(game.m_activePlayer),
        playerCount: game.m_playerBarn?.playerPool?.m_pool?.length,
        objectCount: Object.keys(game.m_objectCreator?.m_idToObj ?? {}).length,
    });
    const original = game.m_processGameUpdate;
    game.m_processGameUpdate = function (msg, ...args) {
        report.updates++;
        if (report.failure) return Reflect.apply(original, this, [msg, ...args]);
        const summarize = objects => ({
            count: objects?.length ?? 0,
            sample: (objects ?? []).slice(0, 8).map(obj => ({ id: obj.__id, type: obj.__type })),
        });
        const entry = {
            update: report.updates,
            activeIdDirty: msg.activePlayerIdDirty,
            receivedActiveId: msg.activePlayerId,
            full: summarize(msg.fullObjects),
            partial: summarize(msg.partObjects),
            deletedCount: msg.delObjIds?.length ?? 0,
            before: snapshot(),
        };
        report.recent.push(entry);
        if (report.recent.length > 8) report.recent.shift();
        try {
            return Reflect.apply(original, this, [msg, ...args]);
        } catch (error) {
            entry.after = snapshot();
            report.failure = { message: String(error?.message ?? error), update: report.updates };
            reportError('[Injector] First game update failure (snapshot):', JSON.stringify(report));
            throw error;
        } finally {
            entry.after ??= snapshot();
        }
    };
    return report;
}
