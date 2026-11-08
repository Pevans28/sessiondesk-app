/* SessionDesk optional cloud mode. The local-only MVP continues to work before Supabase is configured. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const key = 'sessiondesk_cloud_session_v1';
  const UI = {
    status: $('cloudState'), button: $('accountBtn'), dialog: $('accountDialog'),
    form: $('accountForm'), email: $('accountEmail'), password: $('accountPassword'),
    message: $('accountMessage'), details: $('accountDetails'), import: $('accountImport'),
    signout: $('accountSignout'), checkout: $('accountCheckout'),
    portal: $('accountPortal'), reload: $('accountReload')
  };
  let cfg, session, revision = 0, localBeforeCloud, timer, saving = false, pending = false, blocked = false;
  const cloud = window.sessiondeskCloud = {
    active: false,
    queueSave(data) {
      if (!this.active) return;
      if (blocked) { message('Cloud conflict. Export a backup before reloading.'); return; }
      pending = true;
      clearTimeout(timer);
      timer = setTimeout(flush, 650);
      update();
    }
  };
  const clean = input => ({
    businessName: String(input?.businessName || '').slice(0,100),
    clients: Array.isArray(input?.clients) ? input.clients : [],
    events: Array.isArray(input?.events) ? input.events : []
  });
  const message = value => { UI.message.textContent = value; };
  const update = () => {
    const connected = cloud.active;
    UI.status.textContent = !cfg?.configured ? 'Local mode' : connected
      ? (blocked ? 'Cloud conflict' : saving || pending ? 'Syncing…' : 'Cloud synced')
      : 'Local mode · sign in to sync';
    UI.button.textContent = connected ? '☁ Account' : '☁ Sign in';
    UI.details.hidden = !connected;
    UI.form.hidden = connected;
    UI.import.hidden = !connected || blocked;
    UI.signout.hidden = !connected;
    UI.checkout.hidden = !connected || !cfg?.billingConfigured;
    UI.portal.hidden = !connected || !cfg?.billingConfigured;
    UI.reload.hidden = !connected;
    if (connected) UI.status.title = 'Your cloud records stay in your account. Existing device data has not been imported.';
  };
  async function auth(path, body) {
    const response = await fetch(cfg.supabaseUrl+'/auth/v1/'+path, {
      method:'POST', headers:{apikey:cfg.supabaseAnonKey,'Content-Type':'application/json'},
      body:JSON.stringify(body)
    });
    const json = await response.json();
    if (!response.ok) throw new Error(json.msg || json.error_description || json.message || json.error || 'Account request failed');
    return json;
  }
  async function refresh() {
    if (!session?.refresh_token) throw new Error('Please sign in');
    const result = await auth('token?grant_type=refresh_token',{refresh_token:session.refresh_token});
    session = result;
    sessionStorage.setItem(key,JSON.stringify(session));
  }
  async function api(table,opts={},retry=true) {
    if (!session?.access_token) throw new Error('Please sign in');
    let response = await fetch(cfg.supabaseUrl+'/rest/v1/'+table,{
      ...opts,
      headers:{apikey:cfg.supabaseAnonKey, Authorization:'Bearer '+session.access_token,
        ...opts.headers}
    });
    if (response.status===401 && retry) {
      await refresh();
      return api(table,opts,false);
    }
    if (!response.ok) {
      const data = await response.json().catch(()=>({}));
      throw new Error(data.message || 'Cloud request failed ('+response.status+')');
    }
    if (response.status===204) return null;
    return response.json();
  }
  async function getWorkspace() {
    const userId = session.user.id;
    let list = await api('workspaces?user_id=eq.'+encodeURIComponent(userId)+'&select=data,revision');
    if (!list.length) {
      list = await api('workspaces',{
        method:'POST',headers:{'Content-Type':'application/json',Prefer:'return=representation'},
        body:JSON.stringify({user_id:userId,data:clean(null)})
      });
    }
    if (!list.length) throw new Error('Could not create your cloud workspace. Trial may have expired.');
    return list[0];
  }
  async function activate() {
    const account = await auth('user', {}).catch(()=>null); // Nonessential user probe; session verified by workspace RLS.
    void account;
    const workspace=await getWorkspace();
    localBeforeCloud = window.sessiondeskBridge.read();
    revision=workspace.revision;
    blocked=false;
    pending=false;
    cloud.active=true;
    window.sessiondeskBridge.set(clean(workspace.data));
    await subscriptionStatus();
    update();
  }
  async function subscriptionStatus() {
    const rows = await api('account_subscriptions?user_id=eq.'+encodeURIComponent(session.user.id)+'&select=status,trial_ends_at,current_period_end');
    const record = rows[0];
    if (!record) {message('Account needs setup in Supabase.');return;}
    const trial = new Date(record.trial_ends_at).getTime()>Date.now();
    const paid = ['active','trialing'].includes(record.status) && record.current_period_end && new Date(record.current_period_end).getTime()>Date.now();
    const expiry = trial ? record.trial_ends_at : record.current_period_end;
    message((trial ? 'Free trial' : paid ? 'Paid account' : 'Read-only account') +
      (expiry ? ' · through '+new Date(expiry).toLocaleDateString() : '') +
      '. Your browser-only records are not automatically imported.');
  }
  async function flush() {
    if (!cloud.active || saving || blocked || !pending) return;
    saving=true; pending=false; update();
    const snapshot=clean(window.sessiondeskBridge.read());
    const expected=revision;
    try {
      const rows=await api('workspaces?user_id=eq.'+encodeURIComponent(session.user.id)+'&revision=eq.'+expected,{
        method:'PATCH',headers:{'Content-Type':'application/json',Prefer:'return=representation'},
        body:JSON.stringify({data:snapshot,revision:expected+1,updated_at:new Date().toISOString()})
      });
      if (rows.length!==1) {
        blocked=true; pending=true;
        throw new Error('Cloud data changed on another device. Export a backup and reload cloud data to avoid overwriting changes.');
      }
      revision=rows[0].revision;
    } catch(err) {
      if (!blocked) pending=true;
      message(err.message+' Your changes are still on this screen; download a backup before closing.');
    } finally {
      saving=false; update();
      if (pending && !blocked) timer=setTimeout(flush,2500);
    }
  }
  async function signIn(mode) {
    const email=UI.email.value.trim(),password=UI.password.value;
    if (!email || !password) return message('Enter your email and password.');
    UI.form.querySelectorAll('button').forEach(b=>b.disabled=true);
    try {
      if (mode==='signup') {
        const data=await auth('signup',{email,password});
        if (!data.access_token) { message('Check your email to confirm the account, then sign in.');return;}
        session=data;
      } else {
        session=await auth('token?grant_type=password',{email,password});
      }
      sessionStorage.setItem(key,JSON.stringify(session));
      await activate();
    } catch(err) {message(err.message);} finally {
      UI.form.querySelectorAll('button').forEach(b=>b.disabled=false);
    }
  }
  async function logout() {
    if (pending || saving) {
      message('Cloud changes are still syncing. Try again after sync completes, or export a backup.');
      return;
    }
    cloud.active=false; blocked=false;
    session=null;revision=0;
    sessionStorage.removeItem(key);
    window.sessiondeskBridge.set(localBeforeCloud || clean(null));
    localBeforeCloud=null;
    message('Signed out. Showing your original browser-only records.');
    update();
  }
  async function billing(route) {
    try {
      await flush();
      const res=await fetch('/api/'+route,{method:'POST',
        headers:{Authorization:'Bearer '+session.access_token}});
      const data=await res.json();
      if (!res.ok || !/^https:\/\/billing\.stripe\.com\/|^https:\/\/checkout\.stripe\.com\//.test(data.url||''))
        throw new Error(data.error || 'Billing not available');
      window.location.assign(data.url);
    }catch(err){message(err.message);}
  }
  UI.button.addEventListener('click',()=>UI.dialog.showModal());
  UI.form.addEventListener('submit',e=>{e.preventDefault();signIn('signin');});
  $('accountSignup').addEventListener('click',()=>signIn('signup'));
  UI.signout.addEventListener('click',logout);
  UI.checkout.addEventListener('click',()=>billing('checkout'));
  UI.portal.addEventListener('click',()=>billing('portal'));
  UI.reload.addEventListener('click',async()=>{
    if (!confirm('Reloading replaces unsynced cloud changes on screen. Download a backup first if needed. Continue?')) return;
    try { clearTimeout(timer); pending=false; const workspace=await getWorkspace();revision=workspace.revision;blocked=false;
      window.sessiondeskBridge.set(clean(workspace.data));message('Cloud records reloaded.');update();
    } catch(err){message(err.message);}
  });
  UI.import.addEventListener('click',()=>{
    if (!localBeforeCloud?.clients?.length) return message('No existing local records to import.');
    if (!confirm('Replace your cloud workspace with the '+localBeforeCloud.clients.length+' browser-only client records on this device? Export a cloud backup first.')) return;
    if (blocked) return;
    window.sessiondeskBridge.set(clean(localBeforeCloud));
    cloud.queueSave();
    message('Import queued. Keep this tab open until Cloud synced appears.');
  });
  window.addEventListener('beforeunload',event=>{
    if (!cloud.active || (!pending && !saving)) return;
    event.preventDefault();event.returnValue='';
  });
  (async()=>{
    try {
      const response=await fetch('/api/config',{cache:'no-store'});
      if (!response.ok) throw new Error('Cloud configuration unavailable');
      cfg=await response.json();
      if (!cfg.configured) {UI.button.title='Cloud sign-in is not configured yet';UI.button.disabled=true;
        message('Cloud sign-in will be available after account infrastructure is configured. Local tracking still works.'); update();return;}
      try { session=JSON.parse(sessionStorage.getItem(key)||'null'); } catch { session=null; }
      if (session?.refresh_token) {
        try {await refresh();await activate();} catch(err) {
          sessionStorage.removeItem(key);session=null;
          message('Sign in again to access cloud records: '+err.message);
        }
      }
    } catch(err) {UI.button.disabled=true;message('Cloud is currently offline; local tracking works.');}
    update();
  })();
})();
