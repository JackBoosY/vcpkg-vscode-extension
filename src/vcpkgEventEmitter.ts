import { VcpkgLogMgr } from './log';

export type TripletInfo = {
    triplets: { label: string; description: string }[] | undefined;
    current: string | undefined;
};

export interface VcpkgEventPayloads {
    setVcpkgRoot: string;
    getVcpkgPathFromInfoSidebar: null;
    setVcpkgPath: string | undefined;
    setCurrentTriplet: string | undefined;
    setHostTriplet: string | TripletInfo;
    setDefaultTriplet: string | TripletInfo;
    setManifestMode: boolean | string | undefined;
    getManifestModeFromInfoSidebar: null;
    getCurrentTripletFromInfoSidebar: null;
    getHostTripletFromInfoSidebar: null;
    getDebugPortName: string[] | string | null | undefined;
    getDebugPortNameInCMakeDebugger: string[] | string | null | undefined;
    setInstallOptions: string | string[] | { options: string[]; features: string[] };
    setPortFeatures: string[];
    getInstallOptions: null;
    onDidChangeBreakpoints: null;
}

export type EventCallback = <K extends keyof VcpkgEventPayloads>(request: K, result: VcpkgEventPayloads[K]) => void;

export class VcpkgEventEmitter {
    private _logMgr: VcpkgLogMgr;
    private _modules = new Map<string, EventCallback>();

    constructor(log: VcpkgLogMgr) {
        this._logMgr = log;
    }

    public registerListener(name: string, callback: EventCallback) {
        this._modules.set(name, callback);
        this._logMgr.logInfo('Registered module: ' + name);
    }

    public fire<K extends keyof VcpkgEventPayloads>(module: string, request: K, result: VcpkgEventPayloads[K]) {
        this._logMgr.logInfo('Got new event: ' + request + ' to ' + module);
        let callback = this._modules.get(module);
        if (callback) {
            callback(request, result);
        } else {
            this._logMgr.logErr('Error: module ' + module + ' is not registered or callback is undefined!!!');
        }
    }
}
