//@ts-check

// This script will be run within the webview itself
// It cannot access the main VS Code APIs directly.
(function () {
    // @ts-ignore
    const vscode = acquireVsCodeApi();
    let portName = "";

    // @ts-ignore
    document.querySelector('.set-debug-options-button').addEventListener('click', () => {
        setDebuggerInfo();
    });
    
    // Handle messages sent from the extension to the webview
    window.addEventListener('message', event => {
        const message = event.data; // The json data that the extension sent
        switch (message.type) {
            case 'updateDebugPortName':
                {
                    updateDebugPortName(message.name);
                }
            break;
            case 'restoreOptionsAndFeatures':
                {
                    restoreOptionsAndFeatures(message.options, message.features);
                }
            break;
        }
    });

    function initInfo() {
        const dbg = document.querySelector('.debug-options');
        // @ts-ignore
        dbg.textContent = "";
        const dbgLi = document.createElement('li');
        dbgLi.className = 'bg-entry';

        const dbgEdit = document.createElement('input');
        dbgEdit.className = 'text-input';
        dbgEdit.type = 'text';
        dbgLi.appendChild(dbgEdit);
        dbg?.appendChild(dbgLi);

        const ft = document.querySelector('.feature-options');
        // @ts-ignore
        ft.textContent = "";
        const ftLi = document.createElement('li');
        ftLi.className = 'bg-entry';

        const ftEdit = document.createElement('input');
        ftEdit.className = 'text-input';
        ftEdit.type = 'text';
        ftLi.appendChild(ftEdit);
        ft?.appendChild(ftLi);

        const port = document.querySelector('.debug-port-name');
        // @ts-ignore
        port.textContent = portName;
    }

    function updateDebugPortName(name) {

        const port = document.querySelector('.debug-port-name');
        // @ts-ignore
        port.textContent = name;
    }

    function restoreOptionsAndFeatures(options, features) {
        const db = document.querySelector('.debug-options');
        const dbg = db?.querySelector('li')?.querySelector('input');
        // @ts-ignore
        dbg.value = options;
        const ft = document.querySelector('.feature-options');
        const fts = ft?.querySelector('li')?.querySelector('input');
        // @ts-ignore
        fts.value = features;
    }

    function setDebuggerInfo() {
        const db = document.querySelector('.debug-options');
        const dbg = db?.querySelector('li')?.querySelector('input')?.value;
        const ft = document.querySelector('.feature-options');
        const fts = ft?.querySelector('li')?.querySelector('input')?.value;

        vscode.postMessage({ type: "setDebuggerInfo", debugger : dbg, features: fts });
    }

    // init window
    initInfo();
    // request old data
    vscode.postMessage({ type: "requestOptionsAndFeatures"});
    vscode.postMessage({ type: "portName"});
}());


