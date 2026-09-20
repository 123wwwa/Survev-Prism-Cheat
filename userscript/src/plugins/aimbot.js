import { panBlocks, blockingCover, targetScore } from '../combatLogic.js';
import { observeMotion } from './combatAssist.js';
import { position, angleFromMouse, clearShot } from '../aimGeometry.js';
import { state } from '../vars.js';
import { getTeam } from '../utils.js';
import { updateOverlay, aimbotDot } from '../overlay.js';
import { findBullet, findWeap } from '../utils.js';


export function clearAim() {
    unsafeWindow.lastAimPos = null;
    unsafeWindow.aimTouchMoveDir = null;
    unsafeWindow.aimTouchDistanceToEnemy = null;
    state.enemyAimBot = null;
    state.coverTarget = null;
    aimbotDot.style.display = 'none';
}

export function aimBot() {
    const game = unsafeWindow.game;
    const me = game?.m_activePlayer;
    if (!state.isAimBotEnabled || state.isMenuOpen || me?.m_localData?.m_curWeapIdx === 3 || !me?.active || me.m_netData?.m_dead) { clearAim(); return; }
    try {
        const players = game.m_playerBarn.playerPool.m_pool;
        const obstacles = game.m_map.m_obstaclePool.m_pool;
        const meTeam = getTeam(me);
        const origin = game.m_camera.m_pointToScreen(position(me.m_pos));
        const mouse = position(game.m_input.mousePos);
        const halfAngle = state.aimConeDegrees / 2;
        const gun=findWeap(me), bullet=findBullet(gun);
        const covers=new Map();
        const eligible = player => {
            if (!player?.active || player.m_netData.m_dead ||
                (!state.isAimAtKnockedOutEnabled && player.downed) ||
                me.__id === player.__id || me.layer !== player.layer ||
                (meTeam != null && getTeam(player) === meTeam) ||
                state.friends.includes(player.nameText?._text)) return Infinity;
            const angle = angleFromMouse(origin, mouse, game.m_camera.m_pointToScreen(position(player.m_pos)));
            if(angle>halfAngle) return Infinity;
            const start=position(me.m_pos), end=position(player.m_pos);
            if(state.isPanAvoidanceEnabled && panBlocks(start,end,player)) return Infinity;
            const blockers=blockingCover(start,end,me.layer,obstacles);
            if(!blockers) return Infinity;
            if(blockers.length){
                if(!state.isCoverBreakEnabled || !gun || !bullet || blockers.length!==1) return Infinity;
                const cover=blockers[0], def=unsafeWindow.objects?.[cover.type];
                // Do not aim at explosive, indestructible or unknown-health cover.
                const damage=bullet.damage*(bullet.obstacleDamage||1);
                const hp=def?.health*cover.healthT;
                if(!cover.destructible || def?.explosion || !Number.isFinite(hp) || hp<=0 || damage<=0 || Math.ceil(hp/damage)>state.coverShotLimit) return Infinity;
                covers.set(player,cover);
            }
            return targetScore({angle,range:Math.hypot(end.x-start.x,end.y-start.y),gun,bullet,
                threat:state.isThreatPriorityEnabled,weaponAware:state.isWeaponAwareEnabled,me,enemy:player,
                velocity:state.isThreatPriorityEnabled?observeMotion(player):null}) + (blockers.length?20:0);
        };
        let enemy = null;
        let best = Infinity;
        if (state.focusedEnemy && Number.isFinite(eligible(state.focusedEnemy))) enemy = state.focusedEnemy;
        else {
            if (state.focusedEnemy) { state.focusedEnemy = null; updateOverlay(); }
            for (const player of players) {
                const angle = eligible(player);
                if (angle < best) { best = angle; enemy = player; }
            }
        }
        if (!enemy) { clearAim(); return; }
        if (enemy !== state.enemyAimBot) { state.enemyAimBot = enemy; state.lastFrames[enemy.__id] = []; }
        state.coverTarget=covers.get(enemy)||null;
        const predicted = state.coverTarget ? position(state.coverTarget.pos) : calculatePredictedPosForShoot(enemy, me);
        // Check the predicted shot as well: leading a moving player can cross cover.
        const screen = predicted && game.m_camera.m_pointToScreen(predicted);
        if (!screen || angleFromMouse(origin, mouse, screen) > halfAngle ||
            !clearShot(position(me.m_pos), predicted, me.layer, obstacles.filter(o=>o!==state.coverTarget)) ||
            (!state.coverTarget && state.isPanAvoidanceEnabled && panBlocks(position(me.m_pos),predicted,enemy))) { clearAim(); return; }
        unsafeWindow.lastAimPos = { clientX: screen.x, clientY: screen.y };
        const distance = Math.hypot(me.m_pos._x - enemy.m_pos._x, me.m_pos._y - enemy.m_pos._y);
        if (state.isMeleeAttackEnabled && !state.coverTarget && distance <= 8) {
            const angle = calcAngle(enemy.m_pos, me.m_pos) + Math.PI;
            unsafeWindow.aimTouchMoveDir = { x: Math.cos(angle), y: Math.sin(angle) };
            unsafeWindow.aimTouchDistanceToEnemy = distance;
        } else {
            unsafeWindow.aimTouchMoveDir = null;
            unsafeWindow.aimTouchDistanceToEnemy = null;
        }
        aimbotDot.style.left = screen.x + 'px';
        aimbotDot.style.top = screen.y + 'px';
        aimbotDot.className = state.coverTarget ? 'aimbotDot cover' : 'aimbotDot tracking';
        aimbotDot.style.display = 'block';
    } catch (error) {
        clearAim();
        console.error('Error in aimBot:', error);
    }
}

export function aimBotToggle(){
    state.isAimBotEnabled = !state.isAimBotEnabled;
    if (state.isAimBotEnabled) return;

    clearAim();
}

export function meleeAttackToggle(){
    state.isMeleeAttackEnabled = !state.isMeleeAttackEnabled;
    if (state.isMeleeAttackEnabled) return;

    unsafeWindow.aimTouchMoveDir = null;
}

function calculatePredictedPosForShoot(enemy, curPlayer) {
    if (!enemy || !curPlayer) {
        console.log("Missing enemy or player data");
        return null;
    }
    
    const { m_pos: enemyPos } = enemy;
    const { m_pos: curPlayerPos } = curPlayer;

    const dateNow = performance.now();

    if ( !(enemy.__id in state.lastFrames) ) state.lastFrames[enemy.__id] = [];
    state.lastFrames[enemy.__id].push([dateNow, { ...enemyPos }]);

    if (state.lastFrames[enemy.__id].length < 30) {
        console.log("Insufficient data for prediction, using current position");
        return position(enemyPos);
    }

    if (state.lastFrames[enemy.__id].length > 30){
        state.lastFrames[enemy.__id].shift();
    }

    const deltaTime = (dateNow - state.lastFrames[enemy.__id][0][0]) / 1000; // Time since last frame in seconds

    const enemyVelocity = {
        x: (enemyPos._x - state.lastFrames[enemy.__id][0][1]._x) / deltaTime,
        y: (enemyPos._y - state.lastFrames[enemy.__id][0][1]._y) / deltaTime,
    };

    const weapon = findWeap(curPlayer);
    const bullet = findBullet(weapon);

    let bulletSpeed;
    if (!bullet) {
        bulletSpeed = 1000;
    }else{
        bulletSpeed = bullet.speed;
    }


    // Quadratic equation for time prediction
    const vex = enemyVelocity.x;
    const vey = enemyVelocity.y;
    const dx = enemyPos._x - curPlayerPos._x;
    const dy = enemyPos._y - curPlayerPos._y;
    const vb = bulletSpeed;

    const a = vb ** 2 - vex ** 2 - vey ** 2;
    const b = -2 * (vex * dx + vey * dy);
    const c = -(dx ** 2) - (dy ** 2);

    let t; 

    if (Math.abs(a) < 1e-6) {
        console.log('Linear solution bullet speed is much greater than velocity')
        t = -c / b;
    } else {
        const discriminant = b ** 2 - 4 * a * c;

        if (discriminant < 0) {
            console.log("No solution, shooting at current position");
            return position(enemyPos);
        }

        const sqrtD = Math.sqrt(discriminant);
        const t1 = (-b - sqrtD) / (2 * a);
        const t2 = (-b + sqrtD) / (2 * a);

        t = Math.min(t1, t2) > 0 ? Math.min(t1, t2) : Math.max(t1, t2);
    }


    if (!Number.isFinite(t) || t < 0) {
        console.log("Negative time, shooting at current position");
        return position(enemyPos);
    }

    // console.log(`A bullet with the enemy will collide through ${t}`)

    const predictedPos = {
        x: enemyPos._x + vex * t,
        y: enemyPos._y + vey * t,
    };

    return predictedPos;
}

function calcAngle(playerPos, mePos){
    const dx = mePos._x - playerPos._x;
    const dy = mePos._y - playerPos._y;

    return Math.atan2(dy, dx);
}
