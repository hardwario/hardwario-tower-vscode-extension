/* eslint-disable no-bitwise */

/**
 * Helper functions for the serial port
 */

export function getAddressBufferWithXor(address) {
  const buff = Buffer.allocUnsafe(5);
  buff.writeUInt32BE(address, 0);
  buff[4] = 0;
  for (let i = 0; i < 4; i += 1) {
    buff[4] ^= buff[i];
  }
  return buff;
}

export function calculateXor(buffer, length?) {
  let xor = 0;
  for (let i = 0, l = length || buffer.length; i < l; i += 1) {
    xor ^= buffer[i];
  }
  return xor;
}
