/* eslint-disable no-promise-executor-return */
/* eslint-disable no-await-in-loop */
/* eslint-disable consistent-return */
/* eslint-disable no-bitwise */
/* eslint-disable import/no-unresolved */
/* eslint-disable import/extensions */
import * as fs from 'fs';
import { getAddressBufferWithXor, calculateXor } from './flasherSerialHelpers';
import SerialPortFtdi from './serialportFtdi';

import * as helpers from '../helpers';

const ACK = 0x79;

const BOOTLOADER_VERSION = Buffer.from([0x31, 0x00, 0x00]);
const BOOTLOADER_ID = Buffer.from([0x01, 0x04, 0x47]);
const START_ADDRESS = 0x08000000;

const COMMAND_GET_VERSION = Buffer.from([0x01, 0xfe]);
const COMMAND_GET_ID = Buffer.from([0x02, 0xfd]);
const COMMAND_GO = Buffer.from([0x21, 0xde]);
const COMMAND_MEMORY_READ = Buffer.from([0x11, 0xee]);
const COMMAND_MEMORY_WRITE = Buffer.from([0x31, 0xce]);
const COMMAND_EX_ERASE_MEMORY = Buffer.from([0x44, 0xbb]);

export class FlashSerial {
  port: any;

  constructor(device) {
    this.connect = this.connect.bind(this);
    this.startBootloader = this.startBootloader.bind(this);
    this.getVersion = this.getVersion.bind(this);
    this.getID = this.getID.bind(this);

    this.waitForAck = this.waitForAck.bind(this);
    this.read = this.read.bind(this);

    this.memory_read = this.memory_read.bind(this);
    this.memoryWrite = this.memoryWrite.bind(this);
    this.extendedEraseMemory = this.extendedEraseMemory.bind(this);
    this.go = this.go.bind(this);
    this.erase = this.erase.bind(this);
    this.write = this.write.bind(this);
    this.verify = this.verify.bind(this);

    this.port = new SerialPortFtdi(device, 921600, 'even');
  }

  connectPrivate() {
    return new Promise((resolve, reject) => {
      this.startBootloader()
        .then(this.port.clearBuffer())
        .then(() => this.getVersion())
        .then((version) => {
          if (!BOOTLOADER_VERSION.equals(version)) {
            throw new Error('Bad version');
          }

          return this.getID();
        })
        .then((id) => {
          if (!BOOTLOADER_ID.equals(id)) {
            throw new Error('Bad id');
          }
        })
        .then(resolve)
        .catch(reject);
    });
  }

  connect() {
    return new Promise<void>((resolve, reject) => {
      (async () => {
        for (let i = 0; i < 10; i += 1) {
          console.log('connectPrivate', i);
          try {
            await this.port.open();
            await this.connectPrivate();

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

  startBootloader() {
    console.log('startBootloader');

    return new Promise<void>((resolve, reject) => {
      const buffer = Buffer.from([0x7f]);

      this.port.bootSequence()
        .then(() => this.port.clearBuffer())
        .then(() => {
          helpers.sleep(50);
          return this.port.write(buffer);
        })
        .then(() => this.read(buffer, 1))
        .then((length) => {
          if ((length === 1) && (buffer.readUInt8() === ACK)) {
            resolve();
          } else {
            reject(new Error('start bootloader expect ACK'));
          }
        })
        .catch(() => {
          reject(new Error('Error start bootloader'));
        });
    });
  }

  getVersion() {
    return new Promise((resolve, reject) => {
      const outBuffer = Buffer.alloc(5);

      this.port.write(COMMAND_GET_VERSION)
        .then(() => this.read(outBuffer, 5))
        .then(() => {
          if ((outBuffer[0] === ACK) && outBuffer[4] === ACK) {
            resolve(outBuffer.subarray(1, 4));
          } else {
            reject(new Error('fail getVersion'));
          }
        })
        .catch(reject);
    });
  }

  getID() {
    return new Promise((resolve, reject) => {
      const outBuffer = Buffer.alloc(5);

      this.port.write(COMMAND_GET_ID)
        .then(() => this.read(outBuffer, 5))
        .then(() => {
          if ((outBuffer[0] === ACK) && outBuffer[4] === ACK) {
            resolve(outBuffer.subarray(1, 4));
          } else {
            reject(new Error('fail getID'));
          }
        })
        .catch(reject);
    });
  }

  waitForAck() {
    const readBuffer = Buffer.alloc(1);

    return new Promise<void>((resolve, reject) => {
      this.port.read(readBuffer, 0, 1)
        .then((ret) => {
          if (readBuffer[0] === ACK) {
            resolve();
          } else {
            console.log(ret.bytesRead, readBuffer);
            reject(new Error('Expect ACK'));
          }
        })
        .catch(reject);
    });
  }

  read(readBuffer, length, timeout = 1000) {
    return new Promise((resolve, reject) => {
      let readLength = 0;

      (async () => {
        const timer = setTimeout(() => {
          console.log('timeout');
          this.port.close();
        }, timeout);

        let ret;

        while (readLength < length) {
          ret = await this.port.read(readBuffer, readLength, length - readLength).catch((e) => {
            clearTimeout(timer);
            reject(e);
          });
          readLength += ret.bytesRead;
        }

        clearTimeout(timer);

        resolve(readLength);
      })();
    });
  }

  memory_read(startAddress, length) {
    return new Promise((resolve, reject) => {
      if ((length > 256) || (length < 0)) {
        return reject(new Error('Bad length min 1 max 256'));
      }

      const readBuffer = Buffer.alloc(length < 3 ? 3 : length);

      const addressBuf = getAddressBufferWithXor(startAddress);

      const n = length - 1;

      const lengthBuf = Buffer.from([n, 0xff ^ n]);

      this.port.write(COMMAND_MEMORY_READ)
        .then(() => this.port.write(addressBuf))
        .then(() => this.port.write(lengthBuf))
        .then(() => this.read(readBuffer, 3))
        .then(() => {
          if ((readBuffer[0] & readBuffer[1] & readBuffer[2]) !== ACK) {
            throw new Error('Expect ACK');
          }
        })
        .then(() => this.read(readBuffer, length))
        .then((l) => {
          if (l === length) {
            resolve(readBuffer);
          } else {
            console.log(l, length);
            reject(new Error('Bad receive length'));
          }
        })
        .catch(reject);
    });
  }

  memoryWrite(startAddress, buffer) {
    return new Promise((resolve, reject) => {
      if ((buffer.length > 256)) {
        return reject(new Error('Bad length max 256 '));
      }

      if ((buffer.length % 4 !== 0)) {
        return reject(new Error('Bad length must by mod 4'));
      }

      const readBuffer = Buffer.alloc(2);

      const addressBuf = getAddressBufferWithXor(startAddress);

      const n = buffer.length - 1;

      const wbuff = Buffer.from([n]);

      const bufferXor = calculateXor(buffer);

      this.port.write(COMMAND_MEMORY_WRITE)
        .then(() => this.port.write(addressBuf))
        .then(() => this.port.read(readBuffer, 0, 2))
        .then((ret) => {
          if ((readBuffer[0] & readBuffer[1]) !== ACK) {
            if ((ret.bytesRead === 1) && (readBuffer[0] === ACK)) {
              return this.waitForAck();
            }

            throw new Error('Expect ACK');
          }
        })
        .then(() => this.port.write(wbuff))
        .then(() => this.port.write(buffer))
        .then(() => {
          wbuff[0] = n ^ bufferXor;
          return this.port.write(wbuff);
        })
        .then(this.waitForAck)
        .then(resolve)
        .catch(reject);
    });
  }

  extendedEraseMemory(pages) {
    return new Promise((resolve, reject) => {
      if (!pages || (pages.length === 0) || (pages.length > 80)) {
        return reject(new Error('Bad number of pages'));
      }

      const buffer = Buffer.allocUnsafe(3 + (pages.length * 2));

      buffer[0] = 0x00;
      buffer[1] = pages.length - 1;

      let offset = 2;

      for (let i = 0, l = pages.length; i < l; i += 1) {
        buffer.writeUInt16BE(pages[i], offset);
        offset += 2;
      }

      buffer[offset] = calculateXor(buffer, offset);

      this.port.write(COMMAND_EX_ERASE_MEMORY)
        .then(this.waitForAck)
        .then(() => this.port.write(buffer))
        .then(this.waitForAck)
        .then(resolve)
        .catch(reject);
    });
  }

  go(startAddress = START_ADDRESS) {
    return new Promise((resolve, reject) => {
      const addressBuf = getAddressBufferWithXor(startAddress);

      this.port.write(COMMAND_GO)
        .then(this.waitForAck)
        .then(() => this.port.write(addressBuf))
        .then(this.waitForAck)
        .then(resolve)
        .catch(reject);
    });
  }

  erase(length = 196608, reporthook = null) {
    return new Promise<void>((resolve, reject) => {
      let maxPage = Math.ceil(length / 128) + 1;

      if (maxPage > 1536) {
        maxPage = 1536;
      }

      if (reporthook) reporthook(0, maxPage);

      (async function loop() {
        for (let pageStart = 0; pageStart < maxPage; pageStart += 80) {
          let pageStop = pageStart + 80;

          if (pageStop > maxPage) {
            pageStop = maxPage;
          }

          const pages = Array.from({ length: pageStop - pageStart }, (v, i) => i + pageStart);

          try {
            await this.extendedEraseMemory(pages);
          } catch (error) {
            return reject(error);
          }

          if (reporthook) reporthook(pageStop, maxPage);
        }

        resolve();
      }).bind(this)();
    });
  }

  write(firmware, reporthook = null, startAddress = START_ADDRESS) {
    return new Promise<void>((resolve, reject) => {
      const { length } = firmware;
      const step = 128;

      if (reporthook) reporthook(0, length);

      (async function loop() {
        for (let offset = 0; offset < length; offset += step) {
          let offsetEnd = offset + step;

          if (offsetEnd > length) {
            offsetEnd = length;
          }

          const buffer = firmware.slice(offset, offsetEnd);

          try {
            await this.memoryWrite(startAddress + offset, buffer);
          } catch (error) {
            return reject(error);
          }

          if (reporthook) reporthook(offsetEnd, length);
        }

        resolve();
      }).bind(this)();
    });
  }

  verify(firmware, reporthook = null, startAddress = START_ADDRESS) {
    return new Promise<void>((resolve, reject) => {
      const { length } = firmware;
      const step = 128;

      if (reporthook) reporthook(0, length);

      (async function loop() {
        for (let offset = 0; offset < length; offset += step) {
          let offsetEnd = offset + step;
          let readLength = step;

          if (offsetEnd > length) {
            offsetEnd = length;
            readLength = offsetEnd - offset;
          }

          const origBuffer = firmware.slice(offset, offsetEnd);

          let i;

          for (i = 0; i < 2; i += 1) {
            let buffer;

            try {
              buffer = await this.memory_read(startAddress + offset, readLength);
            } catch (error) {
              return reject(error);
            }

            if (origBuffer.equals(buffer)) {
              break;
            }
          }

          if (i === 2) {
            return reject(new Error('Not Match'));
          }

          if (reporthook) reporthook(offsetEnd, length);
        }

        resolve();
      }).bind(this)();
    });
  }
}

export function flash(device, firmwarePath, reporthook = null) {
  return new Promise((resolve, reject) => {
    const firmware = fs.readFileSync(firmwarePath);

    console.log(firmware.length);

    const s = new FlashSerial(device);

    s.connect()
      .then(() => s.erase(firmware.length, (a, b) => { reporthook('erase', a, b); }))
      .then(() => s.write(firmware, (a, b) => { reporthook('write', a, b); }))
      .then(() => s.verify(firmware, (a, b) => { reporthook('verify', a, b); }))
      .then(() => {
        console.log('go');

        return s.go();
      })
      .then(() => s.disconect())
      .then(resolve)
      .catch((e) => {
        s.disconect().catch(() => {});

        console.log('flash error', e);

        reject(e);
      });
  });
}
