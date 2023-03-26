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

    private logInfo(content: string)
    {
        console.log("[vcpkg tools] " + content);
    }

    private logErr(content: string)
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
        return path + '/vcpkg.exe';
    }

    private isVcpkgExistInPath(path: string)
    {
        return fs.existsSync(this.generateVcpkgFullPath(path));
    }

    private getAndCleanCMakeOptions(condition: string)
    {
		let cmakeConfigs = workspace.getConfiguration('cmake').get<Array<string>>(this._cmakeOptionConfig);
		this.logInfo('cmake options: ' + cmakeConfigs?.toString());

        let newConfigs = new Array<string>;
        if (cmakeConfigs !== undefined)
        {
            for (let curr in cmakeConfigs)
            {
                this.logInfo('current cmake option: ' + cmakeConfigs[curr].toString() + ' index: ' + curr);
                let matched = cmakeConfigs[curr].toString().match(condition);
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
            this.logInfo("curr:" + curr);
            let matched = curr.match('CMAKE_TOOLCHAIN_FILE');
            this.logInfo("matched:" + matched);

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
        return triplet?.endsWith('-static');
    }

    private async addVcpkgToolchain(vcpkgRoot : string)
    {
        let cleanConfig = this.getCleanVcpkgToolchian();
        (cleanConfig as any)['CMAKE_TOOLCHAIN_FILE'] = vcpkgRoot + '/scripts/buildsystems/vcpkg.cmake';
        (cleanConfig as any)['VCPKG_TARGET_TRIPLET'] = workspace.getConfiguration('vcpkg').get(this._targetTripletConfig);
        await workspace.getConfiguration('cmake').update(this._configConfigSettingConfig, cleanConfig);
    }

    private async updateCurrentTripletSetting()
    {
        let isStatic = workspace.getConfiguration('vcpkg').get<boolean>(this._useStaticLibConfig);
		let currTriplet = workspace.getConfiguration('vcpkg').get<string>(this._targetTripletConfig);
        
        this.logInfo('current target triplet is: ' + currTriplet);
        this.logInfo('current use static triplet ? ' + isStatic);

        if (isStatic)
        {
            if (!this.isStaticLib(currTriplet as string))
            {
                currTriplet += '-static';
            }
        }
        else
        {
            if (this.isStaticLib(currTriplet as string))
            {
                (currTriplet as string).substring(0, (currTriplet as string).length - '-static'.length);
            }
        }

        let cmakeTargetTripletSetting = this._cmakeOptionPrefix + this._vcpkgTargetTripletConfig + '=' + currTriplet;
        this.logInfo('set target triplet to:' + cmakeTargetTripletSetting);

        let newConfigs = this.getAndCleanCMakeOptions(this._cmakeOptionPrefix + this._vcpkgTargetTripletConfig);

        newConfigs.push(cmakeTargetTripletSetting);
        
		await workspace.getConfiguration('cmake').update(this._cmakeOptionConfig, newConfigs);
    }

    private async initCMakeSettings(vcpkgPath : string)
    {
        let currArch = this.getArch();

        this.logInfo('current arch is: ' + currArch);

        await workspace.getConfiguration('vcpkg').update(this._hostTripletConfig, currArch);
        this.logInfo('update host triplet to: ' + currArch);
        await workspace.getConfiguration('vcpkg').update(this._targetTripletConfig, currArch);
        this.logInfo('update target triplet to: ' + currArch);

        await workspace.getConfiguration('vcpkg').update(this._useStaticLibConfig, false);
        this.logInfo('update use static lib to: ' + false);
        
        this.updateCurrentTripletSetting();
        this.addVcpkgToolchain(vcpkgPath);

        // disable manifest mode by default
        this.disableManifest();
    }

    async enableVcpkg() {
		vscode.window.showInformationMessage('Registring vcpkg...');

        let oldPath = workspace.getConfiguration('vcpkg').get<string>(this._vcpkgPathConfig);

        if (oldPath && this.isVcpkgExistInPath(oldPath))
        {
            this.initCMakeSettings(oldPath);

            this.logInfo('vcpkg already set to ' + oldPath + ' , enabled plugin.');
            vscode.window.showInformationMessage('vcpkg enabled.');
            return;
        }

		let vcpkgRoot = null;
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
				vcpkgRoot = uri.substring(1, uri.length);

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
		vscode.window.showInformationMessage('Disable vcpkg...');

        await workspace.getConfiguration('vcpkg').update(this._enableVcpkgConfig, false);

        // clean vcpkg options
        let cleanOptions = this.getAndCleanCMakeOptions(this._cmakeOptionPrefix + this._vcpkgManifestModeConfig);
		workspace.getConfiguration('cmake').update(this._cmakeOptionConfig, cleanOptions);
        
        // clean toolchain setting
        workspace.getConfiguration('cmake').update(this._configConfigSettingConfig, this.getCleanVcpkgToolchian());

        this.logInfo('Disabled vcpkg plugin.');
    }

    async enableManifest()
    {
		vscode.window.showInformationMessage('Manifest mode enabled.');

		workspace.getConfiguration('vcpkg').update('general.useManifest', true);

        let newConfigs = this.getAndCleanCMakeOptions(this._cmakeOptionPrefix + this._vcpkgManifestModeConfig);

        newConfigs.push(this._cmakeOptionPrefix + this._vcpkgManifestModeConfig + this._cmakeOptionEanble);

		this.logInfo('cmake options: ' + newConfigs.toString());
		workspace.getConfiguration('cmake').update(this._cmakeOptionConfig, newConfigs);
    }

    async disableManifest()
    {
		vscode.window.showInformationMessage('Manifest mode disabled.');

		workspace.getConfiguration('vcpkg').update('general.useManifest', false);

        let newConfigs = this.getAndCleanCMakeOptions(this._cmakeOptionPrefix + this._vcpkgManifestModeConfig);

        newConfigs.push(this._cmakeOptionPrefix + this._vcpkgManifestModeConfig + this._cmakeOptionDisable);

		this.logInfo('cmake options: ' + newConfigs.toString());
		workspace.getConfiguration('cmake').update(this._cmakeOptionConfig, newConfigs);
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
		workspace.getConfiguration('vcpkg').update(this._useStaticLibConfig, true);

        this.updateCurrentTripletSetting();

        this.logInfo('Set to static triplet');
		vscode.window.showInformationMessage('Now use static library / triplet');
    }

    async useDynamicLib()
    {
		workspace.getConfiguration('vcpkg').update(this._useStaticLibConfig, false);

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
            let extraOptions = this._cmakeOptionPrefix + this._vcpkgInstallOptionsConfig + '="';
            if (extraOptCfgs !== undefined)
            {
                for (let curr in extraOptCfgs)
                {
                    extraOptions += extraOptCfgs[curr] + ';';

                    this.logInfo('add extra vcpkg instal option: ' + extraOptCfgs[curr]);
                }
                
            }

            extraOptions += '"';

            let cmakeConfigs = this.getAndCleanCMakeOptions(this._additionalOptionsConfig);
            cmakeConfigs?.push(extraOptions);
            
            await workspace.getConfiguration('cmake').update(this._cmakeOptionConfig, cmakeConfigs);
        }
        else if (event.affectsConfiguration('vcpkg.' + this._useStaticLibConfig))
        {
            this.logInfo('detect vcpkg static lib configuration changed.');
            if (workspace.getConfiguration('vcpkg').get<boolean>(this._useStaticLibConfig))
            {
                this.useStaticLib();
            }
            else
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