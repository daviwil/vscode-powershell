import * as rpc from 'vscode-jsonrpc';
import { PSCommand } from './psCommand';

export namespace PowerShellVersionRequest {
    export const type = new rpc.RequestType0<PowerShellVersionDetails, void, void>('powerShell/getVersion');
}

export interface PowerShellVersionDetails {
    version: string;
    displayVersion: string;
    edition: string;
    architecture: string;
}

export namespace RunspaceChangedEvent {
    export const type = new rpc.NotificationType<RunspaceDetails, void>('powerShell/runspaceChanged');
}

export enum RunspaceType {
    Local,
    Process,
    Remote
}

export interface RunspaceDetails {
    powerShellVersion: PowerShellVersionDetails;
    runspaceType: RunspaceType;
    connectionString: string;
}

export namespace InvokePSCommandRequest {
    export const type = new rpc.RequestType<PSCommand, InvokePSCommandResult, void, void>('powerShell/invokePSCommand');
}

export interface InvokePSCommandResult {
    output: any[];
    errors: string[];
}
