import * as vscode from 'vscode';
import {VcpkgLogMgr} from '../log';
import {VcpkgEventEmitter} from '../vcpkgEventEmitter';

export class VcpkgInfoSideBarViewProvider implements vscode.WebviewViewProvider
{
	public readonly viewType = 'vcpkg.infoSidebarView';

	private _view?: vscode.WebviewView;

	constructor(
		private readonly _extensionUri: vscode.Uri,
		private readonly _extensionPath: string,
		private _logMgr: VcpkgLogMgr,
		private _emitter: VcpkgEventEmitter
	) { 
        this.eventCallback = this.eventCallback.bind(this);
		this._emitter.registerListener("VcpkgInfoSideBarViewProvider", this.eventCallback);
	}

	public eventCallback(request: string, result: any)
	{
		switch (request) {
			case "setVcpkgPath":
			{
				if (this._view) {
					this._view.webview.postMessage({ type: "setVcpkgPath", value: result});
				}
			}
			break;
			case "setDefaultTriplet":
			{
				if (this._view) {
					this._view.webview.postMessage({ type: "setCurrentTriplet", triplets: result.triplets, value: result.current});
				}
			}
			break;
            case "setHostTriplet":
            {
				if (this._view) {
					this._view.webview.postMessage({ type: "setHostTriplet", triplets: result.triplets, value: result.current});
				}
            }
            break;
			case "setManifestMode":
			{
				if (this._view) {
					this._view.webview.postMessage({ type: "setManifestMode", result});
				}
			}
			break;
			default:
			{
				this._logMgr.logErr("CmakeDebugger eventCallback: received unrecognized message type: " + request);
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

			localResourceRoots: [
				this._extensionUri
			]
		};

		webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

		webviewView.webview.onDidReceiveMessage(data => {
			switch (data.type) {
				case 'queryVcpkgOptions':
				{
					this._emitter.fire("ConfigurationManager", "getVcpkgPathFromInfoSidebar", null);
					this._emitter.fire("ConfigurationManager", "getCurrentTripletFromInfoSidebar", null);
					this._emitter.fire("ConfigurationManager", "getHostTripletFromInfoSidebar", null);
					this._emitter.fire("ConfigurationManager", "getManifestModeFromInfoSidebar", null);
				}
				break;
				case 'setVcpkgOptions':
				{
					this._emitter.fire("ConfigurationManager", "setVcpkgPath", data.vcpkgPath);
					this._emitter.fire("ConfigurationManager", "setCurrentTriplet", data.hostTriplet);
					this._emitter.fire("ConfigurationManager", "setHostTriplet", data.currentTriplet);
					this._emitter.fire("ConfigurationManager", "setManifestMode", data.manifestMode);
					// this._emitter.fire("ConfigurationManager", "useLibType", data.manifestMode);
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