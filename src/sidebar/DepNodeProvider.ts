import * as vscode from 'vscode';
import * as fs from 'fs'; 
import * as path from 'path';
import { Uri } from "vscode";

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
		if (process.platform === "win32") {
			currentActive = currentActive.slice(0, currentActive.lastIndexOf('\\'));
		}
		else
		{
			currentActive = currentActive.slice(0, currentActive.lastIndexOf('/'));
		}
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
