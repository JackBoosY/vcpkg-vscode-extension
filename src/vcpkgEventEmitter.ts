import { EventEmitter } from "vscode";
import { VcpkgLogMgr } from './log';

export class VcpkgEventEmitter {
    private _logMgr: VcpkgLogMgr;
    private _modules = new Map<string, (request: string, result: any) => void>();

    constructor(log: VcpkgLogMgr)
    {
        this._logMgr = log;
    }

    public registerListener(name: string, callback: (request: string, result: any) => void)
    {
        this._modules.set(name, callback);
        this._logMgr.logInfo("Registered module: " + name);
    }

    public async fire(module: string, request: string, result: any)
    {
        this._logMgr.logInfo("Got new event: " + request + " to " + module);
        if (this._modules.has(module)) {
            let callback = this._modules.get(module);
            if (callback) {
                callback(request, result);
            } else {
                this._logMgr.logErr("Error: module " + module + " callback function is not found!!!");
            }
        }
        else {
            this._logMgr.logErr("Error: module " + module + " is not registered!!!");
        }
    }
}