// @ts-nocheck

// This script will be run within the webview itself
// It cannot access the main VS Code APIs directly.
(function () {
    const vscode = acquireVsCodeApi();
    let portName = "";

    document.querySelector('.set-debug-options-button').addEventListener('click', () => {
        setDebuggerInfo();
    });
    
    // Handle messages sent from the extension to the webview
    window.addEventListener('message', event => {
        const message = event.data; // The json data that the extension sent
        switch (message.type) {
            case 'updateDebugPortName':
                {
                    updateDebugPortName(message.value);
                }
        }
    });

    function initInfo() {
        const dbg = document.querySelector('.debug-options');
        dbg.textContent = "";
        const dbg_li = document.createElement('li');
        dbg_li.className = 'color-entry';

        const dbgEdit = document.createElement('input');
        dbgEdit.className = 'color-input';
        dbgEdit.type = 'text';
        dbg_li.appendChild(dbgEdit);
        dbg?.appendChild(dbg_li);

        const ft = document.querySelector('.feature-options');
        ft.textContent = "";
        const ft_li = document.createElement('li');
        ft_li.className = 'color-entry';

        const ftEdit = document.createElement('input');
        ftEdit.className = 'color-input';
        ftEdit.type = 'text';
        ft_li.appendChild(ftEdit);
        ft?.appendChild(ft_li);

        const port = document.querySelector('.debug-port-name');
        port.textContent = portName;
    }

    function updateDebugPortName(name) {

        const port = document.querySelector('.debug-port-name');
        port.textContent = name;
    }

    function setDebuggerInfo() {
        const db = document.querySelector('.debug-options');
        const dbg = db?.querySelector('li')?.querySelector('input')?.value;
        const ft = document.querySelector('.feature-options');
        const fts = ft?.querySelector('li')?.querySelector('input')?.value;
        vscode.postMessage({ type: "setDebuggerInfo", debugger : dbg, features: fts });
    }


    initInfo();
}());


