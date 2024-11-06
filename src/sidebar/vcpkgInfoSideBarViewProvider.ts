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
				case 'queryVcpkgOptions':
				{
					const vcpkgPath = this._configMgr.getVcpkgRealPath();
					webviewView.webview.postMessage({ type: "setVcpkgPath", value: vcpkgPath});
					this._configMgr.getCurrentHostTriplet().then(async result => {
						const triplets = this._configMgr.getAllSupportedTriplets();
						webviewView.webview.postMessage({ type: "setHostTriplet", triplets: triplets, value: result});
					});
					this._configMgr.getCurrentTriplet().then(async result => {
						const triplets = this._configMgr.getAllSupportedTriplets();
						webviewView.webview.postMessage({ type: "setCurrentTriplet", triplets: triplets, value: result});
					});
					//this._configMgr.getLibType().then(async result => {
					//	webviewView.webview.postMessage({ type: "setLibraryType", value: result});
					//});
					this._configMgr.getManifestMode().then(async result => {
						webviewView.webview.postMessage({ type: "setManifestMode", value: result});
					});

				}
				break;
				case 'setVcpkgOptions':
				{
					this._configMgr.setVcpkgPath(data.vcpkgPath);
					this._configMgr.setHostTripletByString(data.hostTriplet);
					this._configMgr.setTargetTripletByString(data.currentTriplet);
					//this._configMgr.useLibType(data.libType);
					if (data.manifestMode) {
						this._configMgr.enableManifest();
					}
					else {
						this._configMgr.disableManifest();
					}
				}
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
				<text>Vcpkg Path</text>
				<br>
				<ul class="vcpkg-path">
				</ul>
				<text>Current Triplet</text>
				<br>
				<ul class="current-triplet">
				</ul>
				<text>Host Triplet</text>
				<br>
				<ul class="host-triplet">
				</ul>
				<text>Manifest Mode</text>
				<br>
				<ul class="manifest-mode">
				</ul>

				<button class="set-vcpkg-option-button">Apply</button>

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