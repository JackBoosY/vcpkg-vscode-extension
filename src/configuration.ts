import * as fs from 'fs'; 
import path = require('path');
import * as vscode from 'vscode';
import { workspace } from "vscode";
import * as proc from 'child_process';
import { VcpkgLogMgr } from './log';
import {VcpkgEventEmitter} from './vcpkgEventEmitter';
import {DepNodeProvider} from './sidebar/DepNodeProvider';

export class ConfigurationManager implements vscode.Disposable
{
    //private _context: vscode.ExtensionContext;
    private disposables: vscode.Disposable[] = [];
    private _logMgr : VcpkgLogMgr;
    private _emitter: VcpkgEventEmitter;
    private _nodeProvider: DepNodeProvider;

    private _enableVcpkgConfig = 'general.enable';
    private _vcpkgPathConfig = 'general.vcpkgPath';
    private _vcpkgAssetSourceConfig = 'general.assetSource';
    private _vcpkgBinaryCacheConfig = 'general.binaryCaching';
    private _autoUpdateTriplet = 'general.autoUpdateTriplet';
    private _useManifestConfig = 'target.useManifest';
    private _installDependenciesConfig = 'target.installDependencies';
    private _preferSystemLibsConfig = 'target.preferSystemLibs';
    private _additionalOptionsConfig = 'target.additionalOptions';
    private _useStaticLibConfig = 'target.useStaticLib';
    private _vcpkgUseDynamicCRTConfig = 'target.useDynamicCRT';
    private _targetTripletConfig = 'target.defaultTriplet';
    private _hostTripletConfig = 'target.hostTriplet';

    private _cmakeOptionConfig = 'configureArgs';
    private _configConfigSettingConfig = 'configureSettings';

    private _vcpkgRootConfig = 'VCPKG_ROOT';
    private _vcpkgManifestModeConfig = 'VCPKG_MANIFEST_MODE';
    private _vcpkgTargetTripletConfig = 'VCPKG_TARGET_TRIPLET';
    private _vcpkgInstallOptionsConfig = 'VCPKG_INSTALL_OPTIONS';
    private _vcpkgCRTLinkageConfig = 'VCPKG_CRT_LINKAGE';
    private _vcpkgApplocalDepsConfig = 'VCPKG_APPLOCAL_DEPS';
    private _vcpkgApplocalDepsInstallConfig = 'X_VCPKG_APPLOCAL_DEPS_INSTALL';
    private _vcpkgPreferSystemLibsConfig = 'VCPKG_PREFER_SYSTEM_LIBS';
    private _vcpkgAssetSourceEnvConfig = 'X_VCPKG_ASSET_SOURCES';
    private _vcpkgBinarySourceEnvConfig = 'VCPKG_BINARY_SOURCES';
    private _vcpkgAssertSourceOption = '--x-asset-sources';
    private _vcpkgBinarySourceOption = '--x-binarysource';
    private _cmakeOptionPrefix = '-D';
    private _cmakeOptionEanble = '=ON';
    private _cmakeOptionDisable = '=OFF';

    constructor(/*context: vscode.ExtensionContext, */logMgr : VcpkgLogMgr, nodeProvider: DepNodeProvider, emitter: VcpkgEventEmitter) {
        // this._context = context;
        this._logMgr = logMgr;
        this._emitter = emitter;
        this.eventCallback = this.eventCallback.bind(this);
        this._emitter.registerListener("ConfigurationManager", this.eventCallback);
        this._nodeProvider = nodeProvider;

        let vcpkgPath= this.getVcpkgPathFromConfig();
        if (vcpkgPath !== undefined)
        {
            this._emitter.fire("VersionManager", "setVcpkgRoot", vcpkgPath);
            this._nodeProvider.setVcpkgPath(vcpkgPath);
            this.updateVcpkgSetting(this._vcpkgPathConfig, vcpkgPath, true);
        }

        // Update vcpkg target triplet
        let automaticUpdateTriplet = workspace.getConfiguration('vcpkg').get<Boolean>(this._autoUpdateTriplet);
        if (automaticUpdateTriplet && this.isVcpkgEnabled())
        {
            this.getCurrentTriplet().then((currentTriplet) => {
                const currentArch = this.getArch();
                let newTriplet = this.combineTriplet(currentArch);
                if (currentTriplet !== undefined && newTriplet !== currentTriplet)
                {
                    let triplet = this.separateTriplet(currentTriplet);
                    if (triplet.arch === "" || triplet.os === "")
                    {
                        this.updateVcpkgSetting(this._targetTripletConfig, newTriplet);
                        this.logInfo('Detected wrong triplet setting, automatically update target triplet to: ' + newTriplet);
                        vscode.window.showInformationMessage('Detected wrong triplet setting, automatically update target triplet to: ' + newTriplet);
                    }
                    else if (currentArch.os !== triplet.os)
                    {
                        let newTriplet = this.combineTriplet({arch: triplet.arch, os: currentArch.os});
                        this.updateVcpkgSetting(this._targetTripletConfig, newTriplet);
                        this.logInfo('Automatically update target triplet to: ' + newTriplet);
                        vscode.window.showInformationMessage('Automatically update target triplet to: ' + newTriplet);
                    }
                }
            });
            this.getCurrentHostTriplet().then((currentHostTriplet) => {
                const currentArch = this.getArch();
                if (currentHostTriplet !== undefined && this.combineTriplet(currentArch) !== currentHostTriplet)
                {
                    let triplet = this.separateTriplet(currentHostTriplet);
                    if (triplet.os !== currentArch.os)
                    {
                        let newTriplet = this.combineTriplet({arch: triplet.arch, os: currentArch.os});
                        this.updateVcpkgSetting(this._hostTripletConfig, newTriplet);
                        this.logInfo('Automatically update host triplet to: ' + newTriplet);
                        vscode.window.showInformationMessage('Automatically update host triplet to: ' + newTriplet);
                    }
                }
            });
        }
    }

    public logInfo(content: string)
    {
        this._logMgr.logInfo("configuration.ts: " + content);
    }

    public logErr(content: string)
    {
        this._logMgr.logErr("configuration.ts: " + content);
    }

    public eventCallback(request: string, result: any)
    {
		switch (request) {
            case "getVcpkgPathFromInfoSidebar":
            {
                this._emitter.fire("VcpkgInfoSideBarViewProvider", "setVcpkgPath", this.getVcpkgRealPath());
            }
            break;
            case "getCurrentTripletFromInfoSidebar":
            {
                this.getCurrentTriplet().then(async result => {
                    this._emitter.fire("VcpkgInfoSideBarViewProvider", "setDefaultTriplet", {triplets: this.getAllSupportedTriplets(), current: result});
                });
            }
            break;
            case "getHostTripletFromInfoSidebar":
            {
                this.getCurrentHostTriplet().then(async result => {
                    this._emitter.fire("VcpkgInfoSideBarViewProvider", "setHostTriplet", {triplets: this.getAllSupportedTriplets(), current: result});
                });
            }
            break;
            case "getManifestModeFromInfoSidebar":
            {
                this.getManifestMode().then(async result => {
                    this._emitter.fire("VcpkgInfoSideBarViewProvider", "setManifestMode", result);
                });
            }
            break;
            case "setVcpkgPath":
            {
                this.setVcpkgPath(result);
            }
            break;
            case "setCurrentTriplet":
            {
                this.setTargetTripletByString(result);
            }
            break;
            case "setHostTriplet":
            {
                this.setHostTripletByString(result);
            }
            break;
            case "setManifestMode":
            {
                if (result) {
                    this.enableManifest();
                }
                else {
                    this.disableManifest();
                }
            }
            break;
			default:
			{
				this._logMgr.logErr("CmakeDebugger eventCallback: received unrecognized message type: " + request);
			}
			break;
		}
    }

    private async runCommand(command: string, param: string, executeRoot: string): Promise<string>
    {
        try {
            return await proc.execSync(command + ' ' + param, {cwd: executeRoot, encoding: 'utf-8'});
        }
        catch (error) {
            return "";
        }
    }

    private getArch(){
        this.logInfo('process.platform: ' + process.platform);
        this.logInfo('os.arch: ' + process.arch);

		if (process.platform === "win32")
		{
			if (process.arch === 'x64')
			{
                return {arch: "x64", os: "windows"};
			}
			else if (process.arch === 'x86')
			{
                return {arch: "x86", os: "windows"};
			}
			else if (process.arch.toLowerCase() === 'arm')
			{
                return {arch: "arm", os: "windows"};
			}
			else if (process.arch.toLowerCase() === 'arm64')
			{
                return {arch: "arm64", os: "windows"};
			}
            else
            {
                return {arch: "x86", os: "windows"};
            }
		}
		else if (process.platform === "darwin")
		{
            if (process.arch.toLowerCase() === 'arm64')
            {
                return {arch: "arm64", os: "osx"};
            }
            else
            {
                return {arch: "x64", os: "osx"};
            }
		}
		else if (process.platform === "linux")
		{
            return {arch: "x64", os: "linux"};
		}
        else
        {
            vscode.window.showWarningMessage('Warning! Could NOT detect current triplet! Please set triplet manually.');
            return {arch: "undefined", os: "undefined"};
        }
    }

    private combineTriplet(triplet: {arch: string, os: string})
    {
        return triplet.arch + "-" + triplet.os;
    }

    private separateTriplet(triplet: string)
    {
        let sep = triplet.indexOf('-');
        let arch = triplet.substring(0, sep);
        let os = triplet.substring(sep + 1, triplet.length);

        return {arch: arch, os: os};
    }

    private getEnvironmentValue(name: string)
    {
        if (name.search(/\$[Ee][Nn][Vv]{(.+)}/) !== -1)
        {
            let envName = name.match(/\$[Ee][Nn][Vv]{(.+)}/)?.at(1);

            if (envName !== undefined && process.env[envName] !== undefined)
            {
                return process.env[envName];
            }
            else
            {
                return '';
            }
        }
        else
        {
            return '';
        }
    }

    private convertToAbsolutePath(path: string)
    {
        if (path.search(/\$[Ee][Nn][Vv]{(.+)}/) !== -1)
        {
            let envName = this.getEnvironmentValue(path);
            let suffix = path.match(/\$[Ee][Nn][Vv]{.+}(.*)/)?.at(1);

            if (envName)
            {
                return envName + suffix;
            }
        }
        return path;
    }

    private getVcpkgPathFromEnv()
    {
        let envVar = process.env[this._vcpkgRootConfig];
        // let envVar = this._context.environmentVariableCollection.get(this._vcpkgRootConfig);

        if (envVar !== undefined && envVar.length !== 0)
        {
            return envVar;
        }

        return undefined;
    }

    private getVcpkgPathFromConfig()
    {
        let tryFirst = workspace.getConfiguration('vcpkg').get<string>(this._vcpkgPathConfig);

        if ((tryFirst !== undefined && tryFirst.length !== 0) && this.isVcpkgExistInPath(tryFirst))
        {
            return tryFirst;
        }

        return undefined;
    }

    private generateVcpkgFullPath(path: string)
    {
        if (process.platform === "win32")
        {
            return path + '/vcpkg.exe';
        }
        else
        {
            return path + '/vcpkg';
        }
    }

    private isVcpkgEnabled()
    {
        let oldPath = this.getVcpkgPathFromConfig();

        if (oldPath === undefined)
        {
            return false;
        }

        let config = workspace.getConfiguration('vcpkg').get<boolean>(this._enableVcpkgConfig);


        return config !== undefined ? config : false;
    }

    private isVcpkgExistInPath(path: string)
    {
        let fullPath = '';
        // check whether this path is a environment variable
        if (path.search(/\$[Ee][Nn][Vv]{(.+)}/) === 0)
        {
            let envVar = this.convertToAbsolutePath(path);
            if (envVar.length)
            {
                fullPath = this.generateVcpkgFullPath(envVar);
            }
        }

        // otherwize, treat it as an absolute path
        if (fullPath.length === 0)
        {
            fullPath = this.generateVcpkgFullPath(path);
        }

        if (fs.existsSync(fullPath))
        {
            return true;
        }
        else
        {
            this.logErr('vcpkg was not found in path ' + fullPath);
            return false;
        }
    }

    private getAndCleanCMakeOptions(condition: string)
    {
		let cmakeConfigs = workspace.getConfiguration('cmake').get<Array<string>>(this._cmakeOptionConfig);
        condition += '=';
		this.logInfo('cmake options: ' + cmakeConfigs?.toString() + ' condition: ' + condition);

        let newConfigs = new Array<string>;
        if (cmakeConfigs !== undefined)
        {
            for (let curr in cmakeConfigs)
            {
                //this.logInfo('current cmake option: ' + cmakeConfigs[curr].toString() + ' index: ' + curr);
                let matched = cmakeConfigs[curr].toString().match(condition);
                //this.logInfo('matched: ' + matched);
                if (matched === null)
                {
                    newConfigs.push(cmakeConfigs[curr]);
                }
            }
        }

        return newConfigs;
    }

    private getCMakeConfigureSetting(setting: string)
    {
        let settings = workspace.getConfiguration('cmake').get<Object>(this._configConfigSettingConfig);

        if (settings !== undefined && settings.hasOwnProperty(setting))
        {
            return (settings as any)[setting];
        }

        return new Object;
    }

    private async updateCMakeSetting(subSetting: string, value: any, userScope: boolean = false)
    {
        await workspace.getConfiguration('cmake').update(subSetting, value, userScope);
    }

    private async updateVcpkgSetting(subSetting: string, value: any, userScope: boolean = false)
    {
        await workspace.getConfiguration('vcpkg').update(subSetting, value, userScope);
    }

    private getAndCleanCMakeConfigureSetting(condition: string)
    {
        let options = this.getCMakeConfigureSetting(this._vcpkgInstallOptionsConfig);

        let newConfigs = new Array<string>;
        if (options !== undefined)
        {
            for (let opt in options)
            {
                if (options[opt].match(condition) === null)
                {
                    newConfigs.push((options as any)[opt]);
                }
            }
        }

        return newConfigs;
    }

    private async updateCMakeConfigureSetting(value: Array<string>)
    {
        let currentSettings = workspace.getConfiguration('cmake').get<Object>(this._configConfigSettingConfig);
        if (currentSettings === undefined)
        {
            currentSettings = new Object;
        }
        else
        {
            if (currentSettings.hasOwnProperty(this._vcpkgInstallOptionsConfig))
            {
                const {[this._vcpkgInstallOptionsConfig as keyof typeof currentSettings]: _, ...withoutInstallOptions} = currentSettings;
                currentSettings = withoutInstallOptions;
            }
        }
        let newConfig = {[this._vcpkgInstallOptionsConfig] : value};
        // eslint-disable-next-line @typescript-eslint/naming-convention
        Object.assign(currentSettings, newConfig);
        
        workspace.getConfiguration('cmake').update(this._configConfigSettingConfig, currentSettings, false);
    }
    
    private getCMakeVcpkgToolchain()
    {
        let currentSettings = workspace.getConfiguration('cmake').get<Object>(this._configConfigSettingConfig);
        for (let curr in currentSettings)
        {
            //this.logInfo("curr:" + curr);
            let matched = curr.match('CMAKE_TOOLCHAIN_FILE');
            //this.logInfo("matched:" + matched);

            if (matched !== null)
            {
                return currentSettings[curr as keyof typeof currentSettings].toString();
            }
        }
        return undefined;
    }

    private getCleanVcpkgToolchian()
    {
        let currentSettings = workspace.getConfiguration('cmake').get<Object>(this._configConfigSettingConfig);

        let newSettings = new Object;
        for (let curr in currentSettings)
        {
            //this.logInfo("curr:" + curr);
            let matched = curr.match('CMAKE_TOOLCHAIN_FILE');
            //this.logInfo("matched:" + matched);

            if (matched !== null)
            {
                continue;
            }
            matched = curr.match('VCPKG_TARGET_TRIPLET');
            if (matched !== null)
            {
                continue;
            }

            (newSettings as any)[curr] = (currentSettings as any)[curr];
        }
        return newSettings;
    }

    private isStaticLib(triplet : string)
    {
        return triplet.endsWith('-static');
    }

    private async cleanupVcpkgRelatedCMakeOptions()
    {
        this.logInfo('clean up vcpkg-related cmake configs.');
        let cleanOptions = this.getAndCleanCMakeOptions(this._cmakeOptionPrefix + this._vcpkgManifestModeConfig);
        this.updateCMakeSetting(this._cmakeOptionConfig, cleanOptions);
        cleanOptions = this.getAndCleanCMakeOptions(this._cmakeOptionPrefix + this._vcpkgTargetTripletConfig);
        this.updateCMakeSetting(this._cmakeOptionConfig, cleanOptions);
        cleanOptions = this.getAndCleanCMakeOptions(this._cmakeOptionPrefix + this._vcpkgCRTLinkageConfig);
        this.updateCMakeSetting(this._cmakeOptionConfig, cleanOptions);
    }

    private async checkVcpkgToolchain(vcpkgRoot: string)
    {
        let originToolchain = this.getCMakeVcpkgToolchain();
        if (originToolchain !== undefined)
        {
            if (fs.existsSync(originToolchain))
            {
                // check whether the vcpkg path in toolchain is not the same with the path in settings
                if (this.convertToAbsolutePath(originToolchain) !== this.convertToAbsolutePath(vcpkgRoot + '/scripts/buildsystems/vcpkg.cmake'))
                {
                    this.logInfo('Detected invalid toolchain.');
                    return false;
                }
                else
                {
                    // use current toolchain
                    this.logInfo('Detected valid toolchain.');
                    return true;
                }
            }
            else
            {
                this.logInfo('toolchain file is not found.');
                return false;
            }
        }

        return false;
    }

    private async addVcpkgToolchain(vcpkgRoot : string)
    {
        if (this.getCMakeVcpkgToolchain() !== undefined)
        {
            if (!(await this.checkVcpkgToolchain(vcpkgRoot)))
            {
                vscode.window.showErrorMessage('Detected mismatched vcpkg toolchain!');
                let result = await vscode.window.showQuickPick(['Disable vcpkg', 'Override vcpkg toolchain'], {canPickMany: false});
    
                if (result === 'Disable vcpkg')
                {
                    this.logErr('Detected mismatched toolchain, user canceled, now disable vcpkg');
                    vscode.window.showInformationMessage('Vcpkg will be disabled.');
                    this.disableVcpkg(false);
                    return false;
                }
                else
                {
                    this.logInfo('Detected mismatched toolchain, use continue, override vcpkg toolchain now.');
                    // continue to override the vcpkg toolchain
                }
            }
            else
            {
                // toolchain is matched and set.
                return true;
            }
        }

        let cleanConfig = this.getCleanVcpkgToolchian();
        (cleanConfig as any)['CMAKE_TOOLCHAIN_FILE'] = vcpkgRoot + '/scripts/buildsystems/vcpkg.cmake';
        
        this.updateCMakeSetting(this._configConfigSettingConfig, cleanConfig);

        return true;
    }

    private async updateCurrentTripletSetting()
    {
        let isStatic = workspace.getConfiguration('vcpkg').get<boolean>(this._useStaticLibConfig);
		let currTriplet = workspace.getConfiguration('vcpkg').get<string>(this._targetTripletConfig);

        if (currTriplet === undefined)
        {
            this.logErr('Couldn\'t get current target triplet!');
            vscode.window.showErrorMessage('Vcpkg extension has problem! Please report it to github then disable and enable vcpkg extension.');
            return;
        }
        
        this.logInfo('current target triplet is: ' + currTriplet);
        if (isStatic)
        {
            if (!this.isStaticLib(currTriplet))
            {
                currTriplet += '-static';
            }
        }
        else
        {
            if (this.isStaticLib(currTriplet))
            {
                currTriplet = currTriplet.substring(0, currTriplet.length - '-static'.length);
            }
        }

        let cmakeTargetTripletSetting = this._cmakeOptionPrefix + this._vcpkgTargetTripletConfig + '=' + currTriplet;
        this.logInfo('set target triplet to:' + cmakeTargetTripletSetting);
        
        this.updateVcpkgSetting(this._targetTripletConfig, currTriplet);

        let newConfigs = this.getAndCleanCMakeOptions(this._cmakeOptionPrefix + this._vcpkgTargetTripletConfig);

        newConfigs.push(cmakeTargetTripletSetting);
        
        this.updateCMakeSetting(this._cmakeOptionConfig, newConfigs);
    }

    private async updateCurrentCRTSetting()
    {
        let isUseDynamic = workspace.getConfiguration('vcpkg').get<boolean>(this._vcpkgUseDynamicCRTConfig);

        let newConfigs = this.getAndCleanCMakeOptions(this._cmakeOptionPrefix + this._vcpkgCRTLinkageConfig);

        let crtConfig = this._cmakeOptionPrefix + this._vcpkgCRTLinkageConfig + (isUseDynamic ? this._cmakeOptionEanble : this._cmakeOptionDisable);

        newConfigs.push(crtConfig);

		this.logInfo('cmake options: ' + crtConfig.toString());
        
        this.updateCMakeSetting(this._cmakeOptionConfig, newConfigs);
    }

    private async initCMakeSettings(vcpkgPath : string)
    {
        this.logInfo('init cmake settings.');
        this.updateVcpkgSetting(this._vcpkgPathConfig, vcpkgPath, true);

        let currArch = this.combineTriplet(this.getArch());

        this.logInfo('current arch is: ' + currArch);

        this.updateVcpkgSetting(this._enableVcpkgConfig, true);
        this.updateVcpkgSetting(this._hostTripletConfig, currArch);
        this.logInfo('update host triplet to: ' + currArch);
        this.updateVcpkgSetting(this._targetTripletConfig, currArch);
        this.logInfo('update target triplet to: ' + currArch);

        this.updateVcpkgSetting(this._useStaticLibConfig, false);
        this.logInfo('update use static lib to: ' + false);
        
        this.updateCurrentTripletSetting();
        if (!(await this.addVcpkgToolchain(vcpkgPath)))
        {
            return false;
        }

        this.updateVcpkgSetting(this._installDependenciesConfig, true);
        this.updateVcpkgSetting(this._preferSystemLibsConfig, false);

        // disable manifest mode by default
        this.disableManifest();

        return true;
    }

    private async isContainManifestFile() {
        let projectPath = vscode.workspace.workspaceFolders?.map(folder => folder.uri.path);

        if (projectPath !== undefined && projectPath.length)
        {
            if (process.platform === "win32" && projectPath[0].startsWith('/'))
            {
                projectPath[0] = projectPath[0].substring(1, projectPath[0].length);
            }
            return fs.existsSync(projectPath[0] + '/vcpkg.json');
        }
        else
        {
            return false;
        }
    }

    private async suggestManifestMode() {
        let foundManifest = await this.isContainManifestFile();
        if (foundManifest)
        {
            interface Choice {
                title: string;
                enableManifest: boolean;
            }
            const chosen = await vscode.window.showInformationMessage<Choice>(
                'Found manifest file in current project path, would you like to enable manifest mode?',
                {},
                { title: 'Yes', enableManifest: true },
                { title: 'Not now', enableManifest: false });
            
            if (chosen && chosen.enableManifest)
            {
                this.enableManifest();
            }
        }
    }

    public async chooseAndUpdateVcpkgPath() {
        let path = "";
        await this.chooseVcpkgPath().then(async result => {
            if (await this.isVcpkgExistInPath(result))
            {
                this.updateVcpkgSetting(this._vcpkgPathConfig, result, true);
                this._emitter.fire("VersionManager", "setVcpkgRoot", result);
                this._nodeProvider.setVcpkgPath(result);

                path = result;
            }
            else
            {
                this.logErr('invalid vcpkg path: ' + result + ' , plugin will not be enabled.');
                vscode.window.showErrorMessage('Invalid vcpkg path, vcpkg will not be enabled.');
            }
        });

        return Promise.resolve(path);
    }

    public async chooseVcpkgPath() {
        let path = "";
        let options = {
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            openLabel: 'Select vcpkg root path'
        };
        await vscode.window.showOpenDialog(options).then(async result => {
            if (result === undefined)
            {
                this.logErr('invalid vcpkg path, plugin will not be enabled.');
                vscode.window.showErrorMessage('Invalid vcpkg path, vcpkg will not be enabled.');
                return;
            }

            let uri = result[0].path.toString();

            this.logInfo("select: " + uri);

            if (process.platform === "win32")
            {
                path = uri.substring(1, uri.length);
            }
            else
            {
                path = uri;
            }
        });

        return Promise.resolve(path);
    }

    public async setVcpkgPath(path: string) {
        if (path === undefined || path === "") {
            this.logInfo('detect select valid vcpkg path.');
            return;
        }

        let oldPath = await this.getVcpkgPathFromConfig();

        if (oldPath !== undefined && oldPath === path)
        {
            this.logInfo('vcpkg already set to ' + oldPath + '.');
            return;
        }

		let vcpkgRootEnv = await this.getVcpkgPathFromEnv();
		if (vcpkgRootEnv !== undefined && vcpkgRootEnv === path)
		{
            this.logInfo('vcpkg already set to ' + oldPath + '.');
            return;
		}

        if (await this.isVcpkgExistInPath(path))
        {
            if (!this.initCMakeSettings(path))
            {
                return;
            }
            this._emitter.fire("VersionManager", "setVcpkgRoot", path);
            this._nodeProvider.setVcpkgPath(path);

            vscode.window.showInformationMessage('vcpkg enabled.');

            this.logInfo('update target/host triplet to ' + workspace.getConfiguration('vcpkg').get<string>(this._hostTripletConfig));

            this.logInfo('detect select valid vcpkg path: ' + path + '.');
        }
        else
        {
            this.logErr('invalid vcpkg path: ' + path + ' , this changes will not be applied.');
            vscode.window.showErrorMessage('Invalid vcpkg path, this changes will not be applied.');
        }
    }

    public async enableVcpkg(forceEnable: Boolean) {
        if (this.isVcpkgEnabled() && !forceEnable)
        {
            this.logInfo('vcpkg is already enabled.');
            return;
        }

        // cleanup old vcpkg-related cmake configs
        this.logInfo('cleanning vcpkg related cmake options.');
        this.cleanupVcpkgRelatedCMakeOptions();

        let oldPath = await this.getVcpkgPathFromConfig();

        if (oldPath !== undefined)
        {
            if (!this.initCMakeSettings(oldPath))
            {
                return;
            }
            this._emitter.fire("VersionManager", "setVcpkgRoot", oldPath);
            this._nodeProvider.setVcpkgPath(oldPath);

            this.logInfo('vcpkg already set to ' + oldPath + ' , enabled plugin.');
            // vscode.window.showInformationMessage('vcpkg enabled.');
            return;
        }

		let vcpkgRootEnv = await this.getVcpkgPathFromEnv();
		if (vcpkgRootEnv !== undefined)
		{
			if (await this.isVcpkgExistInPath(vcpkgRootEnv))
			{
                if (!this.initCMakeSettings(vcpkgRootEnv))
                {
                    return;
                }
                this._emitter.fire("VersionManager", "setVcpkgRoot", vcpkgRootEnv);
                this._nodeProvider.setVcpkgPath(vcpkgRootEnv);

				vscode.window.showInformationMessage('vcpkg enabled.');

				this.logInfo('update target/host triplet to ' + workspace.getConfiguration('vcpkg').get(this._hostTripletConfig));

                this.logInfo('detect env VCPKG_ROOT: ' + vcpkgRootEnv + ' , enabled plugin.');
				return;
			}
			else
			{
                this.logErr('invalid env VCPKG_ROOT, plugin will not be enabled.');
				vscode.window.showErrorMessage('Invalid vcpkg path, vcpkg will not be enabled, pleaes check envornment variable VCPKG_ROOT.');
				return;
			}
		}
		else
		{
            this.chooseVcpkgPath().then(async result => {
                if (await this.isVcpkgExistInPath(result))
                    {
                        if (!this.initCMakeSettings(result))
                        {
                            return;
                        }
                        this._emitter.fire("VersionManager", "setVcpkgRoot", result);
                        this._nodeProvider.setVcpkgPath(result);
        
                        vscode.window.showInformationMessage('vcpkg enabled.');
        
                        this.logInfo('update target/host triplet to ' + workspace.getConfiguration('vcpkg').get<string>(this._hostTripletConfig));
        
                        this.logInfo('detect select valid vcpkg path: ' + result + ' , enabled plugin.');
                    }
                    else
                    {
                        this.logErr('invalid vcpkg path: ' + result + ' , plugin will not be enabled.');
                        vscode.window.showErrorMessage('Invalid vcpkg path, vcpkg will not be enabled.');
                    }
            });
		}
    }

    public async disableVcpkg(cleanToolChain: boolean)
    {
        if (!this.isVcpkgEnabled())
        {
            return;
        }

        await this.updateVcpkgSetting(this._enableVcpkgConfig, false);

        // clean vcpkg options
        await this.cleanupVcpkgRelatedCMakeOptions();
        
        // clean toolchain setting
        if (cleanToolChain)
        {
            await this.updateCMakeSetting(this._configConfigSettingConfig, this.getCleanVcpkgToolchian());
        }

        this.logInfo('Disabled vcpkg plugin.');
    }

    public async enableManifest()
    {
        if (!this.isVcpkgEnabled())
        {
            vscode.window.showErrorMessage('Vcpkg is not enabled yet, manifest mode will not be enabled.');
            return;
        }

        let found = await this.isContainManifestFile();
        if (!found)
        {
            vscode.window.showWarningMessage('Enable manifest mode failed: current project path doesn\'t contains vcpkg.json');
            return;
        }

		vscode.window.showInformationMessage('Manifest mode enabled.');

        await this.updateVcpkgSetting(this._useManifestConfig, true);

        let newConfigs = this.getAndCleanCMakeOptions(this._cmakeOptionPrefix + this._vcpkgManifestModeConfig);

        newConfigs.push(this._cmakeOptionPrefix + this._vcpkgManifestModeConfig + this._cmakeOptionEanble);

		this.logInfo('cmake options: ' + newConfigs.toString());
        await this.updateCMakeSetting(this._cmakeOptionConfig, newConfigs);
    }

    public async disableManifest()
    {
		vscode.window.showInformationMessage('Manifest mode disabled.');

        await this.updateVcpkgSetting(this._useManifestConfig, false);

        let newConfigs = this.getAndCleanCMakeOptions(this._cmakeOptionPrefix + this._vcpkgManifestModeConfig);

        newConfigs.push(this._cmakeOptionPrefix + this._vcpkgManifestModeConfig + this._cmakeOptionDisable);

		this.logInfo('cmake options: ' + newConfigs.toString());
        await this.updateCMakeSetting(this._cmakeOptionConfig, newConfigs);
    }

    public getVcpkgRealPath()
    {
        let config = this.getVcpkgPathFromConfig();
        // environment variable
        if (config?.indexOf("$ENV") === 0) {
            return this.getVcpkgPathFromEnv();
        }
        else
        {
            // true real path
            return config;
        }
    }

    public getAllSupportedTriplets()
    {
        let triplets = [];
        let vcpkgPath = this.getVcpkgRealPath();

        if (vcpkgPath === undefined)
        {
            vscode.window.showErrorMessage('Invalid vcpkg path, vcpkg will not be enabled.');
            return;
        }

        // for official triplets
        let officialTriplets = fs.readdirSync(vcpkgPath + '/triplets');
        for (let i = 0; i < officialTriplets.length; i++)
        {
            let curr = officialTriplets[i];
            if (curr.indexOf('.cmake') !== -1)
            {
                triplets.push({label: curr.substring(0, curr.indexOf('.cmake')), description: 'official triplet'});
            }
        }

        // for unofficial triplets
        let unofficialTriplets = fs.readdirSync(vcpkgPath + '/triplets/community');
        for (let i = 0; i < unofficialTriplets.length; i++)
        {
            let curr = unofficialTriplets[i];
            if (curr.indexOf('.cmake') !== -1)
            {
                triplets.push({label: curr.substring(0, curr.indexOf('.cmake')), description: 'unofficial triplet'});
            }
        }

        // TODO: for custom triplets

        return triplets;
    }

    public setTargetTripletByString(triplet: string)
    {
        this.updateVcpkgSetting(this._targetTripletConfig, triplet);
        this.logInfo('update target triplet to: ' + triplet);
        vscode.window.showInformationMessage('Update target triplet to: ' + triplet);
    }

    public async setTargetTriplet()
    {
        let triplets = this.getAllSupportedTriplets();
        if (triplets === undefined || triplets.length === 0)
        {
            vscode.window.showErrorMessage('Please check your vcpkg path first.');
            return;
        }

        let result = await vscode.window.showQuickPick(triplets, {canPickMany: false, placeHolder: "Choose a triplet"});
        if (result !== undefined)
        {
            if (result.label === "") 
            {
                vscode.window.showErrorMessage('Target triplet should not be empty string.');
            }
            this.updateVcpkgSetting(this._targetTripletConfig, result.label);
            this.logInfo('update target triplet to: ' + result.label);
            vscode.window.showInformationMessage('Update target triplet to: ' + result.label);

            // Update debugger configuration
            this._emitter.fire("VcpkgInfoSideBarViewProvider", "setDefaultTriplet", {triplets: this.getAllSupportedTriplets(), current: result.label});
            this._emitter.fire("VcpkgDebugger", "setDefaultTriplet", result.label);
            // this._emitter.fire("VcpkgDebugger", "onDidChangeBreakpoints", null); // why I need this?
        }
    }

    public setHostTripletByString(triplet: string)
    {
        this.updateVcpkgSetting(this._hostTripletConfig, triplet);
        this.logInfo('update host triplet to: ' + triplet);
        vscode.window.showInformationMessage('Update host triplet to: ' + triplet);
    }

    public async setHostTriplet()
    {
        let triplets = this.getAllSupportedTriplets();
        if (triplets === undefined || triplets.length === 0)
        {
            vscode.window.showErrorMessage('Please check your vcpkg path first.');
            return;
        }

        let result = await vscode.window.showQuickPick(triplets, {canPickMany: false, placeHolder: "Choose a triplet"});
        if (result !== undefined)
        {
            this.updateVcpkgSetting(this._hostTripletConfig, result.label);
            this.logInfo('update host triplet to: ' + result.label);
            vscode.window.showInformationMessage('Update host triplet to: ' + result.label);
            this._emitter.fire("VcpkgInfoSideBarViewProvider", "setHostTriplet", {triplets: this.getAllSupportedTriplets(), current: result.label});
        }
    }

    public async getCurrentTriplet()
    {
		return workspace.getConfiguration('vcpkg').get<string>(this._targetTripletConfig);
    }
    public async showCurrentTriplet()
    {
		vscode.window.showInformationMessage('Current triplet is: ' + await this.getCurrentTriplet());
    }

    public async showCurrentHostTriplet()
    {
		vscode.window.showInformationMessage('Current host triplet is: ' + await this.getCurrentHostTriplet());
    }

    public async getCurrentHostTriplet()
    {
        return workspace.getConfiguration('vcpkg').get<string>(this._hostTripletConfig);
    }
    
    public async useLibType(staticLib: boolean)
    {
        await this.updateVcpkgSetting(this._useStaticLibConfig, staticLib);

        await this.updateCurrentTripletSetting();

        this.logInfo('Set to ' + staticLib? 'static': 'dynamic' + ' triplet');
		vscode.window.showInformationMessage('Now use ' + (staticLib? 'static': 'dynamic') + ' library / triplet');
    }

    public async getLibType()
    {
        return workspace.getConfiguration('vcpkg').get<string>(this._useStaticLibConfig);
    }

    public async useCRTType(dynamicCRT: boolean)
    {
        await this.updateVcpkgSetting(this._vcpkgUseDynamicCRTConfig, dynamicCRT);

        await this.updateCurrentCRTSetting();

        this.logInfo('Set to ' + dynamicCRT? 'dynamic': 'static' + ' triplet');
		vscode.window.showInformationMessage('Now use ' + (dynamicCRT? 'dynamic': 'static') + ' CRT linkage');
    }

    public async getManifestMode()
    {
        return workspace.getConfiguration('vcpkg').get<string>(this._useManifestConfig);
    }

    public async installDependencies(install: boolean)
    {
		vscode.window.showInformationMessage('Install dependencies ' + (install ? 'enabled' : 'disabled') + '.');

        await this.updateVcpkgSetting(this._installDependenciesConfig, install);

        let newConfigs = this.getAndCleanCMakeOptions(this._cmakeOptionPrefix + this._vcpkgApplocalDepsConfig);
        newConfigs.push(this._cmakeOptionPrefix + this._vcpkgApplocalDepsConfig + (install ? this._cmakeOptionEanble : this._cmakeOptionDisable));
		this.logInfo('cmake options: ' + newConfigs.toString());
        await this.updateCMakeSetting(this._cmakeOptionConfig, newConfigs);

        newConfigs = this.getAndCleanCMakeOptions(this._cmakeOptionPrefix + this._vcpkgApplocalDepsInstallConfig);
        newConfigs.push(this._cmakeOptionPrefix + this._vcpkgApplocalDepsInstallConfig + (install ? this._cmakeOptionEanble : this._cmakeOptionDisable));
		this.logInfo('cmake options: ' + newConfigs.toString());
        await this.updateCMakeSetting(this._cmakeOptionConfig, newConfigs);
    }

    public async preferSysLibs(sysLib: boolean)
    {
		vscode.window.showInformationMessage('Find ' + (sysLib ? 'system libs' : 'vcpkg generated libs') + ' first.');

        await this.updateVcpkgSetting(this._preferSystemLibsConfig, sysLib);

        let newConfigs = this.getAndCleanCMakeOptions(this._cmakeOptionPrefix + this._vcpkgPreferSystemLibsConfig);
        newConfigs.push(this._cmakeOptionPrefix + this._vcpkgPreferSystemLibsConfig + (sysLib ? this._cmakeOptionEanble : this._cmakeOptionDisable));
		this.logInfo('cmake options: ' + newConfigs.toString());
        await this.updateCMakeSetting(this._cmakeOptionConfig, newConfigs);
    }

    public async assetSourceWithEnv(value: string)
    {
		vscode.window.showInformationMessage('asset source change to ' + value);

        if (value.length !== 0)
        {
            process.env[this._vcpkgAssetSourceEnvConfig] = '\"' + this._vcpkgAssertSourceOption + '=' + 'clear;x-azurl,' + value + ',,read\"';
            //this._context.environmentVariableCollection.replace(this._vcpkgAssetSourceEnvConfig, '\"' + this._vcpkgAssertSourceOption + '=' + 'clear;x-azurl,' + value + ',,read\"');
        }
        else
        {
            delete process.env[this._vcpkgAssetSourceEnvConfig];
            //this._context.environmentVariableCollection.delete(this._vcpkgAssetSourceEnvConfig);
        }
    }

    public async assetSourceWithInstallOption(value: string)
    {
		vscode.window.showInformationMessage('asset source change to ' + value);

        let newConfigs = this.getAndCleanCMakeConfigureSetting(this._vcpkgAssertSourceOption);

        if (value.length !== 0)
        {
            newConfigs.push('\"' + this._vcpkgAssertSourceOption + '=' + 'clear;x-azurl,' + value + ',,read\"');
        }

		this.logInfo('install options: ' + newConfigs.toString());
        await this.updateCMakeConfigureSetting(newConfigs);
    }

    public async binaryCacheWithEnv(value: string)
    {
		vscode.window.showInformationMessage('binary cache change to ' + value);

        if (value.length !== 0)
        {
            process.env[this._vcpkgBinarySourceEnvConfig] = '\"' + this._vcpkgBinarySourceOption + '=' + 'clear;files,' + value + ',read\"';
            //this._context.environmentVariableCollection.replace(this._vcpkgBinarySourceEnvConfig, '\"' + this._vcpkgBinarySourceOption + '=' + 'clear;files,' + value + ',read\"');
        }
        else
        {
            delete process.env[this._vcpkgBinarySourceEnvConfig];
            //this._context.environmentVariableCollection.delete(this._vcpkgBinarySourceEnvConfig);
        }
    }

    public async binaryCacheWithInstallOption(value: string)
    {
		vscode.window.showInformationMessage('binary cache change to ' + value);

        let newConfigs = this.getAndCleanCMakeConfigureSetting(this._vcpkgBinarySourceOption);

        if (value.length !== 0)
        {
            newConfigs.push('\"' + this._vcpkgBinarySourceOption + '=' + 'clear;files,' + value + ',read\"');
        }

		this.logInfo('install options: ' + newConfigs.toString());
        await this.updateCMakeConfigureSetting(newConfigs);
    }

    public async onConfigurationChanged(event : vscode.ConfigurationChangeEvent)
    {
        this.logInfo('detect configuration changed.');
        if (event.affectsConfiguration('vcpkg.' + this._enableVcpkgConfig))
        {
            this.logInfo('detect vcpkg enable configuration changed.');
            if (workspace.getConfiguration('vcpkg').get<boolean>(this._enableVcpkgConfig))
            {
                this.enableVcpkg(true);
                
                await this.suggestManifestMode();
            }
            else
            {
                this.disableVcpkg(true);
            }
        }
        else if (event.affectsConfiguration('vcpkg.' + this._vcpkgPathConfig))
        {
            this.logInfo('detect vcpkg path configuration changed.');
            let oldPath = await this.getVcpkgPathFromConfig();
    
            if (oldPath === undefined)
            {
                vscode.window.showErrorMessage('Vcpkg path is incorrect! Disabling vcpkg now.');
                this.disableVcpkg(true);
            }
            else
            {
                vscode.window.showInformationMessage('Re-enable vcpkg now.');
                this.enableVcpkg(true);
                
                await this.suggestManifestMode();
            }
        }
        else if (event.affectsConfiguration('vcpkg.' + this._useManifestConfig))
        {
            this.logInfo('detect vcpkg manifest configuration changed.');
            if (workspace.getConfiguration('vcpkg').get<boolean>(this._useManifestConfig))
            {
                this.enableManifest();
            }
            else
            {
                this.disableManifest();
            }
        }
        else if (event.affectsConfiguration('vcpkg.' + this._installDependenciesConfig))
        {
            this.logInfo('detect install dependencies configuration changed.');
            let currSel = workspace.getConfiguration('vcpkg').get<boolean>(this._installDependenciesConfig);
            this.installDependencies(currSel!);
        }
        else if (event.affectsConfiguration('vcpkg.' + this._additionalOptionsConfig))
        {
            this.logInfo('detect vcpkg install option configuration changed.');
            let extraOptCfgs = workspace.getConfiguration('vcpkg').get<Array<string>>(this._additionalOptionsConfig);
            if (extraOptCfgs !== undefined && extraOptCfgs.length)
            {
                let cmakeConfigs = this.getAndCleanCMakeConfigureSetting(this._vcpkgInstallOptionsConfig);
                for (let curr in extraOptCfgs)
                {
                    cmakeConfigs?.push(extraOptCfgs[curr]);

                    this.logInfo('add extra vcpkg instal option: ' + extraOptCfgs[curr]);
                }
                
                this.updateCMakeConfigureSetting(cmakeConfigs);
            }
            else
            {
                let cmakeConfigs = this.getAndCleanCMakeConfigureSetting(this._vcpkgInstallOptionsConfig);
                this.updateCMakeConfigureSetting(cmakeConfigs);
            }
        }
        else if (event.affectsConfiguration('vcpkg.' + this._useStaticLibConfig))
        {
            let isUseStatic = workspace.getConfiguration('vcpkg').get<boolean>(this._useStaticLibConfig);
            this.logInfo('detect vcpkg static lib configuration changed to ' + (isUseStatic ? 'static' : 'dynamic'));

            this.useLibType(<any>isUseStatic);
        }
        else if (event.affectsConfiguration('vcpkg.' + this._vcpkgUseDynamicCRTConfig))
        {
            if (process.platform === "win32")
            {
                let isUseDynamic = workspace.getConfiguration('vcpkg').get<boolean>(this._vcpkgUseDynamicCRTConfig);
                this.logInfo('detect vcpkg CRT configuration changed to ' + (isUseDynamic ? 'dynamic' : 'static'));

                this.useCRTType(<any>isUseDynamic);
            }
        }
        else if (event.affectsConfiguration('vcpkg.' + this._targetTripletConfig))
        {
            this.logInfo('detect vcpkg target triplet configuration changed.');
            let currSel = workspace.getConfiguration('vcpkg').get<string>(this._targetTripletConfig);

            this.useLibType(<any>this.isStaticLib(currSel as string));
        }
        else if (event.affectsConfiguration('vcpkg.' + this._preferSystemLibsConfig))
        {
            this.logInfo('detect use system libs configuration changed.');
            let currSel = workspace.getConfiguration('vcpkg').get<boolean>(this._preferSystemLibsConfig);
            this.preferSysLibs(currSel!);
        }
        else if (event.affectsConfiguration('vcpkg.' + this._vcpkgAssetSourceConfig))
        {
            this.logInfo('detect asset source configuration changed.');
            let currValue = workspace.getConfiguration('vcpkg').get<string>(this._vcpkgAssetSourceConfig);
            if (currValue !== undefined)
            {
                this.assetSourceWithEnv(currValue);
            }
        }
        else if (event.affectsConfiguration('vcpkg.' + this._vcpkgBinaryCacheConfig))
        {
            this.logInfo('detect asset source configuration changed.');
            let currValue = workspace.getConfiguration('vcpkg').get<string>(this._vcpkgBinaryCacheConfig);
            if (currValue !== undefined)
            {
                this.binaryCacheWithEnv(currValue);
            }
        }
    }

    dispose(): void {
        this.disposables.forEach((item) => item.dispose());
    }
}