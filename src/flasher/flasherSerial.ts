import * as sleep from 'sleep';
import * as fs from 'fs';
import SerialPortFtdi from './serialportFtdi';

const ACK = 0x79;
const NACK = 0x1F;

const BOOTLOADER_VERSION = Buffer.from([0x31, 0x00, 0x00]);
const BOOTLOADER_ID = Buffer.from([0x01, 0x04, 0x47]);
const START_ADDRESS = 0x08000000;

const COMMAND_GET_VERSION = Buffer.from([0x01, 0xfe]);
const COMMAND_GET_ID = Buffer.from([0x02, 0xfd]);
const COMMAND_GO = Buffer.from([0x21, 0xde]);
const COMMAND_MEMORY_READ = Buffer.from([0x11, 0xee]);
const COMMAND_MEMORY_WRITE = Buffer.from([0x31, 0xce]);
const COMMAND_EX_ERASE_MEMORY = Buffer.from([0x44, 0xbb]);

const ERASE_FULL = 196608;

export default class flashSerial {
  serial: any;

  constructor(device) {
    this.connect = this.connect.bind(this);
    this.start_bootloader = this.start_bootloader.bind(this);
    this.get_version = this.get_version.bind(this);
    this.get_ID = this.get_ID.bind(this);

    this.wait_for_ack = this.wait_for_ack.bind(this);
    this.read = this.read.bind(this);

    this.memory_read = this.memory_read.bind(this);
    this.memory_write = this.memory_write.bind(this);
    this.extended_erase_memory = this.extended_erase_memory.bind(this);
    this.go = this.go.bind(this);
    this.erase = this.erase.bind(this);
    this.write = this.write.bind(this);
    this.verify = this.verify.bind(this);

    this.serial = new SerialPortFtdi(device);
  }

  privateConnect() {
    return new Promise((resolve, reject) => {
      this.start_bootloader()
        .then(this.serial.clear_buffer)
        .then(() => this.get_version())
        .then((version: Uint8Array) => {
          if (!BOOTLOADER_VERSION.equals(version)) {
            throw 'Bad version';
          }

          return this.get_ID();
        })
        .then((id : Uint8Array) => {
          if (!BOOTLOADER_ID.equals(id)) {
            throw 'Bad id';
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
          console.log('_connect', i);
          try {
            await this.serial.open();
            await this.privateConnect();

            return resolve();
          } catch (error) {
            console.log('connect error', error);
            await this.serial.close().catch(() => {});
            sleep.msleep(100);
          }
        }
        reject('Connection error');
      })();
    });
  }

  get_version() {
    return new Promise((resolve, reject) => {
      const outBuffer = Buffer.alloc(5);

      this.serial.write(COMMAND_GET_VERSION)
        .then(() => this.read(outBuffer, 5))
        .then((length) => {
          if ((outBuffer[0] === ACK) && outBuffer[4] === ACK) {
            resolve(outBuffer.subarray(1, 4));
          } else {
            reject('fail get_version');
          }
        })
        .catch(reject);
    });
  }

  disconect() {
    return this.serial.close();
  }

  start_bootloader() {
    console.log('start_bootloader');

    return new Promise<void>((resolve, reject) => {
      const buffer = Buffer.from([0x7f]);

      this.serial.boot_sequence()
        .then(() => this.serial.clear_buffer())
        .then(
          () => sleep.msleep(50),
          this.serial.write(buffer),
        )
        .then(() => this.read(buffer, 1))
        .then((length) => {
          console.log(length, buffer, buffer.readUInt8());
          if ((length === 1) && (buffer.readUInt8() === ACK)) {
            resolve();
          } else {
            reject('start bootloader expect ACK');
          }
        })
        .catch(() => {
          reject('Error start bootloader');
        });
    });
  }

  get_ID() {
    return new Promise((resolve, reject) => {
      const outBuffer = Buffer.alloc(5);

      this.serial.write(COMMAND_GET_ID)
        .then(() => this.read(outBuffer, 5))
        .then((length) => {
          if ((outBuffer[0] === ACK) && outBuffer[4] === ACK) {
            resolve(outBuffer.subarray(1, 4));
          } else {
            reject('fail get_ID');
          }
        })
        .catch(reject);
    });
  }

  get_address_buffer_with_xor(address) {
    const buff = Buffer.allocUnsafe(5);
    buff.writeUInt32BE(address, 0);
    buff[4] = 0;
    for (let i = 0; i < 4; i += 1) {
      buff[4] ^= buff[i];
    }
    return buff;
  }

  calculate_xor(buffer, length?) {
    let xor = 0;
    for (let i = 0, l = length || buffer.length; i < l; i += 1) {
      xor ^= buffer[i];
    }
    return xor;
  }

  wait_for_ack() {
    const readBuffer = Buffer.alloc(1);

    return new Promise<void>((resolve, reject) => {
      this.serial.read(readBuffer, 0, 1)
        .then((ret) => {
          if (readBuffer[0] === ACK) {
            resolve();
          } else {
            console.log(ret.bytesRead, readBuffer);
            reject('Expect ACK');
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
          this.serial.close();
        }, timeout);

        let ret;

        while (readLength < length) {
          ret = await this.serial.read(readBuffer, readLength, length - readLength).catch((e) => {
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
        return reject('Bad length min 1 max 256');
      }

      const readBuffer = Buffer.alloc(length < 3 ? 3 : length);

      const addressBuf = this.get_address_buffer_with_xor(startAddress);

      const n = length - 1;

      const lengthBuf = Buffer.from([n, 0xff ^ n]);

      this.serial.write(COMMAND_MEMORY_READ)
        .then(() => this.serial.write(addressBuf))
        .then(() => this.serial.write(lengthBuf))
        .then(() => this.read(readBuffer, 3))
        .then((l) => {
          if ((readBuffer[0] & readBuffer[1] & readBuffer[2]) !== ACK) {
            throw 'Expect ACK';
          }
        })
        .then(() => this.read(readBuffer, length))
        .then((l) => {
          if (l === length) {
            resolve(readBuffer);
          } else {
            console.log(l, length);
            reject('Bad receive length');
          }
        })
        .catch(reject);
    });
  }

  memory_write(startAddress, buffer) {
    return new Promise((resolve, reject) => {
      if ((buffer.length > 256)) {
        return reject('Bad length max 256 ');
      }

      if ((buffer.length % 4 !== 0)) {
        return reject('Bad length must by mod 4');
      }

      const readBuffer = Buffer.alloc(2);

      const addressBuf = this.get_address_buffer_with_xor(startAddress);

      const n = buffer.length - 1;

      const wbuff = Buffer.from([n]);

      const bufferXor = this.calculate_xor(buffer);

      this.serial.write(COMMAND_MEMORY_WRITE)
        .then(() => this.serial.write(addressBuf))
        .then(() => this.serial.read(readBuffer, 0, 2))
        .then((ret) => {
          if ((readBuffer[0] & readBuffer[1]) !== ACK) {
            if ((ret.bytesRead === 1) && (readBuffer[0] === ACK)) {
              return this.wait_for_ack();
            }

            throw 'Expect ACK';
          }
        })
        .then(() => this.serial.write(wbuff))
        .then(() => this.serial.write(buffer))
        .then(() => {
          wbuff[0] = n ^ bufferXor;
          return this.serial.write(wbuff);
        })
        .then(this.wait_for_ack)
        .then(resolve)
        .catch(reject);
    });
  }

  extended_erase_memory(pages) {
    return new Promise((resolve, reject) => {
      if (!pages || (pages.length === 0) || (pages.length > 80)) {
        return reject('Bad number of pages');
      }

      const buffer = Buffer.allocUnsafe(3 + (pages.length * 2));

      buffer[0] = 0x00;
      buffer[1] = pages.length - 1;

      let offset = 2;

      for (let i = 0, l = pages.length; i < l; i += 1) {
        buffer.writeUInt16BE(pages[i], offset);
        offset += 2;
      }

      buffer[offset] = this.calculate_xor(buffer, offset);

      this.serial.write(COMMAND_EX_ERASE_MEMORY)
        .then(this.wait_for_ack)
        .then(() => this.serial.write(buffer))
        .then(this.wait_for_ack)
        .then(resolve)
        .catch(reject);
    });
  }

  go(startAddress = START_ADDRESS) {
    return new Promise((resolve, reject) => {
      const addressBuf = this.get_address_buffer_with_xor(startAddress);
      const outBuffer = Buffer.alloc(5);

      this.serial.write(COMMAND_GO)
        .then(this.wait_for_ack)
        .then(() => this.serial.write(addressBuf))
        .then(this.wait_for_ack)
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
            await this.extended_erase_memory(pages);
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
            await this.memory_write(startAddress + offset, buffer);
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
            return reject('Not Match');
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

    const s = new flashSerial(device);

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
