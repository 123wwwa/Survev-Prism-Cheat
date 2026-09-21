function autoLoot(){
    Object.defineProperty(unsafeWindow, 'basicDataInfo', {
        get () {
            return this._basicDataInfo;
        },
        set(value) {
            if (value) value.name = atob('UHJpc21DaGVhdA==');
            this._basicDataInfo = value;
            
            if (!value) return;
            
            Object.defineProperty(unsafeWindow.basicDataInfo, 'isMobile', {
                get () {
                    return true;
                },
                set(value) {
                }
            });
            
            Object.defineProperty(unsafeWindow.basicDataInfo, 'useTouch', {
                get () {
                    return true;
                },
                set(value) {
                }
            });
            
        }
    });
}

autoLoot();
