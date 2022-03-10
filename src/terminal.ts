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
            envClone.PATH = "C:\\Users\\Kubaa\\.hardwario\\tower\\python;C:\\Users\\Kubaa\\.hardwario\\tower\\toolchain\\make\\bin;C:\\Users\\Kubaa\\.hardwario\\tower\\toolchain\\gcc\\bin;C:\\Users\\Kubaa\\.hardwario\\tower\\toolchain\\gcc\\arm-none-eabi\\bin;C:\\Users\\Kubaa\\.hardwario\\tower\\toolchain\\git\\usr\\bin;C:\\Users\\Kubaa\\.hardwario\\tower\\toolchain\\git\\mingw64\\bin;C:\\Users\\Kubaa\\.hardwario\\tower\\toolchain\\git\\cmd";
            envClone.Path = "C:\\Users\\Kubaa\\.hardwario\\tower\\python;C:\\Users\\Kubaa\\.hardwario\\tower\\toolchain\\make\\bin;C:\\Users\\Kubaa\\.hardwario\\tower\\toolchain\\gcc\\bin;C:\\Users\\Kubaa\\.hardwario\\tower\\toolchain\\gcc\\arm-none-eabi\\bin;C:\\Users\\Kubaa\\.hardwario\\tower\\toolchain\\git\\usr\\bin;C:\\Users\\Kubaa\\.hardwario\\tower\\toolchain\\git\\mingw64\\bin;C:\\Users\\Kubaa\\.hardwario\\tower\\toolchain\\git\\cmd";
            this._instance = vscode.window.createTerminal({
                name: 'HARDWARIO TOWER',
                env: envClone,
              });
            return this._instance;
        }
        else
        {
            return this._instance;
        }
    }
}