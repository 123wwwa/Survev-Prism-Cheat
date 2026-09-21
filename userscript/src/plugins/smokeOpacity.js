export function smokeOpacity(){
    console.log('smokeopacity')
    
    const particles = unsafeWindow.game.m_smokeBarn.m_particles;
    particles.push = new Proxy( particles.push, {
        apply( target, thisArgs, args ) {
            const particle = args[0];

            Object.defineProperty(particle.sprite, 'alpha', {
                get() {
                    return 0.12;
                },
                set(value) {
                }
            });

            return Reflect.apply( ...arguments );

        }
    });

    particles.forEach(particle => {
        Object.defineProperty(particle.sprite, 'alpha', {
            get() {
                return 0.12;
            },
            set(value) {
            }
        });
    });
}