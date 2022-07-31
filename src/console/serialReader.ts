/* eslint-disable consistent-return */
/* eslint-disable no-await-in-loop */
/* eslint-disable import/extensions */
/* eslint-disable import/no-unresolved */
import { ReadlineParser } from 'serialport';
import SerialPortFtdi from '../flasher/serialportFtdi';
import * as helpers from '../helpers';

export default class SerialPortConsole {
  port: any;

  parser: any;

  constructor(device) {
    this.connect = this.connect.bind(this);

    this.port = new SerialPortFtdi(device, 115200, 'none');
  }

  connect(func, reset) {
    return new Promise<void>((resolve, reject) => {
      (async () => {
        for (let i = 0; i < 10; i += 1) {
          try {
            await this.port.open();
            await this.port.clearBuffer();
            if (reset) {
              await this.port.resetSequence();
            } else {
              await this.port.attachSequence();
            }

            helpers.sleep(100);

            this.parser = this.port.serial.pipe(new ReadlineParser({ delimiter: '\r\n' }));
            this.parser.on('data', func);

            return resolve();
          } catch (error) {
            await this.port.close().catch(() => {});
            helpers.sleep(100);
          }
        }
        reject(new Error('Connection error'));
      })();
    });
  }

  resetDevice() {
    this.port.resetSequence();
  }

  disconnect() {
    return this.port.close();
  }
}
