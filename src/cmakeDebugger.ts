import * as vscode from 'vscode';
import {VcpkgLogMgr} from './log';
import { debug } from 'vscode';
import { execSync } from 'child_process';

export class CmakeDebugger {
    private _logMgr : VcpkgLogMgr;

    constructor(logMgr : VcpkgLogMgr)
    {
        this._logMgr = logMgr;

        this.updateConfigurations();
    }

    private generatePipeline()
    {
        if (process.platform === 'win32') 
        {
            return "\\\\.\\\\pipe\\\\vscode-vcpkg-cmake-debugger-pipe";
        }
        else
        {
            return "/tmp/vscode-vcpkg-cmakelists-debugger-pipe";
        }
    }

    private updateConfig()
    {
        let config = "--x-cmake-configure-debug=" + this.generatePipeline();
        // TODO
        this._logMgr.logInfo("Add pipe " + config + " in Tasks json command");
    }

    private cleanConfig()
    {
        // TODO
        this._logMgr.logInfo("Clean pipe in Tasks json command.");
    }

    public updateConfigurations()
    {
        let breakPoints = debug.breakpoints;
        let validBreakPoint = false;
        for (let index = 0; index < breakPoints.length; index++) 
        {
            const element = breakPoints[index];
            // @ts-ignore
            if (element.location.uri.toString().search("buildtrees") !== -1) 
            {
                // @ts-ignore
                this._logMgr.logInfo("Found breakpoint path: " + element.location.uri.toString());
                validBreakPoint = true;
                break;
            }
        }

        if (validBreakPoint) 
        {
            this._logMgr.logInfo("Found valid CMake breakpoint.");
            this.updateConfig();
        }
        else
        {
            this._logMgr.logInfo("No valid CMake breakpoint was found.");
            this.cleanConfig();
        }
    }

    public async startDebugging()
    {
        this._logMgr.logInfo("Start debugging CMakeLists.");
        await vscode.debug.startDebugging(undefined, {
            name: "Vcpkg extension Debugger",
            request: "launch",
            type: "cmake",
            cmakeDebugType: "external",
            pipeName: this.generatePipeline(),
            fromCommand: true
        });
    }
}
