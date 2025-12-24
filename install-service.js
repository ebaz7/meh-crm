
import { Service } from 'node-windows';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. Create Readline interface for User Input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log("---------------------------------------------------------");
console.log("   Payment System - Windows Service Installer            ");
console.log("---------------------------------------------------------");

// 2. Ask for Port
rl.question('Please enter the port number to run the server (default: 3000): ', (inputPort) => {
  const port = inputPort.trim() || '3000';
  console.log(`> Using Port: ${port}`);

  // 3. Create/Update .env file
  const envContent = `PORT=${port}\n`;
  try {
    fs.writeFileSync(path.join(__dirname, '.env'), envContent);
    console.log('> Saved configuration to .env file.');
  } catch (err) {
    console.error('> Error writing .env file:', err);
    rl.close();
    return;
  }

  // 4. Configure Service
  const svc = new Service({
    name: 'PaymentSystem',
    description: 'Payment Order Management System Web Server',
    script: path.join(__dirname, 'server.js'),
    workingDirectory: __dirname, // CRITICAL: Ensures DB and Auth files are found
    env: [{
      name: "PORT",
      value: port
    }]
  });

  // 5. Listen for events
  svc.on('install', function() {
    console.log('> Service installed successfully!');
    console.log('> Starting service...');
    svc.start();
  });

  svc.on('alreadyinstalled', function() {
    console.log('> Service is already installed.');
    console.log('> Attempting to start it...');
    svc.start();
  });

  svc.on('start', function() {
    console.log(`> Service started! App is running on http://localhost:${port}`);
    console.log('> Telegram & WhatsApp bots are starting in the background.');
    console.log('> You can now close this window.');
    rl.close();
  });

  svc.on('error', function(e) {
    console.error('> Error:', e);
    rl.close();
  });

  // 6. Install
  console.log('> Installing Windows Service (This may prompt for Admin permissions)...');
  svc.install();
});
