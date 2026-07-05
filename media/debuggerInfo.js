//@ts-check

// This script will be run within the webview itself
// It cannot access the main VS Code APIs directly.
(function () {
    // @ts-ignore
    const vscode = acquireVsCodeApi();
    let portName = "";
    
    /** @type {ReturnType<typeof setTimeout> | null} */
    let setDebuggerInfoTimeout = null;
    function scheduleSetDebuggerInfo() {
        if (setDebuggerInfoTimeout) {
            clearTimeout(setDebuggerInfoTimeout);
        }
        setDebuggerInfoTimeout = setTimeout(() => {
            setDebuggerInfo();
        }, 300);
    }

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

    /**
     * @param {Element} listContainer
     * @param {string} value
     */
    function createRow(listContainer, value = "") {
        const li = document.createElement('li');
        li.className = 'bg-entry';

        const input = document.createElement('input');
        input.className = 'text-input';
        input.type = 'text';
        input.value = value;

        const addButton = document.createElement('div');
        addButton.className = 'row-button add-button';
        addButton.textContent = '+';

        const removeButton = document.createElement('div');
        removeButton.className = 'row-button remove-button';
        removeButton.textContent = '-';

        li.appendChild(input);
        li.appendChild(addButton);
        li.appendChild(removeButton);
        listContainer.appendChild(li);

        input.addEventListener('input', () => {
            const isLastRow = li === listContainer.lastElementChild;
            if (isLastRow) {
                if (input.value.trim() !== "") {
                    li.classList.add('show-add');
                } else {
                    li.classList.remove('show-add');
                }
            }
        });

        input.addEventListener('change', () => {
            scheduleSetDebuggerInfo();
        });

        addButton.addEventListener('click', () => {
            if (input.value.trim() === "") { return; } // Prevent adding if empty
            li.classList.remove('show-add');
            createRow(listContainer, "");
            scheduleSetDebuggerInfo();
        });

        removeButton.addEventListener('click', () => {
            if (listContainer.children.length > 1) {
                listContainer.removeChild(li);
                scheduleSetDebuggerInfo();
            }
        });
    }

    function initInfo() {
        const dbg = document.querySelector('.debug-options');
        if (dbg) {
            dbg.textContent = "";
            createRow(dbg);
        }

        const ft = document.querySelector('.feature-options');
        if (ft) {
            ft.textContent = "";
            createRow(ft);
        }

        const port = document.querySelector('.debug-port-name');
        if (port) {
            port.textContent = portName;
        }
    }

    /**
     * @param {string} name
     */
    function updateDebugPortName(name) {
        const port = document.querySelector('.debug-port-name');
        if (port) {
            port.textContent = name;
        }
    }

    /**
     * @param {string[] | string} options
     * @param {string[] | string} features
     */
    function restoreOptionsAndFeatures(options, features) {
        const db = document.querySelector('.debug-options');
        if (db) {
            db.textContent = "";
            const optionsArray = Array.isArray(options) ? options : (options ? [options] : []);
            optionsArray.forEach(opt => createRow(db, opt));
            createRow(db); // Always add an empty one at the bottom
        }

        const ft = document.querySelector('.feature-options');
        if (ft) {
            ft.textContent = "";
            const featuresArray = Array.isArray(features) ? features : (features ? [features] : []);
            featuresArray.forEach(f => createRow(ft, f));
            createRow(ft); // Always add an empty one at the bottom
        }
    }

    function setDebuggerInfo() {
        const db = document.querySelector('.debug-options');
        const ft = document.querySelector('.feature-options');

        /**
         * @param {Element | null} container
         */
        const getValues = (container) => {
            /** @type {string[]} */
            const values = [];
            if (!container) { return values; }
            const inputs = container.querySelectorAll('input');
            inputs.forEach((/** @type {HTMLInputElement} */ input) => {
                if (input.value.trim() !== "") {
                    values.push(input.value.trim());
                }
            });
            return values;
        };

        const debuggerOptions = getValues(db);
        const features = getValues(ft);

        vscode.postMessage({ type: "setDebuggerInfo", debugger: debuggerOptions, features: features });
    }

    // init window
    initInfo();
    // request old data
    vscode.postMessage({ type: "requestOptionsAndFeatures"});
    vscode.postMessage({ type: "portName"});
}());
