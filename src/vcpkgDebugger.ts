import * as vscode from 'vscode';
import {VcpkgLogMgr} from './log';
import { debug } from 'vscode';

export class VcpkgDebugger {
    private tasksJsonFileName = "tasks";
    private launchJsonFileName = "launch";

    private _logMgr : VcpkgLogMgr;

    constructor(logMgr: VcpkgLogMgr)
    {
        this._logMgr = logMgr;

        this.updateConfigurations();
    }

    private getTasksJsonContent()
    {
        this._logMgr.logInfo("Loading tasks json content.");
        return this.readFromFile(this.tasksJsonFileName);
    }

    private getModifiedPorts()
    {
        let ports = new Array;
        let breakPoints = debug.breakpoints;
        for (let index = 0; index < breakPoints.length; index++) {
            const element = breakPoints[index];
            if (!element.enabled)
            {
                continue;
            }
             // @ts-ignore
            if (element.location.uri.toString().search("portfile.cmake") !== -1) {
                 // @ts-ignore
                let valid = element.location.uri.toString().substring(element.location.uri.toString().search("ports/") + "ports/".length, element.location.uri.toString().search("/portfile.cmake"));
                if (ports.indexOf(valid) === -1) 
                {
                    ports.push(valid);
                }
            }
        }

        if (!ports.length) {
            this._logMgr.logInfo("No valid breakpoint.");
            return "";
        }

        this._logMgr.logInfo("Breakpoints are from ports:");
        let portNames = "";
        for (let index = 0; index < ports.length; index++) {
            this._logMgr.logInfo(ports[index]);
            portNames += ports[index];
            portNames += " ";
        }

        return portNames;
    }

    private getDebuggerPipe()
    {
        if (process.platform === 'win32') 
        {
            return "\\\\.\\pipe\\vcpkg_ext_portfile_dbg";
        }
        else
        {
            return "/tmp/vcpkg_ext_portfile_dbg";
        }
    }

    private generateCommand()
    {
        this._logMgr.logInfo("Genereating commands.");
        let modifiedPorts = this.getModifiedPorts();
        if (modifiedPorts === "") {
            return "";
        }

        let exeSuffix = "";
        if (process.platform === "win32")
        {
            exeSuffix = ".exe";
        }
    
        return "\"${workspaceFolder}/vcpkg" + exeSuffix + "\" remove " + modifiedPorts + " --recurse; & \"${workspaceFolder}/vcpkg" + exeSuffix + "\" install " + modifiedPorts + " --no-binarycaching --x-cmake-debug " + this.getDebuggerPipe();
    }

    private async cleanConfigurations()
    {
        this._logMgr.logInfo("Cleanning debugging configurations");
        // clean launch json
        let fullContent = this.getLaunchJsonContent();
        if (JSON.stringify(fullContent) !== "{}")
        {
            if (fullContent.has("configurations"))
            {
                let newConfigs = new Array;
                for (let index = 0; index < fullContent["configurations"].length; index++) 
                {
                    const element = fullContent["configurations"][index];
                    if (element["name"] !== "Debug portfile(s)")
                    {
                        newConfigs.push(element);
                    }
                }
                await this.writeToFile(this.launchJsonFileName, "configurations", newConfigs);
            }
        }

        // clean tasks json
        fullContent = this.getTasksJsonContent();
        if (JSON.stringify(fullContent) !== "{}")
        {
            if (fullContent.has("tasks"))
            {
                let newConfigs = new Array;
                for (let index = 0; index < fullContent["tasks"].length; index++) 
                {
                    const element = fullContent["tasks"][index];
                    if (element["label"] !== "Debug vcpkg commands")
                    {
                        newConfigs.push(element);
                    }
                }
                await this.writeToFile(this.tasksJsonFileName, "tasks", newConfigs);
            }
        }
    }

    public async updateConfigurations()
    {
        this._logMgr.logInfo("Updating debugging configurations.");
        // update tasks json first since we may need to clean all configurations in update launch json
        this.updateTasksJson();
        this.updateLaunchJson();
    }

    private async updateTasksJson()
    {
        this._logMgr.logInfo("Updating tasks.json");

        let modifiedConfig = new Array;
        let staticConfiguration = {
            "label": "Debug vcpkg commands",
            "type": "shell",
            "isBackground": true,
            "command": "",
            "problemMatcher": [
                {
                    "pattern": [
                        {
                            "regexp": "",
                            "file": 1,
                            "location": 2,
                            "message": 3
                        }
                    ],
                    "background": {
                        "activeOnStart": true,
                        "beginsPattern": ".",
                        "endsPattern": "Waiting for debugger client to connect"
                    }
                }
            ]
        };

        let fullContent = this.getTasksJsonContent();

        if (JSON.stringify(fullContent) === "{}")
        {
            this._logMgr.logInfo("No tasks.json file found, creating.");
            staticConfiguration["command"] = this.generateCommand();
            if (staticConfiguration["command"] === "") 
            {
                this.cleanConfigurations();
                return;
            }
            //fullContent.update("version", "2.0.0");
            modifiedConfig.push(staticConfiguration);
        }
        else
        {
            if (fullContent.has("tasks"))
            {
                let found = false;
                for (let index = 0; index < fullContent["tasks"].length; index++) 
                {
                    const element = fullContent["tasks"][index];
                    if (element["label"] === "Debug vcpkg commands")
                    {
                        this._logMgr.logInfo("Found exists task, update now.");

                        let newData = staticConfiguration;
                        newData["command"] = this.generateCommand();
                        if (element["command"] === "") 
                        {
                            this.cleanConfigurations();
                            return;
                        }

                        // update new command
                        modifiedConfig.push(newData);
                        found = true;

                        continue;
                    }
                    modifiedConfig.push(element);
                }
                if (!found)
                {
                    this._logMgr.logInfo("Matched tasks not found, new one now.");

                    staticConfiguration["command"] = this.generateCommand();
                    if (staticConfiguration["command"] === "") 
                    {
                        this.cleanConfigurations();
                        return;
                    }
                    modifiedConfig.push(staticConfiguration);
                }
            }
            else
            {
                this._logMgr.logInfo("Tasks item not found, new one now.");

                staticConfiguration["command"] = this.generateCommand();
                if (staticConfiguration["command"] === "") 
                {
                    this.cleanConfigurations();
                    return;
                }
                modifiedConfig.push(staticConfiguration);
            }
        }

        await this.writeToFile(this.tasksJsonFileName, "tasks", modifiedConfig);
    }

    private getLaunchJsonContent()
    {
        this._logMgr.logInfo("Loading launch json content.");
        return this.readFromFile(this.launchJsonFileName);
    }

    private async updateLaunchJson()
    {
        this._logMgr.logInfo("Updating launch.json");

        let modifiedConfig = new Array;
        let staticConfiguration = {
            "type": "cmake",
            "request": "launch",
            "name": "Debug portfile(s)",
            "cmakeDebugType": "external",
            "pipeName": + this.getDebuggerPipe(),
            "preLaunchTask": "Debug vcpkg commands"};

        let fullContent = this.getLaunchJsonContent();
        if (JSON.stringify(fullContent) === "{}")
        {
            this._logMgr.logInfo("No launch.json file found, creating.");
            // only needs to be updated since it's fixed.
            modifiedConfig.push(staticConfiguration);
            //fullContent.update("version", "0.2.0");
        }
        else
        {
            if (fullContent.has("configurations"))
            {
                let found = false;
                for (let index = 0; index < fullContent["configurations"].length; index++) 
                {
                    const element = fullContent["configurations"][index];
                    if (element["name"] === "Debug portfile(s)")
                    {
                        this._logMgr.logInfo("Found exists configurations, update now.");
                        fullContent["configurations"][index] = staticConfiguration;
    
                        found = true;
                    }
                    
                    modifiedConfig.push(element);
                }
                if (!found)
                {
                    this._logMgr.logInfo("Matched configurations items not found, new one now.");
                    modifiedConfig.push(staticConfiguration);
                }
            }
            else
            {
                this._logMgr.logInfo("Configurations itme not found, noew one now.");
                modifiedConfig.push(staticConfiguration);
            }
        }
        await this.writeToFile(this.launchJsonFileName, "configurations", modifiedConfig);
    }

    private readFromFile(fileName: string)
    {
        return vscode.workspace.getConfiguration(fileName);
    }

    private async writeToFile(fileName: string, scope: string, content: object)
    {
        this._logMgr.logInfo("Updating " + fileName + " - " + scope);
        await vscode.workspace.getConfiguration(fileName).update(scope, content, null);
    }
}