import * as vscode from 'vscode';

export interface ArchInfo {
    arch: string;
    os: string;
}

export function getArch(): ArchInfo {
    if (process.platform === 'win32') {
        if (process.arch === 'x64') {
            return { arch: 'x64', os: 'windows' };
        } else if (process.arch === 'x86') {
            return { arch: 'x86', os: 'windows' };
        } else if (process.arch.toLowerCase() === 'arm') {
            return { arch: 'arm', os: 'windows' };
        } else if (process.arch.toLowerCase() === 'arm64') {
            return { arch: 'arm64', os: 'windows' };
        } else {
            return { arch: 'x86', os: 'windows' };
        }
    } else if (process.platform === 'darwin') {
        if (process.arch.toLowerCase() === 'arm64') {
            return { arch: 'arm64', os: 'osx' };
        } else {
            return { arch: 'x64', os: 'osx' };
        }
    } else if (process.platform === 'linux') {
        return { arch: 'x64', os: 'linux' };
    } else {
        vscode.window.showWarningMessage('Warning! Could NOT detect current triplet! Please set triplet manually.');
        return { arch: 'undefined', os: 'undefined' };
    }
}

export function combineTriplet(triplet: ArchInfo): string {
    return triplet.arch + '-' + triplet.os;
}

export function separateTriplet(triplet: string): ArchInfo {
    const sep = triplet.indexOf('-');
    const arch = triplet.slice(0, sep);
    const os = triplet.slice(sep + 1, triplet.length);

    return { arch: arch, os: os };
}
