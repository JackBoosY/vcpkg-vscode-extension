import * as fs from 'fs'; 
import path = require('path');
import * as vscode from 'vscode';
import { workspace } from "vscode";
import * as proc from 'child_process';

export class ConfigurationManager implements vscode.Disposable
{
    private _context: vscode.ExtensionContext;
    private disposables: vscode.Disposable[] = [];

    private _enableVcpkgConfig = 'general.enable';
    private _vcpkgPathConfig = 'general.vcpkgPath';
    private _vcpkgAssetSourceConfig = 'general.assetSource';
    private _vcpkgBinaryCacheConfig = 'general.binaryCaching';
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

    constructor(context: vscode.ExtensionContext) {
        this._context = context;
    }

    logInfo(content: string)
    {
        console.log("[vcpkg tools] " + content);
    }

    logErr(content: string)
    {
        console.error("[vcpkg tools] " + content);
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
                return "x64-windows";
			}
			else if (process.arch === 'x86')
			{
                return "x86-windows";
			}
			else if (process.arch.toLowerCase() === 'arm')
			{
                return "arm-windows";
			}
			else if (process.arch.toLowerCase() === 'arm64')
			{
                return "arm64-windows";
			}
		}
		else if (process.platform === "darwin")
		{
            if (process.arch.toLowerCase() === 'arm64')
            {
                return "arm64-osx";
            }
            else
            {
                return "x64-osx";
            }
		}
		else if (process.platform === "linux")
		{
            return "x64-linux";
		}
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
        let oldPath = workspace.getConfiguration('vcpkg').get<string>(this._vcpkgPathConfig);

        if ((oldPath === undefined || oldPath.length === 0) || !this.isVcpkgExistInPath(oldPath))
        {
            return false;
        }

        let config = workspace.getConfiguration('vcpkg').get<boolean>(this._enableVcpkgConfig);


        return config !== undefined ? config : false;
    }

    private async isVcpkgExistInPath(path: string): Promise<boolean>
    {
        let fullPath = this.generateVcpkgFullPath(path);
        if (fs.existsSync(fullPath))
        {
            let version = await this.runCommand(fullPath, '--version', path);
            if (version.match('vcpkg package management program version') !== null)
            {
                return true;
            }
            else
            {
                return false;
            }
        }
        else
        {
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

    private async addVcpkgToolchain(vcpkgRoot : string)
    {
        let cleanConfig = this.getCleanVcpkgToolchian();
        (cleanConfig as any)['CMAKE_TOOLCHAIN_FILE'] = vcpkgRoot + '/scripts/buildsystems/vcpkg.cmake';
        
        this.updateCMakeSetting(this._configConfigSettingConfig, cleanConfig);
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
        this.updateVcpkgSetting(this._vcpkgPathConfig, vcpkgPath, true);

        let currArch = this.getArch();

        this.logInfo('current arch is: ' + currArch);

        this.updateVcpkgSetting(this._enableVcpkgConfig, true);
        this.updateVcpkgSetting(this._hostTripletConfig, currArch);
        this.logInfo('update host triplet to: ' + currArch);
        this.updateVcpkgSetting(this._targetTripletConfig, currArch);
        this.logInfo('update target triplet to: ' + currArch);

        this.updateVcpkgSetting(this._useStaticLibConfig, false);
        this.logInfo('update use static lib to: ' + false);
        
        this.updateCurrentTripletSetting();
        this.addVcpkgToolchain(vcpkgPath);

        this.updateVcpkgSetting(this._installDependenciesConfig, true);
        this.updateVcpkgSetting(this._preferSystemLibsConfig, false);

        // disable manifest mode by default
        this.disableManifest();
    }

    private async isContainManifestFile() {
        let projectPath = vscode.workspace.workspaceFolders?.map(folder => folder.uri.path);

        if (projectPath !== undefined && projectPath.length)
        {
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

    async enableVcpkg() {
        if (this.isVcpkgEnabled())
        {
            return;
        }

        // cleanup old vcpkg-related cmake configs
        this.cleanupVcpkgRelatedCMakeOptions();

        let oldPath = workspace.getConfiguration('vcpkg').get<string>(this._vcpkgPathConfig);

        if (oldPath && await this.isVcpkgExistInPath(oldPath))
        {
            this.initCMakeSettings(oldPath);

            this.logInfo('vcpkg already set to ' + oldPath + ' , enabled plugin.');
            vscode.window.showInformationMessage('vcpkg enabled.');
            return;
        }

		let vcpkgRootEnv = this._context.environmentVariableCollection.get(this._vcpkgRootConfig);
		if (vcpkgRootEnv !== undefined)
		{
			if (await this.isVcpkgExistInPath(vcpkgRootEnv.value))
			{
				vscode.window.showInformationMessage('vcpkg enabled.');

                this.initCMakeSettings(vcpkgRootEnv.value);

				this.logInfo('update target/host triplet to ' + workspace.getConfiguration('vcpkg').get(this._hostTripletConfig));

                this.logInfo('detect env VCPKG_ROOT: ' + vcpkgRootEnv.value + ' , enabled plugin.');
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
			let options = {
				canSelectFiles: false,
				canSelectFolders: true,
				canSelectMany: false,
				openLabel: 'Select vcpkg root path'
			};
			vscode.window.showOpenDialog(options).then(async result => {
				if (result === undefined)
				{
                    this.logErr('invalid vcpkg path, plugin will not be enabled.');
					vscode.window.showErrorMessage('Invalid vcpkg path, vcpkg will not be enabled.');
					return;
				}

				let uri = result[0].path.toString();

                this.logInfo("select: " + uri);

                let vcpkgRoot = '';
                if (process.platform === "win32")
                {
                    vcpkgRoot = uri.substring(1, uri.length);
                }
                else
                {
                    vcpkgRoot = uri;
                }

				if (await this.isVcpkgExistInPath(vcpkgRoot))
				{
					vscode.window.showInformationMessage('vcpkg enabled.');

                    this.initCMakeSettings(vcpkgRoot);

					this.logInfo('update target/host triplet to ' + workspace.getConfiguration('vcpkg').get<string>(this._hostTripletConfig));

                    this.logInfo('detect select valid vcpkg path: ' + vcpkgRoot + ' , enabled plugin.');
					return;
				}
				else
				{
                    this.logErr('invalid vcpkg path: ' + vcpkgRoot + ' , plugin will not be enabled.');
					vscode.window.showErrorMessage('Invalid vcpkg path, vcpkg will not be enabled.');
					return;
				}
			});
		}
    }

    async disableVcpkg()
    {
        if (!this.isVcpkgEnabled())
        {
            return;
        }

        await this.updateVcpkgSetting(this._enableVcpkgConfig, false);

        // clean vcpkg options
        await this.cleanupVcpkgRelatedCMakeOptions();
        
        // clean toolchain setting
        await this.updateCMakeSetting(this._configConfigSettingConfig, this.getCleanVcpkgToolchian());

        this.logInfo('Disabled vcpkg plugin.');
    }

    async enableManifest()
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

    async disableManifest()
    {
		vscode.window.showInformationMessage('Manifest mode disabled.');

        await this.updateVcpkgSetting(this._useManifestConfig, false);

        let newConfigs = this.getAndCleanCMakeOptions(this._cmakeOptionPrefix + this._vcpkgManifestModeConfig);

        newConfigs.push(this._cmakeOptionPrefix + this._vcpkgManifestModeConfig + this._cmakeOptionDisable);

		this.logInfo('cmake options: ' + newConfigs.toString());
        await this.updateCMakeSetting(this._cmakeOptionConfig, newConfigs);
    }

    async getCurrentTriplet()
    {
		vscode.window.showInformationMessage('Current triplet is: ' + workspace.getConfiguration('vcpkg').get<string>(this._targetTripletConfig));
    }

    async getCurrentHostTriplet()
    {
		vscode.window.showInformationMessage('Current host triplet is: ' + workspace.getConfiguration('vcpkg').get<string>(this._hostTripletConfig));
    }
    
    async useLibType(staticLib: boolean)
    {
        await this.updateVcpkgSetting(this._useStaticLibConfig, staticLib);

        await this.updateCurrentTripletSetting();

        this.logInfo('Set to ' + staticLib? 'static': 'dynamic' + ' triplet');
		vscode.window.showInformationMessage('Now use ' + (staticLib? 'static': 'dynamic') + ' library / triplet');
    }

    async useCRTType(dynamicCRT: boolean)
    {
        await this.updateVcpkgSetting(this._vcpkgUseDynamicCRTConfig, dynamicCRT);

        await this.updateCurrentCRTSetting();

        this.logInfo('Set to ' + dynamicCRT? 'dynamic': 'static' + ' triplet');
		vscode.window.showInformationMessage('Now use ' + (dynamicCRT? 'dynamic': 'static') + ' CRT linkage');
    }

    async installDependencies(install: boolean)
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

    async preferSysLibs(sysLib: boolean)
    {
		vscode.window.showInformationMessage('Find ' + (sysLib ? 'system libs' : 'vcpkg generated libs') + ' first.');

        await this.updateVcpkgSetting(this._preferSystemLibsConfig, sysLib);

        let newConfigs = this.getAndCleanCMakeOptions(this._cmakeOptionPrefix + this._vcpkgPreferSystemLibsConfig);
        newConfigs.push(this._cmakeOptionPrefix + this._vcpkgPreferSystemLibsConfig + (sysLib ? this._cmakeOptionEanble : this._cmakeOptionDisable));
		this.logInfo('cmake options: ' + newConfigs.toString());
        await this.updateCMakeSetting(this._cmakeOptionConfig, newConfigs);
    }

    async assetSourceWithEnv(value: string)
    {
		vscode.window.showInformationMessage('asset source change to ' + value);

        if (value.length !== 0)
        {
            this._context.environmentVariableCollection.replace(this._vcpkgAssetSourceEnvConfig, '\"' + this._vcpkgAssertSourceOption + '=' + 'clear;x-azurl,' + value + ',,read\"');
        }
        else
        {
            this._context.environmentVariableCollection.delete(this._vcpkgAssetSourceEnvConfig);
        }
    }

    async assetSourceWithInstallOption(value: string)
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

    async binaryCacheWithEnv(value: string)
    {
		vscode.window.showInformationMessage('binary cache change to ' + value);

        if (value.length !== 0)
        {
            this._context.environmentVariableCollection.replace(this._vcpkgBinarySourceEnvConfig, '\"' + this._vcpkgBinarySourceOption + '=' + 'clear;files,' + value + ',read\"');
        }
        else
        {
            this._context.environmentVariableCollection.delete(this._vcpkgBinarySourceEnvConfig);
        }
    }

    async binaryCacheWithInstallOption(value: string)
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

    async onConfigurationChanged(event : vscode.ConfigurationChangeEvent)
    {
        this.logInfo('detect configuration changed.');
        if (event.affectsConfiguration('vcpkg.' + this._enableVcpkgConfig))
        {
            this.logInfo('detect vcpkg enable configuration changed.');
            if (workspace.getConfiguration('vcpkg').get<boolean>(this._enableVcpkgConfig))
            {
                this.enableVcpkg();
                
                await this.suggestManifestMode();
            }
            else
            {
                this.disableVcpkg();
            }
        }
        else if (event.affectsConfiguration('vcpkg.' + this._vcpkgPathConfig))
        {
            this.logInfo('detect vcpkg path configuration changed.');
            let oldPath = workspace.getConfiguration('vcpkg').get<string>(this._vcpkgPathConfig);
    
            if (oldPath === undefined || !this.isVcpkgExistInPath(oldPath))
            {
                this.disableVcpkg();
            }
            else
            {
                this.enableVcpkg();
                
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