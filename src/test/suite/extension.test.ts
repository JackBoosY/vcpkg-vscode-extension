import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Extension Test Suite', () => {
    vscode.window.showInformationMessage('Start all tests.');

    test('Extension should be present', () => {
        assert.ok(vscode.extensions.getExtension('JackBoosY.vcpkg-cmake-tools'));
    });

    test('Extension should activate', async () => {
        const extension = vscode.extensions.getExtension('JackBoosY.vcpkg-cmake-tools');
        if (extension) {
            await extension.activate();
            assert.strictEqual(extension.isActive, true);
        }
    });

    test('Commands should be registered', async () => {
        const commands = await vscode.commands.getCommands(true);
        const expectedCommands = [
            'vcpkg-integration.enable_vcpkg',
            'vcpkg-integration.disable_vcpkg',
            'vcpkg-integration.enable_manifest',
            'vcpkg-integration.disable_manifest',
            'vcpkg-integration.current_triplet',
            'vcpkg-integration.current_host_triplet',
            'vcpkg-integration.set_target_triplet',
            'vcpkg-integration.set_host_triplet',
            'vcpkg-integration.use_static_lib',
            'vcpkg-integration.use_dynamic_lib'
        ];
        
        for (const cmd of expectedCommands) {
            assert.ok(commands.includes(cmd), `Command ${cmd} should be registered`);
        }
    });

    test('Vcpkg settings should exist', () => {
        const config = vscode.workspace.getConfiguration('vcpkg');
        assert.ok(config.has('general.enable'));
        assert.ok(config.has('general.vcpkgPath'));
        assert.ok(config.has('target.defaultTriplet'));
    });
});
