import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const certsDir = path.resolve(__dirname, '../certs');
if (!fs.existsSync(certsDir)) {
  fs.mkdirSync(certsDir, { recursive: true });
}

const keyPath = path.join(certsDir, 'server.key');
const certPath = path.join(certsDir, 'server.cert');

console.log('🔒 Generating SSL Private Key and Certificate for local HTTPS testing...');

// Generate 2048-bit RSA key pair using Node.js crypto
crypto.generateKeyPair(
  'rsa',
  {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem',
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem',
    },
  },
  (err, publicKey, privateKey) => {
    if (err) {
      console.error('Failed to generate RSA keys:', err);
      process.exit(1);
    }

    fs.writeFileSync(keyPath, privateKey);
    // Write public key / cert
    fs.writeFileSync(certPath, publicKey);

    console.log(`✅ Private key written to: ${keyPath}`);
    console.log(`✅ Certificate written to: ${certPath}`);
    console.log('\n💡 To enable HTTPS, set in .env:');
    console.log('HTTPS_ENABLED=true');
    console.log(`SSL_KEY_PATH=${keyPath}`);
    console.log(`SSL_CERT_PATH=${certPath}`);
  }
);
