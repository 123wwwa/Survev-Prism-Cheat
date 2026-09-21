function alertMsgAndcleanPage() {
    const notSupportedHtml = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Unsupported Tampermonkey Environment</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    max-width: 800px;
                    margin: 60px auto;
                    padding: 0 24px;
                    line-height: 1.6;
                }

                h2 {
                    margin-bottom: 8px;
                }

                .warning {
                    font-weight: bold;
                    margin-bottom: 24px;
                }

                li {
                    margin: 12px 0;
                }

                a {
                    color: #0066cc;
                }
            </style>
        </head>
        <body>
            <h2>Download and install</h2>

            <p class="warning">
                Requires a Manifest V2 (MV2) extension environment.
                Firefox is recommended.
            </p>

            <ol>
                <li>
                    Download and install
                    <a href="https://www.mozilla.org/en-US/firefox/new/"
                       target="_blank"
                       rel="noopener noreferrer">
                        Firefox
                    </a>.
                </li>

                <li>
                    Open Firefox and install
                    <a href="https://addons.mozilla.org/en-US/firefox/addon/tampermonkey/"
                       target="_blank"
                       rel="noopener noreferrer">
                        Tampermonkey for Firefox
                    </a>.
                </li>

                <li>
                    Visit
                    <a href="${__INJECTOR_INSTALL_URL__}"
                       target="_blank"
                       rel="noopener noreferrer">
                        Project installation page
                    </a>,
                    click <strong>Install this script</strong>,
                    and confirm installation in Tampermonkey.
                </li>
            </ol>
        </body>
        </html>
    `;

    const alertMessage =
        'This userscript requires a Manifest V2 (MV2) extension environment. ' +
        'Firefox is recommended. See the installation instructions on the page.';

    unsafeWindow.stop();

    document.open();
    document.write(notSupportedHtml);
    document.close();

    alert(alertMessage);
}

if (typeof GM_info !== 'undefined' && GM_info.scriptHandler === 'Tampermonkey') {
    if (
        GM_info.version <= '5.1.1' ||
        GM_info.userAgentData?.brands?.[0]?.brand === 'Firefox'
    ) {
        console.log('The script is launched at Tampermonkey Legacy');
    } else {
        alertMsgAndcleanPage();
    }
} else {
    console.log('The script is not launched at Tampermonkey');
    alertMsgAndcleanPage();
}
