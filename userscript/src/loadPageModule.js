// Import in the page's module realm, not the userscript manager's sandbox.
// A string event detail also crosses Firefox's sandbox boundary safely.
export async function loadPageModule(url) {
    const eventName = `prism-module-${crypto.randomUUID()}`;
    const wrapper = `
try {
    await import(${JSON.stringify(url)});
    document.dispatchEvent(new CustomEvent(${JSON.stringify(eventName)}, { detail: JSON.stringify({ ok: true }) }));
} catch (error) {
    console.error('[Injector] Page module import failed:', error);
    document.dispatchEvent(new CustomEvent(${JSON.stringify(eventName)}, {
        detail: JSON.stringify({ ok: false, message: String(error?.message ?? error), stack: String(error?.stack ?? '') })
    }));
}`;
    const wrapperURL = URL.createObjectURL(new Blob([wrapper], { type: 'application/javascript' }));
    const script = document.createElement('script');
    let timer;
    let onResult;
    let onPolicy;
    let policyFailure = '';
    try {
        await new Promise((resolve, reject) => {
            onResult = event => {
                try {
                    const result = JSON.parse(event.detail);
                    if (result.ok) resolve();
                    else reject(new Error(`Page module import failed: ${result.message}\n${result.stack}`));
                } catch (error) { reject(error); }
            };
            onPolicy = event => {
                if (event.blockedURI === 'blob' || event.blockedURI?.startsWith('blob:')) {
                    policyFailure = ` CSP: ${event.effectiveDirective} blocked ${event.blockedURI}.`;
                    console.error('[Injector] Blob blocked by CSP:', event.effectiveDirective, event.blockedURI);
                }
            };
            document.addEventListener(eventName, onResult);
            document.addEventListener('securitypolicyviolation', onPolicy);
            script.type = 'module';
            script.src = wrapperURL;
            script.onerror = () => reject(new Error(`Page module diagnostic wrapper failed to load.${policyFailure} No import error was received.`));
            timer = setTimeout(() => reject(new Error(`Page module import timed out after 30 seconds.${policyFailure}`)), 30000);
            document.head.append(script);
        });
    } finally {
        clearTimeout(timer);
        document.removeEventListener(eventName, onResult);
        document.removeEventListener('securitypolicyviolation', onPolicy);
        script.remove();
        URL.revokeObjectURL(wrapperURL);
    }
}
