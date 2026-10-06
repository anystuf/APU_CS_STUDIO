import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { cert, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'

const credential = JSON.parse(readFileSync(process.env.APU_FIREBASE_ADMIN_FILE, 'utf8'))
if (credential.project_id !== 'apu-studio') throw new Error('Wrong Firebase project')
initializeApp({ credential: cert(credential) })
const auth = getAuth()
const uid = randomUUID()
const email = `apu-ide-test-${uid}@example.com`
await auth.createUser({ uid, email, emailVerified: true })
const browser = (args, input) => execFileSync(process.env.ComSpec, ['/c', 'npx', 'agent-browser', ...args], { input, encoding: 'utf8', timeout: 90000 })
try {
  const token = await auth.createCustomToken(uid)
  browser(['eval', '--stdin'], `(async()=>{const {firebaseAuth}=await import('/src/lib/firebase/client.ts'); const {signInWithCustomToken}=await import('/node_modules/.vite/deps/firebase_auth.js');await signInWithCustomToken(firebaseAuth,${JSON.stringify(token)});return 'Signed in as temporary test student';})()`)
  await new Promise(resolve => setTimeout(resolve, 3000))
  browser(['open', 'http://127.0.0.1:5173/#/python-ide'])
  console.log(browser(['snapshot', '-i']))
  const result = browser(['eval', '--stdin'], `(async()=>{
    const {runPython,stopPython}=await import('/src/lib/pyodide/runner.ts');
    const files=[{name:'main.py',code:'from helpers import greet\\nprint(greet())'},{name:'helpers.py',code:'def greet(): return "MULTIFILE_OK"'}];
    const multi=await runPython(files[0].code,'',files,'main.py');
    const input=await runPython('print(input())','INPUT_OK');
    const pending=runPython('while True: pass'); setTimeout(stopPython,200);const stopped=await pending;
    const after=await runPython('print("AFTER_STOP_OK")');
    const {supabase}=await import('/src/lib/supabase/client.ts');const {data:session}=await supabase.auth.getSession();
    const userId=session.session.user.id;
    const {data:saved,error}=await supabase.rpc('cs_save_ide_project',{project_files:files,selected_file:'main.py',program_input:'abc',expected_revision:0});
    const {error:conflict}=await supabase.rpc('cs_save_ide_project',{project_files:files,selected_file:'main.py',program_input:'abc',expected_revision:0});
    const {data:read}=await supabase.from('cs_ide_projects').select('*').eq('user_id',userId).single();
    const {error:foreign}=await supabase.from('cs_ide_projects').insert({user_id:'d5d350c3-2c47-4789-89d0-917c05775ef3',files,active_file:'main.py'});
    const checks={multi:multi.stdout==='MULTIFILE_OK'&&!multi.stderr,input:input.stdout==='INPUT_OK',stop:stopped.stderr.includes('Stopped by you'),afterStop:after.stdout==='AFTER_STOP_OK',cloud:!error&&saved[0].revision===1&&read.files.length===2,conflict:!!conflict,foreignOwnerDenied:!!foreign};
    return {checks,testEmail:${JSON.stringify(email)},testSupabaseId:userId};
  })()`)
  console.log(result)
  console.log(browser(['eval', '--stdin'], `(async()=>{
    document.querySelector('.workspace-status button').click();
    for(let i=0;i<50;i++){await new Promise(r=>setTimeout(r,100));if(document.querySelector('.workspace-status')?.textContent.includes('Cloud saved'))break;}
    const run=document.querySelector('.dock-run');run.click();
    for(let i=0;i<150;i++){await new Promise(r=>setTimeout(r,100));if(document.querySelector('.run-state')?.textContent.includes('Finished'))break;}
    return {uiRunOutput:document.querySelector('.stdout')?.textContent,files:document.querySelector('.workspace-files h2')?.textContent};
  })()`))
  console.log(browser(['screenshot']))
  browser(['set', 'viewport', '960', '480'])
  console.log(browser(['eval', '--stdin'], `JSON.stringify({runVisible:document.querySelector('.dock-run').getBoundingClientRect().bottom<innerHeight,noHorizontalOverflow:document.documentElement.scrollWidth<=innerWidth,editorHeight:document.querySelector('.editor-pane').getBoundingClientRect().height})`))
  console.log(browser(['screenshot']))
  console.log(browser(['eval', '--stdin'], `document.querySelector('.dock-tabs button:last-child').click(); 'Output selected'`))
  console.log(browser(['screenshot']))
} finally {
  await auth.deleteUser(uid)
  console.log('Temporary Firebase account deleted. Delete only its matching Supabase fixture after inspecting test results.')
}
