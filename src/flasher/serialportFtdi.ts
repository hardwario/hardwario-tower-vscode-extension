import { SerialPort } from 'serialPort';

import * as helpers from '../helpers';

export default class SerialPortFtdi {
  _serial : any;

  connected: boolean;

  _ser: any;

  write: any;

  read: any;

  flush: any;

  constructor(device) {
    this._serial = new SerialPort({
      path: device,
      autoOpen: false,
      baudRate: 921600,
      parity: 'even',
      stopBits: 1,
      dataBits: 8,
    });

    this._serial.on('open', () => {
      console.log('open');

      this.connected = true;
    });

    this._serial.on('close', () => {
      this.connected = false;
    });

    this.open = this.open.bind(this);
    this.close = this.close.bind(this);
    this.clear_buffer = this.clear_buffer.bind(this);
    this.reset_sequence = this.reset_sequence.bind(this);
    this.boot_sequence = this.boot_sequence.bind(this);
  }

  open() {
    return new Promise((resolve, reject) => {
      this._serial.open((error) => {
        if (error) return reject(error);

        this._ser = this._serial.port;

        this.write = this._ser.write.bind(this._ser);
        this.read = this._ser.read.bind(this._ser);
        this.flush = this._ser.flush.bind(this._ser);

        this.clear_buffer()
          .then(resolve)
          .catch(reject);
      });
    });
  }

  close() {
    return new Promise<void>((resolve, reject) => {
      this._serial.close((error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  clear_buffer() {
    return new Promise((resolve) => {
      this._ser.flush()
        .then(() => this._ser.drain())
        .then(() => resolve(true));
    });
  }

  reset_sequence() {
    return new Promise((resolve, reject) => {
      this._ser.set({ rts: true, dtr: false }).then(() => {
        helpers.sleep(100);
        this._ser.set({ rts: true, dtr: true }).then(resolve).catch(reject);
      });
    });
  }

  boot_sequence() {
    return new Promise((resolve, reject) => {
      this._ser.set({ rts: false, dtr: false })
        .then(() => {
          helpers.sleep(100);
          return this._ser.set({ rts: true, dtr: false });
        })
        .then(() => {
          helpers.sleep(100);
          return this._ser.set({ rts: true, dtr: true });
        })
        .then(() => this._ser.set({ rts: false, dtr: true }))
        .then(() => {
          helpers.sleep(100);
          return this._ser.set({ rts: true, dtr: true });
        })
        .then(resolve)
        .catch(reject);
    });
  }
}

function port_list(callback) {
  SerialPort.list()
    .then((ports) => {
      callback(ports.filter((port) => port.manufacturer == '0403' || port.vendorId == '0403'));
    })
    .catch(() => {
      callback([]);
    });
}
