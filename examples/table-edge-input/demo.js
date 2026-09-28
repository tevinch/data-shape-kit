import {registerTableEdgeInput} from './table-edge-input.js';
import {fixture,edgeRange,runChecks} from './checks.js';

let editor, dispose, enabled=true, readonly=false, counts={beforeinput:0,input:0};
const state=document.querySelector('#state');
const results=document.querySelector('#results');
function show() {
  if(!editor?.initialized) return;
  const r=editor.selection.getRng();
  state.textContent=JSON.stringify({version:`${tinymce.majorVersion}.${tinymce.minorVersion}`,mode:document.querySelector('#mode').value,guard:enabled,readonly,events:counts,selection:{start:r.startContainer.nodeName,startOffset:r.startOffset,end:r.endContainer.nodeName,endOffset:r.endOffset},cells:Array.from(editor.getBody().querySelectorAll('td,th'),c=>c.textContent),html:editor.getContent()},null,2);
}
function reset(){editor.mode.set('design');readonly=false;document.querySelector('#readonly').textContent='Read only: off';editor.setContent(fixture());editor.undoManager.clear();editor.undoManager.add();counts={beforeinput:0,input:0};show();}
async function mount(){
  dispose?.();editor?.remove();
  const inline=document.querySelector('#mode').value==='inline';
  document.querySelector('#host').innerHTML=inline?'<div id="inline"></div>':'<textarea id="editor"></textarea>';
  [editor]=await tinymce.init({selector:inline?'#inline':'#editor',inline,license_key:'gpl',plugins:'table',toolbar:'undo redo | table',promotion:false,height:280,setup(ed){ed.on('beforeinput input',e=>{counts[e.type]++;setTimeout(show,0);});ed.on('mouseup keyup Undo Redo',()=>setTimeout(show,0));}});
  if(enabled)dispose=registerTableEdgeInput(editor);
  reset();
}
document.querySelector('#mode').onchange=mount;
document.querySelector('#reset').onclick=reset;
document.querySelector('#prepare').onclick=()=>{edgeRange(editor);show();};
document.querySelector('#guard').onclick=e=>{enabled=!enabled;dispose?.();if(enabled)dispose=registerTableEdgeInput(editor);e.target.textContent=`Guard: ${enabled?'on':'off'}`;show();};
document.querySelector('#readonly').onclick=e=>{readonly=!readonly;editor.mode.set(readonly?'readonly':'design');e.target.textContent=`Read only: ${readonly?'on':'off'}`;show();};
document.querySelector('#checks').onclick=async e=>{
  const controls=[...document.querySelectorAll('button,select')];controls.forEach(c=>c.disabled=true);
  dispose?.();
  try{const evidence=await runChecks(editor,r=>results.textContent=JSON.stringify(r,null,2));results.textContent=JSON.stringify({environment:{tinyMCE:'8.9.2',userAgent:navigator.userAgent,mode:document.querySelector('#mode').value},...evidence},null,2);}
  finally{if(enabled)dispose=registerTableEdgeInput(editor);controls.forEach(c=>c.disabled=false);reset();}
};
await mount();
