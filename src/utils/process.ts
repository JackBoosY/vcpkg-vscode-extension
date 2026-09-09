import * as proc from 'child_process';
import { VcpkgLogMgr } from '../log';

export async function runShellCommand(command: string, param: string, executeRoot: string, logMgr: VcpkgLogMgr): Promise<string> {
    return new Promise((resolve, reject) => {
        proc.exec(command + ' ' + param, { cwd: executeRoot, encoding: 'utf-8' }, (error, stdout, stderr) => {
            if (error) {
                logMgr.logErr(`Command failed: ${command} ${param}\n${error}`);
                reject(error);
            } else {
                resolve(stdout.toString());
            }
        });
    });
}