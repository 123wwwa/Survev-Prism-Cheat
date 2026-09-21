import { version } from "./constants";


const newFeaturesKey = `newFeaturesShown_${version}`;
const newFeaturesShown = GM_getValue(newFeaturesKey, false);

if (!newFeaturesShown) {
    const message = `
        <strong style="font-size:20px;display:block;">Survev Prism Cheat v${version}</strong><br>
        Loads patched app and shared modules from jsDelivr.<br>
        Open the settings menu with TAB.<br>
    `;

    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.75)';
    overlay.style.zIndex = '999';

    const notification = document.createElement('div');
    notification.innerHTML = message;
    notification.style.position = 'fixed';
    notification.style.top = '50%';
    notification.style.left = '50%';
    notification.style.transform = 'translate(-50%, -50%)';
    notification.style.backgroundColor = 'rgb(20, 20, 20)';
    notification.style.color = '#fff';
    notification.style.padding = '20px';
    notification.style.boxShadow = '0 0 10px rgba(0, 0, 0, 0.5)';
    notification.style.zIndex = '1000';
    notification.style.borderRadius = '10px';
    notification.style.maxWidth = '500px';
    notification.style.width = '80%';
    notification.style.textAlign = 'center';
    notification.style.fontSize = '17px';
    notification.style.overflow = 'auto';
    notification.style.maxHeight = '90%';
    notification.style.margin = '10px';


    const closeButton = document.createElement('button');
    closeButton.textContent = 'Close';
    closeButton.style.margin = '20px auto 0 auto';
    closeButton.style.padding = '10px 20px';
    closeButton.style.border = 'none';
    closeButton.style.backgroundColor = '#007bff';
    closeButton.style.color = '#fff';
    closeButton.style.borderRadius = '5px';
    closeButton.style.cursor = 'pointer';
    closeButton.style.display = 'block';

    closeButton.addEventListener('click', () => {
        document.body.removeChild(notification);
        document.body.removeChild(overlay);
        GM_setValue(newFeaturesKey, true);
    });

    notification.appendChild(closeButton);
    document.body.appendChild(overlay);
    document.body.appendChild(notification);
}