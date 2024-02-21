import * as vscode from 'vscode';
import {VcpkgLogMgr} from './log';
import { debug } from 'vscode';

export class vcpkgDebugger {
    private TASKSJSON_FILENAME = "tasks";
    private LAUNCHJSON_FILENAME = "launch"

    private _logMgr : VcpkgLogMgr;

    constructor(logMgr: VcpkgLogMgr)
    {
        this._logMgr = logMgr;

        this.updateConfigurations();
    }

    private getTasksJsonContent()
    {
        return this.readFromFile(this.TASKSJSON_FILENAME);
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
                ports.push(valid);
            }
        }

        if (!ports.length) {
            return "";
        }

        // TODO: drop same port
        let port_names = "";
        for (let index = 0; index < ports.length; index++) {
            port_names += ports[index];
            port_names += " ";
        }

        return port_names;
    }

    private generateCommand()
    {
        let modifiedPorts = this.getModifiedPorts();
        if (modifiedPorts === "") {
            return "";
        }
        return "\"${workspaceFolder}/vcpkg.exe\" remove " + modifiedPorts + " --recurse; & \"${workspaceFolder}/vcpkg.exe\" install " + modifiedPorts + " --no-binarycaching --x-cmake-debug \\\\.\\pipe\\vcpkg_ext_portfile_dbg";
    }

    private async cleanConfigurations()
    {
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
                await this.writeToFile(this.LAUNCHJSON_FILENAME, "configurations", newConfigs);
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
                await this.writeToFile(this.TASKSJSON_FILENAME, "tasks", newConfigs);
            }
        }
    }

    public async updateConfigurations()
    {
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
                        this._logMgr.logInfo("Got exists tasks");
                        
                        element["command"] = this.generateCommand();
                        if (element["command"] === "") 
                        {
                            this.cleanConfigurations();
                            return;
                        }

                        //TODO also needs to update other options

                        found = true;
                    }
                    modifiedConfig.push(element);
                }
                if (!found)
                {
                    staticConfiguration["command"] = this.generateCommand();
                    if (staticConfiguration["command"] === "") 
                    {
                        this.cleanConfigurations();
                        return;
                    }
                    modifiedConfig.push(staticConfiguration);

                    this._logMgr.logInfo("Tasks json not found, new one.");
                }
            }
            else
            {
                staticConfiguration["command"] = this.generateCommand();
                if (staticConfiguration["command"] === "") 
                {
                    this.cleanConfigurations();
                    return;
                }
                modifiedConfig.push(staticConfiguration);
                this._logMgr.logInfo("Tasks json not found, new one.");
            }
        }

        await this.writeToFile(this.TASKSJSON_FILENAME, "tasks", modifiedConfig);
    }

    private getLaunchJsonContent()
    {
        return this.readFromFile(this.LAUNCHJSON_FILENAME);
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
            "pipeName": "\\\\.\\pipe\\vcpkg_ext_portfile_dbg",
            "preLaunchTask": "Debug vcpkg commands"};

        let fullContent = this.getLaunchJsonContent();
        if (JSON.stringify(fullContent) === "{}")
        {
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
                        this._logMgr.logInfo("Got exists configurations");
                        fullContent["configurations"][index] = staticConfiguration;
    
                        found = true;
                    }
                    
                    modifiedConfig.push(element);
                }
                if (!found)
                {
                    modifiedConfig.push(staticConfiguration);
                }
            }
            else
            {
                modifiedConfig.push(staticConfiguration);
            }
        }
        await this.writeToFile(this.LAUNCHJSON_FILENAME, "configurations", modifiedConfig);
    }

    private readFromFile(fileName: string)
    {
        return vscode.workspace.getConfiguration(fileName);
    }

    private async writeToFile(fileName: string, scope: string, content: object)
    {
        await vscode.workspace.getConfiguration(fileName).update(scope, content, null);
    }
}