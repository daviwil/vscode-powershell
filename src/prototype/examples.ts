
import * as messages from './messages';
import { PSCommand } from './psCommand';
import { IntegrationClient } from './client';

var client =
    // new IntegrationClient("c:\\Program Files\\PowerShell\\6.0.0-beta.3\\powershell.exe");
    new IntegrationClient("c:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe");

client.start().then(x => onStarted());

async function onStarted() {
    // Get the PowerShell version of the launched process
    var version = await client.sendRequest('powerShell/getVersion')
    console.log("\r\nPowerShell version details:");
    console.log(version);

    // TODO: Load a module

    // TODO: Start command prompt

    // TODO: Run a command in the prompt

    // Run a command and get back JSON objects
    var command = new PSCommand();
    command
        .addCommand("Get-Process")
        .addParameter("Name", "powershell")
        .addCommand("Sort-Object")
        .addParameter("Property", "CPU")
        .addParameter("Descending");

    var result = await client.invokeCommand(command);
    console.log("\r\nCommand output: ");
    console.log(result.output);
}