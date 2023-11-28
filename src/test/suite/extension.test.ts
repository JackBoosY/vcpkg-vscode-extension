import * as assert from 'assert';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
import { ConfigurationManager } from '../../configuration';
import {SettingsDocument} from '../../settingsDocument';
import { VersionManager } from '../../versionManager';

let configMgr : ConfigurationManager;
let verMgr : VersionManager;
let settingMgr : SettingsDocument;

suite('Extension Test Suite', () => {
	vscode.window.showInformationMessage('Start all tests.');

	test('general test', async () => {
		const ext = vscode.extensions.getExtension("JackBoosY.vcpkg-cmake-tools");
		assert.notEqual(ext, undefined, "get extension failed!");
		if (ext !== undefined)
		{
			const myExtensionContext = await ext.activate();

			verMgr = new VersionManager();
			configMgr = new ConfigurationManager(myExtensionContext, verMgr);

			configMgr.disableVcpkg();
			configMgr.enableVcpkg();
			assert.equal(configMgr.isVcpkgEnabled(), true, "test enable vcpkg failed");
	
			configMgr.disableVcpkg();
			assert.equal(configMgr.isVcpkgEnabled(), false, "test disable vcpkg failed");
		}
	});

	test('version test', () => {
		const ext = vscode.extensions.getExtension("JackBoosY.vcpkg-cmake-tools");
		assert.notEqual(ext, undefined, "get extension failed!");
		//const myExtensionContext = await ext.activate();
		//verMgr = new VersionManager();
		//configMgr = new ConfigurationManager(myExtensionContext, verMgr);
		//settingMgr = new SettingsDocument(document, verMgr).provideCompletionItems(position, token);
	});
});
