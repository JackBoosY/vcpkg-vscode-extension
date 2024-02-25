import * as vscode from 'vscode';
import {VcpkgLogMgr} from './log';
import { debug } from 'vscode';
import { execSync } from 'child_process';

export class CmakeDebugger {
    private _logMgr : VcpkgLogMgr;

    private _vcpkgCMakeConfigureOptions = "VCPKG_CMAKE_CONFIGURE_OPTIONS";

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

    private getCleanEnv(envName: string, expectValue: string)
    {
        if (!envName.length || !expectValue.length) 
        {
            this._logMgr.logErr("getCleanEnv envName or expectValue is empty!");
            return "";
        }

        let currValue = process.env[envName];

        if (currValue === undefined || !currValue.length) 
        {
            this._logMgr.logInfo("Env " + envName + " value is empty");
            return "";
        }

        let cleanArray = new Array;

        let currArray = currValue.split(";");
        for (let index = 0; index < currArray.length; index++) 
        {
            const element = currArray[index];
            if (element === expectValue) {
                break;
            }
            cleanArray.push(element);
        }

        let cleanValue = "";
        for (let index = 0; index < cleanArray.length; index++) 
        {
            cleanValue += cleanArray[index] + ";";
        }

        this._logMgr.logInfo("Clean env " + envName + " value: " + cleanValue);
        return cleanValue;
    }

    private writeEnvToGlobal(name: string, value: string)
    {
        let command = "";
        if (process.platform === 'win32')
        {
            command = "setx " + name + " \"" + value + "\" /m";
        }
        else
        {
            command = name + "=\"" + value + "\"";
        }
        try {
            execSync(command);
        } catch (error) {
            this._logMgr.logErr("set env " + name + " failed:" + error);
            return;
        }
        return;
        process.env[name] = value;
    }

    private updateEnv()
    {
        let cleanEnv = this.getCleanEnv(this._vcpkgCMakeConfigureOptions, "--debugger");
        let newValue = cleanEnv + "--debugger;--debugger-pipe;" + this.generatePipeline() + ";";//--debugger-dap-log" "j://debugger.log";
        this.writeEnvToGlobal(this._vcpkgCMakeConfigureOptions, newValue);
        this._logMgr.logInfo("Update env " + this._vcpkgCMakeConfigureOptions + " to " + newValue);
    }

    private cleanEnv()
    {
        let cleanEnv = this.getCleanEnv(this._vcpkgCMakeConfigureOptions, "--debugger");
        this.writeEnvToGlobal(this._vcpkgCMakeConfigureOptions, cleanEnv);
        this._logMgr.logInfo("Clean env " + this._vcpkgCMakeConfigureOptions + " to " + cleanEnv);
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
            this.updateEnv();
        }
        else
        {
            this._logMgr.logInfo("No valid CMake breakpoint was found.");
            this.cleanEnv();
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
