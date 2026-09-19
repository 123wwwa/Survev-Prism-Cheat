import { getTeam } from '../utils.js';
import { state } from '../vars.js';
import { RED, GREEN, BLUE, WHITE } from '../constants.js';
import { findBullet, findWeap } from '../utils.js';
import { inputCommands } from '../overrideInputs.js';


export function esp(){
    const pixi = unsafeWindow.game.m_pixi; 
    const me = unsafeWindow.game.m_activePlayer;
    const players = unsafeWindow.game.m_playerBarn.playerPool.m_pool;

    // We check if there is an object of Pixi, otherwise we create a new
    if (!pixi || me?.container == undefined) {
        // console.error("PIXI object not found in game.");
        return;
    }

    const meX = me.m_pos.x;
    const meY = me.m_pos.y;

    const meTeam = getTeam(me);
    
    try{

    // lineDrawer
    const lineDrawer = me.container.lineDrawer;
    try{lineDrawer.clear()}
    catch{if(!unsafeWindow.game?.m_connection || unsafeWindow.game?.m_activePlayer?.m_netData?.m_dead) return;}
    if (state.isLineDrawerEnabled){

        if (!me.container.lineDrawer) {
            me.container.lineDrawer = new PIXI.Graphics();
            me.container.addChild(me.container.lineDrawer);
        }
            
        // For each player
        players.forEach((player) => {
            // We miss inactive or dead players
            if (!player.active || player.m_netData.m_dead || me.__id == player.__id) return;
    
            const playerX = player.m_pos.x;
            const playerY = player.m_pos.y;
    
            const playerTeam = getTeam(player);
    
            // We calculate the color of the line (for example, red for enemies)
            const lineColor = playerTeam === meTeam ? BLUE : state.friends.includes(player.nameText._text) ? GREEN : me.layer === player.layer && (state.isAimAtKnockedOutEnabled || !player.downed) ? RED : WHITE;
    
            // We draw a line from the current player to another player
            lineDrawer.lineStyle(2, lineColor, 1);
            lineDrawer.moveTo(0, 0); // Container Container Center
            lineDrawer.lineTo(
                (playerX - meX) * 16,
                (meY - playerY) * 16
            );
        });
    }

    // nadeDrawer
    const nadeDrawer = me.container.nadeDrawer;
    try{nadeDrawer?.clear()}
    catch{if(!unsafeWindow.game?.m_connection || unsafeWindow.game?.m_activePlayer?.m_netData?.m_dead) return;}
    if (state.isNadeDrawerEnabled){
        if (!me.container.nadeDrawer) {
            me.container.nadeDrawer = new PIXI.Graphics();
            me.container.addChild(me.container.nadeDrawer);
        }
    
        Object.values(unsafeWindow.game.m_objectCreator.m_idToObj)
            .filter(obj => {
                const isValid = ( obj.__type === 9 && obj.type !== "smoke" )
                    ||  (
                            obj.smokeEmitter &&
                            unsafeWindow.objects[obj.type].explosion);
                return isValid;
            })
            .forEach(obj => {
                if(obj.layer !== me.layer) {
                    nadeDrawer.beginFill(0xffffff, 0.3);
                } else {
                    nadeDrawer.beginFill(0xff0000, 0.2);
                }
                nadeDrawer.drawCircle(
                    (obj.pos.x - meX) * 16,
                    (meY - obj.pos.y) * 16,
                    (unsafeWindow.explosions[
                        unsafeWindow.throwable[obj.type]?.explosionType ||
                        unsafeWindow.objects[obj.type].explosion
                            ].rad.max +
                        1) *
                    16
                );
                nadeDrawer.endFill();
            });
    }

    // flashlightDrawer(laserDrawer)
    const laserDrawer = me.container.laserDrawer;
    try{laserDrawer.clear()}
    catch{if(!unsafeWindow.game?.m_connection || unsafeWindow.game?.m_activePlayer?.m_netData?.m_dead) return;}
    if (state.isLaserDrawerEnabled) {
        const curWeapon = findWeap(me);
        const curBullet = findBullet(curWeapon);
        
        if ( !me.container.laserDrawer ) {
            me.container.laserDrawer = new PIXI.Graphics();
            me.container.addChildAt(me.container.laserDrawer, 0);
        }
    
        function laserPointer(
            curBullet,
            curWeapon,
            acPlayer,
            color = 0x0000ff,
            opacity = 0.3,
        ) {
            const { m_pos: acPlayerPos, m_posOld: acPlayerPosOld } = acPlayer;
    
            const dateNow = performance.now();
    
            if ( !(acPlayer.__id in state.lastFrames) ) state.lastFrames[acPlayer.__id] = [];
            state.lastFrames[acPlayer.__id].push([dateNow, { ...acPlayerPos }]);
    
            if (state.lastFrames[acPlayer.__id].length < 30) return;
    
            if (state.lastFrames[acPlayer.__id].length > 30){
                state.lastFrames[acPlayer.__id].shift();
            }
    
            const deltaTime = (dateNow - state.lastFrames[acPlayer.__id][0][0]) / 1000; // Time since last frame in seconds
    
            const acPlayerVelocity = {
                x: (acPlayerPos._x - state.lastFrames[acPlayer.__id][0][1]._x) / deltaTime,
                y: (acPlayerPos._y - state.lastFrames[acPlayer.__id][0][1]._y) / deltaTime,
            };
    
            let lasic = {};
        
            let isMoving = !!(acPlayerVelocity.x || acPlayerVelocity.y);
        
            if(curBullet) {
                lasic.active = true;
                lasic.range = curBullet.distance * 16.25;
                let atan;
                if (acPlayer == me && ( !(unsafeWindow.lastAimPos) || (unsafeWindow.lastAimPos) && !(unsafeWindow.game.m_touch.shotDetected || unsafeWindow.game.m_inputBinds.isBindDown(inputCommands.Fire)) ) ){
                    //local rotation
                    atan = Math.atan2(
                        unsafeWindow.game.m_input.mousePos._y - unsafeWindow.innerHeight / 2,
                        unsafeWindow.game.m_input.mousePos._x - unsafeWindow.innerWidth / 2,
                    );
                }else if(acPlayer == me && (unsafeWindow.lastAimPos) && ( unsafeWindow.game.m_touch.shotDetected || unsafeWindow.game.m_inputBinds.isBindDown(inputCommands.Fire) ) ){
                    const playerPointToScreen = unsafeWindow.game.m_camera.m_pointToScreen({x: acPlayer.m_pos._x, y: acPlayer.m_pos._y})
                    atan = Math.atan2(
                        playerPointToScreen.y - unsafeWindow.lastAimPos.clientY,
                        playerPointToScreen.x - unsafeWindow.lastAimPos.clientX
                    ) 
                    -
                    Math.PI;
                }else{
                    atan = Math.atan2(
                        acPlayer.m_dir.x,
                        acPlayer.m_dir.y
                    ) 
                    -
                    Math.PI / 2;
                }
                lasic.direction = atan;
                lasic.angle =
                    ((curWeapon.shotSpread +
                        (isMoving ? curWeapon.moveSpread : 0)) *
                        0.01745329252) /
                    2;
            } else {
                lasic.active = false;
            }
        
            if(!lasic.active) {
                return;
            }
    
            const center = {
                x: (acPlayerPos._x - me.m_pos._x) * 16,
                y: (me.m_pos._y - acPlayerPos._y) * 16,
            };
            const radius = lasic.range;
            let angleFrom = lasic.direction - lasic.angle;
            let angleTo = lasic.direction + lasic.angle;
            angleFrom =
                angleFrom > Math.PI * 2
                    ? angleFrom - Math.PI * 2
                    : angleFrom < 0
                    ? angleFrom + Math.PI * 2
                    : angleFrom;
            angleTo =
                angleTo > Math.PI * 2
                    ? angleTo - Math.PI * 2
                    : angleTo < 0
                    ? angleTo + Math.PI * 2
                    : angleTo;
            laserDrawer.beginFill(color, opacity);
            laserDrawer.moveTo(center.x, center.y);
            laserDrawer.arc(center.x, center.y, radius, angleFrom, angleTo);
            laserDrawer.lineTo(center.x, center.y);
            laserDrawer.endFill();
        }
        
        
        laserPointer(
            curBullet,
            curWeapon,
            me,
        );
        
        players
            .filter(player => player.active && !player.m_netData.m_dead && me.__id !== player.__id && me.layer === player.layer && getTeam(player) != meTeam)
            .forEach(enemy => {
                const enemyWeapon = findWeap(enemy);
                laserPointer(
                    findBullet(enemyWeapon),
                    enemyWeapon,
                    enemy,
                    "0",
                    0.2,
                )
            });
    };

    }catch(err){
        // console.error('esp', err);
    }
}