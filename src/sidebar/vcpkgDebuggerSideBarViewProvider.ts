import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { Uri } from 'vscode';
import { VcpkgLogMgr } from '../log';
import { VcpkgEventEmitter, VcpkgEventPayloads } from '../vcpkgEventEmitter';
import { VcpkgDebugger } from '../vcpkgDebugger';

export class VcpkgDebuggerSideBarViewProvider implements vscode.WebviewViewProvider {
    public readonly viewType = 'vcpkg.debuggerSidebarView';

    private _view?: vscode.WebviewView;
    private _options: string[];
    private _features: string[];

    constructor(
        private readonly _extensionUri: vscode.Uri,
        private readonly _extensionPath: string,
        private _logMgr: VcpkgLogMgr,
        private _emitter: VcpkgEventEmitter,
    ) {
        this.eventCallback = this.eventCallback.bind(this);
        this._emitter.registerListener('VcpkgDebuggerSideBarViewProvider', this.eventCallback);
        this._options = [];
        this._features = [];
    }

    public eventCallback<K extends keyof VcpkgEventPayloads>(request: K, result: VcpkgEventPayloads[K]) {
        switch (request) {
            case 'getDebugPortName':
                {
                    if (this._view) {
                        this._view.webview.postMessage({ type: 'updateDebugPortName', name: result as string });
                    }
                }
                break;
            case 'setInstallOptions':
                {
                    if (typeof result === 'object' && result !== null && 'options' in result && 'features' in result) {
                        this._options = result.options as string[];
                        this._features = result.features as string[];
                        if (this._view) {
                            this._view.webview.postMessage({
                                type: 'restoreOptionsAndFeatures',
                                options: this._options,
                                features: this._features,
                            });
                        }
                    }
                }
                break;
            default:
                {
                    this._logMgr.logErr('CmakeDebugger eventCallback: received unrecognized message type: ' + request);
                }
                break;
        }
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            // Allow scripts in the webview
            enableScripts: true,

            localResourceRoots: [this._extensionUri],
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        webviewView.webview.onDidReceiveMessage((data) => {
            switch (data.type) {
                case 'setDebuggerInfo':
                    {
                        const options = data.debugger as string[];
                        const features = data.features as string[];
                        this._logMgr.logInfo(
                            'VcpkgDebuggerSideBarViewProvider debugger: ' +
                                options.join(' ') +
                                ' features: ' +
                                features.join(','),
                        );
                        this._options = options;
                        this._features = features;
                        // make sure the debugged port count is one.
                        this._emitter.fire('VcpkgDebugger', 'setInstallOptions', options);
                        this._emitter.fire('VcpkgDebugger', 'setPortFeatures', features);
                    }
                    break;
                case 'requestOptionsAndFeatures':
                    {
                        this._emitter.fire('VcpkgDebugger', 'getInstallOptions', null);
                    }
                    break;
                case 'portName':
                    {
                        this._emitter.fire('VcpkgDebugger', 'getDebugPortName', null);
                    }
                    break;
            }
        });
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        // Get the local path to main script run in the webview, then convert it to a uri we can use in the webview.
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'debuggerInfo.js'));

        // Do the same for the stylesheet.
        const styleResetUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'reset.css'));
        const styleVSCodeUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'vscode.css'));
        const styleMainUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'main.css'));

        // Use a nonce to only allow a specific script to be run.
        const nonce = this.getNonce();

        return `<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">

				<!--
					Use a content security policy to only allow loading styles from our extension directory,
					and only allow scripts that have a specific nonce.
					(See the 'webview-sample' extension sample for img-src content security policy examples)
				-->
				<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">

				<meta name="viewport" content="width=device-width, initial-scale=1.0">

				<link href="${styleResetUri}" rel="stylesheet">
				<link href="${styleVSCodeUri}" rel="stylesheet">
				<link href="${styleMainUri}" rel="stylesheet">

				<title>Vcpkg Settings</title>
			</head>
			<body>
				<text>Debug Options:</text>
				<br>
				<text>("--editable" was set by default)</text>
				<ul class="debug-options">
				</ul>
				<br>
				<text>Debug port name:</text>
				<ul class="debug-port-name">
				</ul>
				<br>
				<text>Features:</text>
				<br>
				<ul class="feature-options">
				</ul>

				<script nonce="${nonce}" src="${scriptUri}"></script>
			</body>
			</html>`;
    }

    private getNonce() {
        let text = '';
        const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        for (let i = 0; i < 32; i++) {
            text += possible.charAt(Math.floor(Math.random() * possible.length));
        }
        return text;
    }
}
