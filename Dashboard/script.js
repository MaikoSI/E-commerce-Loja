/* ============ CONEXÃO COM O E-COMMERCE ============
   Modo demonstração (API_URL vazio): os dados ficam no navegador e são
   COMPARTILHADOS com a Loja (../Compartilhado/dados.js). Produtos cadastrados
   aqui aparecem na loja; contas criadas e pedidos feitos na loja aparecem aqui.
   Para ligar num servidor de verdade, preencha API_URL e ajuste as rotas abaixo. */
const CONFIG = {
  API_URL: '',                       // ex.: 'https://sualoja.com.br/api'
  ROTAS: { login: '/auth/login', produtos: '/produtos', clientes: '/clientes', pedidos: '/pedidos', vendasSemana: '/vendas/semana', metaMensal: '/vendas/meta' },
  HEADERS: { 'Content-Type': 'application/json' } // adicione Authorization se precisar
};
const DADOS = window.IWNZ_DADOS; // definido em ../Compartilhado/dados.js
const Store = {
  demo: !CONFIG.API_URL,
  async req(path, opts){
    const tk = Auth.get()?.token, headers = {...CONFIG.HEADERS, ...(tk ? {Authorization:'Bearer '+tk} : {})};
    const r = await fetch(CONFIG.API_URL + path, {headers, ...opts});
    if(r.status===401){ Auth.limpar(); mostrarLogin(); throw new Error('Sessão expirada') }
    if(!r.ok) throw new Error(r.status);
    return r.json();
  },
  gravarLocal(l){ DADOS.gravar(DADOS.CHAVES.produtos, l) },
  async listar(){
    if(!this.demo) return this.req(CONFIG.ROTAS.produtos);
    return DADOS.produtos(); // na primeira vez grava o catálogo inicial da loja
  },
  async salvar(p){
    if(!this.demo) return this.req(CONFIG.ROTAS.produtos + (p.id?'/'+p.id:''), {method:p.id?'PUT':'POST', body:JSON.stringify(p)});
    const l = await this.listar();
    const i = p.id ? l.findIndex(x=>String(x.id)===p.id) : -1;
    // Mescla para não perder campos que o formulário não edita (nota, avaliações…)
    if(i>=0){ p = {...l[i], ...p}; l[i]=p } else { p.id = String(Date.now()); l.push(p) }
    this.gravarLocal(l); return p;
  },
  async excluir(id){
    if(!this.demo) return this.req(CONFIG.ROTAS.produtos+'/'+id,{method:'DELETE'});
    this.gravarLocal((await this.listar()).filter(x=>String(x.id)!==id));
  },
  async listarClientes(){
    if(!this.demo) return this.req(CONFIG.ROTAS.clientes);
    return DADOS.clientes();
  },
  async salvarCliente(c){
    if(!this.demo) return this.req(CONFIG.ROTAS.clientes + (c.id?'/'+c.id:''), {method:c.id?'PUT':'POST', body:JSON.stringify(c)});
    const l = await this.listarClientes();
    // Não deixa dois clientes com o mesmo e-mail
    if(l.some(x=>x.id!==c.id && String(x.email).toLowerCase()===c.email)) throw new Error('duplicado');
    const i = c.id ? l.findIndex(x=>x.id===c.id) : -1;
    if(i>=0){ c = {...l[i], ...c}; l[i]=c } else { c.id = 'c'+Date.now(); c.criadoEm = new Date().toISOString(); c.origem = 'painel'; l.push(c) }
    DADOS.gravar(DADOS.CHAVES.clientes, l); return c;
  },
  async excluirCliente(id){
    if(!this.demo) return this.req(CONFIG.ROTAS.clientes+'/'+id,{method:'DELETE'});
    DADOS.gravar(DADOS.CHAVES.clientes, (await this.listarClientes()).filter(x=>x.id!==id));
  },
  async listarPedidos(){
    if(!this.demo) return this.req(CONFIG.ROTAS.pedidos);
    return DADOS.pedidos();
  },
  // valores: porcentagem relativa por dia (dom–sáb) da semana atual; reais: total vendido em cada dia
  async vendasSemana(){
    if(!this.demo) return this.req(CONFIG.ROTAS.vendasSemana);
    const pedidos = DADOS.pedidos(), hoje = new Date();
    const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - hoje.getDay());
    const reais = [0,0,0,0,0,0,0];
    let mes = 0, qtdMes = 0, pagos = 0, pendentes = 0, cancelados = 0, valorPago = 0, valorPendente = 0;
    pedidos.forEach(p=>{
      const d = new Date(p.data), total = Number(p.total)||0;
      if(isNaN(d)) return;
      const dia = Math.floor((new Date(d.getFullYear(), d.getMonth(), d.getDate()) - inicio) / 864e5);
      if(dia>=0 && dia<7 && p.status!=='cancelado') reais[dia] += total;
      if(d.getFullYear()===hoje.getFullYear() && d.getMonth()===hoje.getMonth()){
        if(p.status==='cancelado'){ cancelados++; return }
        if(p.status==='pendente'){ pendentes++; valorPendente += total } else { pagos++; valorPago += total }
        mes += total; qtdMes++;
      }
    });
    const max = Math.max(...reais), n = pagos+pendentes+cancelados, pct = x => n ? Math.round(x/n*100) : 0;
    return {
      valores: reais.map(v => max ? Math.round(v/max*100) : 0),
      reais,
      meta: {pct: Math.min(100, Math.round(mes/DADOS.META_MENSAL*100)), valor: mes, valorPago, valorPendente, pago: pct(pagos), pendente: pct(pendentes), cancelado: pct(cancelados)},
      ticket: qtdMes ? mes/qtdMes : 0
    };
  }
};

/* ============ LOGIN DO ADMINISTRADOR ============
   Modo demonstração: usuário fixo abaixo, SÓ para testar o visual (a senha fica visível no código).
   Com API_URL preenchido, o login vai para POST CONFIG.ROTAS.login com {email, senha}
   e espera a resposta {token, nome}. A verificação de verdade precisa acontecer no servidor da loja. */
const Auth = {
  DEMO: {email:'admin@admin.com', senha:'adminadmin'},
  get(){ try{ return JSON.parse(sessionStorage.getItem('loja:sessao')) }catch(e){ return null } },
  set(s){ try{ sessionStorage.setItem('loja:sessao', JSON.stringify(s)) }catch(e){} },
  limpar(){ try{ sessionStorage.removeItem('loja:sessao') }catch(e){} },
  async entrar(email, senha){
    let s;
    if(Store.demo){
      if(email.toLowerCase()!==this.DEMO.email || senha!==this.DEMO.senha) throw new Error('credenciais');
      s = {nome:'Administrador', email, token:null};
    } else {
      const r = await fetch(CONFIG.API_URL + CONFIG.ROTAS.login, {method:'POST', headers:CONFIG.HEADERS, body:JSON.stringify({email, senha})});
      if(!r.ok) throw new Error(r.status===401||r.status===403 ? 'credenciais' : 'rede');
      const d = await r.json();
      s = {nome:d.nome||'Administrador', email, token:d.token};
    }
    this.set(s); return s;
  }
};

/* ============ INTERFACE ============ */
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const brl = v => Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const esc = s => String(s??'').replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
let produtos = [], clientes = [], pedidos = [], aba = 'produtos', semanaOffset = 0;
const TITULOS = {dashboard:'Minha Loja', cadastrar:'Cadastrar', listar:'Listar'};

function toast(m){ const t=$('#toast'); t.textContent=m; t.classList.add('show'); clearTimeout(toast.t); toast.t=setTimeout(()=>t.classList.remove('show'),2200) }

function go(v){
  if(!TITULOS[v]) v='dashboard';
  ['dashboard','cadastrar','listar'].forEach(n=>$('#v-'+n).hidden = n!==v);
  $$('.dock button').forEach(b=> b.dataset.go===v ? b.setAttribute('aria-current','page') : b.removeAttribute('aria-current'));
  $('#title').textContent = TITULOS[v];
  if(location.hash !== '#'+v) history.replaceState(null,'','#'+v);
  setAba(aba);
  if(v==='dashboard') renderDash();
  if(v==='listar'){ renderLista(); renderClientes(); renderPedidos(); }
}
// Entrar em "Cadastrar" pelo menu sempre começa um cadastro novo (sai do modo edição)
function navegar(v){ if(v==='cadastrar'){ limpar(); limparC() } go(v) }
$$('.dock button').forEach(b=>b.onclick=()=>navegar(b.dataset.go));
window.addEventListener('hashchange',()=>{ if(Auth.get()) navegar(location.hash.slice(1)) });

const IC = {
  box:'<path d="M21 8l-9-5-9 5 9 5 9-5zM3 8v8l9 5 9-5V8M12 13v8"/>',
  stock:'<path d="M3 7h18M5 7l1 13h12l1-13M9 7V4h6v3"/>',
  money:'<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/>',
  user:'<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/>'
};
const ring = (p) => `<svg class="ring" viewBox="0 0 26 26"><circle cx="13" cy="13" r="10" fill="none" stroke="rgba(255,255,255,.2)" stroke-width="3"/><circle cx="13" cy="13" r="10" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-dasharray="${(p/100*62.8).toFixed(1)} 62.8" transform="rotate(-90 13 13)"/></svg>`;
const check = '<svg class="ring" viewBox="0 0 26 26" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 13.5l4.5 4.5L20 8"/></svg>';

async function renderDash(){
  const v = await Store.vendasSemana().catch(()=>null) || {valores:[0,0,0,0,0,0,0],meta:{pct:0,valor:0,pago:0,pendente:0,cancelado:0},ticket:0};
  const dias = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'], max = Math.max(...v.valores);
  // Dia sem venda fica com a barra vazia (sem altura mínima nem rótulo "0%")
  $('#bars').innerHTML = v.valores.map((p,i)=>`<div class="bar ${max>0&&p===max?'top':''}" title="${dias[i]}: ${v.reais?brl(v.reais[i]):p+'%'}"><div class="track"><div class="fill" style="height:${p>0?Math.max(p,12):0}%">${p>0?p+'%':''}</div></div>${dias[i]}</div>`).join('');

  const total = produtos.length, un = produtos.reduce((s,p)=>s+Number(p.estoque),0), val = produtos.reduce((s,p)=>s+p.preco*p.estoque,0);
  $('#stats').innerHTML = [[IC.box,total,'Produtos'],[IC.stock,un+' un.','Em estoque'],[IC.money,brl(val),'Valor em estoque'],[IC.user,clientes.length,'Clientes']]
    .map(([ic,b,s])=>`<div class="stat"><div class="ic"><svg class="i" viewBox="0 0 24 24">${ic}</svg></div><div><b>${b}</b><small>${s}</small></div></div>`).join('');

  const m = v.meta, C = 2*Math.PI*48;
  $('#goalPct').textContent = m.pct+'%'; $('#goalVal').textContent = brl(m.valor) + (Store.demo ? ' de '+brl(DADOS.META_MENSAL) : '');
  // O arco mostra o quanto da meta já foi atingido, dividido entre pago (amarelo) e pendente (roxo).
  // Sem os valores em reais (API), divide pela proporção de pedidos.
  const B=$('#arcB'), A=$('#arcA'), gap=6;
  const vPago = m.valorPago ?? m.valor*(m.pago/Math.max(m.pago+m.pendente,1));
  const vPend = m.valorPendente ?? m.valor*(m.pendente/Math.max(m.pago+m.pendente,1));
  const ref = Store.demo ? DADOS.META_MENSAL : (m.pct>0 ? m.valor/(m.pct/100) : 1);
  const segB = Math.min(vPago/ref,1)*C, segA = Math.min(vPend/ref, 1 - vPago/ref)*C;
  B.style.display = segB>0 ? '' : 'none'; A.style.display = segA>0 ? '' : 'none';
  B.style.strokeDasharray = `${Math.max(segB-gap,1)} ${C}`; B.style.strokeDashoffset = 0;
  A.style.strokeDasharray = `${Math.max(segA-gap,1)} ${C}`; A.style.strokeDashoffset = -segB;
  $('#legend').innerHTML = [['#f2c500','Pago',m.pago],['#a78bfa','Pendente',m.pendente],['#c0b4d9','Cancelado',m.cancelado]]
    .map(([c,n,x])=>`<div><span><i style="background:${c}"></i>${n}</span><b>${x}%</b></div>`).join('');

  const baixo = produtos.filter(p=>p.estoque<5).length, ok = produtos.filter(p=>p.estoque>=5).length;
  const metas = [['Cadastrar 20 produtos',total,20,'produtos'],['Produtos com estoque saudável',ok,Math.max(total,1),'itens'],['Repor itens com estoque baixo',total-baixo,Math.max(total,1),'repostos']];
  $('#goals').innerHTML = metas.map(([t,a,b,u])=>{const f=a>=b; return `<div class="row">${f?check:ring(Math.min(a/b*100,100))}<span class="t">${t}</span><span class="n">${a}/${b} ${u}</span><span class="chip ${f?'ok':'on'}">${f?'Concluída':'Em andamento'}</span></div>`}).join('');

  $('#ticket').textContent = brl(v.ticket);
  // Selo só aparece quando há vendas no mês
  const selo = $('#ticketSelo');
  selo.hidden = !(v.ticket > 0);
  selo.textContent = v.ticket >= 500 ? 'ótimo!' : 'no mês';
  renderCal();
}

function renderCal(){
  const hoje = new Date(), base = new Date(hoje); base.setDate(hoje.getDate() - hoje.getDay() + semanaOffset*7);
  const meses=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  $('#calTitle').textContent = meses[base.getMonth()]+' '+base.getFullYear();
  const dias=['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
  $('#days').innerHTML = dias.map((d,i)=>{const x=new Date(base); x.setDate(base.getDate()+i); const t = x.toDateString()===hoje.toDateString(); return `<div class="${t?'today':''}">${d}<b>${x.getDate()}</b></div>`}).join('');
}
$('#prevW').onclick=()=>{semanaOffset--;renderCal()}; $('#nextW').onclick=()=>{semanaOffset++;renderCal()};

function renderLista(){
  const q = $('#q').value.trim().toLowerCase();
  const l = produtos.filter(p=>[p.nome,p.sku,p.categoria].join(' ').toLowerCase().includes(q));
  $('#empty').hidden = l.length>0;
  $('#rows').innerHTML = l.map(p=>`<tr><td>${p.imagem?`<img class="thumb" src="${esc(p.imagem)}" alt="" loading="lazy">`:''}${esc(p.nome)}${p.destaque?'<span class="tag">destaque</span>':''}<br><small style="color:var(--mut)">${esc(p.sku)}</small></td><td>${esc(p.categoria)}</td><td class="r">${brl(p.preco)}</td><td class="r ${p.estoque<5?'low':''}">${p.estoque}${p.estoque<=0?' · esgotado':p.estoque<5?' · baixo':''}</td><td class="r"><button class="iconbtn" data-edit="${esc(p.id)}" aria-label="Editar ${esc(p.nome)}"><svg class="i" viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16v4z"/></svg></button> <button class="iconbtn" data-del="${esc(p.id)}" aria-label="Excluir ${esc(p.nome)}"><svg class="i" viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg></button></td></tr>`).join('');
}
$('#q').oninput = renderLista;
$('#rows').onclick = async e=>{
  const ed=e.target.closest('[data-edit]'), de=e.target.closest('[data-del]');
  if(ed){ const p=produtos.find(x=>String(x.id)===ed.dataset.edit); $('#f-id').value=p.id; $('#f-nome').value=p.nome; $('#f-sku').value=p.sku||''; preencherCategorias(p.categoria); $('#f-preco').value=p.preco; $('#f-preco-antigo').value=p.precoAntigo||''; $('#f-estoque').value=p.estoque; $('#f-destaque').checked=!!p.destaque; $('#f-imagem').value=p.imagem||''; $('#f-desc').value=p.descricao||''; $('#formTitle').textContent='Editar produto'; aba='produtos'; go('cadastrar') }
  if(de && confirm('Excluir este produto?')){ try{ await Store.excluir(de.dataset.del); produtos=await Store.listar(); renderLista(); toast('Produto excluído') }catch(err){ toast('Não foi possível excluir. Tente de novo.') } }
};

function limpar(){ $('#form').reset(); $('#f-id').value=''; preencherCategorias(); $('#formTitle').textContent='Novo produto' }

// Categorias iguais às da loja (mantém uma categoria antiga se o produto já tiver)
function preencherCategorias(atual){
  const cats = [...DADOS.CATEGORIAS];
  if(atual && !cats.includes(atual)) cats.push(atual);
  $('#f-cat').innerHTML = cats.map(c=>`<option>${esc(c)}</option>`).join('');
  if(atual) $('#f-cat').value = atual;
}
preencherCategorias();
$('#cancel').onclick = limpar;
$('#form').onsubmit = async e=>{
  e.preventDefault();
  const nome=$('#f-nome').value.trim(), preco=parseFloat($('#f-preco').value), est=parseInt($('#f-estoque').value,10);
  if(!nome || isNaN(preco) || isNaN(est) || preco<0 || est<0){ toast('Preencha nome, preço e estoque'); return }
  const antigo = parseFloat($('#f-preco-antigo').value);
  if(!isNaN(antigo) && antigo>0 && antigo<=preco){ toast('O preço antigo precisa ser maior que o preço atual'); return }
  const p = {id:$('#f-id').value||undefined, nome, sku:$('#f-sku').value.trim(), categoria:$('#f-cat').value, preco, precoAntigo:antigo>preco?antigo:null, estoque:est, destaque:$('#f-destaque').checked, imagem:$('#f-imagem').value.trim(), descricao:$('#f-desc').value.trim()};
  try{ await Store.salvar(p); produtos = await Store.listar(); toast('Produto salvo'); limpar(); go('listar') }
  catch(err){ toast('Não foi possível salvar. Verifique a conexão com a loja.') }
};

/* ---- abas Produtos | Clientes ---- */
function setAba(a){
  if(a==='pedidos' && $('#v-listar').hidden) a = 'produtos'; // não há cadastro de pedidos
  aba = a;
  $$('[data-aba]').forEach(b=>{ const on = b.dataset.aba===a; b.setAttribute('aria-selected', on); b.tabIndex = on ? 0 : -1 });
  $('#form').hidden = a!=='produtos'; $('#formCliente').hidden = a!=='clientes';
  $('#card-produtos').hidden = a!=='produtos'; $('#card-clientes').hidden = a!=='clientes'; $('#card-pedidos').hidden = a!=='pedidos';
}
$$('[data-aba]').forEach(b=>b.onclick=()=>setAba(b.dataset.aba));
// Setas, Home e End trocam de aba (padrão de abas acessíveis)
$$('[role="tablist"]').forEach(lista=>lista.addEventListener('keydown', e=>{
  const abas = [...lista.querySelectorAll('[role="tab"]')], i = abas.indexOf(document.activeElement);
  if(i<0) return;
  const j = {ArrowRight:(i+1)%abas.length, ArrowLeft:(i-1+abas.length)%abas.length, Home:0, End:abas.length-1}[e.key];
  if(j===undefined) return;
  e.preventDefault(); setAba(abas[j].dataset.aba); abas[j].focus();
}));

/* ---- clientes ---- */
const dataBR = iso => iso ? new Date(iso).toLocaleDateString('pt-BR') : '';
function renderClientes(){
  const q = $('#qc').value.trim().toLowerCase();
  const l = clientes.filter(c=>[c.nome,c.email,c.cidade].join(' ').toLowerCase().includes(q));
  $('#emptyC').hidden = l.length>0;
  $('#rowsC').innerHTML = l.map(c=>`<tr><td>${esc(c.nome)}${c.origem==='loja'?'<span class="tag">conta na loja</span>':''}<br><small style="color:var(--mut)">${esc(c.email)}</small></td><td>${esc(c.telefone)||'—'}</td><td>${esc(c.cidade)||'—'}</td><td>${dataBR(c.criadoEm)}</td><td class="r"><button class="iconbtn" data-cedit="${esc(c.id)}" aria-label="Editar ${esc(c.nome)}"><svg class="i" viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16v4z"/></svg></button> <button class="iconbtn" data-cdel="${esc(c.id)}" aria-label="Excluir ${esc(c.nome)}"><svg class="i" viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg></button></td></tr>`).join('');
}
$('#qc').oninput = renderClientes;
$('#rowsC').onclick = async e=>{
  const ed=e.target.closest('[data-cedit]'), de=e.target.closest('[data-cdel]');
  if(ed){ const c=clientes.find(x=>x.id===ed.dataset.cedit); $('#c-id').value=c.id; $('#c-nome').value=c.nome; $('#c-email').value=c.email; $('#c-tel').value=c.telefone||''; $('#c-cpf').value=c.cpf||''; $('#c-cidade').value=c.cidade||''; $('#c-end').value=c.endereco||''; $('#formClienteTitle').textContent='Editar cliente';
    // O e-mail de quem tem conta na loja é o login dela: não pode ser trocado pelo painel
    const daLoja = c.origem==='loja'; $('#c-email').readOnly = daLoja; $('#c-email-dica').hidden = !daLoja;
    aba='clientes'; go('cadastrar') }
  const cDel = de && clientes.find(x=>x.id===de.dataset.cdel);
  const aviso = cDel?.origem==='loja' ? 'Excluir este cliente do painel?\n\nA conta dele na loja continua existindo e ele volta a aparecer aqui quando entrar de novo.' : 'Excluir este cliente?';
  if(de && confirm(aviso)){ try{ await Store.excluirCliente(de.dataset.cdel); clientes=await Store.listarClientes(); renderClientes(); toast('Cliente excluído') }catch(err){ toast('Não foi possível excluir. Tente de novo.') } }
};
function limparC(){ $('#formCliente').reset(); $('#c-id').value=''; $('#c-email').readOnly=false; $('#c-email-dica').hidden=true; $('#formClienteTitle').textContent='Novo cliente' }
$('#cancelC').onclick = limparC;
$('#formCliente').onsubmit = async e=>{
  e.preventDefault();
  const nome=$('#c-nome').value.trim(), email=$('#c-email').value.trim().toLowerCase();
  if(!nome || !/^\S+@\S+\.\S+$/.test(email)){ toast('Preencha o nome e um e-mail válido'); return }
  const c = {id:$('#c-id').value||undefined, nome, email, telefone:$('#c-tel').value.trim(), cpf:$('#c-cpf').value.trim(), cidade:$('#c-cidade').value.trim(), endereco:$('#c-end').value.trim()};
  try{ await Store.salvarCliente(c); clientes = await Store.listarClientes(); toast('Cliente salvo'); limparC(); aba='clientes'; go('listar') }
  catch(err){ toast(err.message==='duplicado' ? 'Já existe um cliente com este e-mail.' : 'Não foi possível salvar. Verifique a conexão com a loja.') }
};

/* ---- pedidos (feitos na loja) ---- */
function renderPedidos(){
  const q = $('#qp').value.trim().toLowerCase();
  const l = [...pedidos].sort((a,b)=>String(b.data).localeCompare(String(a.data)))
    .filter(p=>[p.id, p.cliente?.nome, p.cliente?.email, ...(p.itens||[]).map(i=>i.nome)].join(' ').toLowerCase().includes(q));
  $('#emptyP').hidden = l.length>0;
  $('#rowsP').innerHTML = l.map(p=>{
    const itens = (p.itens||[]).map(i=>`${i.quantidade}× ${esc(i.nome)}`).join('<br>');
    const data = p.data ? new Date(p.data).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'}) : '';
    return `<tr><td>${esc(p.id)}<br><small style="color:var(--mut)">${esc(p.status||'pago')}</small></td><td>${esc(p.cliente?.nome)}<br><small style="color:var(--mut)">${esc(p.cliente?.email)}</small></td><td>${itens}</td><td>${data}</td><td class="r">${brl(p.total)}</td></tr>`;
  }).join('');
}
$('#qp').oninput = renderPedidos;

async function recarregar(){
  try{ produtos = await Store.listar() }catch(e){ produtos=[]; toast('Sem conexão com a loja') }
  try{ clientes = await Store.listarClientes() }catch(e){ clientes=[] }
  try{ pedidos = await Store.listarPedidos() }catch(e){ pedidos=[] }
}

// Atualiza o painel na hora quando a loja (outra aba) muda produtos, clientes ou pedidos
window.addEventListener('storage', async e=>{
  if(!Store.demo || !Auth.get() || !Object.values(DADOS.CHAVES).includes(e.key)) return;
  await recarregar();
  const v = location.hash.slice(1)||'dashboard';
  if(v==='dashboard') renderDash();
  if(v==='listar'){ renderLista(); renderClientes(); renderPedidos(); }
  if(e.key===DADOS.CHAVES.pedidos) toast('Novo movimento na loja');
});

/* ---- entrar / sair ---- */
function mostrarLogin(){
  $('#app').hidden = true; $('#login').hidden = false; $('#l-senha').value = ''; $('#l-erro').hidden = true;
}
async function iniciar(){
  const s = Auth.get();
  $('#login').hidden = true; $('#app').hidden = false;
  $('#meNome').textContent = s.nome; $('.avatar').textContent = (s.nome||'A').charAt(0).toUpperCase();
  await recarregar();
  go(location.hash.slice(1)||'dashboard');
}
$('#formLogin').onsubmit = async e=>{
  e.preventDefault();
  const email=$('#l-email').value.trim(), senha=$('#l-senha').value, erro=$('#l-erro');
  if(!email || !senha){ erro.textContent='Informe e-mail e senha.'; erro.hidden=false; return }
  try{ await Auth.entrar(email, senha); iniciar() }
  catch(err){ erro.textContent = err.message==='credenciais' ? 'E-mail ou senha incorretos.' : 'Não foi possível conectar com a loja. Tente de novo.'; erro.hidden=false }
};
$('#sair').onclick = ()=>{ Auth.limpar(); produtos=[]; clientes=[]; pedidos=[]; mostrarLogin() };
Auth.get() ? iniciar() : mostrarLogin();