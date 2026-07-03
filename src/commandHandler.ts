import * as vscode from 'vscode';
import { ConfigurationManager } from './configuration';
import { VersionManager } from './versionManager';
import { VcpkgEventEmitter } from './vcpkgEventEmitter';
import { SettingsDocument } from './settingsDocument';

export class CommandHandler {
    constructor(
        private context: vscode.ExtensionContext,
        private configMgr: ConfigurationManager,
        private verMgr: VersionManager,
        private emitter: VcpkgEventEmitter
    ) {}

    public registerCommands() {
        this.context.subscriptions.push(
            vscode.commands.registerCommand(
                'vcpkg-integration.enable_vcpkg',
                async () => await this.configMgr.enableVcpkg(false),
            ),
        );

        this.context.subscriptions.push(
            vscode.commands.registerCommand(
                'vcpkg-integration.disable_vcpkg',
                async () => await this.configMgr.disableVcpkg(true),
            ),
        );

        this.context.subscriptions.push(
            vscode.commands.registerCommand(
                'vcpkg-integration.enable_manifest',
                async () => await this.configMgr.enableManifest(),
            ),
        );

        this.context.subscriptions.push(
            vscode.commands.registerCommand(
                'vcpkg-integration.disable_manifest',
                async () => await this.configMgr.disableManifest(),
            ),
        );

        this.context.subscriptions.push(
            vscode.commands.registerCommand(
                'vcpkg-integration.current_triplet',
                async () => await this.configMgr.showCurrentTriplet(),
            ),
        );

        this.context.subscriptions.push(
            vscode.commands.registerCommand(
                'vcpkg-integration.current_host_triplet',
                async () => await this.configMgr.showCurrentHostTriplet(),
            ),
        );

        this.context.subscriptions.push(
            vscode.commands.registerCommand(
                'vcpkg-integration.set_target_triplet',
                async () => await this.configMgr.setTargetTriplet(),
            ),
        );

        this.context.subscriptions.push(
            vscode.commands.registerCommand(
                'vcpkg-integration.set_host_triplet',
                async () => await this.configMgr.setHostTriplet(),
            ),
        );

        this.context.subscriptions.push(
            vscode.commands.registerCommand(
                'vcpkg-integration.use_static_lib',
                async () => await this.configMgr.useLibType(true),
            ),
        );

        this.context.subscriptions.push(
            vscode.commands.registerCommand(
                'vcpkg-integration.use_dynamic_lib',
                async () => await this.configMgr.useLibType(false),
            ),
        );

        this.context.subscriptions.push(
            vscode.commands.registerCommand('vcpkg-welcome.getting_start', () => {
                vscode.commands.executeCommand(
                    'workbench.action.openWalkthrough',
                    'JackBoosY.vcpkg-cmake-tools#start',
                    false,
                );
            }),
        );

        // manifest completion
        this.context.subscriptions.push(
            vscode.languages.registerCompletionItemProvider(
                { scheme: 'file', language: 'json', pattern: '**/vcpkg.json' },
                {
                    provideCompletionItems: (document, position, token) => {
                        return new SettingsDocument(document, this.verMgr, this.emitter).provideCompletionItems(
                            position,
                            token,
                        );
                    },
                },
                '"',
            ),
        );
    }
}
