const { app, BrowserWindow } = require('electron');
const { fork } = require('child_process');
const path = require('path');
const http = require('http');
const net = require('net');

let serverProcess = null;
let mainWindow = null;

// ---- 找一个空闲端口 ----
function findFreePort(startPort = 3000) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(startPort, '127.0.0.1', () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
    server.on('error', () => {
      // 端口被占用，试下一个
      resolve(findFreePort(startPort + 1));
    });
  });
}

// ---- 等待服务器可访问 ----
function waitForServer(port, maxAttempts = 40) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const check = () => {
      http.get(`http://127.0.0.1:${port}`, (res) => {
        resolve();
      }).on('error', () => {
        attempts++;
        if (attempts >= maxAttempts) {
          reject(new Error(`服务器在端口 ${port} 上启动超时`));
        } else {
          setTimeout(check, 500);
        }
      });
    };
    // 给子进程一点时间启动
    setTimeout(check, 800);
  });
}

// ---- 启动后端 ----
async function startServer() {
  const port = await findFreePort(3000);
  console.log(`[electron] 使用端口: ${port}`);

  const serverPath = path.join(__dirname, 'server', 'app.js');
  serverProcess = fork(serverPath, [], {
    env: { ...process.env, PORT: String(port) },
    silent: true,
  });

  serverProcess.stdout.on('data', (data) => {
    console.log(`[server] ${data.toString().trim()}`);
  });

  serverProcess.stderr.on('data', (data) => {
    console.error(`[server] ${data.toString().trim()}`);
  });

  serverProcess.on('exit', (code) => {
    console.log(`[electron] 后端进程退出，code: ${code}`);
  });

  await waitForServer(port);
  console.log(`[electron] 后端就绪，端口: ${port}`);
  return port;
}

// ---- 退出时清理子进程 ----
function cleanupServer() {
  if (serverProcess && !serverProcess.killed) {
    console.log('[electron] 正在关闭后端进程...');
    serverProcess.kill('SIGTERM');
    // 给子进程 2 秒优雅退出，超时则强杀
    setTimeout(() => {
      if (serverProcess && !serverProcess.killed) {
        console.log('[electron] 后端未响应，强制关闭');
        serverProcess.kill('SIGKILL');
      }
    }, 2000);
  }
}

// ---- Electron 生命周期 ----
app.whenReady().then(async () => {
  try {
    const port = await startServer();

    mainWindow = new BrowserWindow({
      width: 1280,
      height: 860,
      title: '智序 Prio',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      },
    });

    mainWindow.loadURL(`http://127.0.0.1:${port}`);

    mainWindow.on('closed', () => {
      mainWindow = null;
    });
  } catch (err) {
    console.error('[electron] 启动失败:', err.message);
    cleanupServer();
    app.quit();
  }
});

app.on('before-quit', () => {
  cleanupServer();
});

app.on('window-all-closed', () => {
  app.quit();
});

app.on('activate', () => {
  // macOS: 点击 Dock 图标时重新创建窗口
  if (mainWindow === null) {
    // 如果窗口被关了但后端还在，这里简单退出
    app.quit();
  }
});
