import * as fs from 'fs';
import path = require('path');
import * as vscode from 'vscode';
import { workspace } from 'vscode';
import * as proc from 'child_process';
import { VcpkgLogMgr } from './log';
import { VcpkgEventEmitter, VcpkgEventPayloads } from './vcpkgEventEmitter';
import { DepNodeProvider } from './sidebar/DepNodeProvider';
import { CMakeToolsService } from './services/cmakeToolsService';
import { TripletService } from './services/tripletService';
import { getArch, combineTriplet, separateTriplet } from './utils/platform';
import { convertToAbsolutePath, getVcpkgPathFromEnv } from './utils/env';

export class ConfigurationManager implements vscode.Disposable {
    //private _context: vscode.ExtensionContext;
    private disposables: vscode.Disposable[] = [];
    private _logMgr: VcpkgLogMgr;
    private _emitter: VcpkgEventEmitter;
    private _nodeProvider: DepNodeProvider;
    private _cmakeService: CMakeToolsService;
    private _tripletService: TripletService;
    private _vcpkgStatusBarItem: vscode.StatusBarItem;

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
    private _cmakeToolchainFile = 'CMAKE_TOOLCHAIN_FILE';
    private _cmakeOptionPrefix = '-D';
    private _cmakeOptionEanble = '=ON';
    private _cmakeOptionDisable = '=OFF';

    constructor(
        /*context: vscode.ExtensionContext, */ logMgr: VcpkgLogMgr,
        nodeProvider: DepNodeProvider,
        emitter: VcpkgEventEmitter,
    ) {
        // this._context = context;
        this._logMgr = logMgr;
        this._cmakeService = new CMakeToolsService(this._logMgr);
        this._emitter = emitter;
        this._tripletService = new TripletService(this._logMgr, this._emitter, this._cmakeService);
        this.eventCallback = this.eventCallback.bind(this);
        this._emitter.registerListener('ConfigurationManager', this.eventCallback);
        this._nodeProvider = nodeProvider;

        this._vcpkgStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 10);
        this.disposables.push(this._vcpkgStatusBarItem);

        this.getVcpkgPathFromConfig().then(vcpkgPath => {
            if (vcpkgPath !== undefined) {
                this._emitter.fire('VersionManager', 'setVcpkgRoot', vcpkgPath);
                this._nodeProvider.setVcpkgPath(vcpkgPath);
                this.updateVcpkgSetting(this._vcpkgPathConfig, vcpkgPath, true);
            }
        });

        // Update vcpkg target triplet
        const automaticUpdateTriplet = workspace.getConfiguration('vcpkg').get<Boolean>(this._autoUpdateTriplet);
        this.isVcpkgEnabled().then((enabled) => {
            this.updateStatusBar(enabled);
            if (automaticUpdateTriplet && enabled) {
                this.getCurrentTriplet().then((currentTriplet) => {
                    const currentArch = getArch();
                    const newTriplet = combineTriplet(currentArch);
                    if (currentTriplet !== undefined && newTriplet !== currentTriplet) {
                        const triplet = separateTriplet(currentTriplet);
                        if (triplet.arch === '' || triplet.os === '') {
                            this.updateVcpkgSetting(this._targetTripletConfig, newTriplet);
                            this.logInfo('Detected wrong triplet setting, automatically update target triplet to: ' + newTriplet);
                            vscode.window.showInformationMessage(
                                'Detected wrong triplet setting, automatically update target triplet to: ' + newTriplet,
                            );
                        } else if (currentArch.os !== triplet.os) {
                            const newTriplet = combineTriplet({ arch: triplet.arch, os: currentArch.os });
                            this.updateVcpkgSetting(this._targetTripletConfig, newTriplet);
                            this.logInfo('Automatically update target triplet to: ' + newTriplet);
                            vscode.window.showInformationMessage('Automatically update target triplet to: ' + newTriplet);
                        }
                    }
                });

                this.getCurrentHostTriplet().then((currentHostTriplet) => {
                    const currentArch = getArch();
                    if (currentHostTriplet !== undefined && combineTriplet(currentArch) !== currentHostTriplet) {
                        const triplet = separateTriplet(currentHostTriplet);
                        if (triplet.os !== currentArch.os) {
                            const newTriplet = combineTriplet({ arch: triplet.arch, os: currentArch.os });
                            this.updateVcpkgSetting(this._hostTripletConfig, newTriplet);
                            this.logInfo('Automatically update host triplet to: ' + newTriplet);
                            vscode.window.showInformationMessage('Automatically update host triplet to: ' + newTriplet);
                        }
                    }
                });
            }
        });
    }

    private updateStatusBar(enabled: boolean) {
        if (enabled) {
            this.getCurrentTriplet().then(triplet => {
                this._vcpkgStatusBarItem.text = `$(package) vcpkg: ${triplet || 'active'}`;
                this._vcpkgStatusBarItem.tooltip = 'vcpkg is enabled';
                this._vcpkgStatusBarItem.show();
            });
        } else {
            this._vcpkgStatusBarItem.hide();
        }
    }

    public logInfo(content: string) {
        this._logMgr.logInfo('configuration.ts: ' + content);
    }

    public logErr(content: string) {
        this._logMgr.logErr('configuration.ts: ' + content);
    }

    public eventCallback<K extends keyof VcpkgEventPayloads>(request: K, result: VcpkgEventPayloads[K]) {
        switch (request) {
            case 'getVcpkgPathFromInfoSidebar':
                {
                    this.getVcpkgRealPath().then(vcpkgPath => {
                        this._emitter.fire('VcpkgInfoSideBarViewProvider', 'setVcpkgPath', vcpkgPath || '');
                    });
                }
                break;
            case 'getCurrentTripletFromInfoSidebar':
                {
                    this.getCurrentTriplet().then(async (result) => {
                        this._emitter.fire('VcpkgInfoSideBarViewProvider', 'setDefaultTriplet', {
                            triplets: await this.getAllSupportedTriplets(),
                            current: result,
                        });
                    });
                }
                break;
            case 'getHostTripletFromInfoSidebar':
                {
                    this.getCurrentHostTriplet().then(async (result) => {
                        this._emitter.fire('VcpkgInfoSideBarViewProvider', 'setHostTriplet', {
                            triplets: await this.getAllSupportedTriplets(),
                            current: result,
                        });
                    });
                }
                break;
            case 'getManifestModeFromInfoSidebar':
                {
                    this.getManifestMode().then(async (result) => {
                        this._emitter.fire('VcpkgInfoSideBarViewProvider', 'setManifestMode', result);
                    });
                }
                break;
            case 'setVcpkgPath':
                {
                    if (typeof result === 'string') {
                        this.setVcpkgPath(result);
                    }
                }
                break;
            case 'setCurrentTriplet':
                {
                    this.setTargetTripletByString(result as string);
                }
                break;
            case 'setHostTriplet':
                {
                    this.setHostTripletByString(result as string);
                }
                break;
            case 'setManifestMode':
                {
                    if (result) {
                        this.enableManifest();
                    } else {
                        this.disableManifest();
                    }
                }
                break;
            default:
                {
                    this._logMgr.logErr('CmakeDebugger eventCallback: received unrecognized message type: ' + request);
                }
                break;
        }
    }

    private async runCommand(command: string, param: string, executeRoot: string): Promise<string> {
        return new Promise((resolve, reject) => {
            proc.exec(command + ' ' + param, { cwd: executeRoot, encoding: 'utf-8' }, (error, stdout, stderr) => {
                if (error) {
                    this.logErr(`Command failed: ${command} ${param}\n${error}`);
                    reject(error);
                } else {
                    resolve(stdout.toString());
                }
            });
        });
    }

    private async getVcpkgPathFromConfig() {
        const tryFirst = workspace.getConfiguration('vcpkg').get<string>(this._vcpkgPathConfig);

        if (tryFirst !== undefined && tryFirst.length !== 0 && (await this.isVcpkgExistInPath(tryFirst))) {
            return tryFirst;
        }

        return undefined;
    }

    private generateVcpkgFullPath(vcpkgPath: string) {
        const exe = process.platform === 'win32' ? 'vcpkg.exe' : 'vcpkg';
        return path.join(vcpkgPath, exe);
    }

    private async isVcpkgEnabled() {
        const oldPath = await this.getVcpkgPathFromConfig();

        if (oldPath === undefined) {
            return false;
        }

        const config = workspace.getConfiguration('vcpkg').get<boolean>(this._enableVcpkgConfig);

        return config !== undefined ? config : false;
    }

    private async isVcpkgExistInPath(path: string) {
        let fullPath = '';
        if (path.search(/\$[Ee][Nn][Vv]{(.+)}/) === 0) {
            const envVar = convertToAbsolutePath(path);
            if (envVar.length) {
                fullPath = this.generateVcpkgFullPath(envVar);
            }
        }

        if (fullPath.length === 0) {
            fullPath = this.generateVcpkgFullPath(path);
        }

        try {
            await vscode.workspace.fs.stat(vscode.Uri.file(fullPath));
            return true;
        } catch {
            this.logErr('vcpkg was not found in path ' + fullPath);
            return false;
        }
    }

    private getAndCleanCMakeOptions(condition: string) {
        return this._cmakeService.getAndCleanCMakeOptions(condition);
    }

    private getCMakeConfigureSetting(setting: string) {
        return this._cmakeService.getCMakeConfigureSetting(setting);
    }

    private async updateCMakeSetting(subSetting: string, value: string | boolean | string[] | Record<string, unknown>, userScope: boolean = false) {
        return this._cmakeService.updateCMakeSetting(subSetting, value, userScope);
    }

    private async updateVcpkgSetting(subSetting: string, value: string | boolean | string[] | Record<string, unknown>, userScope: boolean = false) {
        await workspace.getConfiguration('vcpkg').update(subSetting, value, userScope);
    }

    private getAndCleanCMakeConfigureSetting(condition: string) {
        return this._cmakeService.getAndCleanCMakeConfigureSetting(condition, this._vcpkgInstallOptionsConfig);
    }

    private async updateCMakeConfigureSetting(value: Array<string>) {
        return this._cmakeService.updateCMakeConfigureSetting(value, this._vcpkgInstallOptionsConfig);
    }

    private getCMakeVcpkgToolchain() {
        return this._cmakeService.getCMakeVcpkgToolchain(this._cmakeToolchainFile);
    }

    private getCleanVcpkgToolchian() {
        return this._cmakeService.getCleanVcpkgToolchain(this._cmakeToolchainFile, this._vcpkgTargetTripletConfig);
    }

    private async cleanupVcpkgRelatedCMakeOptions() {
        this.logInfo('clean up vcpkg-related cmake configs.');
        let cleanOptions = this.getAndCleanCMakeOptions(this._cmakeOptionPrefix + this._vcpkgManifestModeConfig);
        this.updateCMakeSetting(this._cmakeOptionConfig, cleanOptions);
        cleanOptions = this.getAndCleanCMakeOptions(this._cmakeOptionPrefix + this._vcpkgTargetTripletConfig);
        this.updateCMakeSetting(this._cmakeOptionConfig, cleanOptions);
        cleanOptions = this.getAndCleanCMakeOptions(this._cmakeOptionPrefix + this._vcpkgCRTLinkageConfig);
        this.updateCMakeSetting(this._cmakeOptionConfig, cleanOptions);
    }

    private async checkVcpkgToolchain(vcpkgRoot: string) {
        let originToolchain = this.getCMakeVcpkgToolchain();
        if (originToolchain !== undefined) {
            try {
                await vscode.workspace.fs.stat(vscode.Uri.file(originToolchain));
                // check whether the vcpkg path in toolchain is not the same with the path in settings
                if (
                    convertToAbsolutePath(originToolchain) !==
                    convertToAbsolutePath(vcpkgRoot + '/scripts/buildsystems/vcpkg.cmake')
                ) {
                    this.logInfo('Detected invalid toolchain.');
                    return false;
                } else {
                    // use current toolchain
                    this.logInfo('Detected valid toolchain.');
                    return true;
                }
            } catch {
                this.logInfo('toolchain file is not found.');
                return false;
            }
        }

        return false;
    }

    private async addVcpkgToolchain(vcpkgRoot: string) {
        if (this.getCMakeVcpkgToolchain() !== undefined) {
            if (!(await this.checkVcpkgToolchain(vcpkgRoot))) {
                vscode.window.showErrorMessage('Detected mismatched vcpkg toolchain!');
                let result = await vscode.window.showQuickPick(['Disable vcpkg', 'Override vcpkg toolchain'], {
                    canPickMany: false,
                });

                if (result === 'Disable vcpkg') {
                    this.logErr('Detected mismatched toolchain, user canceled, now disable vcpkg');
                    vscode.window.showInformationMessage('Vcpkg will be disabled.');
                    this.disableVcpkg(false);
                    return false;
                } else {
                    this.logInfo('Detected mismatched toolchain, use continue, override vcpkg toolchain now.');
                    // continue to override the vcpkg toolchain
                }
            } else {
                // toolchain is matched and set.
                return true;
            }
        }

        let cleanConfig: Record<string, unknown> = this.getCleanVcpkgToolchian();
        cleanConfig['CMAKE_TOOLCHAIN_FILE'] = path.join(vcpkgRoot, 'scripts', 'buildsystems', 'vcpkg.cmake');

        this.updateCMakeSetting(this._configConfigSettingConfig, cleanConfig);

        return true;
    }

    private async updateCurrentTripletSetting() {
        let isStatic = workspace.getConfiguration('vcpkg').get<boolean>(this._useStaticLibConfig);
        let currTriplet = workspace.getConfiguration('vcpkg').get<string>(this._targetTripletConfig);

        if (currTriplet === undefined) {
            this.logErr("Couldn't get current target triplet!");
            vscode.window.showErrorMessage(
                'Vcpkg extension has problem! Please report it to github then disable and enable vcpkg extension.',
            );
            return;
        }

        this.logInfo('current target triplet is: ' + currTriplet);
        if (isStatic) {
            if (!this._tripletService.isStaticLib(currTriplet)) {
                currTriplet += '-static';
            }
        } else {
            if (this._tripletService.isStaticLib(currTriplet)) {
                currTriplet = currTriplet.slice(0, currTriplet.length - '-static'.length);
            }
        }

        let cmakeTargetTripletSetting = this._cmakeOptionPrefix + this._vcpkgTargetTripletConfig + '=' + currTriplet;
        this.logInfo('set target triplet to:' + cmakeTargetTripletSetting);

        this.updateVcpkgSetting(this._targetTripletConfig, currTriplet);

        let newConfigs = this.getAndCleanCMakeOptions(this._cmakeOptionPrefix + this._vcpkgTargetTripletConfig);

        newConfigs.push(cmakeTargetTripletSetting);

        this.updateCMakeSetting(this._cmakeOptionConfig, newConfigs);
    }

    private async updateCurrentCRTSetting() {
        let isUseDynamic = workspace.getConfiguration('vcpkg').get<boolean>(this._vcpkgUseDynamicCRTConfig);

        let newConfigs = this.getAndCleanCMakeOptions(this._cmakeOptionPrefix + this._vcpkgCRTLinkageConfig);

        let crtConfig =
            this._cmakeOptionPrefix +
            this._vcpkgCRTLinkageConfig +
            (isUseDynamic ? this._cmakeOptionEanble : this._cmakeOptionDisable);

        newConfigs.push(crtConfig);

        this.logInfo('cmake options: ' + crtConfig.toString());

        this.updateCMakeSetting(this._cmakeOptionConfig, newConfigs);
    }

    private async initCMakeSettings(vcpkgRoot: string) {
        this.logInfo('init cmake settings.');
        await this.updateVcpkgSetting(this._vcpkgPathConfig, vcpkgRoot, true);

        let currArch = combineTriplet(getArch());

        this.logInfo('current arch is: ' + currArch);

        await this.updateVcpkgSetting(this._enableVcpkgConfig, true);
        await this.updateVcpkgSetting(this._hostTripletConfig, currArch);
        this.logInfo('update host triplet to: ' + currArch);
        await this.updateVcpkgSetting(this._targetTripletConfig, currArch);
        this.logInfo('update target triplet to: ' + currArch);

        await this.updateVcpkgSetting(this._useStaticLibConfig, false);
        this.logInfo('update use static lib to: ' + false);

        await this.updateCurrentTripletSetting();
        if (!(await this.addVcpkgToolchain(vcpkgRoot))) {
            return false;
        }

        await this.updateVcpkgSetting(this._installDependenciesConfig, true);
        await this.updateVcpkgSetting(this._preferSystemLibsConfig, false);

        // disable manifest mode by default
        await this.disableManifest();

        this.updateStatusBar(true);
        return true;
    }

    private async isContainManifestFile() {
        let projectPath = vscode.workspace.workspaceFolders?.map((folder) => folder.uri.fsPath);

        if (projectPath !== undefined && projectPath.length) {
            try {
                await vscode.workspace.fs.stat(vscode.Uri.file(path.join(projectPath[0], 'vcpkg.json')));
                return true;
            } catch {
                return false;
            }
        } else {
            return false;
        }
    }

    private async suggestManifestMode() {
        let foundManifest = await this.isContainManifestFile();
        if (foundManifest) {
            interface Choice {
                title: string;
                enableManifest: boolean;
            }
            const chosen = await vscode.window.showInformationMessage<Choice>(
                'Found manifest file in current project path, would you like to enable manifest mode?',
                {},
                { title: 'Yes', enableManifest: true },
                { title: 'Not now', enableManifest: false },
            );

            if (chosen && chosen.enableManifest) {
                this.enableManifest();
            }
        }
    }

    public async chooseAndUpdateVcpkgPath(): Promise<string> {
        const path = await this.chooseVcpkgPath();
        if (path && (await this.isVcpkgExistInPath(path))) {
            this.updateVcpkgSetting(this._vcpkgPathConfig, path, true);
            this._emitter.fire('VersionManager', 'setVcpkgRoot', path);
            this._nodeProvider.setVcpkgPath(path);
            return path;
        } else if (path) {
            this.logErr('invalid vcpkg path: ' + path + ' , plugin will not be enabled.');
            vscode.window.showErrorMessage('Invalid vcpkg path, vcpkg will not be enabled.');
        }
        return '';
    }

    public async chooseVcpkgPath(): Promise<string> {
        const options: vscode.OpenDialogOptions = {
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            openLabel: 'Select vcpkg root path',
        };

        const result = await vscode.window.showOpenDialog(options);

        if (!result || result.length === 0) {
            this.logErr('No vcpkg path selected, plugin will not be enabled.');
            vscode.window.showErrorMessage('No vcpkg path selected, vcpkg will not be enabled.');
            return '';
        }

        const uri = result[0].path.toString();
        this.logInfo('select: ' + uri);

        if (process.platform === 'win32' && uri.startsWith('/')) {
            return uri.slice(1);
        } else {
            return uri;
        }
    }

    public async setVcpkgPath(path: string) {
        if (path === undefined || path === '') {
            this.logInfo('detect select valid vcpkg path.');
            return;
        }

        const oldPath = await this.getVcpkgPathFromConfig();

        if (oldPath !== undefined && oldPath === path) {
            this.logInfo('vcpkg already set to ' + oldPath + '.');
            return;
        }

        let vcpkgRootEnv = await getVcpkgPathFromEnv();
        if (vcpkgRootEnv !== undefined && vcpkgRootEnv === path) {
            this.logInfo('vcpkg already set to ' + oldPath + '.');
            return;
        }

        if (await this.isVcpkgExistInPath(path)) {
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Setting vcpkg path...',
                cancellable: false
            }, async () => {
                if (!await this.initCMakeSettings(path)) {
                    return;
                }
                this._emitter.fire('VersionManager', 'setVcpkgRoot', path);
                this._nodeProvider.setVcpkgPath(path);

                vscode.window.showInformationMessage('vcpkg enabled.');

                this.logInfo(
                    'update target/host triplet to ' +
                        workspace.getConfiguration('vcpkg').get<string>(this._hostTripletConfig),
                );

                this.logInfo('detect select valid vcpkg path: ' + path + '.');
            });
        } else {
            this.logErr('invalid vcpkg path: ' + path + ' , this changes will not be applied.');
            vscode.window.showErrorMessage('Invalid vcpkg path, this changes will not be applied.');
        }
    }

    public async enableVcpkg(forceEnable: Boolean) {
        if ((await this.isVcpkgEnabled()) && !forceEnable) {
            this.logInfo('vcpkg is already enabled.');
            return;
        }

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Enabling vcpkg...',
            cancellable: false
        }, async () => {
            // cleanup old vcpkg-related cmake configs
            this.logInfo('cleanning vcpkg related cmake options.');
            await this.cleanupVcpkgRelatedCMakeOptions();

            const oldPath = await this.getVcpkgPathFromConfig();

            if (oldPath !== undefined) {
                if (!await this.initCMakeSettings(oldPath)) {
                    return;
                }
                this._emitter.fire('VersionManager', 'setVcpkgRoot', oldPath);
                this._nodeProvider.setVcpkgPath(oldPath);

                this.logInfo('vcpkg already set to ' + oldPath + ' , enabled plugin.');
                return;
            }

            let vcpkgRootEnv = await getVcpkgPathFromEnv();
            if (vcpkgRootEnv !== undefined) {
                if (await this.isVcpkgExistInPath(vcpkgRootEnv)) {
                    if (!await this.initCMakeSettings(vcpkgRootEnv)) {
                        return;
                    }
                    this._emitter.fire('VersionManager', 'setVcpkgRoot', vcpkgRootEnv);
                    this._nodeProvider.setVcpkgPath(vcpkgRootEnv);

                    vscode.window.showInformationMessage('vcpkg enabled.');

                    this.logInfo(
                        'update target/host triplet to ' + workspace.getConfiguration('vcpkg').get(this._hostTripletConfig),
                    );

                    this.logInfo('detect env VCPKG_ROOT: ' + vcpkgRootEnv + ' , enabled plugin.');
                    return;
                } else {
                    this.logErr('invalid env VCPKG_ROOT, plugin will not be enabled.');
                    vscode.window.showErrorMessage(
                        'Invalid vcpkg path, vcpkg will not be enabled, pleaes check envornment variable VCPKG_ROOT.',
                    );
                    return;
                }
            } else {
                const result = await this.chooseAndUpdateVcpkgPath();
                if (result) {
                    if (!await this.initCMakeSettings(result)) {
                        return;
                    }

                    vscode.window.showInformationMessage('vcpkg enabled.');

                    this.logInfo(
                        'update target/host triplet to ' +
                            workspace.getConfiguration('vcpkg').get<string>(this._hostTripletConfig),
                    );

                    this.logInfo('detect select valid vcpkg path: ' + result + ' , enabled plugin.');
                }
            }
        });

        await this.suggestManifestMode();
    }

    public async disableVcpkg(cleanToolChain: boolean) {
        if (!(await this.isVcpkgEnabled())) {
            return;
        }

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Disabling vcpkg...',
            cancellable: false
        }, async () => {
            await this.updateVcpkgSetting(this._enableVcpkgConfig, false);

            // clean vcpkg options
            await this.cleanupVcpkgRelatedCMakeOptions();

            // clean toolchain setting
            if (cleanToolChain) {
                await this.updateCMakeSetting(this._configConfigSettingConfig, this.getCleanVcpkgToolchian());
            }

            this.logInfo('Disabled vcpkg plugin.');
            this.updateStatusBar(false);
        });
    }

    public async enableManifest() {
        if (!(await this.isVcpkgEnabled())) {
            vscode.window.showErrorMessage('Vcpkg is not enabled yet, manifest mode will not be enabled.');
            return;
        }

        let found = await this.isContainManifestFile();
        if (!found) {
            vscode.window.showWarningMessage(
                "Enable manifest mode failed: current project path doesn't contains vcpkg.json",
            );
            return;
        }

        vscode.window.showInformationMessage('Manifest mode enabled.');

        await this.updateVcpkgSetting(this._useManifestConfig, true);

        let newConfigs = this.getAndCleanCMakeOptions(this._cmakeOptionPrefix + this._vcpkgManifestModeConfig);

        newConfigs.push(this._cmakeOptionPrefix + this._vcpkgManifestModeConfig + this._cmakeOptionEanble);

        this.logInfo('cmake options: ' + newConfigs.toString());
        await this.updateCMakeSetting(this._cmakeOptionConfig, newConfigs);
    }

    public async disableManifest() {
        vscode.window.showInformationMessage('Manifest mode disabled.');

        await this.updateVcpkgSetting(this._useManifestConfig, false);

        let newConfigs = this.getAndCleanCMakeOptions(this._cmakeOptionPrefix + this._vcpkgManifestModeConfig);

        newConfigs.push(this._cmakeOptionPrefix + this._vcpkgManifestModeConfig + this._cmakeOptionDisable);

        this.logInfo('cmake options: ' + newConfigs.toString());
        await this.updateCMakeSetting(this._cmakeOptionConfig, newConfigs);
    }

    public async getVcpkgRealPath() {
        const config = await this.getVcpkgPathFromConfig();
        // environment variable
        if (config?.indexOf('$ENV') === 0) {
            return getVcpkgPathFromEnv();
        } else {
            // true real path
            return config;
        }
    }

    public async getAllSupportedTriplets() {
        return this._tripletService.getAllSupportedTriplets(await this.getVcpkgRealPath());
    }

    public async setTargetTripletByString(triplet: string) {
        await this.updateVcpkgSetting(this._targetTripletConfig, triplet);
        this.logInfo('update target triplet to: ' + triplet);
        vscode.window.showInformationMessage('Update target triplet to: ' + triplet);
        this.updateStatusBar(true);
    }

    public async setTargetTriplet() {
        await this._tripletService.setTriplet(false, await this.getVcpkgRealPath());
        this.updateStatusBar(true);
    }

    public async setHostTripletByString(triplet: string) {
        await this.updateVcpkgSetting(this._hostTripletConfig, triplet);
        this.logInfo('update host triplet to: ' + triplet);
        vscode.window.showInformationMessage('Update host triplet to: ' + triplet);
    }

    public async setHostTriplet() {
        await this._tripletService.setTriplet(true, await this.getVcpkgRealPath());
    }

    public async getCurrentTriplet() {
        return workspace.getConfiguration('vcpkg').get<string>(this._targetTripletConfig);
    }
    public async showCurrentTriplet() {
        vscode.window.showInformationMessage('Current triplet is: ' + (await this.getCurrentTriplet()));
    }

    public async showCurrentHostTriplet() {
        vscode.window.showInformationMessage('Current host triplet is: ' + (await this.getCurrentHostTriplet()));
    }

    public async getCurrentHostTriplet() {
        return workspace.getConfiguration('vcpkg').get<string>(this._hostTripletConfig);
    }

    public async useLibType(staticLib: boolean) {
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Setting to ${staticLib ? 'static' : 'dynamic'} library type...`,
            cancellable: false
        }, async () => {
            await this.updateVcpkgSetting(this._useStaticLibConfig, staticLib);
            await this.updateCurrentTripletSetting();
            this.logInfo('Set to ' + (staticLib ? 'static' : 'dynamic') + ' triplet');
            vscode.window.showInformationMessage('Now use ' + (staticLib ? 'static' : 'dynamic') + ' library / triplet');
        });
    }

    public async getLibType() {
        return workspace.getConfiguration('vcpkg').get<string>(this._useStaticLibConfig);
    }

    public async useCRTType(dynamicCRT: boolean) {
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Setting to ${dynamicCRT ? 'dynamic' : 'static'} CRT linkage...`,
            cancellable: false
        }, async () => {
            await this.updateVcpkgSetting(this._vcpkgUseDynamicCRTConfig, dynamicCRT);
            await this.updateCurrentCRTSetting();
            this.logInfo('Set to ' + (dynamicCRT ? 'dynamic' : 'static') + ' triplet');
            vscode.window.showInformationMessage('Now use ' + (dynamicCRT ? 'dynamic' : 'static') + ' CRT linkage');
        });
    }

    public async getManifestMode() {
        return workspace.getConfiguration('vcpkg').get<string>(this._useManifestConfig);
    }

    public async installDependencies(install: boolean) {
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `${install ? 'Enabling' : 'Disabling'} dependency installation...`,
            cancellable: false
        }, async () => {
            await this.updateVcpkgSetting(this._installDependenciesConfig, install);

            let newConfigs = this.getAndCleanCMakeOptions(this._cmakeOptionPrefix + this._vcpkgApplocalDepsConfig);
            newConfigs.push(
                this._cmakeOptionPrefix +
                    this._vcpkgApplocalDepsConfig +
                    (install ? this._cmakeOptionEanble : this._cmakeOptionDisable),
            );
            this.logInfo('cmake options: ' + newConfigs.toString());
            await this.updateCMakeSetting(this._cmakeOptionConfig, newConfigs);

            newConfigs = this.getAndCleanCMakeOptions(this._cmakeOptionPrefix + this._vcpkgApplocalDepsInstallConfig);
            newConfigs.push(
                this._cmakeOptionPrefix +
                    this._vcpkgApplocalDepsInstallConfig +
                    (install ? this._cmakeOptionEanble : this._cmakeOptionDisable),
            );
            this.logInfo('cmake options: ' + newConfigs.toString());
            await this.updateCMakeSetting(this._cmakeOptionConfig, newConfigs);
            
            vscode.window.showInformationMessage('Install dependencies ' + (install ? 'enabled' : 'disabled') + '.');
        });
    }

    public async preferSysLibs(sysLib: boolean) {
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Preferring ${sysLib ? 'system' : 'vcpkg'} libraries...`,
            cancellable: false
        }, async () => {
            await this.updateVcpkgSetting(this._preferSystemLibsConfig, sysLib);

            let newConfigs = this.getAndCleanCMakeOptions(this._cmakeOptionPrefix + this._vcpkgPreferSystemLibsConfig);
            newConfigs.push(
                this._cmakeOptionPrefix +
                    this._vcpkgPreferSystemLibsConfig +
                    (sysLib ? this._cmakeOptionEanble : this._cmakeOptionDisable),
            );
            this.logInfo('cmake options: ' + newConfigs.toString());
            await this.updateCMakeSetting(this._cmakeOptionConfig, newConfigs);
            vscode.window.showInformationMessage('Find ' + (sysLib ? 'system libs' : 'vcpkg generated libs') + ' first.');
        });
    }

    public async assetSourceWithEnv(value: string) {
        vscode.window.showInformationMessage('asset source change to ' + value);

        if (value.length !== 0) {
            process.env[this._vcpkgAssetSourceEnvConfig] =
                '\"' + this._vcpkgAssertSourceOption + '=' + 'clear;x-azurl,' + value + ',,read\"';
            //this._context.environmentVariableCollection.replace(this._vcpkgAssetSourceEnvConfig, '\"' + this._vcpkgAssertSourceOption + '=' + 'clear;x-azurl,' + value + ',,read\"');
        } else {
            delete process.env[this._vcpkgAssetSourceEnvConfig];
            //this._context.environmentVariableCollection.delete(this._vcpkgAssetSourceEnvConfig);
        }
    }

    public async assetSourceWithInstallOption(value: string) {
        vscode.window.showInformationMessage('asset source change to ' + value);

        let newConfigs = this.getAndCleanCMakeConfigureSetting(this._vcpkgAssertSourceOption);

        if (value.length !== 0) {
            newConfigs.push('\"' + this._vcpkgAssertSourceOption + '=' + 'clear;x-azurl,' + value + ',,read\"');
        }

        this.logInfo('install options: ' + newConfigs.toString());
        await this.updateCMakeConfigureSetting(newConfigs);
    }

    public async binaryCacheWithEnv(value: string) {
        vscode.window.showInformationMessage('binary cache change to ' + value);

        if (value.length !== 0) {
            process.env[this._vcpkgBinarySourceEnvConfig] =
                '\"' + this._vcpkgBinarySourceOption + '=' + 'clear;files,' + value + ',read\"';
            //this._context.environmentVariableCollection.replace(this._vcpkgBinarySourceEnvConfig, '\"' + this._vcpkgBinarySourceOption + '=' + 'clear;files,' + value + ',read\"');
        } else {
            delete process.env[this._vcpkgBinarySourceEnvConfig];
            //this._context.environmentVariableCollection.delete(this._vcpkgBinarySourceEnvConfig);
        }
    }

    public async binaryCacheWithInstallOption(value: string) {
        vscode.window.showInformationMessage('binary cache change to ' + value);

        let newConfigs = this.getAndCleanCMakeConfigureSetting(this._vcpkgBinarySourceOption);

        if (value.length !== 0) {
            newConfigs.push('\"' + this._vcpkgBinarySourceOption + '=' + 'clear;files,' + value + ',read\"');
        }

        this.logInfo('install options: ' + newConfigs.toString());
        await this.updateCMakeConfigureSetting(newConfigs);
    }

    private handleBinaryCachingChange() {
        this.logInfo('detect binary caching configuration changed.');
        let currValue = workspace.getConfiguration('vcpkg').get<string>(this._vcpkgBinaryCacheConfig);
        if (currValue !== undefined) {
            this.binaryCacheWithEnv(currValue);
        }
    }

    private handleAssetSourceChange() {
        this.logInfo('detect asset source configuration changed.');
        let currValue = workspace.getConfiguration('vcpkg').get<string>(this._vcpkgAssetSourceConfig);
        if (currValue !== undefined) {
            this.assetSourceWithEnv(currValue);
        }
    }

    private handlePreferSystemLibsChange() {
        this.logInfo('detect use system libs configuration changed.');
        let currSel = workspace.getConfiguration('vcpkg').get<boolean>(this._preferSystemLibsConfig);
        this.preferSysLibs(currSel!);
    }

    private handleDefaultTripletChange() {
        this.logInfo('detect vcpkg target tripconst configuration changed.');
        let currSel = workspace.getConfiguration('vcpkg').get<string>(this._targetTripletConfig);
        this.useLibType(this._tripletService.isStaticLib(currSel || '') || false);
    }

    private handleUseDynamicCRTChange() {
        if (process.platform === 'win32') {
            let isUseDynamic = workspace.getConfiguration('vcpkg').get<boolean>(this._vcpkgUseDynamicCRTConfig);
            this.logInfo('detect vcpkg CRT configuration changed to ' + (isUseDynamic ? 'dynamic' : 'static'));

            this.useCRTType(isUseDynamic || false);
        }
    }

    private handleUseStaticLibChange() {
        let isUseStatic = workspace.getConfiguration('vcpkg').get<boolean>(this._useStaticLibConfig);
        this.logInfo('detect vcpkg static lib configuration changed to ' + (isUseStatic ? 'static' : 'dynamic'));
        this.useLibType(isUseStatic || false);
    }

    private handleAdditionalOptionsChange() {
        this.logInfo('detect vcpkg install option configuration changed.');
        let extraOptCfgs = workspace.getConfiguration('vcpkg').get<Array<string>>(this._additionalOptionsConfig);
        if (extraOptCfgs !== undefined && extraOptCfgs.length) {
            let cmakeConfigs = this.getAndCleanCMakeConfigureSetting(this._vcpkgInstallOptionsConfig);
            for (let curr in extraOptCfgs) {
                cmakeConfigs?.push(extraOptCfgs[curr]);

                this.logInfo('add extra vcpkg instal option: ' + extraOptCfgs[curr]);
            }

            this.updateCMakeConfigureSetting(cmakeConfigs);
        } else {
            let cmakeConfigs = this.getAndCleanCMakeConfigureSetting(this._vcpkgInstallOptionsConfig);
            this.updateCMakeConfigureSetting(cmakeConfigs);
        }
    }

    private handleInstallDependenciesChange() {
        this.logInfo('detect install dependencies configuration changed.');
        let currSel = workspace.getConfiguration('vcpkg').get<boolean>(this._installDependenciesConfig);
        this.installDependencies(currSel!);
    }

    private handleManifestChange() {
        this.logInfo('detect vcpkg manifest configuration changed.');
        if (workspace.getConfiguration('vcpkg').get<boolean>(this._useManifestConfig)) {
            this.enableManifest();
        } else {
            this.disableManifest();
        }
    }

    private async handleVcpkgPathChange() {
        this.logInfo('detect vcpkg path configuration changed.');
        const oldPath = await this.getVcpkgPathFromConfig();

        if (oldPath === undefined) {
            vscode.window.showErrorMessage('Vcpkg path is incorrect! Disabling vcpkg now.');
            this.disableVcpkg(true);
        } else {
            vscode.window.showInformationMessage('Re-enable vcpkg now.');
            this.enableVcpkg(true);

            await this.suggestManifestMode();
        }
    }

    private async handleEnableVcpkgChange() {
        this.logInfo('detect vcpkg enable configuration changed.');
        if (workspace.getConfiguration('vcpkg').get<boolean>(this._enableVcpkgConfig)) {
            this.enableVcpkg(true);
            await this.suggestManifestMode();
        } else {
            this.disableVcpkg(true);
        }
    }

    public async onConfigurationChanged(event: vscode.ConfigurationChangeEvent) {
        this.logInfo('detect configuration changed.');
        if (event.affectsConfiguration('vcpkg.' + this._enableVcpkgConfig)) {
            await this.handleEnableVcpkgChange();
        } else if (event.affectsConfiguration('vcpkg.' + this._vcpkgPathConfig)) {
            await this.handleVcpkgPathChange();
        } else if (event.affectsConfiguration('vcpkg.' + this._useManifestConfig)) {
            this.handleManifestChange();
        } else if (event.affectsConfiguration('vcpkg.' + this._installDependenciesConfig)) {
            this.handleInstallDependenciesChange();
        } else if (event.affectsConfiguration('vcpkg.' + this._additionalOptionsConfig)) {
            this.handleAdditionalOptionsChange();
        } else if (event.affectsConfiguration('vcpkg.' + this._useStaticLibConfig)) {
            this.handleUseStaticLibChange();
        } else if (event.affectsConfiguration('vcpkg.' + this._vcpkgUseDynamicCRTConfig)) {
            this.handleUseDynamicCRTChange();
        } else if (event.affectsConfiguration('vcpkg.' + this._targetTripletConfig)) {
            this.handleDefaultTripletChange();
        } else if (event.affectsConfiguration('vcpkg.' + this._preferSystemLibsConfig)) {
            this.handlePreferSystemLibsChange();
        } else if (event.affectsConfiguration('vcpkg.' + this._vcpkgAssetSourceConfig)) {
            this.handleAssetSourceChange();
        } else if (event.affectsConfiguration('vcpkg.' + this._vcpkgBinaryCacheConfig)) {
            this.handleBinaryCachingChange();
        }
    }

    dispose(): void {
        this.disposables.forEach((item) => item.dispose());
    }
}
