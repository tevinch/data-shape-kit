import {createServer} from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
const root = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(process.argv[2] || path.join(root,'node_modules/@limetech/lime-elements'));
const mode = process.argv[3] || 'esm';
if (!['esm','bundle'].includes(mode)) throw Error('Loader must be esm or bundle');
const server = createServer(async (req,res) => {
    try {
        const pathname = decodeURIComponent(new URL(req.url,'http://localhost').pathname);
        const asset = pathname.startsWith('/package/');
        if (!asset && !['/','/index.html','/dot.svg'].includes(pathname)) throw Error('unknown fixture');
        const base = asset ? packageRoot : root;
        const relative = asset ? pathname.slice('/package/'.length) : pathname==='/' ? 'index.html' : pathname.slice(1);
        const target = path.resolve(base,relative);
        if (!target.startsWith(base+path.sep)) throw Error('outside asset root');
        const content = await fs.readFile(target);
        res.writeHead(200,{'content-type':({'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'})[path.extname(target)]||'application/octet-stream'});
        res.end(content);
    } catch { res.writeHead(404);res.end(); }
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser = await chromium.launch({headless:true,...(process.env.TABLE_PASTE_BROWSER_CHANNEL?{channel:process.env.TABLE_PASTE_BROWSER_CHANNEL}:{})});
const cases = [
    {name:'plain table',cell:'<p>PASTED A</p>',text:'PASTED A\tPASTED B',expected:'PASTED A',links:0,images:0},
    {name:'table with link URL in plain text',cell:'<p><a href="https://example.com/item">LINK A</a></p>',text:'https://example.com/item\tPASTED B',expected:'LINK A',links:1,images:0},
    {name:'table with link label in plain text',cell:'<p><a href="https://example.com/item">LINK A</a></p>',text:'LINK A\tPASTED B',expected:'LINK A',links:1,images:0},
    {name:'table containing image',cell:'<p>IMAGE A<img src="/dot.svg" alt="sample"></p>',text:'IMAGE A\tPASTED B',expected:'IMAGE A',links:0,images:1},
    {name:'table containing link and image',cell:'<p><a href="https://example.com/item">LINK A</a><img src="/dot.svg" alt="sample"></p>',text:'https://example.com/item\tPASTED B',expected:'LINK A',links:1,images:1},
];
cases.push({...cases[4],name:'paste outside an existing table',outside:true});
cases.push({...cases[1],name:'replace explicitly selected cells with a linked table',selected:true});
cases.push({name:'plain URL still linkifies inside a cell',plainURL:true,text:'https://example.com/item',links:1,images:0});
cases.push({name:'image file completes the configured local upload callback',file:true,config:'upload',text:'',links:0,images:1});
for (const i of [1,3,4]) cases.push({...cases[i],name:cases[i].name+' pasted into a table-free document then pasted again inside its first cell',repeat:true});
cases.push({...cases[4],name:'no-upload tag config excludes new img but keeps table and link',config:'no-upload',images:0});
cases.push({...cases[3],name:'no-upload tag config excludes new custom image but keeps table text',config:'no-upload',images:0,cell:'<p>IMAGE A<fixture-image image-id="new-id" alt="sample"></fixture-image></p>'});
cases.push({...cases[4],name:'no-upload tag config preserves existing image while excluding pasted image',config:'no-upload',existing:true,images:1});
cases.push({name:'no-upload tag config still ignores standalone image file',file:true,config:'no-upload',text:'',links:0,images:0,noChange:true});
cases.push({name:'image file owns paste when URL text is also present',file:true,config:'upload',text:'https://example.com/item',links:0,images:1});
cases.push({name:'no-upload image file with URL text remains ignored',file:true,config:'no-upload',text:'https://example.com/item',links:0,images:0,noChange:true});
const results = [];
async function caret(page, outside) {
    const ed = page.locator('.ProseMirror');
    await ed.locator(outside?'p':'td').first().click();
    await ed.evaluate((el,outside) => {
        el.focus();
        const text = document.createTreeWalker(el.querySelector(outside?'p':'td p'),NodeFilter.SHOW_TEXT).nextNode();
        const selection = el.getRootNode().getSelection();
        const offset = outside?text.textContent.length:0;
        selection.setBaseAndExtent(text,offset,text,offset);
        document.dispatchEvent(new Event('selectionchange'));
    },outside);
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    assert.equal(await ed.evaluate((el,outside)=>el.getRootNode().getSelection().anchorNode===document.createTreeWalker(el.querySelector(outside?'p':'td p'),NodeFilter.SHOW_TEXT).nextNode(),outside),true,'caret must be at the intended paste position');
}
async function paste(page,c,html) {
    await page.locator('.ProseMirror').evaluate((el,payload) => {
        const data = new DataTransfer();
        data.setData('text/html',payload.html);
        data.setData('text/plain',payload.text);
        if (payload.file) data.items.add(new File([Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a2ioAAAAASUVORK5CYII='),c=>c.charCodeAt(0))],'upload.png',{type:'image/png'}));
        el.dispatchEvent(new ClipboardEvent('paste',{clipboardData:data,bubbles:true,cancelable:true,composed:true}));
    },{html,text:c.text,file:!!c.file});
    if (c.file && !c.noChange) await page.waitForFunction(()=>window.lastValue?.includes('upload.png'),null,{timeout:3000});
    // FileReader completion is asynchronous even for an intentionally ignored file.
    if (c.noChange) await page.evaluate(()=>new Promise(r=>setTimeout(r,100)));
    await page.locator('limel-prosemirror-adapter').evaluate(el=>el.flushPendingChanges());
}
async function capture(page) {
    return page.evaluate(() => {
        const value = window.lastValue;
        if (typeof value !== 'string') throw Error('Missing initialized serialized document');
        const el = new DOMParser().parseFromString(value,'text/html').body;
        const tables = [...el.querySelectorAll('table')].map(t=>[...t.rows].map(r=>[...r.cells].map(c=>c.textContent)));
        return {
            tables,
            links:[...el.querySelectorAll('a')].map(a=>({text:a.textContent,href:a.getAttribute('href')})),
            images:[...el.querySelectorAll('img,fixture-image')].map(i=>({tag:i.tagName.toLowerCase(),alt:i.getAttribute('alt'),src:i.getAttribute('src'),id:i.getAttribute('image-id')})),
            paragraphs:[...el.children].filter(c=>c.tagName==='P').map(p=>p.textContent),
            value,changeCount:window.changeCount,legacyImageEvents:window.legacyImageEvents,
        };
    });
}
try {
    for (const c of cases) {
        const page = await browser.newPage({viewport:{width:1100,height:850}});
        const errors = [];
        page.on('pageerror',e=>errors.push(e.message));
        let actual, firstPaste;
        try {
            const query = new URLSearchParams({loader:mode,config:c.config||'default'});
            if (c.repeat) query.set('empty','1');
            if (c.existing) query.set('existing','1');
            await page.goto('http://127.0.0.1:'+server.address().port+'/?'+query);
            const ed = page.locator('.ProseMirror');
            await ed.waitFor({state:'visible'});
            await caret(page,!!(c.outside||c.repeat));
            if (c.selected) {
                const a=await ed.locator('td').nth(0).boundingBox(),b=await ed.locator('td').nth(1).boundingBox();
                await page.mouse.move(a.x+a.width/2,a.y+a.height/2);await page.mouse.down();
                await page.mouse.move(b.x+b.width/2,b.y+b.height/2,{steps:12});await page.mouse.up();
                assert.equal(await ed.locator('.selectedCell').count(),2,'both target cells must be explicitly selected');
            }
            const html=c.plainURL||c.file?'':'<table><tbody><tr><td>'+c.cell+'</td><td><p>PASTED B</p></td></tr></tbody></table>';
            await paste(page,c,html);
            if (c.repeat) {
                firstPaste=await capture(page);
                assert.deepEqual(firstPaste.tables,[[[c.expected,'PASTED B']]],'first paste must create the complete initial table');
                assert.equal(firstPaste.links.length,c.links);
                assert.equal(firstPaste.images.length,c.images);
                await caret(page,false);
                await paste(page,c,html);
            }
            actual=await capture(page);
            const initial=[['ORIGINAL A','ORIGINAL B'],['KEEP C','KEEP D']];
            const pasted=[c.expected,'PASTED B'];
            const expected=c.repeat?[[pasted,pasted]]:c.plainURL?[[['https://example.com/itemORIGINAL A','ORIGINAL B'],initial[1]]]:c.file?[initial]:c.selected?[[pasted,initial[1]]]:c.outside?[[pasted],initial]:[[initial[0],pasted,initial[1]]];
            assert.deepEqual(actual.tables,expected,'table boundaries and all cell text must match');
            assert.deepEqual(actual.paragraphs,['BEFORE','AFTER']);
            assert.equal(actual.links.length,c.links*(c.repeat?2:1));
            assert.equal(actual.images.length,c.images*(c.repeat?2:1));
            for (const a of actual.links) assert.deepEqual(a,{text:c.plainURL?'https://example.com/item':'LINK A',href:'https://example.com/item'});
            for (const i of actual.images) {
                assert.equal(i.alt,c.file?'upload.png':c.existing?'existing':'sample');
                if(c.existing) {assert.equal(i.id,'existing-id');assert.equal(i.tag,'fixture-image');}
                else assert.equal(i.src,'/dot.svg');
            }
            assert.equal(actual.legacyImageEvents,0);
            if(c.noChange) assert.equal(actual.changeCount,0);
            else {
                assert.ok(actual.changeCount>0,'paste must emit a public change');
                assert.ok(actual.value.includes(c.plainURL?'https://example.com/item':c.file?'upload.png':'PASTED B'));
                if(c.repeat) assert.ok(actual.changeCount>firstPaste.changeCount,'the second paste must complete and emit change');
            }
            assert.deepEqual(errors,[]);
            results.push({name:c.name,pass:true,firstPaste,actual,errors});
            console.log('PASS '+c.name);
        } catch(e) {
            if(!actual) { try {actual=await capture(page);} catch{} }
            results.push({name:c.name,pass:false,failure:e.message,firstPaste,actual,errors});
            console.log('FAIL '+c.name+' '+e.message.slice(0,220));
        } finally {await page.close();}
    }
} finally {await browser.close();await new Promise(r=>server.close(r));}
if (process.argv[4]) {
    const report=path.resolve(process.argv[4]);
    await fs.mkdir(path.dirname(report),{recursive:true});
    await fs.writeFile(report,JSON.stringify(results,null,2)+'\n');
}
console.log(JSON.stringify({passed:results.filter(r=>r.pass).length,total:results.length}));
if(results.some(r=>!r.pass)) process.exitCode=1;
