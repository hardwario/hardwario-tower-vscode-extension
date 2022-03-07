import * as vscode from 'vscode';

export class Terminal
{
    _instance: any;
    constructor() {
        this._instance = null;
    }

    get()
    {
        if(this._instance === null)
        {
            const envClone = Object.create(process.env);
            envClone.PATH = "C:\\Users\\Kubaa\\BigClown_Toolchain\\script;C:\\Users\\Kubaa\\.hardwario;C:\\Users\\Kubaa\\.hardwario\\python";
            envClone.Path = "C:\\Users\\Kubaa\\BigClown_Toolchain\\script;C:\\Users\\Kubaa\\.hardwario;C:\\Users\\Kubaa\\.hardwario\\python";
            this._instance = vscode.window.createTerminal({
                name: 'HARDWARIO TOWER',
                env: envClone,
                shellPath: "C:\\Windows\\System32\\cmd.exe"
              });
            return this._instance;
        }
        else
        {
            return this._instance;
        }
    }
}