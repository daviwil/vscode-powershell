import vscode = require('vscode');
import utils = require('../utils');
import { IFeature, LanguageClient } from '../feature';

export interface PowerShellTaskDefinition extends vscode.TaskDefinition {
    command: string;
    powerShellExePath?: string;
}

export class TaskProviderFeature implements vscode.TaskProvider, IFeature {

    private registration: vscode.Disposable;

    constructor() {
        this.registration = vscode.workspace.registerTaskProvider("PowerShell", this);
    }

    setLanguageClient(languageClient: LanguageClient) {
        // TODO: Keep this
    }

    provideTasks(token?: vscode.CancellationToken): Thenable<vscode.Task[]> {
        var taskCommand = `Write-Host -ForegroundColor Green 'Yeah buddy!'`;
        var task =
            new vscode.Task(
                { type: "PowerShell", command: taskCommand } as PowerShellTaskDefinition,
                "BuildAll",
                "Invoke-Build",
                new vscode.ProcessExecution(
                    "powershell.exe", // TODO: Pull from settings!
                    [
                        "-NoProfile",
                        "-ExecutionPolicy", "Bypass",  // TODO: Platform specific!
                        "-Command", taskCommand
                    ]));

        task.group = vscode.TaskGroup.Build;

        return Promise.resolve([task]);
    }

    resolveTask(task: vscode.Task, token?: vscode.CancellationToken): Thenable<vscode.Task> {

        // TODO: This may be pointless...

        var powerShellExePath = undefined;
        var taskDefinition = task.definition as PowerShellTaskDefinition;

        if (taskDefinition.powerShellExePath) {
            powerShellExePath =
                utils.resolvePowerShellPath(
                    taskDefinition.powerShellExePath);
        }
        else {
            powerShellExePath = utils.getPowerShellPath();
        }

        var args = [ "-NoProfile" ];
        if (utils.isWindowsOS()) {
            args.push("-ExecutionPolicy", "Bypass");
        }

        args.push("-Command", taskDefinition.command);

        task.execution =
            new vscode.ProcessExecution(
                powerShellExePath,
                args);

        return Promise.resolve(task);
    }

    dispose() {
        if (this.registration) {
            this.registration.dispose();
            this.registration = undefined;
        }
    }
}