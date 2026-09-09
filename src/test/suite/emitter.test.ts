import * as assert from 'assert';
import { VcpkgEventEmitter, VcpkgEventPayloads, TripletInfo } from '../../vcpkgEventEmitter';
import { VcpkgLogMgr } from '../../log';
import * as vscode from 'vscode';

// Mock Log Manager to avoid creating real output channels during tests
class MockLogMgr extends VcpkgLogMgr {
    constructor() {
        // @ts-ignore
        super(true); // Signal to skip real initialization
    }
    logInfo(content: string) {}
    logErr(content: string) {}
}

suite('Event Emitter Test Suite', () => {
    let emitter: VcpkgEventEmitter;
    let logMgr: MockLogMgr;

    setup(() => {
        logMgr = new MockLogMgr();
        emitter = new VcpkgEventEmitter(logMgr);
    });

    test('Register and Fire event', (done) => {
        const expectedPath = '/test/vcpkg/path';
        
        emitter.registerListener('TestModule', (request, result) => {
            if (request === 'setVcpkgPath') {
                assert.strictEqual(result, expectedPath);
                done();
            }
        });

        emitter.fire('TestModule', 'setVcpkgPath', expectedPath);
    });

    test('Fire event to unregistered module should not crash', () => {
        assert.doesNotThrow(() => {
            emitter.fire('NonExistentModule', 'setVcpkgRoot', 'some/path');
        });
    });

    test('Complex payload: setHostTriplet', (done) => {
        const info: TripletInfo = {
            triplets: [{ label: 'x64-windows', description: 'desc' }],
            current: 'x64-windows'
        };

        emitter.registerListener('TripletModule', (request, result) => {
            if (request === 'setHostTriplet') {
                const payload = result as TripletInfo;
                assert.strictEqual(payload.current, 'x64-windows');
                assert.strictEqual(payload.triplets?.length, 1);
                done();
            }
        });

        emitter.fire('TripletModule', 'setHostTriplet', info);
    });
});
