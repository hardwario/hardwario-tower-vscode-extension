import { SerialPort, SerialPortOpenOptions } from 'serialport';

const sleep = require('sleep');

export default class SerialPortFtdi {
  serial : any;

  connected: boolean;

  // serial : any;

  write : any;

  read : any;

  flush : any;

  constructor(device) {
    this.serial = new SerialPort({
      path: device,
      baudRate: 921600,
      parity: 'even',
      autoOpen: false,
    });

    this.serial.on('open', () => {
      console.log('open');

      this.connected = true;
    });

    this.serial.on('close', () => {
      this.connected = false;
    });

    this.serial = this.serial.binding;

    this.open = this.open.bind(this);
    this.close = this.close.bind(this);
    this.clear_buffer = this.clear_buffer.bind(this);
    this.reset_sequence = this.reset_sequence.bind(this);
    this.boot_sequence = this.boot_sequence.bind(this);

    this.write = this.serial.write.bind(this.serial);
    this.read = this.serial.read.bind(this.serial);
    this.flush = this.serial.flush.bind(this.serial);
  }

  open() {
    return new Promise((resolve, reject) => {
      this.serial.open((error) => {
        if (error) return reject(error);

        this.clear_buffer()
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

  clear_buffer() {
    return new Promise((resolve) => {
      this.serial.flush()
        .then(() => this.serial.drain())
        .then(() => resolve(true));
    });
  }

  reset_sequence() {
    return new Promise((resolve, reject) => {
      this.serial.set({ rts: true, dtr: false }).then(() => {
        sleep.msleep(100);
        this.serial.set({ rts: true, dtr: true }).then(resolve).catch(reject);
      });
    });
  }

  boot_sequence() {
    return new Promise((resolve, reject) => {
      this.serial.set({ rts: false, dtr: false })
        .then(
          () => sleep.msleep(100),
          this.serial.set({ rts: true, dtr: false }),
        )
        .then(
          () => sleep.msleep(100),
          this.serial.set({ rts: true, dtr: true }),
        )
        .then(() => this.serial.set({ rts: false, dtr: true }))
        .then(
          () => sleep.msleep(100),
          this.serial.set({ rts: true, dtr: true }),
        )
        .then(resolve)
        .catch(reject);
    });
  }
}

export function portList(callback) {
  SerialPort.list()
    .then((ports) => {
      callback(ports.filter((port) => port.manufacturer === '0403' || port.vendorId === '0403'));
    })
    .catch(() => {
      callback([]);
    });
}
