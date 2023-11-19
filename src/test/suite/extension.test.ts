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

	test('Sample test', async () => {
		const ext = vscode.extensions.getExtension("JackBoosY.vcpkg-cmake-tools");
		if (ext === undefined)
		{
			console.error('Get exntension failed!');
			return;
		}
		const myExtensionContext = await ext.activate();
		verMgr = new VersionManager();
		configMgr = new ConfigurationManager(myExtensionContext, verMgr);
		assert.strictEqual(-1, [1, 2, 3].indexOf(5));
		assert.strictEqual(-1, [1, 2, 3].indexOf(0));
	});

	test('version test', () => {
		const ext = vscode.extensions.getExtension("JackBoosY.vcpkg-cmake-tools");
		if (ext === undefined)
		{
			console.error('Get exntension failed!');
			return;
		}
		//const myExtensionContext = await ext.activate();
		//verMgr = new VersionManager();
		//configMgr = new ConfigurationManager(myExtensionContext, verMgr);
		//settingMgr = new SettingsDocument(document, verMgr).provideCompletionItems(position, token);
	});
});
