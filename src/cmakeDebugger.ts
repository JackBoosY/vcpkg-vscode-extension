import * as vscode from 'vscode';
import {VcpkgLogMgr} from './log';
import { debug } from 'vscode';
import * as fs from 'fs'; 

function sleep(time: number){
    return new Promise((resolve) => setTimeout(resolve, time));
   }

export class CmakeDebugger {
    private _logMgr : VcpkgLogMgr;
    private _waitDebug : boolean;

    constructor(logMgr : VcpkgLogMgr)
    {
        this._logMgr = logMgr;
        this._waitDebug = false;

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

    public stopWaitingDebug()
    {
        this._waitDebug = false;
    }

    public async startDebugging(vcpkgRoot: any, currentTriplet : any)
    {
        if (vcpkgRoot === undefined || currentTriplet === undefined) 
        {
            this._logMgr.logErr("vcpkgRoot(" + vcpkgRoot + ") or currentTriplet(" + currentTriplet + ") is undefined!");
            return;
        }
        let portName = "zlib";
        let outName = vcpkgRoot + "buildtrees//" + portName + "//stdout-" + currentTriplet + ".log";
        let content = "";
        let whenConfigure = false;

        // wait for configure
        this._waitDebug = true;
        do {
            if (!this._waitDebug) 
            {
                this._logMgr.logInfo("Cancel debug CMakeLists.");
                return;
            }
            content = fs.readFileSync(outName, { encoding: 'utf8', flag: 'r' });
            await sleep(100);
            if (content.search("-- Configuring ") !== -1) {
                whenConfigure = true;
            }
        } while (!whenConfigure);

        this._waitDebug = false;

        this._logMgr.logInfo("Start debugging CMakeLists.");
        vscode.debug.startDebugging(undefined, {
            name: "Vcpkg extension Debugger",
            request: "launch",
            type: "cmake",
            cmakeDebugType: "external",
            pipeName: this.generatePipeline(),
            fromCommand: true
        });
    }
}
