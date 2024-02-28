import * as vscode from 'vscode';
import {VcpkgLogMgr} from './log';
import {VcpkgDebugger} from './vcpkgDebugger';
import { debug } from 'vscode';
import * as fs from 'fs'; 

function sleep(time: number){
    return new Promise((resolve) => setTimeout(resolve, time));
   }

export class CmakeDebugger {
    private _vcpkgDbg: VcpkgDebugger;
    private _logMgr : VcpkgLogMgr;
    private _waitDebug : boolean;

    constructor(vcpkgDebugger: VcpkgDebugger, logMgr : VcpkgLogMgr)
    {
        this._vcpkgDbg = vcpkgDebugger;
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

    private getTasksJsonContent()
    {
        this._logMgr.logInfo("Loading tasks json content.");
        return this.readFromFile("tasks");
    }

    private async updateConfig()
    {
        this._logMgr.logInfo("Updating tasks.json");

        let fullContent = this.getTasksJsonContent();

        if (JSON.stringify(fullContent) === "{}")
        {
            this._logMgr.logErr("tasks json is empty!");
            return;
        }
        else
        {
            if (fullContent.has("tasks"))
            {
                let taskArray = new Array;
                let originCommand = "";
                let currTask;
                for (let index = 0; index < fullContent["tasks"].length; index++) 
                {
                    const element = fullContent["tasks"][index];
                    if (element["label"] === "Debug vcpkg commands")
                    {
                        this._logMgr.logInfo("Found exists task, update now.");

                        currTask = element;
                        originCommand = element["command"];
                    }
                    else
                    {
                        taskArray.push(element);
                    }
                }

                if (originCommand) 
                {
                    if (originCommand.indexOf("--x-cmake-configure-debug") === -1)
                    {
                        let config = originCommand + " --x-cmake-configure-debug " + this.generatePipeline() + " --editable";
                        currTask["command"] = config;

                        taskArray.push(currTask);
    
                        this._logMgr.logInfo("Update command " + config + " in Tasks json command");
                        await this.writeToFile("tasks", "tasks", taskArray);
                    }
                    else
                    {
                        this._logMgr.logInfo("Already update command");
                    }
                }
            }
            else
            {
                this._logMgr.logInfo("Tasks item not found, new one now.");
                return;
            }
        }
    }

    private readFromFile(fileName: string)
    {
        return vscode.workspace.getConfiguration(fileName);
    }

    private async writeToFile(fileName: string, scope: string, content: any)
    {
        this._logMgr.logInfo("Updating " + fileName + " - " + scope);
        await vscode.workspace.getConfiguration(fileName).update(scope, content, null);
    }

    private async cleanConfig()
    {
        this._logMgr.logInfo("Clean command in Tasks json command.");

        let fullContent = this.getTasksJsonContent();

        if (JSON.stringify(fullContent) === "{}")
        {
            this._logMgr.logErr("tasks json is empty!");
            return;
        }
        else
        {
            if (fullContent.has("tasks"))
            {
                let taskArray = new Array;
                let originCommand = "";
                let currTask;
                for (let index = 0; index < fullContent["tasks"].length; index++) 
                {
                    const element = fullContent["tasks"][index];
                    if (element["label"] === "Debug vcpkg commands")
                    {
                        this._logMgr.logInfo("Found exists task, update now.");

                        currTask = element;
                        originCommand = element["command"];
                    }
                    else
                    {
                        taskArray.push(element);
                    }
                }

                if (originCommand) 
                {
                    if (currTask["command"].indexOf(" --x-cmake-configure-debug") !== -1) 
                    {
                        let config = currTask["command"];
                        config = config.substring(0, config.indexOf(" --x-cmake-configure-debug"));
                        currTask["command"] = config;
    
                        taskArray.push(currTask);
    
                        this._logMgr.logInfo("Delete command in Tasks json command");
                        await this.writeToFile("tasks", "tasks", taskArray);
                    }
                    else
                    {
                        this._logMgr.logInfo("Command is alreay cleaned.");
                    }
                }
            }
            else
            {
                this._logMgr.logInfo("Tasks item not found, new one now.");
                return;
            }
        }
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
        this._logMgr.logInfo("Starting debug cmake.");
        if (vcpkgRoot === undefined || !vcpkgRoot.length) 
        {
            this._logMgr.logErr("vcpkgRoot(" + vcpkgRoot + ") is empty!");
            vscode.window.showErrorMessage("Vcpkg root is empty! Please manually set.");
            return;
        }
        else if (currentTriplet === undefined || !currentTriplet.length)
        {
            this._logMgr.logErr("currentTriplet(" + currentTriplet + ") is empty!");
            vscode.window.showErrorMessage("Current default triplet is empty! Please manually set first.");
            return;
        }

        let portName = this._vcpkgDbg.getModifiedPorts();
        portName = portName?.replace(" ", "");
        let outName = vcpkgRoot + "/buildtrees/" + portName + "/stdout-" + currentTriplet + ".log";
        let content = "";
        let whenConfigure = false;

        // wait for configure
        this._logMgr.logInfo("Waiting for configure, reading output in " + outName);
        this._waitDebug = true;
        do {
            if (!this._waitDebug) 
            {
                this._logMgr.logInfo("Cancel debug CMakeLists.");
                return;
            }
            content = fs.readFileSync(outName, { encoding: 'utf8', flag: 'r' });
            await sleep(100);
            if (content.search("-- Configuring ") !== -1 && content.search("-- Performing post-build validation") === -1) 
            {
                whenConfigure = true;
            }
        } while (!whenConfigure);

        this._waitDebug = false;

        this._logMgr.logInfo("Connecting cmake debug pipe.");
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
