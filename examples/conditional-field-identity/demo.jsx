import React, {useLayoutEffect, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {useForm} from 'react-hook-form';

function RegistrationForm({saved, onSave, useKeys}) {
  const {register, watch, handleSubmit} = useForm({defaultValues:saved, mode:'onChange'});
  const values = watch();
  const host = useRef(null), previous = useRef(null);
  const [identity, setIdentity] = useState(null);
  useLayoutEffect(() => {
    const input = host.current.querySelector('[data-registration-field]');
    if (input && previous.current && input.name !== previous.current.name) {
      setIdentity({from:previous.current.name, to:input.name, sameDOMNode:input===previous.current.node});
    }
    previous.current = input ? {name:input.name,node:input} : null;
  });
  return <form ref={host} onSubmit={handleSubmit(onSave)}>
    <label>State<select {...register('issueState')}><option value="">Select a state</option><option>NSW</option><option>QLD</option></select></label>
    <label>Name<input defaultValue="name" {...register('name')} /></label>
    {values.issueState && <div>{values.issueState === 'NSW' ?
      <div><label>Registration number<input key={useKeys ? "number" : undefined} data-registration-field defaultValue="_default_number" {...register('number')} /></label></div> :
      <div><label>Registration date<input key={useKeys ? "date" : undefined} data-registration-field defaultValue="_default_date" {...register('date')} /></label></div>
    }</div>}
    <button type="submit">Continue</button>
    <h2>Current form values</h2><pre id="values">{JSON.stringify(values,null,2)}</pre>
    <h2>Last field switch</h2><pre id="identity">{JSON.stringify(identity,null,2)}</pre>
  </form>;
}
function Example({useKeys}) {
  const [saved,setSaved]=useState(), [page,setPage]=useState('form'),[submissions,setSubmissions]=useState(0);
  return <>
    {page==='form' ? <RegistrationForm saved={saved} useKeys={useKeys} onSave={v=>{setSaved(v);setSubmissions(n=>n+1);setPage('saved');}}/> : <><p>Saved. Go back to edit again.</p><button onClick={()=>setPage('form')}>Go back</button></>}
    <h2>Submitted data</h2><pre id="submitted">{JSON.stringify({submissions,values:saved??null},null,2)}</pre>
  </>;
}
function App() {
  const [useKeys,setUseKeys]=useState(true),[revision,setRevision]=useState(0);
  return <main><h1>Keep conditional fields separate</h1><p>Choose NSW, enter 111, Continue, Go back, then choose QLD. The date should start as _default_date.</p>
    <label><input type="checkbox" checked={useKeys} onChange={e=>setUseKeys(e.target.checked)}/>Use distinct field keys</label>
    <button onClick={()=>setRevision(n=>n+1)}>Reset example</button>
    <p>Changing this comparison or resetting starts a fresh form and submission history.</p>
    <Example key={`${useKeys}-${revision}`} useKeys={useKeys}/>
  </main>;
}
createRoot(document.getElementById('root')).render(<App/>);
