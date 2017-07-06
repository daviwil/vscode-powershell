import os = require('os');
import net = require('net');
import path = require('path');
import utils = require('../utils');
import * as rpc from 'vscode-jsonrpc';
import * as messages from './messages';

import { PSCommand } from './psCommand';
import { PowerShellProcess } from './process';

export class IntegrationClient {

    private connection: rpc.MessageConnection;
    private powerShellProcess: PowerShellProcess;

    constructor(
        powerShellExePath: string,
        executionPolicy: string = "Bypass") {

        var bundledModulesPath =
            path.resolve(
                __dirname,
                "../../../PowerShellEditorServices/module");

        var requiredEditorServicesVersion = "1.4.1";
        var startArgs =
            "-EditorServicesVersion '" + requiredEditorServicesVersion  + "' " +
            "-HostName 'Visual Studio Code Host' " +
            "-HostProfileId 'Microsoft.VSCode' " +
            "-HostVersion '1.0.0' " +
            "-AdditionalModules @('PowerShellEditorServices.VSCode') " +
            "-BundledModulesPath '" + bundledModulesPath + "' " +
            "-EnableConsoleRepl ";

        var sessionFilePath =
            utils.getSessionFilePath(
                Math.floor(100000 + Math.random() * 900000));

        this.powerShellProcess =
            new PowerShellProcess(
                powerShellExePath,
                startArgs,
                sessionFilePath);
    }

    public start(): Thenable<boolean> {
        return this.powerShellProcess
                   .start()
                   .then(session => this.startProtocol(session))
                   .then(connection => {
                       this.connection = connection;
                       return true;
                   });
    }

    public invokeCommand(psCommand: PSCommand): Thenable<messages.InvokePSCommandResult> {
        return this.connection.sendRequest(
                    messages.InvokePSCommandRequest.type,
                    psCommand);
    }

    public sendRequest(method: string, params?: any): Thenable<any> {
        return this.connection.sendRequest(method, params);
    }

    public sendNotification(method: string, params?: any): void {
        this.connection.sendNotification(method, params);
    }

    public onNotification(method: string, handler: rpc.GenericNotificationHandler): void {
        this.connection.onNotification(method, handler);
    }

    public onRequest<R, E>(method: string, handler: rpc.GenericRequestHandler<R, E>): void {
        this.connection.onRequest(method, handler);
    }

    public dispose(): void {
        this.connection.dispose();
        this.powerShellProcess.dispose();
    }

    private startProtocol(sessionDetails: utils.EditorServicesSessionDetails): Thenable<rpc.MessageConnection> {

        return new Promise<rpc.MessageConnection>(
            (resolve, reject) => {
                if (sessionDetails.status !== "started") {
                    console.log(sessionDetails);
                    reject(sessionDetails);
                }

                console.log(`${utils.getTimestampString()} Language server started.`);

                var port = sessionDetails.languageServicePort;

                try
                {
                    console.log("Connecting to service on port " + port + "..." + os.EOL);

                    var socket = net.connect(port);
                    socket.on(
                        'connect',
                        () => {
                            console.log("Integration service connected.");
                            var connection = rpc.createMessageConnection(
                                new rpc.StreamMessageReader(socket),
                                new rpc.StreamMessageWriter(socket),
                                undefined);

                            connection.listen();

                            resolve(connection);
                        });
                }
                catch (e)
                {
                    reject(sessionDetails);
                }
        })
    }
}