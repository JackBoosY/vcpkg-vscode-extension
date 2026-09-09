import { TextDecoder } from "util";

import * as vscode from 'vscode';
import { VcpkgLogMgr } from './log';
import { debug } from 'vscode';
import { VcpkgEventEmitter, VcpkgEventPayloads } from './vcpkgEventEmitter';

import * as fs from 'fs';
function sleep(time: number) {
    return new Promise((resolve) => setTimeout(resolve, time));
}

export class CmakeDebugger {
    private _logMgr: VcpkgLogMgr;
    private _emitter: VcpkgEventEmitter;
    private _waitDebug: boolean;
    private _port: string;

    constructor(logMgr: VcpkgLogMgr, emitter: VcpkgEventEmitter) {
        this._logMgr = logMgr;
        this._waitDebug = false;
        this._port = '';
        this._emitter = emitter;
        this.eventCallback = this.eventCallback.bind(this);
        this._emitter.registerListener('CmakeDebugger', this.eventCallback);

        this.updateConfigurations();
    }

    public eventCallback<K extends keyof VcpkgEventPayloads>(request: K, result: VcpkgEventPayloads[K]) {
        switch (request) {
            case 'getDebugPortNameInCMakeDebugger':
                {
                    this._port = result as string;
                }
                break;

            default:
                {
                    this._logMgr.logErr('CmakeDebugger eventCallback: received unrecognized message type: ' + request);
                }
                break;
        }
    }

    private generatePipeline() {
        if (process.platform === 'win32') {
            return '\\\\.\\\\pipe\\\\vscode-vcpkg-cmake-debugger-pipe';
        } else {
            return '/tmp/vscode-vcpkg-cmakelists-debugger-pipe';
        }
    }

    private getTasksJsonContent() {
        this._logMgr.logInfo('Loading tasks json content.');
        return this.readFromFile('tasks');
    }

    private async updateConfig() {
        this._logMgr.logInfo('Updating tasks.json');

        let fullContent = this.getTasksJsonContent();

        if (JSON.stringify(fullContent) === '{}') {
            this._logMgr.logErr('tasks json is empty!');
            return;
        } else {
            if (fullContent.has('tasks')) {
                let taskArray = [];
                let modified = false;
                for (let index = 0; index < fullContent['tasks'].length; index++) {
                    const element = { ...fullContent['tasks'][index] };
                    if (element['label'] === 'Debug vcpkg commands') {
                        let originCommand = element['command'] || '';
                        if (originCommand.indexOf('--x-cmake-configure-debug') === -1) {
                            let config = originCommand + ' --x-cmake-configure-debug ' + this.generatePipeline();
                            if (config.indexOf('--editable') === -1) {
                                config += ' --editable';
                            }
                            element['command'] = config;
                            modified = true;
                            this._logMgr.logInfo('Update command ' + config + ' in Tasks json command');
                        }
                    }
                    taskArray.push(element);
                }

                if (modified) {
                    await this.writeToFile('tasks', 'tasks', taskArray);
                }
            } else {
                this._logMgr.logInfo('Tasks item not found, new one now.');
                return;
            }
        }
    }

    private readFromFile(fileName: string) {
        return vscode.workspace.getConfiguration(fileName);
    }

    private async writeToFile(fileName: string, scope: string, content: Array<unknown> | Record<string, unknown>) {
        this._logMgr.logInfo('Updating ' + fileName + ' - ' + scope);
        await vscode.workspace.getConfiguration(fileName).update(scope, content, null);
    }

    private async cleanConfig() {
        this._logMgr.logInfo('Clean command in Tasks json command.');

        let fullContent = this.getTasksJsonContent();

        if (JSON.stringify(fullContent) === '{}') {
            this._logMgr.logErr('tasks json is empty!');
            return;
        } else {
            if (fullContent.has('tasks')) {
                let taskArray = [];
                let modified = false;
                for (let index = 0; index < fullContent['tasks'].length; index++) {
                    const element = { ...fullContent['tasks'][index] };
                    if (element['label'] === 'Debug vcpkg commands') {
                        if (element['command'] && element['command'].indexOf('--x-cmake-configure-debug') !== -1) {
                            element['command'] = element['command'].replace(/\s*--x-cmake-configure-debug\s+\S+/, '');
                            modified = true;
                            this._logMgr.logInfo('Removed --x-cmake-configure-debug from command');
                        }
                    }
                    taskArray.push(element);
                }

                if (modified) {
                    await this.writeToFile('tasks', 'tasks', taskArray);
                }
            } else {
                this._logMgr.logInfo('Tasks item not found, new one now.');
                return;
            }
        }

        if (process.platform !== 'win32') {
            try {
                const pipe = this.generatePipeline();
                if (fs.existsSync(pipe)) {
                    fs.unlinkSync(pipe);
                }
            } catch (e) {
                // Ignore error
            }
        }
    }

    public onDidChangeBreakpoints() {
        this._emitter.fire('VcpkgDebugger', 'getDebugPortNameInCMakeDebugger', null);
        this.updateConfigurations();
    }

    public hasValidCMakeBreakpoint(): boolean {
        let breakPoints = debug.breakpoints;
        for (let index = 0; index < breakPoints.length; index++) {
            const element = breakPoints[index];
            // @ts-ignore
            if (element.enabled && element.location?.uri?.toString().search('buildtrees') !== -1) {
                return true;
            }
        }
        return false;
    }

    private updateConfigurations() {
        let validBreakPoint = this.hasValidCMakeBreakpoint();

        if (validBreakPoint) {
            this._logMgr.logInfo('Found valid CMake breakpoint.');
            this.updateConfig();
        } else {
            this._logMgr.logInfo('No valid CMake breakpoint was found.');
            this.cleanConfig();
        }
    }

    public stopWaitingDebug() {
        this._waitDebug = false;
        if (process.platform !== 'win32') {
            try {
                const pipe = this.generatePipeline();
                if (fs.existsSync(pipe)) {
                    fs.unlinkSync(pipe);
                }
            } catch (e) {
                // Ignore error
            }
        }
    }

    public async startDebugging(vcpkgRoot: string, currentTriplet: string) {
        this._logMgr.logInfo('Starting debug cmake.');
        this.stopWaitingDebug();
        if (vcpkgRoot === undefined || !vcpkgRoot.length) {
            this._logMgr.logErr('vcpkgRoot(' + vcpkgRoot + ') is empty!');
            vscode.window.showErrorMessage('Vcpkg root is empty! Please manually set.');
            return;
        } else if (currentTriplet === undefined || !currentTriplet.length) {
            this._logMgr.logErr('currentTriplet(' + currentTriplet + ') is empty!');
            vscode.window.showErrorMessage('Current default triplet is empty! Please manually set first.');
            return;
        }

        const pipe = this.generatePipeline();
        let whenConfigure = false;

        // Clean stale pipe if any
        if (process.platform !== 'win32') {
            try {
                if (fs.existsSync(pipe)) {
                    fs.unlinkSync(pipe);
                }
            } catch (e) {
                // Ignore error
            }
        }

        this._logMgr.logInfo(`Waiting for CMake configure debugger on pipe: ${pipe}`);
        this._waitDebug = true;
        do {
            if (!this._waitDebug) {
                this._logMgr.logInfo('Cancel debug CMakeLists.');
                return;
            }

            if (process.platform !== 'win32') {
                if (fs.existsSync(pipe)) {
                    whenConfigure = true;
                    break;
                }
            }

            if (!whenConfigure) {
                await sleep(200);
            }
        } while (!whenConfigure);

        this._waitDebug = false;

        if (whenConfigure) {
            this._logMgr.logInfo('Connecting cmake debug pipe.');
            // Allow CMake a brief moment to initialize the listening socket
            await sleep(300);
            await vscode.debug.startDebugging(undefined, {
                name: 'Vcpkg extension Debugger',
                request: 'launch',
                type: 'cmake',
                cmakeDebugType: 'external',
                pipeName: pipe,
                fromCommand: true,
            });
        }
    }
}
