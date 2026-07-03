import * as fs from 'fs';
import * as vscode from 'vscode';
import { workspace } from 'vscode';
import { VcpkgLogMgr } from '../log';
import { VcpkgEventEmitter } from '../vcpkgEventEmitter';
import { CMakeToolsService } from './cmakeToolsService';

export class TripletService {
    private _logMgr: VcpkgLogMgr;
    private _emitter: VcpkgEventEmitter;
    private _cmakeService: CMakeToolsService;

    private _useStaticLibConfig = 'target.useStaticLib';
    private _targetTripletConfig = 'target.defaultTriplet';
    private _hostTripletConfig = 'target.hostTriplet';
    private _vcpkgUseDynamicCRTConfig = 'target.useDynamicCRT';

    private _vcpkgTargetTripletConfig = 'VCPKG_TARGET_TRIPLET';
    private _vcpkgCRTLinkageConfig = 'VCPKG_CRT_LINKAGE';

    private _cmakeOptionConfig = 'configureArgs';
    private _cmakeOptionPrefix = '-D';
    private _cmakeOptionEanble = '=ON';
    private _cmakeOptionDisable = '=OFF';

    constructor(logMgr: VcpkgLogMgr, emitter: VcpkgEventEmitter, cmakeService: CMakeToolsService) {
        this._logMgr = logMgr;
        this._emitter = emitter;
        this._cmakeService = cmakeService;
    }

    private logInfo(content: string) {
        this._logMgr.logInfo('tripletService.ts: ' + content);
    }

    private logErr(content: string) {
        this._logMgr.logErr('tripletService.ts: ' + content);
    }

    public isStaticLib(triplet: string) {
        return triplet.endsWith('-static');
    }

    public async getAllSupportedTriplets(vcpkgPath: string | undefined) {
        let triplets = [];
        if (vcpkgPath === undefined || vcpkgPath === '') {
            return [];
        }

        try {
            // for official triplets
            const officialPath = vcpkgPath + '/triplets';
            if (fs.existsSync(officialPath)) {
                let officialTriplets = fs.readdirSync(officialPath);
                for (let curr of officialTriplets) {
                    if (curr.indexOf('.cmake') !== -1) {
                        triplets.push({ label: curr.slice(0, curr.indexOf('.cmake')), description: 'official triplet' });
                    }
                }
            }

            // for unofficial triplets
            const communityPath = vcpkgPath + '/triplets/community';
            if (fs.existsSync(communityPath)) {
                let unofficialTriplets = fs.readdirSync(communityPath);
                for (let curr of unofficialTriplets) {
                    if (curr.indexOf('.cmake') !== -1) {
                        triplets.push({ label: curr.slice(0, curr.indexOf('.cmake')), description: 'unofficial triplet' });
                    }
                }
            }
        } catch (e) {
            this.logErr('Error reading triplets: ' + e);
        }

        return triplets;
    }

    public async updateCurrentTripletSetting() {
        let isStatic = workspace.getConfiguration('vcpkg').get<boolean>(this._useStaticLibConfig);
        let currTriplet = workspace.getConfiguration('vcpkg').get<string>(this._targetTripletConfig);

        if (currTriplet === undefined) {
            this.logErr("Couldn't get current target triplet!");
            return;
        }

        this.logInfo('current target triplet is: ' + currTriplet);
        if (isStatic) {
            if (!this.isStaticLib(currTriplet)) {
                currTriplet += '-static';
            }
        } else {
            if (this.isStaticLib(currTriplet)) {
                currTriplet = currTriplet.slice(0, currTriplet.length - '-static'.length);
            }
        }

        let cmakeTargetTripletSetting = this._cmakeOptionPrefix + this._vcpkgTargetTripletConfig + '=' + currTriplet;
        this.logInfo('set target triplet to:' + cmakeTargetTripletSetting);

        await workspace.getConfiguration('vcpkg').update(this._targetTripletConfig, currTriplet);

        let newConfigs = this._cmakeService.getAndCleanCMakeOptions(this._cmakeOptionPrefix + this._vcpkgTargetTripletConfig);
        newConfigs.push(cmakeTargetTripletSetting);
        await this._cmakeService.updateCMakeSetting(this._cmakeOptionConfig, newConfigs);
    }

    public async updateCurrentCRTSetting() {
        let isUseDynamic = workspace.getConfiguration('vcpkg').get<boolean>(this._vcpkgUseDynamicCRTConfig);

        let newConfigs = this._cmakeService.getAndCleanCMakeOptions(this._cmakeOptionPrefix + this._vcpkgCRTLinkageConfig);

        let crtConfig =
            this._cmakeOptionPrefix +
            this._vcpkgCRTLinkageConfig +
            (isUseDynamic ? this._cmakeOptionEanble : this._cmakeOptionDisable);

        newConfigs.push(crtConfig);
        this.logInfo('cmake options: ' + crtConfig.toString());
        await this._cmakeService.updateCMakeSetting(this._cmakeOptionConfig, newConfigs);
    }

    public async setTriplet(isHost: boolean, vcpkgPath: string | undefined) {
        const triplets = await this.getAllSupportedTriplets(vcpkgPath);
        if (triplets.length === 0) {
            vscode.window.showErrorMessage('Please check your vcpkg path first.');
            return;
        }

        const tripletType = isHost ? 'host' : 'target';
        const result = await vscode.window.showQuickPick(triplets, {
            canPickMany: false,
            placeHolder: `Choose a ${tripletType} triplet`,
        });

        if (result !== undefined) {
            if (result.label === '') {
                vscode.window.showErrorMessage(`${tripletType} triplet should not be empty string.`);
                return;
            }

            const configToUpdate = isHost ? this._hostTripletConfig : this._targetTripletConfig;
            await workspace.getConfiguration('vcpkg').update(configToUpdate, result.label);
            this.logInfo(`update ${tripletType} triplet to: ${result.label}`);
            vscode.window.showInformationMessage(`Update ${tripletType} triplet to: ${result.label}`);

            if (isHost) {
                this._emitter.fire('VcpkgInfoSideBarViewProvider', 'setHostTriplet', {
                    triplets: await this.getAllSupportedTriplets(vcpkgPath),
                    current: result.label,
                });
            } else {
                this._emitter.fire('VcpkgInfoSideBarViewProvider', 'setDefaultTriplet', {
                    triplets: await this.getAllSupportedTriplets(vcpkgPath),
                    current: result.label,
                });
                this._emitter.fire('VcpkgDebugger', 'setDefaultTriplet', result.label);
            }
        }
    }
}
