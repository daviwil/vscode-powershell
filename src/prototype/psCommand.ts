
export interface CommandParameter {
    name?: string;
    value?: any;
    typeName?: string;
}

export class Command {
    public commandText: string;
    public parameters: CommandParameter[] = [];

    constructor(commandName: string) {
        this.commandText = commandName;
    }
}

export class PSCommand {

    private currentCommand: Command;

    public commands: Command[] = [];

    public addCommand(commandName: string): PSCommand {
        this.currentCommand = new Command(commandName);
        this.commands.push(this.currentCommand);
        return this;
    }

    public addParameter(parameterName: string, parameterValue?: any, typeName?: string): PSCommand {
        this.currentCommand.parameters.push(
            { name: parameterName,
              value: parameterValue,
              typeName: typeName
            });

        return this;
    }

    public addArgument(argumentValue?: any, typeName?: string): PSCommand {
        this.currentCommand.parameters.push(
            { value: argumentValue,
              typeName: typeName
            });

        return this;
    }
}
