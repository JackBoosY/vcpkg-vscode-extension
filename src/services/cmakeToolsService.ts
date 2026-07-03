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

    public async updateCMakeSetting(subSetting: string, value: any, userScope: boolean = false) {
        await workspace.getConfiguration('cmake').update(subSetting, value, userScope);
    }

    public getAndCleanCMakeOptions(condition: string): Array<string> {
        let cmakeConfigs = workspace.getConfiguration('cmake').get<Array<string>>(this._cmakeOptionConfig);
        let actualCondition = condition + '=';
        this._logMgr.logInfo('cmake options: ' + cmakeConfigs?.toString() + ' condition: ' + actualCondition);

        let newConfigs = [];
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
        let settings = workspace.getConfiguration('cmake').get<Object>(this._configConfigSettingConfig);

        if (settings !== undefined && settings.hasOwnProperty(setting)) {
            return (settings as any)[setting];
        }

        return {};
    }

    public getAndCleanCMakeConfigureSetting(condition: string, vcpkgInstallOptionsConfig: string): Array<string> {
        let options = this.getCMakeConfigureSetting(vcpkgInstallOptionsConfig);

        let newConfigs = [];
        if (options !== undefined) {
            for (let opt in options) {
                if (options[opt].match(condition) === null) {
                    newConfigs.push((options as any)[opt]);
                }
            }
        }

        return newConfigs;
    }

    public async updateCMakeConfigureSetting(value: Array<string>, vcpkgInstallOptionsConfig: string) {
        let currentSettings = workspace.getConfiguration('cmake').get<Object>(this._configConfigSettingConfig);
        if (currentSettings === undefined) {
            currentSettings = {};
        } else {
            if (currentSettings.hasOwnProperty(vcpkgInstallOptionsConfig)) {
                const {
                    [vcpkgInstallOptionsConfig as keyof typeof currentSettings]: _,
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
        let currentSettings = workspace.getConfiguration('cmake').get<Object>(this._configConfigSettingConfig);
        for (let curr in currentSettings) {
            let matched = curr.match(cmakeToolchainFile);
            if (matched !== null) {
                return currentSettings[curr as keyof typeof currentSettings].toString();
            }
        }
        return undefined;
    }

    public getCleanVcpkgToolchain(cmakeToolchainFile: string, vcpkgTargetTripletConfig: string) {
        let currentSettings = workspace.getConfiguration('cmake').get<Object>(this._configConfigSettingConfig);

        let newSettings = {};
        for (let curr in currentSettings) {
            if (curr.match(cmakeToolchainFile) !== null) {
                continue;
            }
            if (curr.match(vcpkgTargetTripletConfig) !== null) {
                continue;
            }

            (newSettings as any)[curr] = (currentSettings as any)[curr];
        }
        return newSettings;
    }
}