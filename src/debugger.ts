import * as vscode from 'vscode';
import {VcpkgLogMgr} from './log';

export class vcpkgDebugger {
    private TASKSJSON_FILENAME = "tasks";
    private LAUNCHJSON_FILENAME = "launch"

    private _logMgr : VcpkgLogMgr;

    constructor(logMgr: VcpkgLogMgr)
    {
        this._logMgr = logMgr;
        
        let tmp = this.updateTasksJson();
    }

    private getTasksJsonContent()
    {
        let content = this.readFromFile(this.TASKSJSON_FILENAME);

        return content;
    }

    private getModifiedPorts()
    {
        return "zlib";
    }

    private generateCommand()
    {
        let modifiedPorts = this.getModifiedPorts();
        return "\"${workspaceFolder}/vcpkg.exe\" remove " + modifiedPorts + " --recurse; & \"${workspaceFolder}/vcpkg.exe\" install " + modifiedPorts + " --no-binarycaching --x-cmake-debug \\\\.\\pipe\\vcpkg_ext_portfile_dbg";
    }

    private updateTasksJson()
    {
        this._logMgr.logInfo("Updating tasks.json");

        const staticConfiguration = {
            "label": "Debug vcpkg commands",
            "type": "shell",
            "command": "",
            "sig": "vcpkg_vscode_extension",
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

        if (fullContent === null)
        {
            //fullContent["version"] = "2.0.0";
            fullContent["tasks"];
        }
        else
        {
            if (fullContent.has("tasks"))
            {
                let found = false;
                for (let index = 0; index < fullContent["tasks"].length; index++) {
                    const element = fullContent["tasks"][index];
                    if (element["sig"] === "vcpkg_vscode_extension")
                    {
                        this._logMgr.logInfo("Got exists tasks");
                        
                        element["command"] = this.generateCommand();

                        //TODO also needs to update other options

                        found = true;
                        break;
                    }
                }
                if (!found) 
                {
                    let tmp = staticConfiguration;
                    tmp["command"] = this.generateCommand();
                    this._logMgr.logInfo("Tasks json not found, new one.");
                    fullContent["tasks"].push(tmp);
                }
            }
            else
            {
                fullContent["tasks"][0] = staticConfiguration;
                fullContent["tasks"][0]["command"] = this.generateCommand();
                this._logMgr.logInfo("Tasks json not found, new one.");
            }
        }

        this.writeToFile(this.TASKSJSON_FILENAME, "tasks", fullContent["tasks"]);
    }

    private getLaunchJsonContent()
    {
        return this.readFromFile(this.LAUNCHJSON_FILENAME);
    }

    private updateLaunchJson()
    {
        this._logMgr.logInfo("Updating launch.json");

        const staticConfiguration = {
            "type": "cmake",
            "request": "launch",
            "sig": "vcpkg_vscode_extension",
            "name": "Debug portfile(s)",
            "cmakeDebugType": "external",
            "pipeName": "\\\\.\\pipe\\vcpkg_ext_portfile_dbg",
            "preLaunchTask": "Debug vcpkg commands"};

        let fullContent = this.getLaunchJsonContent();
        if (fullContent === null)
        {
            // only needs to be updated since it's fixed.
            fullContent["version"];// = "0.2.0";
            fullContent["configurations"][0];// = staticConfiguration;
        }
        else
        {
            for (let index = 0; index < fullContent["configurations"].length; index++) {
                const element = fullContent["configurations"][index];
                if (element["sig"] === "vcpkg_vscode_extension")
                {
                    this._logMgr.logInfo("Got exists configurations");
                    fullContent["configurations"][index] = staticConfiguration;
                    break;
                }
            }
        }
        this.writeToFile(this.LAUNCHJSON_FILENAME, "configurations", fullContent["configurations"]);
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