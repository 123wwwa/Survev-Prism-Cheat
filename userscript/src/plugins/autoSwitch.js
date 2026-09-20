import { state } from '../vars.js';
import { inputs } from '../overrideInputs.js';
import { createAutoSwap } from '../autoSwap.js';

const update = createAutoSwap();
export function autoSwitch() {
    update(unsafeWindow.game, unsafeWindow.guns, state, inputs, performance.now());
}
