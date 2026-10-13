import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { chromium } from 'playwright';
const directory = process.cwd();
const version = JSON.parse(await fs.readFile(path.join(directory,'package.json'),'utf8')).dependencies['@tanstack/react-table'];
// Fail before opening a server when the example has not been built.
for (const file of ['index.html','app.js','compiler-events.json']) {
  await fs.access(path.join(directory,'dist',file));
}
const checks = [], errors = [];
const result = {version, mode:'software-operated headless Google Chrome', checks, errors, humanValidation:false, originalUserAdoption:false};
const server = createServer(async (req,res) => {
  if (req.url === '/favicon.ico') {res.writeHead(204).end();return;}
  const name = req.url === '/' ? 'index.html' : req.url === '/app.js' ? 'app.js' : null;
  if (!name) {res.writeHead(404).end();return;}
  res.setHeader('Content-Type',name.endsWith('js')?'text/javascript':'text/html');
  try {
    res.end(await fs.readFile(path.join(directory,'dist',name)));
  } catch (error) {
    errors.push(error.message);
    res.writeHead(500).end('Unable to read the built example.');
  }
});
await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
let browser;
try {
  browser = await chromium.launch({channel:'chrome',headless:true});
  result.browserVersion = browser.version();
  const events = JSON.parse(await fs.readFile(path.join(directory,'dist/compiler-events.json'),'utf8'));
  for (const name of ['Body','Controls','Grid','Spacer','App']) assert.ok(events.some(e=>e.kind==='CompileSuccess' && e.fnName===name),`${name} compiler execution`);
  result.compiledComponents = ['Body','Controls','Grid','Spacer','App'];
  const page = await browser.newPage();
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error') errors.push(m.text());});
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.locator('#source-data').waitFor();
  async function snapshot() {
    return page.evaluate(()=>({
      source:JSON.parse(document.querySelector('#source-data').textContent),
      revision:document.querySelector('#source-revision').textContent,
      page:[...document.querySelectorAll('span')].find(e=>/^Page \d+$/.test(e.textContent))?.textContent,
      rows:[...document.querySelectorAll('tbody tr')].map(r=>[...r.querySelectorAll('td')].map(c=>c.textContent)),
      filter:document.querySelector('input:not([type=checkbox])').value,
      reset:document.querySelector('input[type=checkbox]').checked,
    }));
  }
  async function check(label,names,revision,pageNumber=1) {
    const wanted = names.map(n=>[n,String(revision)]);
    let observed;
    for(let i=0;i<40;i++) {
      observed=await snapshot();
      if(JSON.stringify(observed.rows)===JSON.stringify(wanted) && observed.page===`Page ${pageNumber}`) break;
      await page.waitForTimeout(25);
    }
    checks.push({label, observed, expectedRows:wanted, expectedPage:pageNumber});
    assert.deepEqual(observed.rows,wanted,label);
    assert.equal(observed.page,`Page ${pageNumber}`,label+' page');
    assert.equal(observed.revision,names.length?String(revision):revision===null?'empty':String(revision),label+' source');
  }
  const click = name=>page.getByRole('button',{name,exact:true}).click();
  await check('initial',['Alpha','Beta','Gamma'],0);
  await click('Update data');
  await check('external replacement1',['Beta','Gamma','Delta'],1);
  await click('Update data');
  await check('external replacement2',['Gamma','Delta','Epsilon'],2);
  await click('Next');
  await check('page2',['Zeta','Alpha','Beta'],2,2);
  await click('Update data');
  await check('page2 update1',['Alpha','Beta','Gamma'],3,2);
  await click('Update data');
  await check('page2 update2',['Beta','Gamma','Delta'],4,2);
  assert.equal((await snapshot()).reset,false);
  await click('Sort ascending');
  await check('ascending page2',['Epsilon','Gamma','Zeta'],4,2);
  await click('Update data');
  await check('sorted update',['Epsilon','Gamma','Zeta'],5,2);
  await click('Previous');
  await page.getByRole('textbox',{name:'Filter'}).fill('ta');
  await check('filtered ascending',['Beta','Delta','Zeta'],5);
  await click('Update data');
  await check('filtered update',['Beta','Delta','Zeta'],6);
  assert.equal((await snapshot()).filter,'ta');
  await click('Sort descending');
  await check('filtered descending',['Zeta','Delta','Beta'],6);
  await click('Empty data');
  await check('empty',[],null);
  await click('Update data');
  await check('refill preserves filter and sort',['Zeta','Delta','Beta'],1);
  assert.equal((await snapshot()).filter,'ta');
  await page.getByRole('textbox',{name:'Filter'}).fill('');
  await check('clear filter',['Zeta','Gamma','Epsilon'],1);
  await click('Clear sorting');
  await check('clear sorting',['Beta','Gamma','Delta'],1);
  await page.getByRole('checkbox',{name:'Reset page on data change'}).check();
  assert.equal((await snapshot()).reset,true);
  await click('Next');
  await check('reset enabled page2',['Epsilon','Zeta','Alpha'],1,2);
  await click('Update data');
  await check('reset returns page1',['Gamma','Delta','Epsilon'],2);
  await click('Start updates');
  for(const [revision,names] of [[3,['Delta','Epsilon','Zeta']],[4,['Epsilon','Zeta','Alpha']],[5,['Zeta','Alpha','Beta']]]) {
    await page.waitForFunction(r=>document.querySelector('#source-revision').textContent===String(r),revision,{timeout:5000});
    await check(`timer revision${revision}`,names,revision);
  }
  await click('Stop updates');
  await page.screenshot({path:path.join(directory,'dist','browser.png'),fullPage:true});
  assert.deepEqual(errors,[]);
  result.pass=true;
} catch(error) {
  result.pass=false; result.failure=error.message;
} finally {
  await browser?.close();
  await new Promise(resolve=>server.close(resolve));
  await fs.writeFile(path.join(directory,'dist','browser-results.json'),JSON.stringify(result,null,2));
  console.log(JSON.stringify({version,pass:result.pass,checks:checks.length,failure:result.failure,errors}));
  if(!result.pass) process.exitCode=1;
}
