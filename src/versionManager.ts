import { TextDecoder } from "util";

import * as vscode from 'vscode';
import * as fs from 'fs';
import { VcpkgLogMgr } from './log';
import { VcpkgEventEmitter, VcpkgEventPayloads } from './vcpkgEventEmitter';

export class VersionManager {
    private _emitter: VcpkgEventEmitter;
    private _vcpkgRoot = '';
    private _reportedFailure = false;
    private _logMgr: VcpkgLogMgr;

    private _hashCache = new Map<string, string>();
    private _portVersionsCache = new Map<string, Array<{ version: string; hash: string }>>();
    private _portVersionHashCache = new Map<string, string>();

    constructor(logMgr: VcpkgLogMgr, emitter: VcpkgEventEmitter) {
        this._logMgr = logMgr;
        this._emitter = emitter;
        this.eventCallback = this.eventCallback.bind(this);
        this._emitter.registerListener('VersionManager', this.eventCallback);
    }

    public eventCallback<K extends keyof VcpkgEventPayloads>(request: K, result: VcpkgEventPayloads[K]) {
        switch (request) {
            case 'setVcpkgRoot':
                {
                    this._hashCache.clear();
                    this._portVersionsCache.clear();
                    this._portVersionHashCache.clear();
                    this.setVcpkgRoot(result as string);
                }
                break;
            default:
                {
                    this._logMgr.logErr('CmakeDebugger eventCallback: received unrecognized message type: ' + request);
                }
                break;
        }
    }

    public setVcpkgRoot(root: string) {
        this._vcpkgRoot = root + '/versions/';
    }

    private checkVcpkgPath() {
        if (!this._vcpkgRoot.length) {
            if (!this._reportedFailure) {
                vscode.window.showErrorMessage('vcpkg path is not set, auto-suggest versions will be disabled.');
            }
            this._reportedFailure = true;

            return false;
        } else {
            this._reportedFailure = false;

            return true;
        }
    }

    private getPortVersionFile(name: string) {
        return this._vcpkgRoot + name.charAt(0).toLocaleLowerCase() + '-/' + name.toLocaleLowerCase() + '.json';
    }

    public async getPortVersions(name: string) {
        if (!this.checkVcpkgPath()) {
            return new Array<{ version: string; hash: string }>();
        }

        if (this._portVersionsCache.has(name)) {
            return this._portVersionsCache.get(name)!;
        }

        const verionFile = this.getPortVersionFile(name);
        let versions = '';
        let json;
        try {
            const buffer = await vscode.workspace.fs.readFile(vscode.Uri.file(verionFile));
            versions = new TextDecoder('utf-8').decode(buffer);
            json = JSON.parse(versions);
        } catch (e) {
            return new Array<{ version: string; hash: string }>();
        }

        let results = new Array<{ version: string; hash: string }>();

        for (let i = 0; i < json.versions.length; i++) {
            let finalVersion = '';
            if (json.versions[i]['version'] !== undefined) {
                finalVersion = json.versions[i]['version'];
            } else if (json.versions[i]['version-string'] !== undefined) {
                finalVersion = json.versions[i]['version-string'];
            } else if (json.versions[i]['version-date'] !== undefined) {
                finalVersion = json.versions[i]['version-date'];
            } else if (json.versions[i]['version-semver'] !== undefined) {
                finalVersion = json.versions[i]['version-semver'];
            } else {
                return new Array<{ version: string; hash: string }>();
            }

            const finalVersionWithPatch = finalVersion + '#' + json.versions[i]['port-version'];
            results.push({ version: finalVersionWithPatch, hash: await this.getVersionDate(name, finalVersion) });
        }

        this._portVersionsCache.set(name, results);
        return results;
    }

    public async getPortVersionHash(name: string, version: string) {
        if (!this.checkVcpkgPath()) {
            return '';
        }

        const cacheKey = name + '@' + version;
        if (this._portVersionHashCache.has(cacheKey)) {
            return this._portVersionHashCache.get(cacheKey)!;
        }

        const verionFile = this.getPortVersionFile(name);
        let versions = '';
        let json;
        try {
            const buffer = await vscode.workspace.fs.readFile(vscode.Uri.file(verionFile));
            versions = new TextDecoder('utf-8').decode(buffer);
            json = JSON.parse(versions);
        } catch (e) {
            return '';
        }

        if (!version.length) {
            const result = await this.getVersionDate(name, json.versions[0]['version']);
            this._portVersionHashCache.set(cacheKey, result);
            return result;
        }

        for (let i = 0; i < json.versions.length; i++) {
            let expectedVersion = '';
            if (json.versions[i]['version'] !== undefined) {
                expectedVersion = json.versions[i]['version'];
            } else if (json.versions[i]['version-string'] !== undefined) {
                expectedVersion = json.versions[i]['version-string'];
            } else if (json.versions[i]['version-date'] !== undefined) {
                expectedVersion = json.versions[i]['version-date'];
            } else if (json.versions[i]['version-semver'] !== undefined) {
                expectedVersion = json.versions[i]['version-semver'];
            } else {
                continue;
            }
            const expectedVersionWithPatch = expectedVersion + '#' + json.versions[i]['port-version'];
            if (expectedVersionWithPatch === version) {
                const result = await this.getVersionDate(name, expectedVersion);
                this._portVersionHashCache.set(cacheKey, result);
                return result;
            }
        }

        this._portVersionHashCache.set(cacheKey, '');
        return '';
    }

    private async getVersionDate(name: string, version: string) {
        const cacheKey = name + '@' + version;
        if (this._hashCache.has(cacheKey)) {
            return this._hashCache.get(cacheKey)!;
        }

        const verionFile = this.getPortVersionFile(name);
        const command = 'git blame -l ' + verionFile;
        let result = '';
        try {
            const { runShellCommand } = await import('./utils/process');
            result = await runShellCommand(command, '', this._vcpkgRoot + '../', this._logMgr);
        } catch (e) {
            return '';
        }

        const results = result.split('\n');
        let found = '';
        for (let current of results) {
            if (current.search(version) !== -1) {
                found = current;
                break;
            }
        }
        if (found.length > 0) {
            found = found.slice(0, found.indexOf(' '));
        }

        this._hashCache.set(cacheKey, found);
        return found;
    }
}
