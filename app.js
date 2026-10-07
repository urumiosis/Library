const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
let db=null, books=[], people=[], loans=[], activity=[], selectedBook=null, selectedPerson=null, filter="all";
const CFG_KEY="library7_supabase_config";
const defaultConfig={url:"",key:""};

function toast(t){const e=$("#toast");e.textContent=t;e.classList.add("show");setTimeout(()=>e.classList.remove("show"),2200)}
function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function placeholder(text){return "data:image/svg+xml;charset=UTF-8,"+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400"><rect width="100%" height="100%" fill="#eaeef2"/><text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle" fill="#57606a" font-family="Arial" font-size="22">${esc(text).slice(0,20)}</text></svg>`)}

function loadConfig(){try{return {...defaultConfig,...JSON.parse(sessionStorage.getItem(CFG_KEY)||"{}")}}catch{return defaultConfig}}
function saveConfig(c){sessionStorage.setItem(CFG_KEY,JSON.stringify(c))}
async function connect(){
 const c=loadConfig(); if(!c.url||!c.key){$("#connection").textContent="Not connected";return false}
 db=supabase.createClient(c.url,c.key); $("#connection").textContent="Connecting…";
 const {error}=await db.from("books").select("id").limit(1);
 if(error){$("#connection").textContent="Connection error";toast(error.message);return false}
 $("#connection").textContent="Connected"; return true;
}
async function loadAll(){
 if(!db)return;
 const results=await Promise.all([
  db.from("books").select("*").order("created_at",{ascending:true}),
  db.from("people").select("*").order("created_at",{ascending:true}),
  db.from("loans").select("*").order("created_at",{ascending:false}),
  db.from("activity").select("*").order("created_at",{ascending:false}).limit(100)
 ]);
 for(const r of results) if(r.error){toast(r.error.message);return}
 books=results[0].data||[]; people=results[1].data||[]; loans=results[2].data||[]; activity=results[3].data||[];
 render();
}
function currentLoan(bookId){return loans.find(x=>x.book_id===bookId&&!x.returned_at)}
function render(){
 $("#bookCount").textContent=books.length; $("#peopleCount").textContent=people.length;
 $("#availableCount").textContent=books.filter(b=>!currentLoan(b.id)).length;
 $("#loanCount").textContent=books.filter(b=>currentLoan(b.id)).length;
 renderBooks();renderPeople();renderSelection();renderLog();
}
function renderBooks(){
 const list=books.filter(b=>filter==="all"||filter==="available"&&!currentLoan(b.id)||filter==="loaned"&&currentLoan(b.id));
 $("#books").innerHTML=list.length?list.map(b=>{const l=currentLoan(b.id);return `<div class="book ${selectedBook===b.id?"selected":""}" data-id="${b.id}">
 <img src="${b.cover_url||placeholder(b.title)}"><div class="book-title">${esc(b.title)}</div><div class="book-meta">${esc(b.author||"")}</div>
 <span class="badge ${l?"loaned":""}">${l?"ON LOAN":"AVAILABLE"}</span>${l?`<button class="putback" data-return="${b.id}">PUT BACK</button>`:""}</div>`}).join(""):'<div class="empty-state">No books in this view.</div>';
 $$("#books .book").forEach(e=>e.onclick=ev=>{if(ev.target.dataset.return)return;selectedBook=e.dataset.id;render()});
 $$("#books [data-return]").forEach(e=>e.onclick=async ev=>{ev.stopPropagation();await returnBook(e.dataset.return)});
}
function renderPeople(){
 $("#people").innerHTML=people.length?people.map(p=>`<div class="person ${selectedPerson===p.id?"selected":""}" data-id="${p.id}">
 <img src="${p.photo_url||placeholder(p.name)}"><div class="person-name">${esc(p.name)}</div><div class="person-meta">${loans.filter(l=>l.person_id===p.id&&!l.returned_at).length} borrowed</div></div>`).join(""):'<div class="empty-state">No people yet.<br>Use ••• to add someone.</div>';
 $$("#people .person").forEach(e=>e.onclick=()=>{selectedPerson=e.dataset.id;render()});
}
function renderSelection(){
 const b=books.find(x=>x.id===selectedBook),p=people.find(x=>x.id===selectedPerson);
 $("#selectedBook").className="selected-box"+(b?"":" empty");$("#selectedPerson").className="selected-box"+(p?"":" empty");
 $("#selectedBook").innerHTML=b?`<img src="${b.cover_url||placeholder(b.title)}"><div><b>${esc(b.title)}</b><br><small>${esc(b.author||"")}</small></div>`:"No book selected";
 $("#selectedPerson").innerHTML=p?`<img class="avatar" src="${p.photo_url||placeholder(p.name)}"><div><b>${esc(p.name)}</b></div>`:"No person selected";
 const valid=b&&p&&!currentLoan(b.id);$("#loanBtn").disabled=!valid;$("#selectionHint").textContent=valid?"Ready to loan.":"Select an available book and a person.";
}
function renderLog(){
 $("#log").innerHTML=activity.length?activity.map(a=>`<div class="log-row"><span class="log-type ${a.type}">${a.type==="loan"?"LOAN":"RETURN"}</span><span>${esc(a.book_title)}</span><span>${esc(a.person_name)}</span><time>${new Date(a.created_at).toLocaleString()}</time></div>`).join(""):'<div class="empty-state">No activity yet.</div>';
}
async function loan(){
 const b=books.find(x=>x.id===selectedBook),p=people.find(x=>x.id===selectedPerson);if(!b||!p||currentLoan(b.id))return;
 const id=crypto.randomUUID(), now=new Date().toISOString();
 const {error}=await db.from("loans").insert({id,book_id:b.id,person_id:p.id,created_at:now});
 if(error){toast(error.message);return}
 const r=await db.from("activity").insert({type:"loan",book_id:b.id,person_id:p.id,book_title:b.title,person_name:p.name,created_at:now});
 if(r.error){toast(r.error.message);return}
 $("#loanBtn").blur();selectedBook=null;selectedPerson=null;playLoanSound();await loadAll();toast("Book loaned");
}
async function returnBook(bookId){
 const l=currentLoan(bookId);if(!l)return;const b=books.find(x=>x.id===bookId),p=people.find(x=>x.id===l.person_id),now=new Date().toISOString();
 const {error}=await db.from("loans").update({returned_at:now}).eq("id",l.id);if(error){toast(error.message);return}
 const r=await db.from("activity").insert({type:"return",book_id:b.id,person_id:p.id,book_title:b.title,person_name:p.name,created_at:now});
 if(r.error){toast(r.error.message);return}await loadAll();toast("Book returned");
}
function playLoanSound(){new Audio("sounds/loan.wav").play().catch(()=>{})}
function openModal(type){
 $("#modalTitle").textContent=type==="book"?"Add book":"Add person";
 $("#modalForm").innerHTML=type==="book"?`
 <div class="form-row"><label>Title *</label><input name="title" required></div><div class="form-row"><label>Author</label><input name="author"></div>
 <div class="form-row"><label>Description</label><textarea name="description"></textarea></div><div class="form-row"><label>Cover photo</label><input name="photo" type="file" accept="image/*"></div>
 <div class="form-actions"><button type="button" class="secondary" id="cancel">Cancel</button><button class="primary">Add book</button></div>`:
 `<div class="form-row"><label>Name *</label><input name="name" required></div><div class="form-row"><label>Description</label><textarea name="description"></textarea></div>
 <div class="form-row"><label>Photo</label><input name="photo" type="file" accept="image/*"></div><div class="form-actions"><button type="button" class="secondary" id="cancel">Cancel</button><button class="primary">Add person</button></div>`;
 $("#modal").classList.remove("hidden");$("#modalForm").onsubmit=e=>{e.preventDefault();saveEntity(type,new FormData(e.target))};$("#cancel").onclick=closeModal;
}
function closeModal(){$("#modal").classList.add("hidden")}
async function saveEntity(type,fd){
 if(!db){toast("Connect Supabase first");return}
 const file=fd.get("photo");let url=null;
 if(file&&file.size){
  const path=`${type}s/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g,"_")}`;
  const up=await db.storage.from("library-media").upload(path,file,{upsert:false});if(up.error){toast(up.error.message);return}
  url=db.storage.from("library-media").getPublicUrl(path).data.publicUrl;
 }
 let row=type==="book"?{title:fd.get("title"),author:fd.get("author"),description:fd.get("description"),cover_url:url}:{name:fd.get("name"),description:fd.get("description"),photo_url:url};
 const {error}=await db.from(type==="book"?"books":"people").insert(row);if(error){toast(error.message);return}
 closeModal();await loadAll();toast(type==="book"?"Book added":"Person added");
}
function setupModal(){
 $("#modalTitle").textContent="Supabase setup";
 const c=loadConfig();
 $("#modalForm").innerHTML=`<p class="setup-note">Use your Supabase <b>Project URL</b> and <b>Publishable key</b>. Do not use a secret/service-role key in this website. RLS policies should control writes.</p>
 <div class="form-row"><label>Project URL</label><input name="url" value="${esc(c.url)}" placeholder="https://your-project.supabase.co" required></div>
 <div class="form-row"><label>Publishable key</label><input name="key" value="${esc(c.key)}" placeholder="sb_publishable_..." required></div>
 <div class="form-actions"><button type="button" class="secondary" id="cancel">Cancel</button><button class="primary">Connect</button></div>`;
 $("#modal").classList.remove("hidden");$("#cancel").onclick=closeModal;
 $("#modalForm").onsubmit=async e=>{e.preventDefault();saveConfig({url:e.target.url.value.trim(),key:e.target.key.value.trim()});closeModal();if(await connect())await loadAll()};
}
$("#menuBtn").onclick=e=>{$("#menu").classList.toggle("hidden");e.stopPropagation()};
document.onclick=()=>$("#menu").classList.add("hidden");
$("#menu").onclick=e=>{e.stopPropagation();const a=e.target.dataset.action;if(a==="add-book")openModal("book");if(a==="add-person")openModal("person");if(a==="setup")setupModal();$("#menu").classList.add("hidden")};
$("#closeModal").onclick=closeModal;$("#loanBtn").onclick=loan;$("#refreshBtn").onclick=async()=>{await connect();await loadAll()};
$$(".filter").forEach(b=>b.onclick=()=>{$$(".filter").forEach(x=>x.classList.remove("active"));b.classList.add("active");filter=b.dataset.filter;renderBooks()});
(async()=>{if(await connect())await loadAll()})();