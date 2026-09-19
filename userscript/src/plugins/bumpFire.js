import { inputCommands } from "../overrideInputs";


export function bumpFire(){
    unsafeWindow.game.m_inputBinds.isBindPressed = new Proxy( unsafeWindow.game.m_inputBinds.isBindPressed, {
        apply( target, thisArgs, args ) {
            if (args[0] === inputCommands.Fire) {
                return unsafeWindow.game.m_inputBinds.isBindDown(...args);
            }
            return Reflect.apply( ...arguments );
        }
    });
}
