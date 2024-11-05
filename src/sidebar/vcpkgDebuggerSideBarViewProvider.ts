import * as vscode from 'vscode';
import * as fs from 'fs'; 
import * as path from 'path';
import { Uri } from "vscode";
import { VcpkgDebugger } from '../vcpkgDebugger';
import {VcpkgLogMgr} from '../log';

export class VcpkgDebuggerSideBarViewProvider implements vscode.WebviewViewProvider
{
	public readonly viewType = 'vcpkg.debuggerSidebarView';

	private _view?: vscode.WebviewView;
	private _options: string;
	private _features: string;

	constructor(
		private readonly _extensionUri: vscode.Uri,
		private readonly _extensionPath: string,
		private _debugger: VcpkgDebugger,
		private _logMgr: VcpkgLogMgr
	) { 
		this._options = "";
		this._features = "";
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

			localResourceRoots: [
				this._extensionUri
			]
		};

		webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

		webviewView.webview.onDidReceiveMessage(data => {
			switch (data.type) {
				case 'setDebuggerInfo':
				{
					this._logMgr.logInfo("VcpkgDebuggerSideBarViewProvider debugger: " + data.debugger + " features: " + data.features);
					this._options = data.debugger;
					this._features = data.features;
					// make sure the debugged port count is one.
					if (this._debugger.isDebugSinglePort()) {
						this._debugger.setExtraInstallOptions(data.debugger);
						this._debugger.setPortFeatures(data.features);
					}
				}
				break;
				case 'requestOptionsAndFeatures':
				{
					webviewView.webview.postMessage({ type: "restoreOptionsAndFeatures", options: this._options, features:this._features });
				}
				break;
			}
		});

		let portName = this._debugger.getModifiedPorts();
		webviewView.webview.postMessage({ type: "updateDebugPortName", name: portName});
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
				<text>("--debug" was set by default, seperator is empty space)</text>
				<ul class="debug-options">
				</ul>
				<text>Debug port name:</text>
				<ul class="debug-port-name">
				</ul>
				<text>Features:</text>
				<text>(seperator is comma)</text>
				<ul class="feature-options">
				</ul>

				<button class="set-debug-options-button">Set debug options</button>

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