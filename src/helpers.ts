import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export const WINDOWS = process.platform.startsWith('win');
export const OSX = process.platform === 'darwin';
export const LINUX = !WINDOWS && !OSX;

export const includePathSetting : string[] = [
    "${workspaceFolder}/app/**",
    "${workspaceFolder}/src/**",
    "${workspaceFolder}/sdk/bcl/inc",
    "${workspaceFolder}/sdk/bcl/stm/inc",
    "${workspaceFolder}/sdk/sys/inc",
    "${workspaceFolder}/sdk/stm/spirit1/inc",
    "${workspaceFolder}/sdk/stm/hal/inc",
    "${workspaceFolder}/sdk/stm/usb/inc",
    "${workspaceFolder}/sdk/twr/**",
    "${workspaceFolder}/sdk/lib/**",
    "${default}"
];

export const browsePathSetting : string[] = [
    "${workspaceFolder}/app",
    "${workspaceFolder}/src",
    "${workspaceFolder}/sdk/bcl",
    "${workspaceFolder}/sdk/twr",
    "${workspaceFolder}/sdk/lib",
    "${workspaceFolder}/sdk/sys",
    "${workspaceFolder}/sdk/stm",
    "${default}"
];

var commandExistsSync = require('command-exists').sync;

export function isPortable()
{
    const config = vscode.workspace.getConfiguration('window');
    let title = config.get('title');

    let titleString = title.toString();

    if(titleString.includes("HARDWARIO Code"))
    {
        return true;
    }
    else
    {
        return false;
    }

}

export function checkCommand(command, warningMessage, firstOption, secondOption, guideLink)
{
    if(!commandExistsSync(command)) {
        vscode.window.showWarningMessage(warningMessage, 
            firstOption, secondOption)
        .then(answer => {
            if (answer === firstOption) {
                vscode.env.openExternal(vscode.Uri.parse(guideLink));
                return;
            }
        });
    }
}

export function isHardwarioProject()
{
    let workspaceFolder = vscode.workspace.workspaceFolders[0];
    if (fs.existsSync(path.join(workspaceFolder.uri.fsPath.toString(), "app", "application.c")) || fs.existsSync(path.join(workspaceFolder.uri.fsPath.toString(), "src", "application.c"))) {
        let data;
        try {
            data = fs.readFileSync(path.join(workspaceFolder.uri.fsPath.toString(), "src", "application.c"));
        } catch (error) {
            try {
                data = fs.readFileSync(path.join(workspaceFolder.uri.fsPath.toString(), "app", "application.c"));
            } catch (error) {
                console.log("ERROR");
            }
        }
        if(data.includes('application_init('))
        {
            return true;
        }
        else
        {
            return false;
        }
    }
    else
    {
        return false;
    }
    
}

export function addSetting()
{
    let includePath: string[] = vscode.workspace.getConfiguration('C_Cpp.default').get('includePath');
	let browsePath: string[] = vscode.workspace.getConfiguration('C_Cpp.default.browse').get('path');
	let cStandard = vscode.workspace.getConfiguration('C_Cpp.default').get('cStandard');
    let terminalIntegratedShell = vscode.workspace.getConfiguration('terminal.integrated.shell').get('windows');

    let fileAssociations = vscode.workspace.getConfiguration('files.associations').get('ranges');

	if(includePath === null || includePath.length === 0)
	{
		vscode.workspace.getConfiguration('C_Cpp.default').update('includePath', includePathSetting);
	}

	if(browsePath === null || browsePath.length === 0)
	{
		vscode.workspace.getConfiguration('C_Cpp.default.browse').update('path', browsePathSetting);
	}

	if(cStandard === '')
	{
		vscode.workspace.getConfiguration('C_Cpp.default').update('cStandard', 'c11');
	}

    if(fileAssociations === '')
    {
        vscode.workspace.getConfiguration('files.associations').update('ranges', 'c');
    }

    if(terminalIntegratedShell === null || terminalIntegratedShell === '')
    {
        vscode.workspace.getConfiguration('terminal.integrated.shell').update('windows', "C:\\Windows\\sysnative\\cmd.exe");
    }
}
