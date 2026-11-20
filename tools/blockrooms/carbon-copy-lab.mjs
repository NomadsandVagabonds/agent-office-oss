// Local experiment. Serves the game assets and, optionally, a loopback llama.cpp model.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { instructions, schema } from '../../public/world/dev/carbon-copy/recipe-contract.js';
const root=fileURLToPath(new URL('../../public/',import.meta.url));
const port=Number(process.env.CARBON_COPY_PORT || 4386);
const modelPort=Number(process.env.CARBON_COPY_MODEL_PORT || 4387);
const upstream='http://127.0.0.1:'+modelPort;
const keyFile=process.env.CARBON_COPY_MODEL_KEY_FILE;
const headers={'Content-Type':'application/json'};
if(keyFile)headers.Authorization='Bearer '+(await readFile(keyFile,'utf8')).trim();
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.woff2':'font/woff2'};
let busy=false;
const json=(res,status,body)=>res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'}).end(JSON.stringify(body));
http.createServer(async(req,res)=>{
  const base='http://'+req.headers.host;
  if(!['127.0.0.1:'+port,'localhost:'+port].includes(req.headers.host)){res.writeHead(403).end();return;}
  try{
    const {pathname}=new URL(req.url,base);
    if(req.method==='GET' && pathname==='/_local/model'){
      let ready=false;
      try{ready=(await fetch(upstream+'/health',{headers,signal:AbortSignal.timeout(1300)})).ok;}catch{}
      json(res,200,{ready});return;
    }
    if(req.method==='POST' && pathname==='/_local/recipe'){
      if(req.headers.origin!==base || !req.headers['content-type']?.startsWith('application/json')){json(res,403,{});return;}
      if(busy){json(res,429,{error:'The local sketcher is busy. Try again shortly.'});return;}
      let body='';
      for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>900){json(res,413,{});return;}}
      let text;
      try{text=JSON.parse(body).text;}catch{}
      if(typeof text!=='string'||!text.trim()||text.length>96){json(res,400,{error:'Use 1–96 characters.'});return;}
      busy=true;
      const stop=new AbortController();
      res.on('close',()=>{if(!res.writableEnded)stop.abort();});
      try{
        const response=await fetch(upstream+'/v1/chat/completions',{method:'POST',headers,
          signal:AbortSignal.any([stop.signal,AbortSignal.timeout(42000)]),
          body:JSON.stringify({model:'local',temperature:.55,repeat_penalty:1.13,max_tokens:1600,messages:[
            {role:'system',content:instructions},{role:'user',content:text.trim()}
          ],response_format:{type:'json_schema',json_schema:{name:'voxel_object',schema}}})});
        if(!response.ok)throw Error();
        const data=await response.json();
        json(res,200,JSON.parse(data.choices[0].message.content));
      }catch{if(!res.destroyed)json(res,503,{error:'The local sketcher could not finish. Try a shorter description.'});}
      finally{busy=false;}
      return;
    }
    if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405).end();return;}
    if(pathname==='/' || pathname==='/world/dev/carbon-copy'){res.writeHead(302,{location:'/world/dev/carbon-copy/'}).end();return;}
    if(pathname==='/favicon.ico'){res.writeHead(204).end();return;}
    const name=decodeURIComponent(pathname)+(pathname.endsWith('/')?'index.html':'');
    if(!/^\/(?:world\/(?:dev\/carbon-copy\/|vox\/|props\/office\.js$|backrooms\/rooms\/copiers\/model\.js$)|vendor\/)/.test(name) || name.split('/').includes('..')){res.writeHead(404).end();return;}
    const bytes=await readFile(path.join(root,name));
    res.writeHead(200,{'Content-Type':mime[path.extname(name)]||'application/octet-stream','Cache-Control':'no-cache'}).end(req.method==='HEAD'?undefined:bytes);
  }catch{if(!res.headersSent)res.writeHead(404);res.end();}
}).listen(port,'127.0.0.1',()=>console.log('Carbon Copy — http://127.0.0.1:'+port+'/'));
