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

    test('Platform: separateTriplet with invalid format', () => {
        // Even if format is weird, it should split by first hyphen
        const triplet = 'custom-triplet-with-hyphens';
        const info = platform.separateTriplet(triplet);
        assert.strictEqual(info.arch, 'custom');
        assert.strictEqual(info.os, 'triplet-with-hyphens');
    });

    test('Env: getEnvironmentValue with different casings', () => {
        // Test case-insensitive regex for $ENV{...}
        assert.strictEqual(env.getEnvironmentValue('$ENV{PATH}').length > 0, true);
        assert.strictEqual(env.getEnvironmentValue('$env{PATH}').length > 0, true);
        assert.strictEqual(env.getEnvironmentValue('$eNv{PATH}').length > 0, true);
    });

    test('Env: convertToAbsolutePath with suffix', () => {
        // Mocking VCPKG_ROOT for a moment if possible, or using a standard one like PATH
        // Since we can't easily set process.env in some environments, we test the logic
        const input = '$env{PATH}/subfolder';
        const result = env.convertToAbsolutePath(input);
        assert.ok(result.includes('/subfolder'));
        assert.ok(!result.includes('$env{PATH}'));
    });

    test('Env: getVcpkgPathFromEnv', () => {
        const original = process.env['VCPKG_ROOT'];
        process.env['VCPKG_ROOT'] = '/mock/vcpkg';
        try {
            assert.strictEqual(env.getVcpkgPathFromEnv(), '/mock/vcpkg');
        } finally {
            process.env['VCPKG_ROOT'] = original;
        }
    });
});
