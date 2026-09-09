import * as assert from 'assert';
import * as vscode from 'vscode';
import { CMakeToolsService } from '../../services/cmakeToolsService';
import { VcpkgLogMgr } from '../../log';

class MockLogMgr extends VcpkgLogMgr {
    constructor() { super(true); }
    logInfo(content: string) {}
    logErr(content: string) {}
}

suite('CMakeTools Service Test Suite', () => {
    let service: CMakeToolsService;
    let logMgr: MockLogMgr;

    setup(() => {
        logMgr = new MockLogMgr();
        service = new CMakeToolsService(logMgr);
    });

    test('getAndCleanCMakeOptions logic', async () => {
        // This test depends on the current workspace configuration.
        // We can't easily set the 'cmake' config here without affecting other tests,
        // but we can verify the method returns an array.
        const options = service.getAndCleanCMakeOptions('-DVCPKG_TARGET_TRIPLET');
        assert.ok(Array.isArray(options));
    });

    test('getCMakeConfigureSetting returns object', () => {
        const setting = service.getCMakeConfigureSetting('non-existent-setting');
        assert.deepStrictEqual(setting, {});
    });
});
