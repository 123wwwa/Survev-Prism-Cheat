let lastTime = Date.now();
let showing = false;
let timer = null;
export function grenadeTimer(){
    if (!(unsafeWindow.game?.m_connection && unsafeWindow.game?.m_activePlayer?.m_localData?.m_curWeapIdx != null && unsafeWindow.game?.m_activePlayer?.m_netData?.m_activeWeapon != null)) return; 

    try{
    let elapsed = (Date.now() - lastTime) / 1000;
    const player = unsafeWindow.game.m_activePlayer;
    const activeItem = player.m_netData.m_activeWeapon;

    if (3 !== unsafeWindow.game.m_activePlayer.m_localData.m_curWeapIdx 
        || player.throwableState !== "cook"
        || (!activeItem.includes('frag') && !activeItem.includes('mirv') && !activeItem.includes('martyr_nade'))
    )
        return (
            (showing = false),
            timer && timer.destroy(),
            (timer = false)
        );
    const time = 4;

    if(elapsed > time) {
        showing = false;
    }
    if(!showing) {
        if(timer) {
            timer.destroy();
        }
        timer = new unsafeWindow.pieTimerClass();
        unsafeWindow.game.m_pixi.stage.addChild(timer.container);
        timer.start("Grenade", 0, time);
        showing = true;
        lastTime = Date.now();
        return;
    }
    timer.update(elapsed - timer.elapsed, unsafeWindow.game.m_camera);
    }catch(err){
        console.error('grenadeTimer', err);
    }
}