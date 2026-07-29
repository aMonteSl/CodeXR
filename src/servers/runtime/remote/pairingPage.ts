import { CODEXR_BRAND_MARK_SVG } from './brandMark';

/**
 * Guest-facing pages served over the Cloudflare tunnel.
 *
 * These are the only CodeXR screens a remote guest sees before joining, so they
 * follow the product site's identity (black canvas, neon-blue accent, glass
 * card). Everything is inlined on purpose: the response CSP is
 * `default-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline'`
 * with no `img-src`, and an unpaired guest is not authorised to fetch any
 * static asset — so external stylesheets, web fonts and `data:` images would
 * all fail. Keep every addition self-contained.
 */

/**
 * Design tokens mirrored from the product site (same names, same values), so
 * the first CodeXR screen a guest ever sees belongs to the same family as the
 * marketing pages: flat slate surfaces, a muted steel-blue accent carrying
 * DARK text, hairline edges and a single soft card shadow. No glass, no neon
 * glow, no gradient text — the previous look predates the site redesign.
 */
const PAGE_STYLES = `
:root{
  --surface:#0e141b;
  --surface-raised:#151d26;
  --surface-sunken:#0a0f15;
  --ink:#e6ebf0;
  --ink-muted:#a3b1bf;
  --ink-faint:#66778a;
  --edge:#26313e;
  --accent:#7ba7cc;
  --accent-strong:#9dbfda;
  --on-accent:#0e141b;
  --shadow-card:0 1px 2px rgb(0 0 0 / .4),0 10px 30px -16px rgb(0 0 0 / .5);
}
*{box-sizing:border-box}
html,body{height:100%}
body{
  margin:0;
  /* The site's hero gradient: raised surface fading into the page surface. */
  background:var(--surface) linear-gradient(var(--surface-raised),var(--surface) 60%) no-repeat;
  color:var(--ink);
  font-family:"Inter Variable",Inter,Poppins,Roboto,system-ui,-apple-system,"Segoe UI",sans-serif;
  font-size:16px;
  line-height:1.6;
  display:grid;
  place-items:center;
  padding:32px 16px;
  -webkit-font-smoothing:antialiased;
}

main{position:relative;width:min(460px,100%)}
.brand{display:flex;align-items:center;gap:10px;justify-content:center;margin-bottom:22px}
.brand-mark{width:28px;height:28px;color:var(--ink);flex:none}
/* "Code-" in ink, "XR" in accent: the site's wordmark, no gradient. */
.wordmark{font-size:1.35rem;font-weight:800;letter-spacing:-.025em;color:var(--ink)}
.wordmark .wordmark-accent{color:var(--accent)}
.card{
  background:var(--surface-raised);
  border:1px solid var(--edge);
  border-radius:12px;
  padding:28px 26px;
  box-shadow:var(--shadow-card);
}
h1{margin:0 0 6px;font-size:1.5rem;font-weight:700;color:var(--ink);letter-spacing:-.025em}
.lede{margin:0 0 22px;color:var(--ink-muted);font-size:.94rem}
.section-label{
  margin:0 0 10px;font-size:.7rem;font-weight:600;letter-spacing:.025em;text-transform:uppercase;
  color:var(--accent);
}

fieldset{border:0;padding:0;margin:0 0 16px}
legend{padding:0}
.choice{
  display:flex;align-items:center;gap:10px;
  padding:11px 13px;margin-bottom:8px;cursor:pointer;
  background:var(--surface-sunken);
  border:1px solid var(--edge);
  border-radius:8px;
  color:var(--ink-muted);font-size:.94rem;
  transition:border-color .15s,background .15s,color .15s;
}
.choice:hover{border-color:var(--accent)}
.choice:has(input:checked){border-color:var(--accent);background:rgb(123 167 204 / .1);color:var(--ink)}
.choice input{width:auto;margin:0;accent-color:var(--accent);flex:none}

label.field{display:block;margin:0 0 6px;font-size:.82rem;font-weight:600;color:var(--ink-muted)}
input[type=text],input:not([type]),#name,#code{
  width:100%;padding:12px 14px;
  background:var(--surface-sunken);
  border:1px solid var(--edge);
  border-radius:8px;
  color:var(--ink);font-size:1rem;font-family:inherit;
  transition:border-color .15s,box-shadow .15s;
}
input::placeholder{color:var(--ink-faint)}
input:focus-visible{outline:none;border-color:var(--accent);box-shadow:0 0 0 3px rgb(123 167 204 / .25)}
input:disabled{opacity:.55;cursor:not-allowed}
#code{
  margin-top:4px;
  text-align:center;
  font-size:1.6rem;font-weight:700;
  letter-spacing:.42em;text-indent:.42em;
  color:var(--ink);
  font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
}
.hint{margin:8px 0 0;color:var(--ink-muted);font-size:.85rem}

button{
  width:100%;min-height:44px;margin-top:16px;padding:12px 24px;
  background:var(--accent);color:var(--on-accent);
  border:0;border-radius:8px;
  font-family:inherit;font-size:1rem;font-weight:600;
  cursor:pointer;
  transition:background .15s,transform .05s;
}
button:hover:not(:disabled){background:var(--accent-strong)}
button:active:not(:disabled){transform:translateY(1px)}
button:focus-visible{outline:2px solid var(--accent-strong);outline-offset:2px}
button:disabled{opacity:.45;cursor:not-allowed}

#status{margin:16px 0 0;min-height:1.2em;font-size:.9rem;color:var(--ink-muted);text-align:center}
#status.error{
  color:#f0a9a9;text-align:left;
  background:rgb(220 120 120 / .1);
  border:1px solid rgb(220 120 120 / .3);
  border-radius:8px;padding:10px 12px;
}
#code,#confirm{display:none}
.footnote{margin:18px 0 0;text-align:center;color:var(--ink-faint);font-size:.78rem}

@media (max-width:480px){
  .card{padding:22px 18px}
  #code{font-size:1.35rem;letter-spacing:.3em;text-indent:.3em}
}
`;

function shell(title: string, body: string, script = ''): string {
    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark">
<title>${title}</title>
<style>${PAGE_STYLES}</style>
</head>
<body>
<main>
<div class="brand">${CODEXR_BRAND_MARK_SVG}<span class="wordmark">Code-<span class="wordmark-accent">XR</span></span></div>
${body}
</main>
${script ? `<script>${script}</script>` : ''}
</body></html>`;
}

/**
 * The two-step pairing page: pick an identity, request access, then enter the
 * six-digit code the host reads out.
 */
export function renderPairingPage(invitationToken: string): string {
    const tokenLiteral = JSON.stringify(invitationToken);

    const body = `<div class="card">
<h1>Join the XR session</h1>
<p class="lede">Connect to a CodeXR workspace shared across networks.</p>
<section id="identity-step">
<p class="section-label">Step 1 · How you appear</p>
<fieldset>
<label class="choice"><input type="radio" name="identity" value="anonymous" checked> Continue as anonymous</label>
<label class="choice"><input type="radio" name="identity" value="custom"> Use a custom name</label>
</fieldset>
<label class="field" for="name">Display name</label>
<input id="name" maxlength="32" disabled>
<p id="identity-hint" class="hint">CodeXR reserved this anonymous alias for you.</p>
<p class="hint">Then ask the host for the temporary six-digit code.</p>
</section>
<button id="request">Request access</button>
<input id="code" inputmode="numeric" maxlength="6" placeholder="000000" disabled>
<button id="confirm" disabled>Connect</button>
<p id="status" aria-live="polite"></p>
</div>
<p class="footnote">Temporary link · the host can revoke it at any time</p>`;

    const script = `
const invitationToken=${tokenLiteral};let requestId='',identityToken='',anonymousAlias='';
const status=document.querySelector('#status'),code=document.querySelector('#code'),confirmButton=document.querySelector('#confirm'),nameInput=document.querySelector('#name'),requestButton=document.querySelector('#request');
function selectedMode(){return document.querySelector('input[name="identity"]:checked').value}
function updateIdentityMode(){const custom=selectedMode()==='custom';nameInput.disabled=!custom;nameInput.value=custom?'':anonymousAlias;document.querySelector('#identity-hint').textContent=custom?'Use between 2 and 32 characters.':'CodeXR reserved this anonymous alias for you.'}
document.querySelectorAll('input[name="identity"]').forEach(input=>input.onchange=updateIdentityMode);
async function prepareIdentity(){requestButton.disabled=true;status.textContent='Preparing identity...';try{const response=await fetch('/api/remote/identity',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({invitationToken})});if(!response.ok)throw new Error();const data=await response.json();identityToken=data.identityToken;anonymousAlias=data.anonymousAlias;nameInput.value=anonymousAlias;requestButton.disabled=false;status.textContent='';}catch{status.className='error';status.textContent='This invitation is not valid or is no longer available.'}}
document.querySelector('#request').onclick=async()=>{status.textContent='Requesting access...';try{
const mode=selectedMode(),customName=mode==='custom'?nameInput.value:'';
const response=await fetch('/api/remote/pair/request',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({invitationToken,clientKind:'browser',identityToken,identityMode:mode,customName})});
if(!response.ok)throw new Error();const data=await response.json();requestId=data.requestId;code.disabled=false;confirmButton.disabled=false;status.textContent='Request sent.';
}catch{status.className='error';status.textContent='Check the name or ask for a new invitation.'}};
const submitIdentity=requestButton.onclick;requestButton.onclick=async()=>{await submitIdentity();if(requestId){document.querySelector('#identity-step').style.display='none';requestButton.style.display='none';code.style.display='block';confirmButton.style.display='block';status.className='';status.textContent='Request sent. Enter the code the host gives you.';code.focus();}else{status.className='error';status.textContent='Check the name or ask for a new invitation.'}};
confirmButton.onclick=async()=>{status.className='';status.textContent='Verifying...';try{
const response=await fetch('/api/remote/pair/confirm',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({requestId,code:code.value})});
const data=await response.json().catch(()=>({}));
if(!response.ok)throw new Error(data.message||'The code is not valid.');
location.replace(data.browserUrl);
}catch(error){status.className='error';status.textContent=error.message||'The code is not valid.';code.value='';code.focus();}};
prepareIdentity();
`;

    return shell('Join CodeXR', body, script);
}

/**
 * Shown instead of raw JSON when a guest opens an invitation link that is
 * expired, already consumed, or malformed.
 */
export function renderInvitationErrorPage(title: string, message: string): string {
    const body = `<div class="card">
<h1>${escapeHtml(title)}</h1>
<p class="lede">${escapeHtml(message)}</p>
</div>
<p class="footnote">Invitation links are temporary by design</p>`;

    return shell('CodeXR · invitation unavailable', body);
}

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
