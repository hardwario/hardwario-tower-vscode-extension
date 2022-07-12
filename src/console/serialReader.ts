import { SerialPort, ReadlineParser } from 'serialport';
import SerialPortFtdi from '../flasher/serialportFtdi';
import * as helpers from '../helpers';

const ACK = 0x79;

const BOOTLOADER_VERSION = Buffer.from([0x31, 0x00, 0x00]);
const BOOTLOADER_ID = Buffer.from([0x01, 0x04, 0x47]);

const COMMAND_GET_VERSION = Buffer.from([0x01, 0xfe]);
const COMMAND_GET_ID = Buffer.from([0x02, 0xfd]);

export default class SerialPortConsole {
  port: any;

  parser: any;

  constructor(device) {
    this.connect = this.connect.bind(this);

    this.port = new SerialPortFtdi(device, 115200, 'none');
  }

  connect(func) {
    return new Promise<void>((resolve, reject) => {
      (async () => {
        for (let i = 0; i < 10; i += 1) {
          try {
            await this.port.open();
            await this.port.clearBuffer();
            await this.port.resetSequence();

            helpers.sleep(100);

            this.parser = this.port.serial.pipe(new ReadlineParser({ delimiter: '\r\n' }));
            this.parser.on('data', func);

            return resolve();
          } catch (error) {
            console.log('connect error', error);
            await this.port.close().catch(() => {});
            helpers.sleep(100);
          }
        }
        reject(new Error('Connection error'));
      })();
    });
  }

  disconect() {
    return this.port.close();
  }
}

export function attachConsole(device, func) {
  const s = new SerialPortConsole(device);
  s.connect(func);
}
