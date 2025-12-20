/**
 * 本地视频服务器 - 用于播放 M3U8 + TS 视频
 *
 * 使用方法：
 * 1. 将你的视频文件夹放在任意位置
 * 2. 运行: node local-video-server.js
 * 3. 在浏览器中访问显示的 URL
 */

import { readFile, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 配置
const PORT = 8888;
const VIDEO_DIR = process.argv[2] || join(__dirname, 'videos'); // 可以通过命令行参数指定视频目录

// MIME 类型映射
const MIME_TYPES = {
  '.m3u8': 'application/vnd.apple.mpegurl',
  '.ts': 'video/mp2t',
  '.mp4': 'video/mp4',
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
};

const server = createServer(async (req, res) => {
  // 启用 CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  try {
    // 解码 URL
    const url = decodeURIComponent(req.url);

    // 列出视频文件
    if (url === '/' || url === '/list') {
      const { readdir } = await import('node:fs/promises');
      const files = await readdir(VIDEO_DIR);
      const videoFiles = files.filter(
        (f) => f.endsWith('.m3u8') || f.endsWith('.mp4') || f.endsWith('.ts'),
      );

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          videoDir: VIDEO_DIR,
          files: videoFiles,
          m3u8Files: videoFiles.filter((f) => f.endsWith('.m3u8')),
          urls: videoFiles
            .filter((f) => f.endsWith('.m3u8') || f.endsWith('.mp4'))
            .map((f) => `http://localhost:${PORT}/video/${f}`),
        }),
      );
      return;
    }

    // 提供视频文件
    if (url.startsWith('/video/')) {
      const filename = url.replace('/video/', '');
      const filePath = join(VIDEO_DIR, filename);

      // 检查文件是否存在
      const stats = await stat(filePath);
      if (!stats.isFile()) {
        res.writeHead(404);
        res.end('File not found');
        return;
      }

      // 获取文件扩展名和 MIME 类型
      const ext = extname(filename).toLowerCase();
      const mimeType = MIME_TYPES[ext] || 'application/octet-stream';

      // 读取并发送文件
      const content = await readFile(filePath);
      res.writeHead(200, {
        'Content-Type': mimeType,
        'Content-Length': stats.size,
        'Cache-Control': 'no-cache',
      });
      res.end(content);
      return;
    }

    // 默认响应
    res.writeHead(404);
    res.end('Not found');
  } catch (error) {
    console.error('Error:', error);
    res.writeHead(500);
    res.end(`Internal server error: ${error.message}`);
  }
});

server.listen(PORT, () => {
  console.log('\n🎬 本地视频服务器已启动！\n');
  console.log(`📁 视频目录: ${VIDEO_DIR}`);
  console.log(`🌐 服务地址: http://localhost:${PORT}`);
  console.log(`📋 视频列表: http://localhost:${PORT}/list`);
  console.log('\n使用方法：');
  console.log('1. 将 M3U8 和 TS 文件放在视频目录中');
  console.log('2. 访问 http://localhost:${PORT}/list 查看可用视频');
  console.log(
    '3. 在播放器中输入视频 URL (例如: http://localhost:${PORT}/video/your-video.m3u8)',
  );
  console.log('\n按 Ctrl+C 停止服务器\n');
});
