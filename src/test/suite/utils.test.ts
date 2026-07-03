import * as assert from 'assert';
import * as platform from '../../utils/platform';
import * as env from '../../utils/env';

suite('Utility Test Suite', () => {
    test('Platform: combineTriplet', () => {
        const info: platform.ArchInfo = { arch: 'x64', os: 'windows' };
        assert.strictEqual(platform.combineTriplet(info), 'x64-windows');
    });

    test('Platform: separateTriplet', () => {
        const triplet = 'arm64-osx';
        const info = platform.separateTriplet(triplet);
        assert.strictEqual(info.arch, 'arm64');
        assert.strictEqual(info.os, 'osx');
    });

    test('Env: getEnvironmentValue (non-existent)', () => {
        assert.strictEqual(env.getEnvironmentValue('$env{NON_EXISTENT_VAR_12345}'), '');
    });

    test('Env: convertToAbsolutePath (no env var)', () => {
        const path = '/simple/path';
        assert.strictEqual(env.convertToAbsolutePath(path), path);
    });
});
