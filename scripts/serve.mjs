import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist');
const port = Number(process.env.ACHEIQUEM_PORT || 4173);
const mime = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.ttf':'font/ttf','.txt':'text/plain; charset=utf-8'};
http.createServer((req,res) => {
  let route;
  try { route = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); } catch {res.writeHead(400);res.end();return;}
  const file = path.resolve(root, '.' + (route === '/' ? '/index.html' : route));
  const relative = path.relative(root,file);
  if(relative.startsWith('..') || path.isAbsolute(relative)) {res.writeHead(403);res.end();return;}
  fs.readFile(file,(error,data) => {if(error){res.writeHead(404);res.end('Arquivo não encontrado');return;}res.writeHead(200,{'Content-Type':mime[path.extname(file)] || 'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(data);});
}).listen(port,'127.0.0.1',()=>process.stdout.write(`Achei Quem local: http://127.0.0.1:${port}\n`));
