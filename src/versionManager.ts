import * as vscode from 'vscode';
import * as fs from 'fs';
import {VcpkgEventEmitter} from './vcpkgEventEmitter';

export class VersionManager {
    private _emitter: VcpkgEventEmitter;
	private _vcpkgRoot = "";
    private _reportedFailure = false;

    constructor(emitter: VcpkgEventEmitter)
    {
        this._emitter = emitter;
        this.eventCallback = this.eventCallback.bind(this);
        this._emitter.registerListener("VersionManager", this.eventCallback);
    }

    public eventCallback(request: string, result: any)
    {

    }

    public setVcpkgRoot(root: string)
    {
        this._vcpkgRoot = root + '/versions/';
    }

    private checkVcpkgPath()
    {
        if (!this._vcpkgRoot.length)
        {
            if (!this._reportedFailure)
            {
                vscode.window.showErrorMessage('vcpkg path is not set, auto-suggest versions will be disabled.');
            }
            this._reportedFailure = true;

            return false;
        }
        else
        {
            this._reportedFailure = false;

            return true;
        }
    }

    private getPortVersionFile(name: string)
    {
        return this._vcpkgRoot + name.charAt(0).toLocaleLowerCase() + '-/' + name.toLocaleLowerCase() + '.json';
    }

    public getPortVersions(name: string)
    {
        if (!this.checkVcpkgPath())
        {
            return new Array<{version: string, hash: string}>;
        }

        const verionFile = this.getPortVersionFile(name);
        let versions = "";
        let json;
        try
        {
             versions = fs.readFileSync(verionFile, { encoding: 'utf8', flag: 'r' });
             json = JSON.parse(versions);
        }
        catch (e)
        {
             return new Array<{version: string, hash: string}>;
        }
        
        let results = new Array<{version: string, hash: string}>;
       
        for (let i = 0; i < json.versions.length; i++)
        {
            let finalVersion = "";
            if (json.versions[i]["version"] !== undefined)
            {
                finalVersion = json.versions[i]["version"];
            }
            else if (json.versions[i]["version-string"] !== undefined)
            {
                finalVersion = json.versions[i]["version-string"];
            }
            else if (json.versions[i]["version-date"] !== undefined)
            {
                finalVersion = json.versions[i]["version-date"];
            }
            else if (json.versions[i]["version-semver"] !== undefined)
            {
                finalVersion = json.versions[i]["version-semver"];
            }
            else
            {
                return new Array<{version: string, hash: string}>;
            }
           
            const finalVersionWithPatch = finalVersion + '#' + json.versions[i]["port-version"];
            results.push({version: finalVersionWithPatch, hash: this.getVersionDate(name, finalVersion)});
        }
       
        return results;
    }

    public getPortVersionHash(name: string, version: string)
    {
        if (!this.checkVcpkgPath())
        {
            return "";
        }

       const verionFile = this.getPortVersionFile(name);
       let versions = "";
       let json;
       try
       {
            versions = fs.readFileSync(verionFile, { encoding: 'utf8', flag: 'r' });
            json = JSON.parse(versions);
       }
       catch (e)
       {
            return "";
       }

       if (!version.length)
       {
            return this.getVersionDate(name, json.versions[0]["version"]);
       }

       for (let i = 0; i < json.versions.length; i++)
       {
            let expectedVersion = "";
            if (json.versions[i]["version"] !== undefined)
            {
                expectedVersion = json.versions[i]["version"];
            }
            else if (json.versions[i]["version-string"] !== undefined)
            {
                expectedVersion = json.versions[i]["version-string"];
            }
            else if (json.versions[i]["version-date"] !== undefined)
            {
                expectedVersion = json.versions[i]["version-date"];
            }
            else if (json.versions[i]["version-semver"] !== undefined)
            {
                expectedVersion = json.versions[i]["version-semver"];
            }
            else
            {
                continue;
            }
            const expectedVersionWithPatch = expectedVersion + '#' + json.versions[i]["port-version"];
            if (expectedVersionWithPatch === version)
            {
                return this.getVersionDate(name, expectedVersion);
            }
       }

       return "";
    }

    private getVersionDate(name: string, version: string)
    {
        const verionFile = this.getPortVersionFile(name);
        let command = "git blame -l " + verionFile;
        const cp = require('child_process');
        let result = "";
        try
        {
            result = cp.execSync(command, {cwd: this._vcpkgRoot + "../"}).toString();
        }
        catch(e)
        {
            return "";
        }

        const results = result.split('\n');
        let found = "";
        for (let current of results)
        {
            if (current.search(version) !== -1)
            {
                found = current;
                break;
            }
        }
        found = found.substring(0, found.indexOf(' '));

        return found;
    }
}