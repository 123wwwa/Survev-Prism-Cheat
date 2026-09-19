export function obstacleOpacity(){
    unsafeWindow.game.m_map.m_obstaclePool.m_pool.forEach(obstacle => {
        if (!['bush', 'tree', 'table', 'stairs'].some(substring => obstacle.type.includes(substring))) return;
        obstacle.sprite.alpha = 0.45
    });
}
