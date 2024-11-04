import * as vscode from 'vscode';
import * as fs from 'fs'; 
import * as path from 'path';
import { Uri } from "vscode";
import { ConfigurationManager } from './configuration';

export class VcpkgInfoSideBarViewProvider implements vscode.WebviewViewProvider
{
	public readonly viewType = 'vcpkg.infoSidebarView';

	private _view?: vscode.WebviewView;

	constructor(
		private readonly _extensionUri: vscode.Uri,
		private readonly _extensionPath: string,
		private _configMgr: ConfigurationManager
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
				}
				break;
				case 'chooseVcpkgPath':
				{
					this._configMgr.chooseVcpkgPath().then(async result => {
						webviewView.webview.postMessage({ type: "setVcpkgPath", value: result});
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

export class DepNodeProvider implements vscode.TreeDataProvider<Dependency> {

	private _vcpkgPath: string;
	private _onDidChangeTreeData: vscode.EventEmitter<Dependency | undefined | void> = new vscode.EventEmitter<Dependency | undefined | void>();
	readonly onDidChangeTreeData: vscode.Event<Dependency | undefined | void> = this._onDidChangeTreeData.event;

	constructor(private workspaceRoot: string | undefined) {
		this._vcpkgPath = "";
	}

	public setVcpkgPath(path: string)
	{
		this._vcpkgPath = path;
	}

	refresh(): void {
		this._onDidChangeTreeData.fire();
	}

	getTreeItem(element: Dependency): vscode.TreeItem {
		return element;
	}

	// get dependency file path
	getChildren(element?: Dependency): Thenable<Dependency[]> {
		if (!this.workspaceRoot) {
			vscode.window.showInformationMessage('No dependency in empty workspace');
			return Promise.resolve([]);
		}

		if (vscode.window.activeTextEditor === undefined) {
			return Promise.resolve([]);
		}
		// get vcpkg.json in the current opened file folder
		let currentActive = vscode.window.activeTextEditor.document.fileName;
		currentActive = currentActive.slice(0, currentActive.lastIndexOf('/'));
		if (fs.existsSync(currentActive + '/vcpkg.json')) {
			return Promise.resolve(this.getDepsInPackageJson(currentActive + '/vcpkg.json'));
		}
		else
		{
			return Promise.resolve([]);
		}
	}

	private getDepsInPackageJson(packageJsonPath: string): Dependency[] {
		const workspaceRoot = this.workspaceRoot;
		if (this.pathExists(packageJsonPath) && workspaceRoot) {
			const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

			const toDep = (index: any, dependenciesArrary: Array<any>): Dependency => {
				let currentType = dependenciesArrary[index].constructor;
				let name, version;
				if (currentType === String) {
					name = dependenciesArrary[index];
					version = this.getDependencyVersion(name);
				}
				else if (currentType === Object) {
					name = dependenciesArrary[index].name;
					version = dependenciesArrary[index].version !== undefined ? dependenciesArrary[index].version : this.getDependencyVersion(name);
				}

				return new Dependency(name, version, vscode.TreeItemCollapsibleState.None, {
					command: 'vscode.openFolder',
					title: '',
					arguments: [Uri.file(this._vcpkgPath + "/ports/" + name + "/vcpkg.json")]
				});
			};

			const deps = packageJson.dependencies
				? Object.keys(packageJson.dependencies).map(dep => toDep(dep, packageJson.dependencies))
				: [];
			return deps;
		} else {
			return [];
		}
	}
	
	private getDependencyVersion(dependency: string)
	{
		const latestVersionFile = this._vcpkgPath + "/versions/baseline.json";
		if (fs.existsSync(latestVersionFile)) {
			const versionJson = JSON.parse(fs.readFileSync(latestVersionFile, 'utf-8'));
			return versionJson.default[dependency].baseline + "#" + versionJson.default[dependency]["port-version"];
		}
		else
		{
			return "undefined";
		}
	}

	private pathExists(p: string): boolean {
		try {
			fs.accessSync(p);
		} catch (err) {
			return false;
		}

		return true;
	}
}

export class Dependency extends vscode.TreeItem {

	constructor(
		public readonly label: string,
		private readonly version: string,
		public readonly collapsibleState: vscode.TreeItemCollapsibleState,
		public readonly command?: vscode.Command
	) {
		super(label, collapsibleState);

		this.tooltip = `${this.label}-${this.version}`;
		this.description = this.version;
	}

	iconPath = {
		light: path.join(__filename, '..', '..', 'media', 'dependency_light.svg'),
		dark: path.join(__filename, '..', '..', 'media', 'dependency_dark.svg')
	};

	contextValue = 'dependency';
}


export class VcpkgDebuggerSideBarViewProvider implements vscode.WebviewViewProvider
{
	public readonly viewType = 'vcpkg.debuggerSidebarView';

	private _view?: vscode.WebviewView;

	constructor(
		private readonly _extensionUri: vscode.Uri,
		private readonly _extensionPath: string
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
				case 'setDebuggerInfo':
				{
					data;
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
				<ul class="debug-options">
				</ul>
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