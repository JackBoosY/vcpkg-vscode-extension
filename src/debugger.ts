import * as vscode from 'vscode';
import {VcpkgLogMgr} from './log';

export class vcpkgDebugger {
    private TASKSJSON_FILENAME = "tasks";
    private LAUNCHJSON_FILENAME = "launch"

    private _logMgr : VcpkgLogMgr;

    constructor(logMgr: VcpkgLogMgr)
    {
        this._logMgr = logMgr;
        
        this.updateTasksJson();
        this.updateLaunchJson();
    }

    private getTasksJsonContent()
    {
        return this.readFromFile(this.TASKSJSON_FILENAME);
    }

    private getModifiedPorts()
    {
        return "curl";
    }

    private generateCommand()
    {
        let modifiedPorts = this.getModifiedPorts();
        return "\"${workspaceFolder}/vcpkg.exe\" remove " + modifiedPorts + " --recurse; & \"${workspaceFolder}/vcpkg.exe\" install " + modifiedPorts + " --no-binarycaching --x-cmake-debug \\\\.\\pipe\\vcpkg_ext_portfile_dbg";
    }

    private updateTasksJson()
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
            //fullContent.update("version", "2.0.0");
            modifiedConfig.push(staticConfiguration);
        }
        else
        {
            if (fullContent.has("tasks"))
            {
                let found = false;
                for (let index = 0; index < fullContent["tasks"].length; index++) {
                    const element = fullContent["tasks"][index];
                    if (element["label"] === "Debug vcpkg commands")
                    {
                        this._logMgr.logInfo("Got exists tasks");
                        
                        element["command"] = this.generateCommand();

                        //TODO also needs to update other options

                        found = true;
                    }
                    modifiedConfig.push(element);
                }
                if (!found)
                {
                    staticConfiguration["command"] = this.generateCommand();
                    modifiedConfig.push(staticConfiguration);

                    this._logMgr.logInfo("Tasks json not found, new one.");
                }
            }
            else
            {
                staticConfiguration["command"] = this.generateCommand();
                modifiedConfig.push(staticConfiguration);
                this._logMgr.logInfo("Tasks json not found, new one.");
            }
        }

        this.writeToFile(this.TASKSJSON_FILENAME, "tasks", modifiedConfig);
    }

    private getLaunchJsonContent()
    {
        return this.readFromFile(this.LAUNCHJSON_FILENAME);
    }

    private updateLaunchJson()
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
            let found = false;
            for (let index = 0; index < fullContent["configurations"].length; index++) {
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
        this.writeToFile(this.LAUNCHJSON_FILENAME, "configurations", modifiedConfig);
    }

    private readFromFile(fileName: string)
    {
        return vscode.workspace.getConfiguration(fileName);
    }

    private writeToFile(fileName: string, scope: string, content: object)
    {
        vscode.workspace.getConfiguration(fileName).update(scope, content);
    }
}