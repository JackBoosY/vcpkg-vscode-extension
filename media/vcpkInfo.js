//@ts-check

// This script will be run within the webview itself
// It cannot access the main VS Code APIs directly.
(function () {
    // @ts-ignore
    const vscode = acquireVsCodeApi();

    // @ts-ignore
    document.querySelector('.set-vcpkg-option-button').addEventListener('click', () => {
        vscode.postMessage({ type: "setVcpkgOptions", vcpkgPath: getVcpkgPath(), currentTriplet: getCurrentTriplet(), hostTriplet: getHostTriplet(), libType:getLibraryType(), manifestMode: getManifest() });
    });

    // Handle messages sent from the extension to the webview
    window.addEventListener('message', event => {
        const message = event.data; // The json data that the extension sent
        switch (message.type) {
            case 'setVcpkgPath':
                {
                    setVcpkgPath(message.value);
                    break;
                }
            case 'setCurrentTriplet':
                {
                    setCurrentTriplet(message.triplets, message.value);
                    break;
                }
            case 'setHostTriplet':
                {
                    setHostTriplet(message.triplets, message.value);
                    break;
                }
            case 'setLibraryType':
                {
                    setLibraryType(message.value);
                    break;
                }
            case 'setManifestMode':
                {
                    setManifest(message.value);
                    break;
                }
        }
    });

    vscode.postMessage({ type: "queryVcpkgOptions"});

    function setVcpkgPath(path) {
        const ul = document.querySelector('.vcpkg-path');
        const input = ul?.querySelector('input');
        if (input) {
            input.textContent = path;
        }
        else {
            const newInput = document.createElement('input');
            newInput.className = 'text-input';
            newInput.type = 'text';
            newInput.value = path;
            ul?.appendChild(newInput);
        }
    }

    function getVcpkgPath() {
        return document.querySelector('.vcpkg-path')?.querySelector('input')?.value;
    }

    function setCurrentTriplet(triplets, value) {
        const ul = document.querySelector('.current-triplet');
        const sel = ul?.querySelector('select');
        if (sel) {
            for (let index = 0; index < sel.size; index++) {
                const element = sel[index];
                if (value === element) {
                    sel.selectedIndex = index;
                    break;
                }
            }
        }
        else {
            const sel = document.createElement('select');
            let idx = 0;
            for (let index = 0; index < triplets.length; index++) {
                const current = document.createElement('option');
                current.contentEditable = "false";
                current.text = triplets[index].label;
                sel.appendChild(current);
                if (triplets[index].label === value) {
                    idx = index;
                }
            }
    
            sel.selectedIndex = idx;
            ul?.appendChild(sel);
        }
    }

    function getCurrentTriplet() {
        let sel = document.querySelector('.current-triplet')?.querySelector('select');
        return sel?.options[sel.selectedIndex].textContent;
    }

    function setHostTriplet(triplets, value) {
        const ul = document.querySelector('.host-triplet');
        const sel = ul?.querySelector('select');
        if (sel) {
            for (let index = 0; index < sel.size; index++) {
                const element = sel[index];
                if (value === element) {
                    sel.selectedIndex = index;
                    break;
                }
            }
        }
        else {
            const sel = document.createElement('select');
            let idx = 0;
            for (let index = 0; index < triplets.length; index++) {
                const current = document.createElement('option');
                current.contentEditable = "false";
                current.text = triplets[index].label;
                sel.appendChild(current);
                if (triplets[index].label === value) {
                    idx = index;
                }
            }
    
            sel.selectedIndex = idx;
            ul?.appendChild(sel);
        }
    }

    function getHostTriplet() {
        let sel = document.querySelector('.host-triplet')?.querySelector('select');
        return sel?.options[sel.selectedIndex].textContent;
    }

    function setLibraryType(type) {
        const ul = document.querySelector('.library-type');
        const sel = document.createElement('select');
        const triplet1 = document.createElement('option');
        triplet1.text = "dynamic";
        const triplet2 = document.createElement('option');
        triplet2.text = "static";
        sel.appendChild(triplet1);
        sel.appendChild(triplet2);
        sel.selectedIndex = 0;

        ul?.appendChild(sel);
    }

    function getLibraryType() {
        // 0 is dynamic and 1 is static; true should be static and false should be dynamic
        return document.querySelector('.library-type')?.querySelector('select')?.selectedIndex === 1;
    }

    function setManifest(mode) {
        const ul = document.querySelector('.manifest-mode');
        const sel = document.createElement('select');
        const triplet1 = document.createElement('option');
        triplet1.text = "true";
        const triplet2 = document.createElement('option');
        triplet2.text = "false";
        sel.appendChild(triplet1);
        sel.appendChild(triplet2);
        sel.selectedIndex = 1;

        ul?.appendChild(sel);
    }

    function getManifest() {
        // 0 is enabled and 1 is disabled
        return document.querySelector('.manifest-mode')?.querySelector('select')?.selectedIndex === 0;
    }

}());


