// Independent audit. Test-only; reads the built artifact and never visits real contact targets.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const { chromium } = await import('/tmp/ya-card-browser-check/node_modules/playwright/index.mjs');
const html = await readFile(new URL('../dist/index.html', import.meta.url));
const results = { sha256: createHash('sha256').update(html).digest('hex'), checks: [], errors: [], external: [] };
const server = createServer((req, res) => { res.writeHead(200, { 'content-type': 'text/html' }); res.end(html); });
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const check = async (name, fn) => {
  try { const evidence = await fn(); results.checks.push({ name, status: 'PASS', evidence }); }
  catch (error) { results.checks.push({ name, status: 'FAIL', error: error.message }); }
  console.log(JSON.stringify(results.checks.at(-1)));
};
const instrument = ({ noGpu, noDerivatives, focusDuringBoot }) => {
  Math.random = () => .5;
  window.audit = { model: null, light: null, focuses: [], hover: [], clicks: [], events: [], captures: [] };
  if(focusDuringBoot) {
    const load=document.fonts.load.bind(document.fonts);
    const gate=new Promise(resolve=>{window.releaseAuditFonts=resolve;});
    document.fonts.load=(...args)=>Promise.all([load(...args),gate]).then(([fonts])=>fonts);
  }
  const proto = WebGLRenderingContext.prototype, names = new WeakMap();
  for (const name of ['getUniformLocation', 'uniformMatrix4fv', 'uniform3f', 'uniform4f', 'getExtension']) {
    const original = proto[name];
    proto[name] = function (...args) {
      if (name === 'getExtension' && noDerivatives && args[0] === 'OES_standard_derivatives') return null;
      const result = original.apply(this, args);
      if (name === 'getUniformLocation' && result) names.set(result, args[1]);
      if (name === 'uniformMatrix4fv' && names.get(args[0]) === 'uModel') {
        audit.model = [...args[2]]; audit.focuses = []; audit.hover = [];
      }
      if (name === 'uniform3f' && names.get(args[0]) === 'uKeyPosition') audit.light = args.slice(1);
      if (name === 'uniform4f' && args[1] >= 0) {
        if (names.get(args[0]) === 'uFocusRect') audit.focuses.push(args.slice(1));
        if (names.get(args[0]) === 'uHoverRect') audit.hover.push(args.slice(1));
      }
      return result;
    };
  }
  if (noGpu) {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) { return type === 'webgl' ? null : original.call(this, type, ...args); };
  }
  document.addEventListener('click', event => {
    const anchor = event.target.closest?.('.face a');
    if (anchor) { audit.clicks.push({ href: anchor.getAttribute('href'), trusted: event.isTrusted }); event.preventDefault(); }
  }, true);
  document.addEventListener('pointerleave', event => audit.events.push({ type: event.type, target: event.target.tagName, trusted: event.isTrusted }), true);
  document.addEventListener('gotpointercapture', event => audit.captures.push(event.pointerId), true);
};
const newPage = async (opts = {}, flags = {}) => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1, ...opts });
  page.on('pageerror', error => results.errors.push(error.message));
  page.on('request', req => { if (!req.url().startsWith(base) && !req.url().startsWith('data:')) results.external.push(req.url()); });
  await page.addInitScript(instrument, flags);
  await page.goto(base);
  if(flags.focusDuringBoot) {
    await page.locator('.scene').focus();
    await page.keyboard.press('Tab');await page.keyboard.press('Tab');await page.keyboard.press('Tab');
    assert.equal((await active(page)).href,'mailto:sbmaxx@yandex-team.ru');
    await page.evaluate(()=>releaseAuditFonts());
  }
  if (opts.javaScriptEnabled !== false) await page.waitForFunction(() => document.documentElement.classList.contains('webgl-ready') || document.documentElement.classList.contains('webgl-fallback'));
  return page;
};
const active = page => page.evaluate(() => ({ href: document.activeElement.getAttribute('href'), lang: document.activeElement.closest('.face')?.lang, cls: document.activeElement.className }));
const gpu = page => page.evaluate(() => ({ model: audit.model, light: audit.light, focuses: audit.focuses, hover: audit.hover }));
const delta = (a,b) => Math.max(...a.map((v,i) => Math.abs(v-b[i])));
const point = async (page, x=200, y=266) => page.evaluate(({ x,y }) => {
  const m=audit.model, p=[(x/545-.5)*4.235,(.5-y/300)*2.333,.055];
  const w=[0,1,2].map(i => m[i]*p[0]+m[i+4]*p[1]+m[i+8]*p[2]+m[i+12]);
  const f=1/Math.tan(Math.PI/8);
  return { x:(w[0]*f/(innerWidth/innerHeight)/(7-w[2])+1)*innerWidth/2,y:(1-w[1]*f/(7-w[2]))*innerHeight/2 };
}, {x,y});
try {
  await check('baseline desktop/mobile image bytes and exact dimensions', async () => {
    const output=[];
    for (const width of [1440,390]) {
      const page=await newPage({ viewport:{width,height:width===1440?1000:844}, reducedMotion:'reduce', hasTouch:width===390, isMobile:width===390 });
      await page.waitForTimeout(150);
      const path=`/tmp/ya-card-judge-${width}.png`, shot=await page.screenshot({path});
      const baseline=await readFile(`/tmp/ya-card-contact-baseline-${width}.png`);
      output.push({ width, exactPngBytes:shot.equals(baseline), bytes:shot.length, baselineBytes:baseline.length });
      await page.close();
    }
    return output;
  });
  await check('native forward/reverse Tab and trusted Enter for all 12 active-face anchors', async () => {
    const page=await newPage({ reducedMotion:'reduce' });
    const output=[];
    for (const lang of ['ru','en']) {
      if(lang==='en') { await page.locator('[data-lang=en]').focus(); await page.keyboard.press('Enter'); }
      await page.locator('.scene').focus();
      const hrefs=await page.locator(`#${lang} a`).evaluateAll(a=>a.map(e=>e.getAttribute('href')));
      for (let i=0;i<6;i++) {
        await page.keyboard.press('Tab');
        assert.deepEqual((await active(page)), {href:hrefs[i],lang,cls:await page.locator(`#${lang} a`).nth(i).getAttribute('class')||''});
        await page.waitForTimeout(70);
        assert.equal((await gpu(page)).focuses.length,1);
        await page.keyboard.press('Enter');
        assert.deepEqual(await page.evaluate(()=>audit.clicks.at(-1)),{href:hrefs[i],trusted:true});
        await page.screenshot({path:`/tmp/ya-card-judge-focus-${lang}-${i}.png`});
      }
      for(let i=4;i>=0;i--) { await page.keyboard.press('Shift+Tab'); assert.equal((await active(page)).href,hrefs[i]); }
      await page.keyboard.press('Shift+Tab'); assert.equal((await active(page)).cls,'scene');
      assert.equal(await page.locator(`.face:not(#${lang}) a`).evaluateAll(a=>a.some(e=>e.tabIndex>=0)),false);
      output.push({lang,hrefs});
    }
    await page.close();return output;
  });
  await check('focus pose frozen but light continues; language/history clears old focus', async()=>{
    const page=await newPage();await page.waitForTimeout(700);
    await page.locator('#ru .email').focus();await page.waitForTimeout(100);
    const a=await gpu(page);await page.waitForTimeout(500);const b=await gpu(page);
    assert.ok(delta(a.model,b.model)<1e-6);assert.ok(delta(a.light,b.light)>.001);
    await page.evaluate(()=>{ location.hash='#en'; });await page.waitForTimeout(100);
    assert.notEqual((await active(page)).lang,'ru');assert.equal((await gpu(page)).focuses.length,0);
    await page.goBack();await page.waitForTimeout(100);assert.equal((await gpu(page)).focuses.length,0);
    await page.goForward();await page.waitForTimeout(1800);assert.equal((await gpu(page)).focuses.length,0);
    await page.close();return {modelDelta:delta(a.model,b.model),lightDelta:delta(a.light,b.light)};
  });
  await check('focused email after crossing layout breakpoint matches freshly focused email',async()=>{
    const page=await newPage({reducedMotion:'reduce'});await page.locator('#ru .email').focus();await page.waitForTimeout(100);
    await page.setViewportSize({width:390,height:844});await page.waitForTimeout(180);
    const stale=(await gpu(page)).focuses;
    await page.screenshot({path:'/tmp/ya-card-judge-resize-stale.png'});
    await page.locator('.scene').focus();await page.locator('#ru .email').focus();await page.waitForTimeout(100);
    const refreshed=(await gpu(page)).focuses;
    await page.screenshot({path:'/tmp/ya-card-judge-resize-refocused.png'});await page.close();
    assert.deepEqual(stale,refreshed,`focus rectangle before refocus ${JSON.stringify(stale)}; correct ${JSON.stringify(refreshed)}`);
  });
  await check('hover holds pose and underlines; moving off link resumes',async()=>{
    const page=await newPage();await page.waitForTimeout(600);const p=await point(page);await page.mouse.move(p.x,p.y);await page.waitForTimeout(150);
    const a=await gpu(page);await page.waitForTimeout(400);const b=await gpu(page);
    assert.ok(a.hover.length);assert.ok(delta(a.model,b.model)<1e-6);assert.ok(delta(a.light,b.light)>.001);
    await page.mouse.move(1300,100);await page.waitForTimeout(500);const c=await gpu(page);assert.ok(delta(b.model,c.model)>.0001);
    await page.close();return {held:delta(a.model,b.model),released:delta(b.model,c.model)};
  });
  await check('leaving browser viewport while hovering link releases pose',async()=>{
    const page=await newPage();await page.waitForTimeout(600);const p=await point(page);await page.mouse.move(p.x,p.y);await page.waitForTimeout(150);
    assert.ok((await gpu(page)).hover.length);await page.mouse.move(-50,-50);await page.waitForTimeout(100);
    const a=await gpu(page);await page.waitForTimeout(1800);const b=await gpu(page);
    const events=await page.evaluate(()=>audit.events);await page.close();
    assert.ok(delta(a.model,b.model)>.0001,`matrix delta ${delta(a.model,b.model)} after trusted pointerleave: ${JSON.stringify(events)}`);
    return {delta:delta(a.model,b.model),events};
  });
  await check('context loss during captured drag releases capture; restores native focus and next drag',async()=>{
    const page=await newPage();await page.mouse.move(610,470);await page.mouse.down();await page.mouse.move(675,500,{steps:6});await page.waitForTimeout(100);
    const before=await page.evaluate(()=>({ids:audit.captures,dragging:document.documentElement.classList.contains('is-dragging')}));assert.ok(before.dragging);
    await page.evaluate(()=>{window.loss=document.querySelector('canvas').getContext('webgl').getExtension('WEBGL_lose_context');loss.loseContext();});
    await page.waitForFunction(()=>document.documentElement.classList.contains('webgl-fallback'));
    assert.equal(await page.evaluate(()=>audit.captures.some(id=>document.querySelector('.scene').hasPointerCapture(id))),false);
    assert.equal(await page.locator('html').evaluate(e=>e.classList.contains('is-dragging')),false);await page.mouse.up();
    await page.locator('#ru .email').focus();await page.keyboard.press('Enter');assert.equal(await page.evaluate(()=>audit.clicks.at(-1).trusted),true);
    await page.evaluate(()=>loss.restoreContext());await page.waitForFunction(()=>document.documentElement.classList.contains('webgl-ready'));await page.waitForTimeout(100);
    assert.equal((await active(page)).href,'mailto:sbmaxx@yandex-team.ru');assert.equal((await gpu(page)).focuses.length,1);
    await page.screenshot({path:'/tmp/ya-card-judge-restored-focus.png'});
    await page.locator('.scene').focus();await page.waitForTimeout(100);const a=await gpu(page);
    await page.mouse.move(600,470);await page.mouse.down();await page.mouse.move(700,530,{steps:8});await page.waitForTimeout(300);await page.mouse.up();const b=await gpu(page);
    assert.ok(delta(a.model,b.model)>.001);await page.close();return{before,afterDragDelta:delta(a.model,b.model)};
  });
  await check('no derivatives shader retains visible focus and no GL error',async()=>{
    const page=await newPage({reducedMotion:'reduce'},{noDerivatives:true});assert.equal(await page.locator('html').evaluate(e=>e.classList.contains('webgl-ready')),true);
    await page.locator('.scene').focus();await page.keyboard.press('Tab');await page.waitForTimeout(100);
    assert.equal((await gpu(page)).focuses.length,1);assert.equal(await page.evaluate(()=>document.querySelector('canvas').getContext('webgl').getError()),0);
    await page.screenshot({path:'/tmp/ya-card-judge-no-derivatives-focus.png'});await page.close();
  });
  await check('native email focused during GPU initialization gets visible cue on first ready frame',async()=>{
    const page=await newPage({reducedMotion:'reduce'},{focusDuringBoot:true});await page.waitForTimeout(100);
    const state=await gpu(page);await page.screenshot({path:'/tmp/ya-card-judge-focus-during-boot.png'});
    assert.equal((await active(page)).href,'mailto:sbmaxx@yandex-team.ru');await page.close();assert.equal(state.focuses.length,1);
  });
  await check('no-GPU RU/EN/history native Tab Enter and real wheel/touch scroll',async()=>{
    const evidence=[];
    for(const noGpu of [true,false]) {
    const page=await newPage({viewport:{width:390,height:450},hasTouch:true,isMobile:true},{noGpu});
    if(!noGpu) {
      await page.evaluate(()=>{window.loss=document.querySelector('canvas').getContext('webgl').getExtension('WEBGL_lose_context');loss.loseContext();});
      await page.waitForFunction(()=>document.documentElement.classList.contains('webgl-fallback'));
    }
    for(const lang of ['ru','en','ru','en']) {
      if(lang!==await page.locator('html').getAttribute('lang')) await page.locator(`[data-lang=${lang}]`).click();
      await page.locator('[data-lang=en]').focus();
      for(let i=0;i<6;i++) { await page.keyboard.press('Tab');assert.equal((await active(page)).lang,lang);await page.keyboard.press('Enter');assert.equal(await page.evaluate(()=>audit.clicks.at(-1).trusted),true); }
    }
    await page.goBack();assert.equal(await page.locator('#ru').isVisible(),true);await page.goForward();assert.equal(await page.locator('#en').isVisible(),true);
    await page.evaluate(()=>scrollTo(0,0));await page.mouse.move(190,200);await page.mouse.wheel(0,240);await page.waitForTimeout(180);const wheel=await page.evaluate(()=>scrollY);assert.ok(wheel>0);
    await page.evaluate(()=>scrollTo(0,0));const cdp=await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:190,y:420,id:1}]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:190,y:150,id:1}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForTimeout(100);
    const touch=await page.evaluate(()=>scrollY);assert.ok(touch>0);
    if(!noGpu) {
      await page.locator('#en .email').focus();await page.evaluate(()=>loss.restoreContext());
      await page.waitForFunction(()=>document.documentElement.classList.contains('webgl-ready'));await page.waitForTimeout(100);
      assert.equal((await active(page)).href,'mailto:sbmaxx@yandex-team.ru');assert.equal((await active(page)).lang,'en');assert.equal((await gpu(page)).focuses.length,1);
      await page.screenshot({path:'/tmp/ya-card-judge-mobile-en-restored-focus.png'});
    }
    evidence.push({mode:noGpu?'noGPU':'contextloss',wheel,touch});await page.close();
    }
    return evidence;
  });
  await check('touch pinch changes zoom and leaves no stuck capture; touch never adds hover underline',async()=>{
    const page=await newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true,reducedMotion:'reduce'});
    const cdp=await page.context().newCDPSession(page),send=(type,touchPoints)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints});
    const a=await gpu(page);
    await send('touchStart',[{x:120,y:200,id:1},{x:240,y:200,id:2}]);
    await send('touchMove',[{x:80,y:200,id:1},{x:280,y:200,id:2}]);await page.waitForTimeout(100);
    const b=await gpu(page);await send('touchEnd',[]);assert.ok(b.model[0]>a.model[0]*1.3);assert.equal(b.hover.length,0);
    assert.equal(await page.evaluate(()=>audit.captures.some(id=>document.querySelector('.scene').hasPointerCapture(id))),false);
    await page.locator('.scene').focus();await page.keyboard.press('Escape');await page.waitForTimeout(100);
    await page.touchscreen.tap(195,170);assert.equal(await page.locator('html').getAttribute('lang'),'en');
    await page.close();return{scaleBefore:a.model[0],scalePinched:b.model[0]};
  });
  await check('no-JS both faces and all links visible',async()=>{
    const page=await newPage({javaScriptEnabled:false});for(const lang of ['ru','en']){assert.equal(await page.locator(`#${lang}`).isVisible(),true);assert.equal(await page.locator(`#${lang} a`).count(),6);}await page.close();
  });
  await check('no page errors or external requests',async()=>{assert.deepEqual(results.errors,[]);assert.deepEqual(results.external,[]);});
}finally {await browser.close();await new Promise(resolve=>server.close(resolve));await writeFile('/tmp/ya-card-judge-results.json',JSON.stringify(results,null,2));}
if(results.checks.some(c=>c.status==='FAIL'))process.exitCode=1;
