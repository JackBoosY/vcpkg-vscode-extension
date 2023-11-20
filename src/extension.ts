// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below

import * as vscode from 'vscode';
import { ConfigurationManager } from './configuration';
import {SettingsDocument} from './settingsDocument';
import { VersionManager } from './versionManager';

let configMgr : ConfigurationManager;
let verMgr : VersionManager;
let disposables: vscode.Disposable[];

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	disposables = [];
	verMgr = new VersionManager();
	configMgr = new ConfigurationManager(context, verMgr);
	
	configMgr.logInfo('Trying to active vcpkg plugin...');

	// register vcpkg
	disposables.push(vscode.commands.registerCommand('vcpkg-integration.enable_vcpkg', async() => await configMgr.enableVcpkg()));

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
	
	configMgr.logInfo('All the event are registered.');
}

// This method is called when your extension is deactivated
export function deactivate() {}
