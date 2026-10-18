import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,mkdir,rm,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {validate} from './check-html5.mjs';

async function fixture(html,files,fn){const root=await mkdtemp(path.join(tmpdir(),'itch-html5-'));try{
  await writeFile(path.join(root,'index.html'),html);
  for(const [name,body] of Object.entries(files)){await mkdir(path.dirname(path.join(root,name)),{recursive:true});await writeFile(path.join(root,name),body);}
  await fn(root);
}finally{await rm(root,{recursive:true,force:true});}}
const unityHtml='matchWebGLToCanvasSize:true dataUrl:"Build/data" frameworkUrl:"Build/framework" codeUrl:"Build/wasm"';
const unityFiles={'Build/data':'x','Build/framework':'x','Build/wasm':'x'};
const plainHtml='<script src="js/game.js"></script><link href="style.css" rel="stylesheet">';
const plainFiles={'js/game.js':'x','style.css':'x'};

test('generic: accepts any relative HTML5 bundle',()=>fixture(plainHtml,plainFiles,r=>validate(r)));
test('generic: accepts external CDN urls',()=>fixture('<script src="https://cdn.jsdelivr.net/npm/phaser"></script>',{},r=>validate(r)));
test('generic: rejects missing index.html',async()=>{const r=await mkdtemp(path.join(tmpdir(),'itch-html5-'));try{await assert.rejects(validate(r),/index\.html/);}finally{await rm(r,{recursive:true,force:true});}});
test('generic: rejects root-absolute asset path',()=>fixture('<script src="/js/game.js"></script>',plainFiles,r=>assert.rejects(validate(r),/relative/)));
test('generic: rejects referenced file that is missing',()=>fixture('<script src="js/missing.js"></script>',{},r=>assert.rejects(validate(r),/missing/i)));
test('generic: rejects symlinks',()=>fixture(plainHtml,plainFiles,async r=>{await symlink(path.join(r,'style.css'),path.join(r,'link.css'));await assert.rejects(validate(r),/symlink/i);}));
test('generic: Unity checks are off by default',()=>fixture(plainHtml,plainFiles,r=>validate(r,{unity:false})));
test('unity: accepts complete relative bundle',()=>fixture(unityHtml,unityFiles,r=>validate(r,{unity:true})));
test('unity: rejects missing wasm',()=>fixture(unityHtml,{'Build/data':'x','Build/framework':'x'},r=>assert.rejects(validate(r,{unity:true}))));
test('unity: rejects unexpanded template',()=>fixture('{{{ PRODUCT_NAME }}}',{},r=>assert.rejects(validate(r,{unity:true}),/expanded/)));
test('unity: rejects nonresponsive canvas',()=>fixture('dataUrl:"Build/data"',unityFiles,r=>assert.rejects(validate(r,{unity:true}),/resize/)));
