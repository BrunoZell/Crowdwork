import { OnRpcRequestHandler } from '@metamask/snaps-types';
import { panel, text } from '@metamask/snaps-ui';
import { BIP44CoinTypeNode, getBIP44AddressKeyDeriver } from '@metamask/key-tree';
// import * as dag4 from '../dag/dag4';
// import {DagAccount} from "../dag/dag4-wallet/dag-account"
const secp = require("@noble/secp256k1");
import * as jsSha256 from "js-sha256";
import * as jsSha512 from "js-sha512";
import * as bs58 from 'bs58';
import {Buffer} from 'buffer';
// import dag4 from '../dag4';
// import dagWrapper from "../../dag-account/dist/app"

const CONSTANTS = {
  PKCS_PREFIX: '3056301006072a8648ce3d020106052b8104000a034200' //Removed last 2 digits. 04 is part of Public Key.
}

var getPublicKeyFromPrivate = function (privateKey: string, compact = false) {
    return Buffer.from(secp.getPublicKey(privateKey, compact)).toString('hex');
}

var getDagAddressFromPublicKey = function (publicKeyHex: string) {

  //PKCS standard requires a prefix '04' for an uncompressed Public Key
  // An uncompressed public key consists of a 64-byte number; 2 bytes per number in HEX is 128
  // Check to see if prefix is missing
  if (publicKeyHex.length === 128) {
    publicKeyHex = '04' + publicKeyHex;
  }

  publicKeyHex = CONSTANTS.PKCS_PREFIX + publicKeyHex;

  const sha256Str = jsSha256.sha256(Buffer.from(publicKeyHex, 'hex'));

  const bytes = Buffer.from(sha256Str, 'hex');
  const hash = bs58.encode(bytes);

  let end = hash.slice(hash.length - 36, hash.length);
  let sum = end.split('').reduce((val: number, char: any) => (isNaN(char) ? val : val + (+char)), 0);
  let par = sum % 9;

  return ('DAG' + par + end);
}


var sign = async function (privateKey: string, msg: string) {
  const sha512Hash = jsSha512.sha512(msg);

  const sig = await secp.sign(sha512Hash, privateKey);
  return Buffer.from(sig).toString('hex');
}

/**
 * Handle incoming JSON-RPC requests, sent through `wallet_invokeSnap`.
 *
 * @param args - The request handler args as object.
 * @param args.origin - The origin of the request, e.g., the website that
 * invoked the snap.
 * @param args.request - A validated JSON-RPC request object.
 * @returns The result of `snap_dialog`.
 * @throws If the request method is not valid for this snap.
 */
export const onRpcRequest: OnRpcRequestHandler = async ({ origin, request }) => {
  
  const dagNode : any = await snap.request({
    method: 'snap_getBip44Entropy',
    params: {
      coinType: 1137, // = $DAG. from https://github.com/satoshilabs/slips/blob/master/slip-0044.md
    },
  });

  console.log(dagNode);

  // Creates a function that takes an index and returns an extended private key for m/44'/3'/0'/0/address_index
  // The second parameter to getBIP44AddressKeyDeriver is not passed. This sets account and change to 0
  const deriveDagAddress = await getBIP44AddressKeyDeriver(dagNode);

  // Derive the second DAG address, which has index 0
  const dagAccount : any = await deriveDagAddress(0);
  // {"depth":5,"parentFingerprint":1325694261,"index":0,"privateKey":"0xd76f211a053ca6d6fff20524392f72d34b4a5ffe4db676c2633d57e541f1ee5a","publicKey":"0x044ecb168ba757aa47c87976c9a71a7f0f1ef4d4d078f00704db47937e0da3fba5543771eb905edc13d87b67aa75aeafe03d15a416dd5ac9c531851db771d512b1","chainCode":"0x710d590aef36d9998beed11cbec5f80cc00c945c9255e4c31eeab4a564d04432"}!

  console.log(dagAccount);

  const publicKeyHexString = getPublicKeyFromPrivate(dagAccount.privateKey.substring(2), true);
  const address = getDagAddressFromPublicKey(publicKeyHexString);
  // const address = getDagAddressFromPublicKey(dagAccount.publicKey);

  switch (request.method) {
    case 'publish':
      var result = await snap.request({
        method: 'snap_dialog',
        params: {
          type: 'Confirmation',
          content: panel([
            text(`Hello, **${address}**!`),
            text('Ready to publish your project?'),
            text('Here we go!'),
          ]),
        },
      });

      if(result === true) {
        // const signature = await sign(dagAccount.privateKey.substring(2), request["message"]);
        return JSON.stringify(request);
      } else {
        return null;
      }
      
    case 'accept':
      
      var result = await snap.request({
        method: 'snap_dialog',
        params: {
          type: 'Confirmation',
          content: panel([
            text('Onboard this builder?'),
          ]),
        },
      });

      if(result === true) {
        // const signature = await sign(dagAccount.privateKey.substring(2), request["message"]);
        return JSON.stringify(request);
      } else {
        return null;
      }
      
    default:
      throw new Error('Method not found.');
  }
};
