import * as vscode from 'vscode';

export default class Terminal
{
    _instance : Terminal;
    constructor() {
        this._instance = new Terminal();
    }

    newTerminal()
    {
        const envClone = Object.create(process.env);
		envClone.PATH = "C:\\Users\\Kubaa\\BigClown_Toolchain\\script";
		envClone.Path = "C:\\Users\\Kubaa\\BigClown_Toolchain\\script";
		return vscode.window.createTerminal({
			name: 'HARDWARIO TOWER',
			env: envClone,
			shellPath: "C:\\Windows\\System32\\cmd.exe"
		  });
    }
}