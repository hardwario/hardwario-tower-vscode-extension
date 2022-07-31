/* eslint-disable consistent-return */
/* eslint-disable import/extensions */
/* eslint-disable import/no-unresolved */
import { SerialPort } from 'serialport';
import * as ext from '../extension';
import { sleep } from '../helpers';

/**
 * Class for serial port. Used for flashing and attaching console to Core Module
 */
export default class SerialPortFtdi {
  serial : SerialPort;

  connected: boolean;

  port: any;

  write: any;

  read: any;

  flush: any;

  /**
   * Creates the instance of a specific serial port to the selected device and options
   * @param device Path to the connected device. For example COM4 on Windows
   * @param baudRate Baud rate for the opened serial port
   * @param parity Parity type ('odd', 'even', 'none')
   */
  constructor(device, baudRate, parity) {
    this.serial = new SerialPort({
      path: device,
      autoOpen: false,
      baudRate,
      parity,
      stopBits: 1,
      dataBits: 8,
    });

    this.serial.on('open', () => {
      this.connected = true;
    });

    this.serial.on('close', () => {
      this.connected = false;
      ext.deviceDisconnected();
    });

    this.open = this.open.bind(this);
    this.close = this.close.bind(this);
    this.clearBuffer = this.clearBuffer.bind(this);
    this.resetSequence = this.resetSequence.bind(this);
    this.bootSequence = this.bootSequence.bind(this);
    this.attachSequence = this.attachSequence.bind(this);
  }

  /**
   * Opens the serial port to the selected device
   */
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

  /**
   * Closes the serial port to the selected device
   */
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

  /**
   * Clear the serial buffer
   */
  clearBuffer() {
    return new Promise((resolve) => {
      this.port.flush()
        .then(() => this.port.drain())
        .then(() => resolve(true));
    });
  }

  /**
   * Reset the connected device
   */
  resetSequence() {
    return new Promise((resolve, reject) => {
      this.port.set({ rts: true, dtr: false }).then(() => {
        sleep(100);
        this.port.set({ rts: true, dtr: true }).then(resolve).catch(reject);
      });
    });
  }

  attachSequence() {
    return new Promise((resolve, reject) => {
      this.port.set({ rts: false, dtr: false }).then(resolve).catch(reject);
    });
  }

  /**
   * Execute the boot sequence on the connected device
   */
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
