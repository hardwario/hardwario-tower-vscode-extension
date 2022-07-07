import * as fs from 'fs';
import SerialPortFtdi from './serialportFtdi';

import * as helpers from '../helpers';

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

export class Flash_Serial {
  constructor(device) {
    this.connect = this.connect.bind(this);
    this.start_bootloader = this.start_bootloader.bind(this);
    this.get_version = this.get_version.bind(this);
    this.get_ID = this.get_ID.bind(this);

    this._wait_for_ack = this._wait_for_ack.bind(this);
    this._read = this._read.bind(this);

    this.memory_read = this.memory_read.bind(this);
    this.memory_write = this.memory_write.bind(this);
    this.extended_erase_memory = this.extended_erase_memory.bind(this);
    this.go = this.go.bind(this);
    this.erase = this.erase.bind(this);
    this.write = this.write.bind(this);
    this.verify = this.verify.bind(this);

    this._ser = new SerialPortFtdi(device);
  }

  _connect() {
    return new Promise((resolve, reject) => {
      this.start_bootloader()
        /* .then(this._ser.clear_buffer()) */
        .then(() => this.get_version())
        .then((version) => {
          if (!BOOTLOADER_VERSION.equals(version)) {
            throw 'Bad version';
          }

          return this.get_ID();
        })
        .then((id) => {
          if (!BOOTLOADER_ID.equals(id)) {
            throw 'Bad id';
          }
        })
        .then(resolve)
        .catch(reject);
    });
  }

  connect() {
    return new Promise((resolve, reject) => {
      (async () => {
        for (let i = 0; i < 10; i++) {
          console.log('_connect', i);
          try {
            await this._ser.open();
            await this._connect();

            return resolve();
          } catch (error) {
            console.log('connect error', error);
            await this._ser.close().catch(() => {});
            helpers.sleep(100);
          }
        }
        reject('Connection error');
      })();
    });
  }

  disconect() {
    return this._ser.close();
  }

  start_bootloader() {
    console.log('start_bootloader');

    return new Promise((resolve, reject) => {
      const buffer = Buffer.from([0x7f]);

      this._ser.boot_sequence()
        .then(() => this._ser.clear_buffer())
        .then(() => {
          helpers.sleep(50);
          return this._ser.write(buffer);
        })
        .then(() => this._read(buffer, 1))
        .then((length) => {
          console.log(length, buffer, buffer.readUInt8());
          if ((length == 1) && (buffer.readUInt8() == ACK)) {
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

  get_version() {
    return new Promise((resolve, reject) => {
      const outBuffer = Buffer.alloc(5);

      this._ser.write(COMMAND_GET_VERSION)
        .then(() => this._read(outBuffer, 5))
        .then((length) => {
          if ((outBuffer[0] == ACK) && outBuffer[4] == ACK) {
            resolve(outBuffer.subarray(1, 4));
          } else {
            reject('fail get_version');
          }
        })
        .catch(reject);
    });
  }

  get_ID() {
    return new Promise((resolve, reject) => {
      const outBuffer = Buffer.alloc(5);

      this._ser.write(COMMAND_GET_ID)
        .then(() => this._read(outBuffer, 5))
        .then((length) => {
          if ((outBuffer[0] == ACK) && outBuffer[4] == ACK) {
            resolve(outBuffer.subarray(1, 4));
          } else {
            reject('fail get_ID');
          }
        })
        .catch(reject);
    });
  }

  _get_address_buffer_with_xor(address) {
    const buff = Buffer.allocUnsafe(5);
    buff.writeUInt32BE(address, 0);
    buff[4] = 0;
    for (let i = 0; i < 4; i++) {
      buff[4] ^= buff[i];
    }
    return buff;
  }

  _calculate_xor(buffer, length) {
    let xor = 0;
    for (let i = 0, l = length || buffer.length; i < l; i++) {
      xor ^= buffer[i];
    }
    return xor;
  }

  _wait_for_ack() {
    const readBuffer = Buffer.alloc(1);

    return new Promise((resolve, reject) => {
      this._ser.read(readBuffer, 0, 1)
        .then((ret) => {
          if (readBuffer[0] == ACK) {
            resolve();
          } else {
            console.log(ret.bytesRead, readBuffer);
            reject('Expect ACK');
          }
        })
        .catch(reject);
    });
  }

  _read(readBuffer, length, timeout = 1000) {
    return new Promise((resolve, reject) => {
      let read_length = 0;

      (async () => {
        const timer = setTimeout(() => {
          console.log('timeout');
          this._ser.close();
        }, timeout);

        let ret;

        while (read_length < length) {
          ret = await this._ser.read(readBuffer, read_length, length - read_length).catch((e) => {
            clearTimeout(timer);
            reject(e);
          });
          read_length += ret.bytesRead;
        }

        clearTimeout(timer);

        resolve(read_length);
      })();
    });
  }

  memory_read(start_address, length) {
    return new Promise((resolve, reject) => {
      if ((length > 256) || (length < 0)) {
        return reject('Bad length min 1 max 256');
      }

      const readBuffer = Buffer.alloc(length < 3 ? 3 : length);

      const address_buf = this._get_address_buffer_with_xor(start_address);

      const n = length - 1;

      const length_buf = Buffer.from([n, 0xff ^ n]);

      this._ser.write(COMMAND_MEMORY_READ)
        .then(() => this._ser.write(address_buf))
        .then(() => this._ser.write(length_buf))
        .then(() => this._read(readBuffer, 3))
        .then((l) => {
          if ((readBuffer[0] & readBuffer[1] & readBuffer[2]) != ACK) {
            throw 'Expect ACK';
          }
        })
        .then(() => this._read(readBuffer, length))
        .then((l) => {
          if (l == length) {
            resolve(readBuffer);
          } else {
            console.log(l, length);
            reject('Bad receive length');
          }
        })
        .catch(reject);
    });
  }

  memory_write(start_address, buffer) {
    return new Promise((resolve, reject) => {
      if ((buffer.length > 256)) {
        return reject('Bad length max 256 ');
      }

      if ((buffer.length % 4 != 0)) {
        return reject('Bad length must by mod 4');
      }

      const readBuffer = Buffer.alloc(2);

      const address_buf = this._get_address_buffer_with_xor(start_address);

      const n = buffer.length - 1;

      const wbuff = Buffer.from([n]);

      const buffer_xor = this._calculate_xor(buffer);

      this._ser.write(COMMAND_MEMORY_WRITE)
        .then(() => this._ser.write(address_buf))
        .then(() => this._ser.read(readBuffer, 0, 2))
        .then((ret) => {
          if ((readBuffer[0] & readBuffer[1]) != ACK) {
            if ((ret.bytesRead == 1) && (readBuffer[0] == ACK)) {
              return this._wait_for_ack();
            }

            throw 'Expect ACK';
          }
        })
        .then(() => this._ser.write(wbuff))
        .then(() => this._ser.write(buffer))
        .then(() => {
          wbuff[0] = n ^ buffer_xor;
          return this._ser.write(wbuff);
        })
        .then(this._wait_for_ack)
        .then(resolve)
        .catch(reject);
    });
  }

  extended_erase_memory(pages) {
    return new Promise((resolve, reject) => {
      if (!pages || (pages.length == 0) || (pages.length > 80)) {
        return reject('Bad number of pages');
      }

      const buffer = Buffer.allocUnsafe(3 + (pages.length * 2));

      buffer[0] = 0x00;
      buffer[1] = pages.length - 1;

      let offset = 2;

      for (let i = 0, l = pages.length; i < l; i++) {
        buffer.writeUInt16BE(pages[i], offset);
        offset += 2;
      }

      buffer[offset] = this._calculate_xor(buffer, offset);

      this._ser.write(COMMAND_EX_ERASE_MEMORY)
        .then(this._wait_for_ack)
        .then(() => this._ser.write(buffer))
        .then(this._wait_for_ack)
        .then(resolve)
        .catch(reject);
    });
  }

  go(start_address = START_ADDRESS) {
    return new Promise((resolve, reject) => {
      const address_buf = this._get_address_buffer_with_xor(start_address);
      const outBuffer = Buffer.alloc(5);

      this._ser.write(COMMAND_GO)
        .then(this._wait_for_ack)
        .then(() => this._ser.write(address_buf))
        .then(this._wait_for_ack)
        .then(resolve)
        .catch(reject);
    });
  }

  erase(length = 196608, reporthook = null) {
    return new Promise((resolve, reject) => {
      let max_page = Math.ceil(length / 128) + 1;

      if (max_page > 1536) {
        max_page = 1536;
      }

      if (reporthook) reporthook(0, max_page);

      (async function loop() {
        for (let page_start = 0; page_start < max_page; page_start += 80) {
          let page_stop = page_start + 80;

          if (page_stop > max_page) {
            page_stop = max_page;
          }

          const pages = Array.from({ length: page_stop - page_start }, (v, i) => i + page_start);

          try {
            await this.extended_erase_memory(pages);
          } catch (error) {
            return reject(error);
          }

          if (reporthook) reporthook(page_stop, max_page);
        }

        resolve();
      }).bind(this)();
    });
  }

  write(firmware, reporthook = null, start_address = START_ADDRESS) {
    return new Promise((resolve, reject) => {
      const { length } = firmware;
      const step = 128;

      if (reporthook) reporthook(0, length);

      (async function loop() {
        for (let offset = 0; offset < length; offset += step) {
          let offset_end = offset + step;

          if (offset_end > length) {
            offset_end = length;
          }

          const buffer = firmware.slice(offset, offset_end);

          try {
            await this.memory_write(start_address + offset, buffer);
          } catch (error) {
            return reject(error);
          }

          if (reporthook) reporthook(offset_end, length);
        }

        resolve();
      }).bind(this)();
    });
  }

  verify(firmware, reporthook = null, start_address = START_ADDRESS) {
    return new Promise((resolve, reject) => {
      const { length } = firmware;
      const step = 128;

      if (reporthook) reporthook(0, length);

      (async function loop() {
        for (let offset = 0; offset < length; offset += step) {
          let offset_end = offset + step;
          let read_length = step;

          if (offset_end > length) {
            offset_end = length;
            read_length = offset_end - offset;
          }

          const orig_buffer = firmware.slice(offset, offset_end);

          let i;

          for (i = 0; i < 2; i++) {
            let buffer;

            try {
              buffer = await this.memory_read(start_address + offset, read_length);
            } catch (error) {
              return reject(error);
            }

            if (orig_buffer.equals(buffer)) {
              break;
            }
          }

          if (i == 2) {
            return reject('Not Match');
          }

          if (reporthook) reporthook(offset_end, length);
        }

        resolve();
      }).bind(this)();
    });
  }
}

export function flash(device, firmware_path, reporthook = null) {
  return new Promise((resolve, reject) => {
    const firmware = fs.readFileSync(firmware_path);

    console.log(firmware.length);

    const s = new Flash_Serial(device);

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
