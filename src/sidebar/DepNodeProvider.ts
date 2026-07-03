import { TextDecoder } from "util";

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { Uri } from 'vscode';

export class DepNodeProvider implements vscode.TreeDataProvider<Dependency> {
    private _vcpkgPath: string;
    private _onDidChangeTreeData: vscode.EventEmitter<Dependency | undefined | void> = new vscode.EventEmitter<
        Dependency | undefined | void
    >();
    readonly onDidChangeTreeData: vscode.Event<Dependency | undefined | void> = this._onDidChangeTreeData.event;

    constructor(private workspaceRoot: string | undefined) {
        this._vcpkgPath = '';
    }

    public setVcpkgPath(path: string) {
        this._vcpkgPath = path;
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: Dependency): vscode.TreeItem {
        return element;
    }

    // get dependency file path
    async getChildren(element?: Dependency): Promise<Dependency[]> {
        if (!this.workspaceRoot) {
            vscode.window.showInformationMessage('No dependency in empty workspace');
            return [];
        }

        if (vscode.window.activeTextEditor === undefined) {
            return [];
        }
        // get vcpkg.json in the current opened file folder
        let currentActive = vscode.window.activeTextEditor.document.fileName;
        if (process.platform === 'win32') {
            currentActive = currentActive.slice(0, currentActive.lastIndexOf('\\'));
        } else {
            currentActive = currentActive.slice(0, currentActive.lastIndexOf('/'));
        }
        
        try {
            await vscode.workspace.fs.stat(vscode.Uri.file(currentActive + '/vcpkg.json'));
            return await this.getDepsInPackageJson(currentActive + '/vcpkg.json');
        } catch {
            return [];
        }
    }

    private async getDepsInPackageJson(packageJsonPath: string): Promise<Dependency[]> {
        const workspaceRoot = this.workspaceRoot;
        if (this.pathExists(packageJsonPath) && workspaceRoot) {
            const buffer = await vscode.workspace.fs.readFile(vscode.Uri.file(packageJsonPath));
            const packageJson = JSON.parse(new TextDecoder('utf-8').decode(buffer));

            let versionJson: { default?: Record<string, { baseline: string; 'port-version': number }> } | null = null;
            const latestVersionFile = this._vcpkgPath + '/versions/baseline.json';
            try {
                const verBuffer = await vscode.workspace.fs.readFile(vscode.Uri.file(latestVersionFile));
                versionJson = JSON.parse(new TextDecoder('utf-8').decode(verBuffer));
            } catch (e) {
                // Ignore missing or malformed baseline.json
                console.error('Failed to parse baseline.json', e);
            }

            const getDependencyVersion = (dependency: string) => {
                if (versionJson && versionJson.default && versionJson.default[dependency]) {
                    return (
                        versionJson.default[dependency].baseline + '#' + versionJson.default[dependency]['port-version']
                    );
                }
                return 'undefined';
            };

            const toDep = (index: string, dependenciesObj: Record<string, string | { name?: string; version?: string }> | string[]): Dependency => {
                let name, version;
                
                if (Array.isArray(dependenciesObj)) {
                    // Array of strings
                    name = dependenciesObj[Number(index)] as string;
                    version = getDependencyVersion(name);
                } else {
                    // Object structure
                    const item = dependenciesObj[index];
                    if (typeof item === 'string') {
                        name = item;
                        version = getDependencyVersion(name);
                    } else if (typeof item === 'object' && item !== null) {
                        name = item.name || index; // Fallback to key if name is undefined
                        version = item.version !== undefined ? item.version : getDependencyVersion(name);
                    } else {
                        name = index;
                        version = 'undefined';
                    }
                }

                return new Dependency(name, version, vscode.TreeItemCollapsibleState.None, {
                    command: 'vscode.openFolder',
                    title: '',
                    arguments: [Uri.file(this._vcpkgPath + '/ports/' + name + '/vcpkg.json')],
                });
            };

            const deps = packageJson.dependencies
                ? Object.keys(packageJson.dependencies).map((dep) => toDep(dep, packageJson.dependencies))
                : [];
            return deps;
        } else {
            return [];
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
        public readonly command?: vscode.Command,
    ) {
        super(label, collapsibleState);

        this.tooltip = `${this.label}-${this.version}`;
        this.description = this.version;
    }

    iconPath = {
        light: path.join(__filename, '..', '..', 'media', 'dependency_light.svg'),
        dark: path.join(__filename, '..', '..', 'media', 'dependency_dark.svg'),
    };

    contextValue = 'dependency';
}
