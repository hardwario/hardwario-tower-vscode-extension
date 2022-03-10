import * as vscode from 'vscode';
import fs = require("fs");
import request = require("request");
import * as path from 'path';

import AdmZip = require("adm-zip");

import FindFiles = require("file-regex");

import * as main from './extension';


export async function installPortablePython(pythonPath : fs.PathLike) {
    let uri = "https://www.python.org/ftp/python/3.9.10/python-3.9.10-embed-amd64.zip";
    const file = fs.createWriteStream(pythonPath);
    const sendReq = request.get(uri);
    
    // verify response code
    sendReq.on('response', (response) => {
        if (response.statusCode !== 200) {
            return callback('Response status was ' + response.statusCode);
        }

        sendReq.pipe(file);
    });

    // close() is async, call cb after close completes
    file.on('finish', () => file.close(callbackFinish));

    // check for request errors
    sendReq.on('error', (err) => {
        fs.unlink(pythonPath, () => callback(err.message)); // delete the (partial) file and then return the error
    });

    file.on('error', (err) => { // Handle errors
        fs.unlink(pythonPath, () => callback(err.message)); // delete the (partial) file and then return the error
    });
}

async function installPortablePip(pythonDir) {
    let uri = "https://bootstrap.pypa.io/get-pip.py";
    const file = fs.createWriteStream(path.join(pythonDir, 'get-pip.py'));
    const sendReq = request.get(uri);
    
    // verify response code
    sendReq.on('response', (response) => {
        if (response.statusCode !== 200) {
            return callback('Response status was ' + response.statusCode);
        }

        sendReq.pipe(file);
    });

    // close() is async, call cb after close completes
    file.on('finish', () => file.close(pipFinishCallback));

    // check for request errors
    sendReq.on('error', (err) => {
        fs.unlink(path.join(pythonDir, 'get-pip.py'), () => callback(err.message)); // delete the (partial) file and then return the error
    });

    file.on('error', (err) => { // Handle errors
        fs.unlink(path.join(pythonDir, 'get-pip.py'), () => callback(err.message)); // delete the (partial) file and then return the error
    });
}

function callback(message)
{
    vscode.window.showInformationMessage(message);
}

async function pipFinishCallback()
{
    let homePath = process.env.USERPROFILE || 'Home';

    let hardwarioDir = path.join(homePath, '.hardwario/tower');
	let pythonDir = path.join(hardwarioDir, 'python');
    
    const result = await FindFiles(pythonDir, /\_pth$/);
    
    let pthFile = result[0].file;

    pthFile = path.join(pythonDir, pthFile);
    
    fs.readFile(pthFile, 'utf8', function (err,data) {
        if (err) {
          return console.log(err);
        }
        var result = data.replace(/#import site/g, 'import site');
      
        fs.writeFile(pthFile, result, 'utf8', function (err) {
           if (err) return console.log(err);
        });
      });

    var data = fs.readFileSync(pthFile); //read existing contents into data
    var fd = fs.openSync(pthFile, 'w+');
    var buffer = Buffer.from('Lib/site-packages\r\n');

    fs.writeSync(fd, buffer, 0, buffer.length, 0); //write new data
    fs.writeSync(fd, data, 0, data.length, buffer.length); //append old data
    // or fs.appendFile(fd, data);
    fs.close(fd, callbackInstalationFinish);
}

async function callbackFinish()
{
    let homePath = process.env.USERPROFILE || 'Home';

    let hardwarioHomeDir = path.join(homePath, '.hardwario');
    let hardwarioDir = path.join(hardwarioHomeDir, 'tower');
	let tempDir = path.join(hardwarioDir, 'temp');
	let pythonTemp = path.join(tempDir, 'python.zip');
	let pythonDir = path.join(hardwarioDir, 'python');
	let pythonExecutable = path.join(pythonDir, 'python.exe');

    if(!fs.existsSync(pythonExecutable))
	{
		var zip = new AdmZip(pythonTemp);
		await zip.extractAllTo(pythonDir, true);

        installPortablePip(pythonDir);
	}
}

function callbackInstalationFinish()
{
    main.postInstall();
}