export function getEnvironmentValue(name: string): string {
    if (name.search(/\$[Ee][Nn][Vv]{(.+)}/) !== -1) {
        const envName = name.match(/\$[Ee][Nn][Vv]{(.+)}/)?.at(1);

        if (envName !== undefined && process.env[envName] !== undefined) {
            return process.env[envName] as string;
        } else {
            return '';
        }
    } else {
        return '';
    }
}

export function convertToAbsolutePath(path: string): string {
    if (path.search(/\$[Ee][Nn][Vv]{(.+)}/) !== -1) {
        const envName = getEnvironmentValue(path);
        const suffix = path.match(/\$[Ee][Nn][Vv]{.+}(.*)/)?.at(1);

        if (envName) {
            return envName + suffix;
        }
    }
    return path;
}

export function getVcpkgPathFromEnv(): string | undefined {
    const envVar = process.env['VCPKG_ROOT'];
    if (envVar !== undefined && envVar.length !== 0) {
        return envVar;
    }
    return undefined;
}
