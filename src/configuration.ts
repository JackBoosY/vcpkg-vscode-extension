import * as fs from 'fs'; 
import path = require('path');
import * as vscode from 'vscode';
import { workspace } from "vscode";

export class ConfigurationManager implements vscode.Disposable
{
    private _context: vscode.ExtensionContext;
    private disposables: vscode.Disposable[] = [];

    private _enableVcpkgConfig = 'general.enable';
    private _vcpkgPathConfig = 'general.vcpkgPath';
    private _useManifestConfig = 'general.useManifest';
    private _installDependenciesConfig = 'general.installDependencies';
    private _autoLinkConfig = 'general.autolink';
    private _installDirectoryConfig = 'general.installDirectory';
    private _additionalOptionsConfig = 'target.additionalOptions';
    private _useStaticLibConfig = 'target.useStaticLib';
    private _vcpkgUseDynamicCRTConfig = 'target.useDynamicCRT';
    private _targetTripletConfig = 'target.defaultTriplet';
    private _hostTripletConfig = 'target.hostTriplet';

    private _cmakeOptionConfig = 'configureArgs';
    private _configConfigSettingConfig = 'configureSettings';

    private _vcpkgManifestModeConfig = 'VCPKG_MANIFEST_MODE';
    private _vcpkgTargetTripletConfig = 'VCPKG_TARGET_TRIPLET';
    private _vcpkgInstallOptionsConfig = 'VCPKG_INSTALL_OPTIONS';
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
        return workspace.getConfiguration('vcpkg').get<boolean>(this._enableVcpkgConfig) === undefined ?
            false : workspace.getConfiguration('vcpkg').get<boolean>(this._enableVcpkgConfig);
    }

    private isVcpkgExistInPath(path: string)
    {
        return fs.existsSync(this.generateVcpkgFullPath(path));
    }

    private async updateCMakeSetting(subSetting: string, value: any, userScope: boolean = false)
    {
        await workspace.getConfiguration('cmake').update(subSetting, value, userScope);
    }

    private async updateVcpkgSetting(subSetting: string, value: any, userScope: boolean = false)
    {
        await workspace.getConfiguration('vcpkg').update(subSetting, value, userScope);
    }

    private getAndCleanCMakeOptions(condition: string)
    {
		let cmakeConfigs = workspace.getConfiguration('cmake').get<Array<string>>(this._cmakeOptionConfig);
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

    private getCleanVcpkgToolchian()
    {
        let currentSettings = workspace.getConfiguration('cmake').get<object>(this._configConfigSettingConfig);

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
        cleanOptions = this.getAndCleanCMakeOptions(this._cmakeOptionPrefix + this._vcpkgInstallOptionsConfig);
        this.updateCMakeSetting(this._cmakeOptionConfig, cleanOptions);
        cleanOptions = this.getAndCleanCMakeOptions(this._cmakeOptionPrefix + this._vcpkgTargetTripletConfig);
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

        // disable manifest mode by default
        this.disableManifest();
    }

    async enableVcpkg() {
        if (this.isVcpkgEnabled())
        {
            vscode.window.showInformationMessage('Vcpkg is already enabled.');
            return;
        }

		vscode.window.showInformationMessage('Enabling vcpkg...');

        // cleanup old vcpkg-related cmake configs
        this.cleanupVcpkgRelatedCMakeOptions();

        let oldPath = workspace.getConfiguration('vcpkg').get<string>(this._vcpkgPathConfig);

        if (oldPath && this.isVcpkgExistInPath(oldPath))
        {
            this.initCMakeSettings(oldPath);

            this.logInfo('vcpkg already set to ' + oldPath + ' , enabled plugin.');
            vscode.window.showInformationMessage('vcpkg enabled.');
            return;
        }

		let vcpkgRoot = "";
		if (process.env['VCPKG_ROOT'])
		{
			vcpkgRoot = process.env['VCPKG_ROOT'];
			
			if (this.isVcpkgExistInPath(vcpkgRoot))
			{
				vscode.window.showInformationMessage('vcpkg enabled.');

                this.initCMakeSettings(vcpkgRoot);

				this.logInfo('update target/host triplet to ' + workspace.getConfiguration('vcpkg').get(this._hostTripletConfig));

                this.logInfo('detect env VCPKG_ROOT: ' + vcpkgRoot + ' , enabled plugin.');
				return;
			}
			else
			{
                this.logErr('invalid env VCPKG_ROOT: ' + vcpkgRoot + ' , plugin will not be enabled.');
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
			vscode.window.showOpenDialog(options).then(result => {
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
                    vcpkgRoot = uri.substring(1, uri.length);
                }
                else
                {
                    vcpkgRoot = uri;
                }

				if (this.isVcpkgExistInPath(vcpkgRoot))
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
            vscode.window.showInformationMessage('Vcpkg is already disabled.');
            return;
        }
		vscode.window.showInformationMessage('Disable vcpkg...');

        this.updateVcpkgSetting(this._enableVcpkgConfig, false);

        // clean vcpkg options
        this.cleanupVcpkgRelatedCMakeOptions();
        
        // clean toolchain setting
        this.updateCMakeSetting(this._configConfigSettingConfig, this.getCleanVcpkgToolchian());

        this.logInfo('Disabled vcpkg plugin.');
    }

    async enableManifest()
    {
		vscode.window.showInformationMessage('Manifest mode enabled.');

        this.updateVcpkgSetting(this._useManifestConfig, true);

        let newConfigs = this.getAndCleanCMakeOptions(this._cmakeOptionPrefix + this._vcpkgManifestModeConfig);

        newConfigs.push(this._cmakeOptionPrefix + this._vcpkgManifestModeConfig + this._cmakeOptionEanble);

		this.logInfo('cmake options: ' + newConfigs.toString());
        this.updateCMakeSetting(this._cmakeOptionConfig, newConfigs);
    }

    async disableManifest()
    {
		vscode.window.showInformationMessage('Manifest mode disabled.');

        this.updateVcpkgSetting(this._useManifestConfig, false);

        let newConfigs = this.getAndCleanCMakeOptions(this._cmakeOptionPrefix + this._vcpkgManifestModeConfig);

        newConfigs.push(this._cmakeOptionPrefix + this._vcpkgManifestModeConfig + this._cmakeOptionDisable);

		this.logInfo('cmake options: ' + newConfigs.toString());
        this.updateCMakeSetting(this._cmakeOptionConfig, newConfigs);
    }

    async getCurrentTriplet()
    {
		vscode.window.showInformationMessage('Current triplet is: ' + workspace.getConfiguration('vcpkg').get<string>(this._targetTripletConfig));
    }

    async getCurrentHostTriplet()
    {
		vscode.window.showInformationMessage('Current host triplet is: ' + workspace.getConfiguration('vcpkg').get<string>(this._hostTripletConfig));
    }

    async useStaticLib()
    {
        this.updateVcpkgSetting(this._useStaticLibConfig, true);

        this.updateCurrentTripletSetting();

        this.logInfo('Set to static triplet');
		vscode.window.showInformationMessage('Now use static library / triplet');
    }

    async useDynamicLib()
    {
        this.updateVcpkgSetting(this._useStaticLibConfig, false);

        this.updateCurrentTripletSetting();

        this.logInfo('Set to dynamic triplet');
		vscode.window.showInformationMessage('Now use dynamic library / triplet');
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
            }
            else
            {
                this.disableVcpkg();
            }
        }
        else if (event.affectsConfiguration('vcpkg.' + this._vcpkgPathConfig))
        {
            this.logInfo('detect vcpkg path configuration changed.');
            this.disableVcpkg();
            this.enableVcpkg();
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
        }
        else if (event.affectsConfiguration('vcpkg.' + this._autoLinkConfig))
        {
        }
        else if (event.affectsConfiguration('vcpkg.' + this._installDirectoryConfig))
        {
        }
        else if (event.affectsConfiguration('vcpkg.' + this._additionalOptionsConfig))
        {
            this.logInfo('detect vcpkg install option configuration changed.');
            let extraOptCfgs = workspace.getConfiguration('vcpkg').get<Array<string>>(this._additionalOptionsConfig);
            if (extraOptCfgs !== undefined && extraOptCfgs.length)
            {
                let extraOptions = this._cmakeOptionPrefix + this._vcpkgInstallOptionsConfig + '="';
                for (let curr in extraOptCfgs)
                {
                    extraOptions += extraOptCfgs[curr] + ';';

                    this.logInfo('add extra vcpkg instal option: ' + extraOptCfgs[curr]);
                }
                extraOptions += '"';

                let cmakeConfigs = this.getAndCleanCMakeOptions(this._vcpkgInstallOptionsConfig);
                cmakeConfigs?.push(extraOptions);
                
                this.updateCMakeSetting(this._cmakeOptionConfig, cmakeConfigs);
            }
            else
            {
                let cmakeConfigs = this.getAndCleanCMakeOptions(this._vcpkgInstallOptionsConfig);
                this.updateCMakeSetting(this._cmakeOptionConfig, cmakeConfigs);
            }
        }
        else if (event.affectsConfiguration('vcpkg.' + this._useStaticLibConfig))
        {
            let isUseStatic = workspace.getConfiguration('vcpkg').get<boolean>(this._useStaticLibConfig);
            this.logInfo('detect vcpkg static lib configuration changed to ' + (isUseStatic ? 'static' : 'dynamic'));

            if (isUseStatic)
            {
                this.useStaticLib();
            }
            else if (!isUseStatic)
            {
                this.useDynamicLib();
            }
        }
        else if (event.affectsConfiguration('vcpkg.' + this._vcpkgUseDynamicCRTConfig))
        {
            if (process.platform === "win32")
            {

            }
        }
        else if (event.affectsConfiguration('vcpkg.' + this._targetTripletConfig))
        {
            this.logInfo('detect vcpkg target triplet configuration changed.');
            let currSel = workspace.getConfiguration('vcpkg').get<string>(this._targetTripletConfig);
            if (this.isStaticLib(currSel as string))
            {
                this.useStaticLib();
            }
            else
            {
                this.useDynamicLib();
            }
        }
    }

    dispose(): void {
        this.disposables.forEach((item) => item.dispose());
    }
}