import * as vscode from 'vscode';
import * as fs from 'fs';

export class VcpkgLogMgr {
    private outputChannel?: vscode.OutputChannel;

    constructor(isTest: boolean = false) {
        if (!isTest) {
            this.outputChannel = vscode.window.createOutputChannel('vcpkg');
            this.outputChannel.show();
        }
    }

    logInfo(content: string) {
        this.outputChannel?.appendLine('[vcpkg tools][Info] ' + content);
    }

    logErr(content: string) {
        this.outputChannel?.appendLine('[vcpkg tools][Error] ' + content);
    }
}
