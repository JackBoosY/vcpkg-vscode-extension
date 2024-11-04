//@ts-check

// This script will be run within the webview itself
// It cannot access the main VS Code APIs directly.
(function () {
    const vscode = acquireVsCodeApi();

    let vcpkgPath = "";

    document.querySelector('.set-vcpkg-path-button').addEventListener('click', () => {
        vscode.postMessage({ type: "chooseVcpkgPath" });
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
            case 'updateVcpkgPath':
                {
                    setVcpkgPath(message.value);
                }
        }
    });

    vscode.postMessage({ type: "updateVcpkgPath"});

    /**
     * @param {string} path
     */
    function updateVcpkgPath(path) {
        const ul = document.querySelector('.vcpkg-path');
        ul.textContent = path;

        // Update the saved state
        vscode.setState({ vcpkgPath: path });
    }

    function setVcpkgPath(path) {
        if (path === "" || path === null) {
            const ul = document.querySelector('.vcpkg-path');
            path = ul.textContent;
        }
        updateVcpkgPath(path);
    }
}());


