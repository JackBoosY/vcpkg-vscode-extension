// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below

import * as vscode from 'vscode';
import { VcpkgLogMgr } from './log';
import { VcpkgEventEmitter } from './vcpkgEventEmitter';
import { ConfigurationManager } from './configuration';
import { VersionManager } from './versionManager';
import { CmakeDebugger } from './cmakeDebugger';
import { VcpkgDebugger } from './vcpkgDebugger';
import { VcpkgInfoSideBarViewProvider } from './sidebar/vcpkgInfoSideBarViewProvider';
import { VcpkgDebuggerSideBarViewProvider } from './sidebar/vcpkgDebuggerSideBarViewProvider';
import { DepNodeProvider } from './sidebar/DepNodeProvider';
import { CommandHandler } from './commandHandler';

let logMgr: VcpkgLogMgr;
let vcpkgEventEmitter: VcpkgEventEmitter;
let configMgr: ConfigurationManager;
let verMgr: VersionManager;
let vcpkgDebugger: VcpkgDebugger;
let cmakeDbg: CmakeDebugger;
let infoSideBarProvider: VcpkgInfoSideBarViewProvider;
let debuggerSideBarProvider: VcpkgDebuggerSideBarViewProvider;

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
    const rootPath =
        vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0
            ? vscode.workspace.workspaceFolders[0].uri.fsPath
            : undefined;
    const nodeDependenciesProvider = new DepNodeProvider(rootPath);
    vscode.window.registerTreeDataProvider('nodeDependencies', nodeDependenciesProvider);

    logMgr = new VcpkgLogMgr();
    vcpkgEventEmitter = new VcpkgEventEmitter(logMgr);
    verMgr = new VersionManager(logMgr, vcpkgEventEmitter);
    vcpkgDebugger = new VcpkgDebugger(logMgr, vcpkgEventEmitter);
    configMgr = new ConfigurationManager(/*context, */ logMgr, nodeDependenciesProvider, vcpkgEventEmitter);
    cmakeDbg = new CmakeDebugger(logMgr, vcpkgEventEmitter);

    infoSideBarProvider = new VcpkgInfoSideBarViewProvider(
        context.extensionUri,
        context.extensionPath,
        logMgr,
        vcpkgEventEmitter,
    );
    debuggerSideBarProvider = new VcpkgDebuggerSideBarViewProvider(
        context.extensionUri,
        context.extensionPath,
        logMgr,
        vcpkgEventEmitter,
    );

    const commandHandler = new CommandHandler(context, configMgr, verMgr, vcpkgEventEmitter);
    commandHandler.registerCommands();

    configMgr.logInfo('Trying to active vcpkg plugin...');

    // config changed event
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration(async (event) => await configMgr.onConfigurationChanged(event)),
    );

    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(infoSideBarProvider.viewType, infoSideBarProvider),
    );
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(debuggerSideBarProvider.viewType, debuggerSideBarProvider),
    );

    function onDidChangeActiveTextEditor(editor: vscode.TextEditor | undefined) {
        nodeDependenciesProvider.refresh();
    }

    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor(onDidChangeActiveTextEditor, null, context.subscriptions),
    );

    context.subscriptions.push(
        vscode.debug.onDidChangeBreakpoints((session) => {
            configMgr.getCurrentTriplet().then((triplet) => {
                if (vcpkgDebugger.setDefaultTriplet(triplet)) {
                    vcpkgDebugger.onDidChangeBreakpoints();
                    cmakeDbg.onDidChangeBreakpoints();
                }
            });
        }),
    );

    context.subscriptions.push(
        vscode.debug.onDidStartDebugSession(async (session) => {
            if (session.name === 'Debug portfile(s)') {
                logMgr.logInfo('Starting debug portfile.');
                if (cmakeDbg.hasValidCMakeBreakpoint()) {
                    const root = await configMgr.getVcpkgRealPath();
                    const triplet = await configMgr.getCurrentTriplet();
                    if (root) {
                        cmakeDbg.startDebugging(root, triplet || '');
                    } else {
                        logMgr.logErr('vcpkg root path not found');
                    }
                }
            }
        }),
    );

    context.subscriptions.push(
        vscode.debug.onDidTerminateDebugSession((session) => {
            if (session.name === 'Debug portfile(s)' || session.name === 'Vcpkg extension Debugger') {
                logMgr.logInfo(`Stop debug session: ${session.name}`);
                cmakeDbg.stopWaitingDebug();
            }
        }),
    );

    configMgr.logInfo('All the event are registered.');
}

// This method is called when your extension is deactivated
export function deactivate() {}
