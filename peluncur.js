'use strict';

const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline');

// Resolve everything relative to the package, even when opened from a shortcut.
process.chdir(__dirname);

const requiredFiles = [
  'server.js', 'game.js', 'package.json',
  'public/index.html', 'public/admin.html', 'public/app.js', 'public/style.css',
  'public/arena-map.js', 'public/audio.js'
];
const missing = requiredFiles.filter(file => !fs.existsSync(path.join(__dirname, file)));

function fail(message) {
  console.error('\n[BELUM BISA DIMULAI] ' + message);
  process.exitCode = 1;
}

function launch() {
  if (missing.length) {
    fail('Paket game belum lengkap. File yang tidak ditemukan:\n- ' + missing.join('\n- ') +
      '\nEkstrak ulang seluruh ZIP. Jangan memindahkan file MULAI GAME.bat sendirian.');
    return;
  }

  console.log('Folder game yang dibuka: ' + __dirname);

  let app;
  try {
    // The complete dependency folder is shipped with the portable package.
    require('ws');
    require('qrcode');
    app = require('./server');
  } catch (error) {
    fail('Komponen game tidak dapat dibaca. Ekstrak ulang seluruh ZIP, termasuk folder node_modules.\n' +
      'Rincian untuk pendamping teknis: ' + error.message);
    return;
  }

  let input;
  let stopping = false;
  function stop() {
    if (stopping) return;
    stopping = true;
    const wasListening = app.server.listening;
    if (input) input.close();
    app.stop();
    console.log(wasListening
      ? '\nServer Arena Sahabat sudah berhenti. Semua pemain terputus.'
      : '\nPeluncuran dibatalkan. Server lain yang sedang berjalan tidak dihentikan.');
  }

  // ws forwards HTTP bind errors before the HTTP server's error handler runs.
  // Keep a second launch from turning a busy port into an uncaught exception.
  app.wss.on('error', error => {
    if (app.server.listening) {
      fail('Koneksi server terganggu: ' + error.message);
      stop();
    }
  });

  app.server.once('listening', () => {
    console.log('LANGKAH BERMAIN');
    console.log('1. Sambungkan laptop guru dan perangkat pemain ke Wi-Fi yang sama.');
    console.log('2. Pada halaman pengelola, klik "Buat room".');
    console.log('3. Pilih alamat jaringan Wi-Fi laptop dan tampilkan QR kepada siswa.');
    console.log('4. Tunggu 6 pemain siap: 3 tim Biru dan 3 tim Merah.');
    console.log('5. Klik "Mulai pertandingan".');
    console.log('\nBiarkan jendela server ini terbuka selama bermain.');
    console.log('Jika browser tidak terbuka, salin SELURUH alamat Pengelola di atas.');
    console.log('Untuk MENGHENTIKAN server, ketik Q lalu tekan Enter di jendela ini.\n');
    input = readline.createInterface({input: process.stdin, output: process.stdout, terminal: false});
    input.on('line', line => {
      if (line.trim().toLowerCase() === 'q') stop();
    });
    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);
  });

  app.server.once('error', error => {
    if (error.code === 'EADDRINUSE') {
      console.error('Server lain masih memakai port ini. Menutup tab browser saja tidak menghentikannya.');
      console.error('Untuk memakai paket dari folder di atas, buka jendela server lama, ketik Q lalu Enter.');
      console.error('Setelah server lama berhenti, klik MULAI GAME lagi dari folder yang benar.');
      console.error('Jika tidak ada jendela server lama, minta pendamping memeriksa aplikasi yang memakai port ini.');
    } else if (error.code === 'EACCES') {
      console.error('Akses jaringan ditolak. Minta pendamping sekolah memeriksa izin aplikasi.');
    }
    stop();
    process.exitCode = 1;
  });

  app.start();
}

launch();
