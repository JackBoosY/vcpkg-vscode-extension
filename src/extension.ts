// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below

import * as vscode from 'vscode';
import { ConfigurationManager } from './configuration';

let configMgr : ConfigurationManager;
let disposables: vscode.Disposable[];

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	disposables = [];
	configMgr = new ConfigurationManager(context);
	
	configMgr.logInfo('Trying to active vcpkg plugin...');
	

	// register vcpkg
	disposables.push(vscode.commands.registerCommand('vcpkg-integration.enable_vcpkg', async() => await configMgr.enableVcpkg()));

	// disable vcpkg
	disposables.push(vscode.commands.registerCommand('vcpkg-integration.disable_vcpkg', async() => await configMgr.disableVcpkg()));
	
	// enable manifest
	disposables.push(vscode.commands.registerCommand('vcpkg-integration.enable_manifest', async() => await configMgr.enableManifest()));
	
	// disable manifest
	disposables.push(vscode.commands.registerCommand('vcpkg-integration.disable_manifest', async() => await configMgr.disableManifest()));
	
	// get current triplet
	disposables.push(vscode.commands.registerCommand('vcpkg-integration.current_triplet', async() => await configMgr.getCurrentTriplet()));
	
	// get host triplet
	disposables.push(vscode.commands.registerCommand('vcpkg-integration.current_host_triplet', async() => await configMgr.getCurrentHostTriplet()));
	
	// use static lib
	disposables.push(vscode.commands.registerCommand('vcpkg-integration.use_static_lib', async() => await configMgr.useLibType(true)));
	
	// use dynamic lib
	disposables.push(vscode.commands.registerCommand('vcpkg-integration.use_dynamic_lib', async() => await configMgr.useLibType(false)));

	// config changed event
	disposables.push(vscode.workspace.onDidChangeConfiguration(async(event) => await configMgr.onConfigurationChanged(event)));
	
	configMgr.logInfo('All the event are registered.');
}

// This method is called when your extension is deactivated
export function deactivate() {}
