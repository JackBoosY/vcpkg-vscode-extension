import * as vscode from 'vscode';
import { ConfigurationManager } from '../configuration';
import {VcpkgLogMgr} from '../log';

export class VcpkgInfoSideBarViewProvider implements vscode.WebviewViewProvider
{
	public readonly viewType = 'vcpkg.infoSidebarView';

	private _view?: vscode.WebviewView;

	constructor(
		private readonly _extensionUri: vscode.Uri,
		private readonly _extensionPath: string,
		private _configMgr: ConfigurationManager,
		private _logMgr: VcpkgLogMgr
	) { }

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
				case 'updateVcpkgPath':
				{
					const vcpkgPath = this._configMgr.getVcpkgRealPath();
					webviewView.webview.postMessage({ type: "setVcpkgPath", value: vcpkgPath});
					this._logMgr.logInfo("VcpkgInfoSideBarViewProvider getVcpkgPath: " + vcpkgPath);
				}
				break;
				case 'chooseVcpkgPath':
				{
					this._configMgr.chooseAndUpdateVcpkgPath().then(async result => {
						if (result.length) {
							webviewView.webview.postMessage({ type: "setVcpkgPath", value: result});
							this._logMgr.logInfo("VcpkgInfoSideBarViewProvider setVcpkgPath: " + result);
						}
					});
				}
				case 'setVcpkgPath':
				{
				}
				break;
			}
		});
	}

	private _getHtmlForWebview(webview: vscode.Webview) {
		// Get the local path to main script run in the webview, then convert it to a uri we can use in the webview.
		const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'vcpkInfo.js'));

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
				<ul class="vcpkg-path">
				</ul>

				<button class="set-vcpkg-path-button">Set Vcpkg Path</button>

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