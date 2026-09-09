import * as vscode from 'vscode';
import { workspace } from 'vscode';
import { VcpkgLogMgr } from '../log';

export class CMakeToolsService {
    private _logMgr: VcpkgLogMgr;
    private _cmakeOptionConfig = 'configureArgs';
    private _configConfigSettingConfig = 'configureSettings';
    private _cmakeOptionPrefix = '-D';

    constructor(logMgr: VcpkgLogMgr) {
        this._logMgr = logMgr;
    }

    public async updateCMakeSetting(subSetting: string, value: string | boolean | string[] | Record<string, unknown>, userScope: boolean = false) {
        await workspace.getConfiguration('cmake').update(subSetting, value, userScope);
    }

    public getAndCleanCMakeOptions(condition: string): Array<string> {
        let cmakeConfigs = workspace.getConfiguration('cmake').get<Array<string>>(this._cmakeOptionConfig);
        let actualCondition = condition + '=';
        this._logMgr.logInfo('cmake options: ' + cmakeConfigs?.toString() + ' condition: ' + actualCondition);

        let newConfigs: string[] = [];
        if (cmakeConfigs !== undefined) {
            for (let curr of cmakeConfigs) {
                let matched = curr.toString().match(actualCondition);
                if (matched === null) {
                    newConfigs.push(curr);
                }
            }
        }

        return newConfigs;
    }

    public getCMakeConfigureSetting(setting: string) {
        let settings = workspace.getConfiguration('cmake').get<Record<string, unknown>>(this._configConfigSettingConfig);

        if (settings !== undefined && Object.prototype.hasOwnProperty.call(settings, setting)) {
            return settings[setting];
        }

        return {};
    }

    public getAndCleanCMakeConfigureSetting(condition: string, vcpkgInstallOptionsConfig: string): Array<string> {
        let options = this.getCMakeConfigureSetting(vcpkgInstallOptionsConfig) as Record<string, string>;

        let newConfigs: string[] = [];
        if (options !== undefined && typeof options === 'object') {
            for (let opt in options) {
                if (Object.prototype.hasOwnProperty.call(options, opt) && typeof options[opt] === 'string') {
                    if (options[opt].match(condition) === null) {
                        newConfigs.push(options[opt]);
                    }
                }
            }
        }

        return newConfigs;
    }

    public async updateCMakeConfigureSetting(value: Array<string>, vcpkgInstallOptionsConfig: string) {
        let currentSettings = workspace.getConfiguration('cmake').get<Record<string, unknown>>(this._configConfigSettingConfig);
        if (currentSettings === undefined) {
            currentSettings = {};
        } else {
            if (Object.prototype.hasOwnProperty.call(currentSettings, vcpkgInstallOptionsConfig)) {
                const {
                    [vcpkgInstallOptionsConfig]: _,
                    ...withoutInstallOptions
                } = currentSettings;
                currentSettings = withoutInstallOptions;
            }
        }
        let newConfig = { [vcpkgInstallOptionsConfig]: value };
        Object.assign(currentSettings, newConfig);

        await workspace.getConfiguration('cmake').update(this._configConfigSettingConfig, currentSettings, false);
    }

    public getCMakeVcpkgToolchain(cmakeToolchainFile: string): string | undefined {
        let currentSettings = workspace.getConfiguration('cmake').get<Record<string, unknown>>(this._configConfigSettingConfig);
        for (let curr in currentSettings) {
            if (curr.match(cmakeToolchainFile) !== null) {
                return currentSettings[curr]?.toString();
            }
        }
        return undefined;
    }

    public getCleanVcpkgToolchain(cmakeToolchainFile: string, vcpkgTargetTripletConfig: string) {
        let currentSettings = workspace.getConfiguration('cmake').get<Record<string, unknown>>(this._configConfigSettingConfig);

        let newSettings: Record<string, unknown> = {};
        if (currentSettings) {
            for (let curr in currentSettings) {
                if (curr.match(cmakeToolchainFile) !== null) {
                    continue;
                }
                if (curr.match(vcpkgTargetTripletConfig) !== null) {
                    continue;
                }

                newSettings[curr] = currentSettings[curr];
            }
        }
        return newSettings;
    }
}