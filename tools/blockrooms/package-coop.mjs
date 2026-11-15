// Prepare an explicit tracked-file artifact for a private Railway deployment.
// Never copy Office data, untracked uploads, .git, credentials or local settings.
import {execFileSync} from 'node:child_process';
import {mkdir,copyFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url));
const target=process.argv[2];if(!target)throw Error('Pass an empty output directory outside the repository');
const out=path.resolve(target);if(out.startsWith(root))throw Error('Output must be outside the checkout');
await mkdir(out,{recursive:false});
const files=execFileSync('git',['ls-files','-z','--','core','public','server/ws.mjs','package.json','tools/blockrooms/coop-server.mjs'],{cwd:root,encoding:'utf8'}).split('\0').filter(Boolean).filter(f=>!/^public\/(knowledge|transcripts)\//.test(f));
for(const file of files){await mkdir(path.dirname(path.join(out,file)),{recursive:true});await copyFile(path.join(root,file),path.join(out,file));}
await copyFile(path.join(root,'tools/blockrooms/coop/Dockerfile'),path.join(out,'Dockerfile'));
await writeFile(path.join(out,'railway.json'),JSON.stringify({build:{builder:'DOCKERFILE',dockerfilePath:'Dockerfile'},deploy:{healthcheckPath:'/health',healthcheckTimeout:60,numReplicas:1,restartPolicyType:'ON_FAILURE',restartPolicyMaxRetries:3}},null,2)+'\n');
console.log(`Prepared ${files.length} tracked files in ${out}; no upload performed.`);
