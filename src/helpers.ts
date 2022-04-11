import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as Term from './terminal';

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

export function checkProjectStructure()
{
    let workspaceFolder = vscode.workspace.workspaceFolders[0];
    let workspacePath = workspaceFolder.uri.fsPath.toString();

    if (fs.existsSync(path.join(workspacePath, "app", "application.c")) || 
        (!fs.existsSync(path.join(workspacePath, "sdk"))) ||
       (fs.existsSync(path.join(workspacePath, "src", "application.c")) && (fs.existsSync(path.join(workspacePath, "include")) || fs.existsSync(path.join(workspacePath, "platformio.ini")))))
    {
        vscode.window.showWarningMessage("It looks like your project is deprecated. It might not work with current SDK and this extension", 
			"Update to currently supported firmware version", "Cancel")
			.then(answer => {
				if (answer === "Update to currently supported firmware version") {
                    updateToSupportedFirmwareStructure(workspacePath);
				}
			});
    }
}

function updateToSupportedFirmwareStructure(workspacePath)
{
    let updateFirmwareTerminal = new Term.Terminal("HARDWARIO TOWER Update firmware");

    if (!fs.existsSync(path.join(workspacePath, "sdk")))
    {
        updateFirmwareTerminal.get().sendText("git submodule add https://github.com/hardwario/twr-sdk.git sdk");
        updateFirmwareTerminal.get().sendText("exit");
        updateFirmwareTerminal.get().show();
    }
    else
    {
        updateFirmwareTerminal.get().sendText("make update");
        updateFirmwareTerminal.get().show();
    }


    vscode.window.onDidCloseTerminal((terminal) => {
        if(updateFirmwareTerminal._instance !== null && terminal === updateFirmwareTerminal.get())
        {
            fs.readFile(path.join(workspacePath, "sdk", 'Makefile.mk'), 'utf8', function (err,data) {
                if (err) {
                  return console.log(err);
                }
                var result = data.replace(/app/g, 'src');
              
                fs.writeFile(path.join(workspacePath, "sdk", 'Makefile.mk'), result, 'utf8', function (err) {
                   if (err)
                   {
                       return console.log(err);  
                   } 
                });
              });
        }
    });

    if (!fs.existsSync(path.join(workspacePath, "src")))
    {
        fs.mkdirSync(path.join(workspacePath, "src"));
    }

    if(fs.existsSync(path.join(workspacePath, "app", "application.c")))
    {
        const moveFrom = path.join(workspacePath, "app");
        const moveTo = path.join(workspacePath, "src");

        (async ()=>{
            try {
                const files = await fs.promises.readdir(moveFrom);

                for( const file of files ) {
                    const fromPath = path.join(moveFrom, file);
                    const toPath = path.join(moveTo, file);

                    await fs.promises.rename(fromPath, toPath);
                }
                fs.rmSync(moveFrom, { recursive: true, force: true });
            }
            catch( e ) {
                console.error( "ERROR!", e );
            }

        })();
    }
    else if(fs.existsSync(path.join(workspacePath, "include")) || fs.existsSync(path.join(workspacePath, "platformio.ini")))
    {
        if(fs.existsSync(path.join(workspacePath, "platformio.ini")))
        {
            fs.rmSync(path.join(workspacePath, "platformio.ini"), { force: true });
        }
        if(fs.existsSync(path.join(workspacePath, ".pio")))
        {
            fs.rmSync(path.join(workspacePath, ".pio"), { recursive: true, force: true });
        }

        const moveFrom = path.join(workspacePath, "include");
        const moveTo = path.join(workspacePath, "src");

        (async ()=>{
            try {
                const files = await fs.promises.readdir(moveFrom);

                for( const file of files ) {
                    const fromPath = path.join(moveFrom, file);
                    const toPath = path.join(moveTo, file);

                    await fs.promises.rename(fromPath, toPath);
                }
                fs.rmSync(moveFrom, { recursive: true, force: true });
            }
            catch( e ) {
                console.error( "ERROR!", e );
            }

        })();
    }
}
