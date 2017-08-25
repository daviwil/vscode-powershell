import fs = require('fs');
import os = require('os');
import path = require('path');
import Settings = require('./settings');

export let PowerShellLanguageId = 'powershell';

export function ensurePathExists(targetPath: string) {
    // Ensure that the path exists
    try {
        fs.mkdirSync(targetPath);
    }
    catch (e) {
        // If the exception isn't to indicate that the folder
        // exists already, rethrow it.
        if (e.code != 'EEXIST') {
            throw e;
        }
    }
}

export function getPipePath(pipeName: string) {
    if (os.platform() == "win32") {
        return "\\\\.\\pipe\\" + pipeName;
    }
    else {
        // On UNIX platforms the pipe will live under the temp path
        // For details on how this path is computed, see the corefx
        // source for System.IO.Pipes.PipeStream:
        // https://github.com/dotnet/corefx/blob/d0dc5fc099946adc1035b34a8b1f6042eddb0c75/src/System.IO.Pipes/src/System/IO/Pipes/PipeStream.Unix.cs#L340
        return path.resolve(
            os.tmpdir(),
            ".dotnet", "corefx", "pipe",
            pipeName);
    }
}

export interface EditorServicesSessionDetails {
    status: string;
    reason: string;
    detail: string;
    powerShellVersion: string;
    channel: string;
    languageServicePort: number;
    debugServicePort: number;
}

export interface ReadSessionFileCallback {
    (details: EditorServicesSessionDetails): void;
}

export interface WaitForSessionFileCallback {
    (details: EditorServicesSessionDetails, error: string): void;
}

let sessionsFolder = path.resolve(__dirname, "..", "sessions/");
let sessionFilePathPrefix = path.resolve(sessionsFolder, "PSES-VSCode-" + process.env.VSCODE_PID);

// Create the sessions path if it doesn't exist already
ensurePathExists(sessionsFolder);

export function getSessionFilePath(uniqueId: number) {
    return `${sessionFilePathPrefix}-${uniqueId}`;
}

export function getDebugSessionFilePath() {
    return `${sessionFilePathPrefix}-Debug`;
}

export function writeSessionFile(sessionFilePath: string, sessionDetails: EditorServicesSessionDetails) {
    ensurePathExists(sessionsFolder);

    var writeStream = fs.createWriteStream(sessionFilePath);
    writeStream.write(JSON.stringify(sessionDetails));
    writeStream.close();
}

export function waitForSessionFile(sessionFilePath: string, callback: WaitForSessionFileCallback) {

    function innerTryFunc(remainingTries: number, delayMilliseconds: number) {
        if (remainingTries == 0) {
            callback(undefined, "Timed out waiting for session file to appear.");
        }
        else if(!checkIfFileExists(sessionFilePath)) {
            // Wait a bit and try again
            setTimeout(
                function() { innerTryFunc(remainingTries - 1, delayMilliseconds); },
                delayMilliseconds);
        }
        else {
            // Session file was found, load and return it
            callback(readSessionFile(sessionFilePath), undefined);
        }
    }

    // Try once per second for 60 seconds, one full minute
    innerTryFunc(60, 1000);
}

export function readSessionFile(sessionFilePath: string): EditorServicesSessionDetails {
    let fileContents = fs.readFileSync(sessionFilePath, "utf-8");
    return JSON.parse(fileContents)
}

export function deleteSessionFile(sessionFilePath: string) {
    try {
        fs.unlinkSync(sessionFilePath);
    }
    catch (e) {
        // TODO: Be more specific about what we're catching
    }
}

export function checkIfFileExists(filePath: string): boolean {
    try {
        fs.accessSync(filePath, fs.constants.R_OK)
        return true;
    }
    catch (e) {
        return false;
    }
}

export function getTimestampString() {
    var time = new Date();
    return `[${time.getHours()}:${time.getMinutes()}:${time.getSeconds()}]`
}

export function isWindowsOS(): boolean {
    return os.platform() == "win32";
}

export function getPowerShellPath(settings?: Settings.ISettings): string {
    if (!settings) {
        settings = Settings.load();
    }

    // Is there a setting override for the PowerShell path?
    var powerShellExePath =
        (settings.powerShellExePath ||
         settings.developer.powerShellExePath ||
         "").trim();

    return powerShellExePath.length > 0
        ? this.resolvePowerShellPath(powerShellExePath)
        : this.getDefaultPowerShellPath(settings.useX86Host);
}

export function getDefaultPowerShellPath(use32Bit: boolean): string | null {
    // Find the path to powershell.exe based on the current platform
    // and the user's desire to run the x86 version of PowerShell
    var powerShellExePath = undefined;

    if (isWindowsOS()) {
        powerShellExePath =
            use32Bit || !process.env.hasOwnProperty('PROCESSOR_ARCHITEW6432')
            ? process.env.windir + '\\System32\\WindowsPowerShell\\v1.0\\powershell.exe'
            : process.env.windir + '\\Sysnative\\WindowsPowerShell\\v1.0\\powershell.exe';
    }
    else if (os.platform() == "darwin") {
        powerShellExePath = "/usr/local/bin/powershell";
    }
    else {
        powerShellExePath = "/usr/bin/powershell";
    }

    return this.resolvePowerShellPath(powerShellExePath);
}

export function resolvePowerShellPath(powerShellExePath: string): string {
    var resolvedPath = path.resolve(__dirname, powerShellExePath);

    // If the path does not exist, show an error
    if (!checkIfFileExists(resolvedPath)) {
        throw "powershell.exe cannot be found or is not accessible at path " + resolvedPath;
    }

    return resolvedPath;
}
