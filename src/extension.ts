// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below

import * as vscode from 'vscode';
import { ConfigurationManager } from './configuration';
import {SettingsDocument} from './settingsDocument';
import { VersionManager } from './versionManager';
import {VcpkgLogMgr} from './log';
import {CmakeDebugger} from './cmakeDebugger';
import {VcpkgDebugger} from './vcpkgDebugger';

let logMgr : VcpkgLogMgr;
let configMgr : ConfigurationManager;
let verMgr : VersionManager;
let vcpkgDebugger : VcpkgDebugger;
let disposables: vscode.Disposable[];
let cmakeDbg: CmakeDebugger;

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	disposables = [];
	
	logMgr = new VcpkgLogMgr();
	verMgr = new VersionManager();
	vcpkgDebugger = new VcpkgDebugger(logMgr);
	configMgr = new ConfigurationManager(/*context, */verMgr, logMgr, vcpkgDebugger);
	cmakeDbg = new CmakeDebugger(vcpkgDebugger, logMgr);
	
	configMgr.logInfo('Trying to active vcpkg plugin...');

	// register vcpkg
	disposables.push(vscode.commands.registerCommand('vcpkg-integration.enable_vcpkg', async() => await configMgr.enableVcpkg(false)));

	// disable vcpkg
	disposables.push(vscode.commands.registerCommand('vcpkg-integration.disable_vcpkg', async() => await configMgr.disableVcpkg(true)));
	
	// enable manifest
	disposables.push(vscode.commands.registerCommand('vcpkg-integration.enable_manifest', async() => await configMgr.enableManifest()));
	
	// disable manifest
	disposables.push(vscode.commands.registerCommand('vcpkg-integration.disable_manifest', async() => await configMgr.disableManifest()));
	
	// get current triplet
	disposables.push(vscode.commands.registerCommand('vcpkg-integration.current_triplet', async() => await configMgr.showCurrentTriplet()));
	
	// get host triplet
	disposables.push(vscode.commands.registerCommand('vcpkg-integration.current_host_triplet', async() => await configMgr.showCurrentHostTriplet()));
	
	// set current triplet
	disposables.push(vscode.commands.registerCommand('vcpkg-integration.set_target_triplet', async() => await configMgr.setTargetTriplet()));
		
	// set host triplet
	disposables.push(vscode.commands.registerCommand('vcpkg-integration.set_host_triplet', async() => await configMgr.setHostTriplet()));
	
	// use static lib
	disposables.push(vscode.commands.registerCommand('vcpkg-integration.use_static_lib', async() => await configMgr.useLibType(true)));
	
	// use dynamic lib
	disposables.push(vscode.commands.registerCommand('vcpkg-integration.use_dynamic_lib', async() => await configMgr.useLibType(false)));

	// config changed event
	disposables.push(vscode.workspace.onDidChangeConfiguration(async(event) => await configMgr.onConfigurationChanged(event)));

	// manifest completion
	disposables.push(vscode.languages.registerCompletionItemProvider({ scheme: 'file', language: 'json', pattern: '**/vcpkg.json' }, {
		provideCompletionItems(document, position, token) {
			return new SettingsDocument(document, verMgr).provideCompletionItems(position, token);
		}
	}, "\""));
	
	context.subscriptions.push(
		vscode.commands.registerCommand("vcpkg-welcome.getting_start", () => {
		  vscode.commands.executeCommand('workbench.action.openWalkthrough', 'JackBoosY.vcpkg-cmake-tools#start', false);
		})
	);

	context.subscriptions.push(vscode.debug.onDidChangeBreakpoints(
        session => {
			configMgr.getCurrentTriplet().then(triplet => {
				if (vcpkgDebugger.setDefaultTriplet(triplet))
				{
					vcpkgDebugger.updateConfigurations();
					cmakeDbg.updateConfigurations();
				}
			});
        }
    ));

	context.subscriptions.push(vscode.debug.onDidStartDebugSession(
		session => {
			if (session.name === "Debug portfile(s)") 
			{
				logMgr.logInfo("Starting debug portfile.");
				let root : any;
				if(vscode.workspace.workspaceFolders !== undefined) 
				{
					root = vscode.workspace.workspaceFolders[0].uri.fsPath; 
				}
				else
				{
					logMgr.logErr("Should not reach here to getVcpkgRealPath.");
					root = configMgr.getVcpkgRealPath();
				}
				configMgr.getCurrentTriplet().then(triplet => {
					cmakeDbg.startDebugging(root, triplet);
				});
			}
		}
	));

	context.subscriptions.push(vscode.debug.onDidTerminateDebugSession(
		session => {
			if (session.name === "Debug portfile(s)") 
			{
				logMgr.logInfo("Stop debug.");
				cmakeDbg.stopWaitingDebug();
			}
		}
	));
	
	configMgr.logInfo('All the event are registered.');
}

// This method is called when your extension is deactivated
export function deactivate() {}

