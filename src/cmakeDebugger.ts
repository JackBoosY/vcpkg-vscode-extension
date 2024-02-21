import * as vscode from 'vscode';
import {VcpkgLogMgr} from './log';

export class VcpkgDebugger {
    private _logMgr : VcpkgLogMgr;

    constructor(logMgr : VcpkgLogMgr)
    {
        this._logMgr = logMgr;
    }

    private generatePipeline()
    {
        return "\\\\.\\\\pipe\\\\vscode-vcpkg-cmake-debugger-pipe";
    }

    public setDebuggingVcpkgCmakeOptions()
    {
        let envName = "VCPKG_CMAKE_CONFIGURE_OPTIONS";

        let pipeline = this.generatePipeline();

        process.env[envName] = pipeline;
    }
}
