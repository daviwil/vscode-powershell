/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import os = require('os');
import fs = require('fs');
import net = require('net');
import path = require('path');
import utils = require('./utils');
import vscode = require('vscode');
import cp = require('child_process');
import Settings = require('./settings');

import { Logger } from './logging';
import { IFeature } from './feature';
import { StringDecoder } from 'string_decoder';
import { LanguageClient, LanguageClientOptions, Executable, RequestType, NotificationType, StreamInfo } from 'vscode-languageclient';
import { EventEmitter } from "events";

export interface ProcessConfiguration {
    powerShellExePath: string;
    isWindowsDevBuild: boolean;
    bundledModulesPath: string;
    hostVersion: string;
    logLevel: string;
    logPath: string;
    waitForDebugger: boolean;
    featureFlags: string[];
    isWindowsOS: boolean;
    showConsoleOnStartup: boolean;
}

/*

WHAT I NEED:
- Remote files (psedit) -- POSTPONE
- Startup progress indicator until debugger starts
- No language server hookup, MAYBE IntelliSense, but not likely
- Switch F8 to debug session console
- When debug session ends, switch back to integrated console
- New client, maybe based on vscode-jsonrpc
- Reuse SessionManager startup code

*/

/*

What's the minimum needed for launching the process?  Process path and
arguments.  Maybe there's a class that can make PowerShell process
arguments?

Events: This class should raise events for all lifecycle changes.

No connections will be made here.  Once the process is launched, the
session information will be transmitted back to the caller through
a resolved promise.

Actually, maybe events aren't needed at all, the promise could just
return an error depending on what happened.  Encode enough information
to show the right error messages.

*/

// - TODO: How do I send the Evaluate request?  Any other requests?

export class PowerShellProcess extends EventEmitter {

    private registeredCommands: vscode.Disposable[] = [];
    private consoleTerminal: vscode.Terminal = undefined;

    // When in development mode, VS Code's session ID is a fake
    // value of "someValue.machineId".  Use that to detect dev
    // mode for now until Microsoft/vscode#10272 gets implemented.
    private readonly inDevelopmentMode =
        vscode.env.sessionId === "someValue.sessionId";

    constructor(
        private requiredEditorServicesVersion: string,
        private log: Logger,
        private extensionFeatures: IFeature[] = []) {
            super();
    }

    public launch(processConfig: ProcessConfiguration) {

        var bundledModulesPath = path.resolve(__dirname, "../../modules");

        if (this.inDevelopmentMode) {
            var devBundledModulesPath =
                path.resolve(
                    __dirname,
                    processConfig.bundledModulesPath ||
                    "../../../PowerShellEditorServices/module");

            // Make sure the module's bin path exists
            if (fs.existsSync(path.join(devBundledModulesPath, "PowerShellEditorServices/bin"))) {
                bundledModulesPath = devBundledModulesPath;
            }
            else {
                this.log.write(
                    `\nWARNING: In development mode but PowerShellEditorServices dev module path cannot be found (or has not been built yet): ${devBundledModulesPath}\n`);
            }
        }

        var startArgs =
            "-EditorServicesVersion '" + this.requiredEditorServicesVersion + "' " +
            "-HostName 'Visual Studio Code Host' " +
            "-HostProfileId 'Microsoft.VSCode' " +
            "-HostVersion '" + processConfig.hostVersion + "' " +
            "-BundledModulesPath '" + bundledModulesPath + "' " +
            "-EnableConsoleRepl ";

        if (processConfig.waitForDebugger) {
            startArgs += '-WaitForDebugger ';
        }
        if (processConfig.logLevel) {
            startArgs += "-LogLevel '" + processConfig.logLevel + "' "
        }

        try
        {
            // this.setSessionStatus(
            //     "Starting PowerShell...",
            //     SessionStatus.Initializing);

            let startScriptPath =
                path.resolve(
                    __dirname,
                    '../../scripts/Start-EditorServices.ps1');

            var editorServicesLogPath = this.log.getLogFilePath("EditorServices");

            var featureFlags =
                processConfig.featureFlags !== undefined
                ? processConfig.featureFlags.map(f => `'${f}'`).join(', ')
                : "";

            startArgs +=
                `-LogPath '${editorServicesLogPath}' ` +
                `-SessionDetailsPath '${utils.getSessionFilePath()}' ` +
                `-FeatureFlags @(${featureFlags})`

            var powerShellArgs = [
                "-NoProfile",
                "-NonInteractive"
            ]

            // Only add ExecutionPolicy param on Windows
            if (processConfig.isWindowsOS) {
                powerShellArgs.push("-ExecutionPolicy", "Unrestricted")
            }

            powerShellArgs.push(
                "-Command",
                "& '" + startScriptPath + "' " + startArgs);

            var powerShellExePath = processConfig.powerShellExePath;

            if (processConfig.isWindowsDevBuild) {
                // Windows PowerShell development builds need the DEVPATH environment
                // variable set to the folder where development binaries are held

                // NOTE: This batch file approach is needed temporarily until VS Code's
                // createTerminal API gets an argument for setting environment variables
                // on the launched process.
                var batScriptPath = path.resolve(__dirname, '../../sessions/powershell.bat');
                fs.writeFileSync(
                    batScriptPath,
                    `@set DEVPATH=${path.dirname(powerShellExePath)}\r\n@${powerShellExePath} %*`);

                powerShellExePath = batScriptPath;
            }

            // Make sure no old session file exists
            utils.deleteSessionFile();

            this.log.write(`${utils.getTimestampString()} Language server starting...`);

            // Launch PowerShell in the integrated terminal
            this.consoleTerminal =
                vscode.window.createTerminal(
                    "PowerShell Integrated Console",
                    powerShellExePath,
                    powerShellArgs);

            if (processConfig.showConsoleOnStartup) {
                this.consoleTerminal.show(true);
            }

            // Start the language client
            utils.waitForSessionFile(
                (sessionDetails, error) => {
                    if (sessionDetails) {
                        if (sessionDetails.status === "started") {
                            this.log.write(`${utils.getTimestampString()} Language server started.`);

                            // Write out the session configuration file
                            utils.writeSessionFile(sessionDetails);

                            // Start the language service client
                            // this.startLanguageClient(sessionDetails);
                        }
                        else if (sessionDetails.status === "failed") {
                            if (sessionDetails.reason === "unsupported") {
                                // this.setSessionFailure(
                                //     `PowerShell language features are only supported on PowerShell version 3 and above.  The current version is ${sessionDetails.powerShellVersion}.`)
                            }
                            else if (sessionDetails.reason === "languageMode") {
                                // this.setSessionFailure(
                                //     `PowerShell language features are disabled due to an unsupported LanguageMode: ${sessionDetails.detail}`);
                            }
                            else {
                                // this.setSessionFailure(`PowerShell could not be started for an unknown reason '${sessionDetails.reason}'`)
                            }
                        }
                        else {
                            // TODO: Handle other response cases
                        }
                    }
                    else {
                        this.log.write(`${utils.getTimestampString()} Language server startup failed.`);
                        // this.setSessionFailure("Could not start language service: ", error);
                    }
                });

            // this.powerShellProcess.stderr.on(
            //     'data',
            //     (data) => {
            //         this.log.writeError("ERROR: " + data);

            //         if (this.sessionStatus === SessionStatus.Initializing) {
            //             this.setSessionFailure("PowerShell could not be started, click 'Show Logs' for more details.");
            //         }
            //         else if (this.sessionStatus === SessionStatus.Running) {
            //             this.promptForRestart();
            //         }
            //     });

            vscode.window.onDidCloseTerminal(
                terminal => {
                    this.log.write(os.EOL + "powershell.exe terminated or terminal UI was closed" + os.EOL);

                    // if (this.languageServerClient != undefined) {
                    //     this.languageServerClient.stop();
                    // }

                    // if (this.sessionStatus === SessionStatus.Running) {
                    //     this.setSessionStatus("Session exited", SessionStatus.Failed);
                    //     this.promptForRestart();
                    // }
                });

            this.consoleTerminal.processId.then(
                pid => {
                    console.log("powershell.exe started, pid: " + pid + ", exe: " + powerShellExePath);
                    this.log.write(
                        "powershell.exe started --",
                        "    pid: " + pid,
                        "    exe: " + powerShellExePath,
                        "    args: " + startScriptPath + ' ' + startArgs + os.EOL + os.EOL);
                });
        }
        catch (e)
        {
            // this.setSessionFailure("The language service could not be started: ", e);
        }
    }

    public dispose() : void {
        // Kill the PowerShell process we spawned via the console
        if (this.consoleTerminal !== undefined) {
            this.log.write(os.EOL + "Terminating PowerShell process...");
            this.consoleTerminal.dispose();
            this.consoleTerminal = undefined;
        }
    }
}
