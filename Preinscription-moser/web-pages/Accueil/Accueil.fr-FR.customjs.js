(function(){
  const ctx = window.__ctx || {};
  const state = { step: null, children: [] };

  async function loadContext(){
    if(!ctx.accountId && ctx.parent1Id){
      try{
        const r = await fetch(`/_api/contacts(${ctx.parent1Id})?$select=_parentcustomerid_value,emailaddress1`,{
          headers:{'Accept':'application/json'}
        });
        if(r.ok){
          const j = await r.json();
          ctx.accountId = j["_parentcustomerid_value"] || null;
          ctx.parent1Email = j["emailaddress1"] || null;
        }
      }catch(e){ console.error('[Pré-inscription] Contexte', e); }
    }
  }

  function hideAll(){
    document.querySelectorAll('section[id^="step-"]').forEach(s=>s.classList.add('hidden'));
  }

  function goToStep(name){
    hideAll();
    document.getElementById(`step-${name}`)?.classList.remove('hidden');
    state.step = name;
  }

  async function submitStep(name){
    switch(name){
      case 'eleve':
        await submitEleve();
        goToStep('parent1');
        break;
      case 'parent1':
        await submitParent1();
        goToStep('children');
        break;
      case 'child':
        const again = await submitCurrentChild();
        if(again){
          addChildForm();
          goToStep('children');
        }else{
          await decideParent2();
        }
        break;
      case 'parent2':
        await submitParent2();
        goToStep('validation');
        break;
      case 'validation':
        await finalize();
        break;
    }
  }

  // Helpers API
  async function createContact(data){
    return fetch('/_api/contacts',{
      method:'POST',
      headers:{'Content-Type':'application/json','Accept':'application/json'},
      body: JSON.stringify(data)
    });
  }
  async function updateContact(id,data){
    return fetch(`/_api/contacts(${id})`,{
      method:'PATCH',
      headers:{'Content-Type':'application/json','Accept':'application/json'},
      body: JSON.stringify(data)
    });
  }
  async function createOpportunity(data){
    return fetch('/_api/opportunities',{
      method:'POST',
      headers:{'Content-Type':'application/json','Accept':'application/json'},
      body: JSON.stringify(data)
    });
  }

  // Step implementations
  async function submitEleve(){
    const form = document.querySelector('#step-eleve form');
    if(!form) return;
    const data = Object.fromEntries(new FormData(form).entries());
    if(ctx.accountId){
      data['parentaccountid@odata.bind'] = `/accounts(${ctx.accountId})`;
    }
    await createOpportunity(data);
  }

  async function submitParent1(){
    const form = document.querySelector('#step-parent1 form');
    if(!form) return;
    const data = Object.fromEntries(new FormData(form).entries());
    await updateContact(ctx.parent1Id,data);
  }

  async function submitCurrentChild(){
    const forms = document.querySelectorAll('#children-container form');
    const form = forms[forms.length-1];
    if(!form) return false;
    const data = Object.fromEntries(new FormData(form).entries());
    if(ctx.accountId){
      data['parentcustomerid@odata.bind'] = `/accounts(${ctx.accountId})`;
    }
    await createContact(data);
    state.children.push(data);
    return window.confirm('Ajouter un autre enfant ?');
  }

  function addChildForm(){
    const tpl = document.getElementById('child-form-template');
    const container = document.getElementById('children-container');
    if(!tpl || !container) return;
    const node = tpl.content ? tpl.content.cloneNode(true) : tpl.cloneNode(true);
    container.appendChild(node);
    const btn = container.querySelector('form:last-child .submit-child');
    if(btn){
      btn.addEventListener('click',()=>submitStep('child'));
    }
  }

  async function decideParent2(){
    const email1 = (ctx.parent1Email || '').replace(/'/g,"''");
    const filter = `new_typedecontact eq ${ctx.parentTypeValue} and _parentcustomerid_value eq ${ctx.accountId}` + (email1 ? ` and emailaddress1 ne '${email1}'` : '');
    const url = '/_api/contacts?$select=contactid,firstname,lastname,emailaddress1&$top=1&$filter=' + encodeURIComponent(filter);
    let contact=null;
    try{
      const r=await fetch(url,{headers:{'Accept':'application/json'}});
      if(r.ok){
        const j=await r.json();
        if(Array.isArray(j.value) && j.value.length){
          contact=j.value[0];
        }
      }
    }catch(e){ console.error('[Pré-inscription] Parent2',e); }
    prefillParent2(contact);
    goToStep('parent2');
  }

  function prefillParent2(contact){
    const form=document.querySelector('#step-parent2 form');
    if(!form) return;
    if(contact){
      form.dataset.contactid=contact.contactid;
      form.querySelector('[name="firstname"]')?.setAttribute('value',contact.firstname||'');
      form.querySelector('[name="lastname"]')?.setAttribute('value',contact.lastname||'');
      form.querySelector('[name="emailaddress1"]')?.setAttribute('value',contact.emailaddress1||'');
    }else{
      form.dataset.contactid='';
      form.querySelector('[name="parentcustomerid"]')?.setAttribute('value',ctx.accountId||'');
    }
  }

  async function submitParent2(){
    const form=document.querySelector('#step-parent2 form');
    if(!form) return;
    const data=Object.fromEntries(new FormData(form).entries());
    const id=form.dataset.contactid;
    if(id){
      await updateContact(id,data);
    }else{
      if(ctx.accountId){
        data['parentcustomerid@odata.bind']=`/accounts(${ctx.accountId})`;
      }
      await createContact(data);
    }
  }

  async function finalize(){
    try{
      await fetch('/_api/opportunities',{method:'GET'});
    }finally{
      location.href='/confirmation';
    }
  }

  window.goToStep=goToStep;
  window.submitStep=submitStep;

  document.getElementById('add-child')?.addEventListener('click',addChildForm);

  loadContext().then(()=>{
    addChildForm();
    goToStep('eleve');
  });
})();

