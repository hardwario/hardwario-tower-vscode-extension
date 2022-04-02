import * as vscode from 'vscode';

export const WINDOWS = process.platform.startsWith('win');
export const OSX = process.platform === 'darwin';
export const LINUX = !WINDOWS && !OSX;

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
