/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import os = require('os');
import fs = require('fs');
import net = require('net');
import path = require('path');
import utils = require('../utils');
import cp = require('child_process');
import Settings = require('../settings');

import { Logger } from '../logging';

export class PowerShellProcess {

    private powerShellProcess: cp.ChildProcess;
    private sessionDetails: utils.EditorServicesSessionDetails;

    constructor(
        public exePath: string,
        private startArgs: string,
        private sessionFilePath: string) {
    }

    public start(): Thenable<utils.EditorServicesSessionDetails> {

        return new Promise<utils.EditorServicesSessionDetails>(
            (resolve, reject) => {
                try
                {
                    let startScriptPath =
                        path.resolve(
                            __dirname,
                            '../../scripts/Start-EditorServices.ps1');

                    var editorServicesLogPath = this.sessionFilePath + ".log"; //this.log.getLogFilePath(logFileName);

                    var featureFlags = "";
                        // this.sessionSettings.developer.featureFlags !== undefined
                        //     ? this.sessionSettings.developer.featureFlags.map(f => `'${f}'`).join(', ')
                        //     : "";

                    this.startArgs +=
                        `-LogPath '${editorServicesLogPath}' ` +
                        `-LogLevel 'Verbose' ` +
                        `-SessionDetailsPath '${this.sessionFilePath}' ` +
                        `-FeatureFlags @(${featureFlags})`

                    var powerShellArgs = [
                        "/c",
                        "start",
                        "/wait",
                        '""',
                        this.exePath,
                        "-NoProfile",
                        "-NonInteractive"
                    ]

                    // Only add ExecutionPolicy param on Windows
                    if (utils.isWindowsOS()) {
                        powerShellArgs.push("-ExecutionPolicy", "Bypass")
                    }

                    powerShellArgs.push(
                        "-Command",
                        "& '" + startScriptPath + "' " + this.startArgs);

                    console.log(`${utils.getTimestampString()} Integration server starting...`);
                    console.log(`\r\nstartArgs:\r\n\r\n${this.startArgs}`);
                    console.log("\r\nargs: ", powerShellArgs);

                    // Make sure no old session file exists
                    utils.deleteSessionFile(this.sessionFilePath);

                    this.powerShellProcess =
                        cp.spawn(
                            "cmd.exe",
                            powerShellArgs,
                            { env: process.env });

                    console.log("\r\n\r\nSpawned process with PID " + this.powerShellProcess.pid);

                    // Start the language client
                    utils.waitForSessionFile(
                        this.sessionFilePath,
                        (sessionDetails, error) => {
                            // Clean up the session file
                            utils.deleteSessionFile(this.sessionFilePath);

                            if (error) {
                                reject(error);
                            }
                            else {
                                this.sessionDetails = sessionDetails;
                                resolve(this.sessionDetails);
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

                // this.consoleCloseSubscription =
                //     vscode.window.onDidCloseTerminal(
                //         terminal => {
                //             if (terminal === this.consoleTerminal) {
                //                 this.log.write(os.EOL + "powershell.exe terminated or terminal UI was closed" + os.EOL);
                //                 this.onExitedEmitter.fire();
                //             }
                //         });

                // this.consoleTerminal.processId.then(
                //     pid => {
                //         console.log("powershell.exe started, pid: " + pid + ", exe: " + powerShellExePath);
                //         this.log.write(
                //             "powershell.exe started --",
                //             "    pid: " + pid,
                //             "    exe: " + powerShellExePath,
                //             "    args: " + startScriptPath + ' ' + this.startArgs + os.EOL + os.EOL);
                //     });
            }
            catch (e)
            {
                reject(e);
            }
        });
    }

    public dispose() {

        // Clean up the session file
        utils.deleteSessionFile(this.sessionFilePath);

        // Kill the PowerShell process we spawned via the console
        if (this.powerShellProcess !== undefined) {
            this.powerShellProcess.kill();
            this.powerShellProcess = undefined;
        }
    }
}
