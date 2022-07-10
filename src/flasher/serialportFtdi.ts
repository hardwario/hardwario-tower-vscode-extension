/* eslint-disable consistent-return */
/* eslint-disable import/extensions */
/* eslint-disable import/no-unresolved */
import { SerialPort } from 'serialPort';

import { sleep } from '../helpers';

export default class SerialPortFtdi {
  serial : any;

  connected: boolean;

  port: any;

  write: any;

  read: any;

  flush: any;

  constructor(device) {
    this.serial = new SerialPort({
      path: device,
      autoOpen: false,
      baudRate: 921600,
      parity: 'even',
      stopBits: 1,
      dataBits: 8,
    });

    this.serial.on('open', () => {
      console.log('open');

      this.connected = true;
    });

    this.serial.on('close', () => {
      this.connected = false;
    });

    this.open = this.open.bind(this);
    this.close = this.close.bind(this);
    this.clearBuffer = this.clearBuffer.bind(this);
    this.resetSequence = this.resetSequence.bind(this);
    this.bootSequence = this.bootSequence.bind(this);
  }

  open() {
    return new Promise((resolve, reject) => {
      this.serial.open((error) => {
        if (error) return reject(error);

        this.port = this.serial.port;

        this.write = this.port.write.bind(this.port);
        this.read = this.port.read.bind(this.port);
        this.flush = this.port.flush.bind(this.port);

        this.clearBuffer()
          .then(resolve)
          .catch(reject);
      });
    });
  }

  close() {
    return new Promise<void>((resolve, reject) => {
      this.serial.close((error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  clearBuffer() {
    return new Promise((resolve) => {
      this.port.flush()
        .then(() => this.port.drain())
        .then(() => resolve(true));
    });
  }

  resetSequence() {
    return new Promise((resolve, reject) => {
      this.port.set({ rts: true, dtr: false }).then(() => {
        sleep(100);
        this.port.set({ rts: true, dtr: true }).then(resolve).catch(reject);
      });
    });
  }

  bootSequence() {
    return new Promise((resolve, reject) => {
      this.port.set({ rts: false, dtr: false })
        .then(() => {
          sleep(100);
          return this.port.set({ rts: true, dtr: false });
        })
        .then(() => {
          sleep(100);
          return this.port.set({ rts: true, dtr: true });
        })
        .then(() => this.port.set({ rts: false, dtr: true }))
        .then(() => {
          sleep(100);
          return this.port.set({ rts: true, dtr: true });
        })
        .then(resolve)
        .catch(reject);
    });
  }
}
