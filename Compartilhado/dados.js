/* =====================================================
   IWNZ Tech — dados compartilhados entre Loja e Dashboard
   -----------------------------------------------------
   As duas aplicações rodam no mesmo endereço (ex.: python3 -m http.server)
   e por isso enxergam o mesmo localStorage. Este arquivo define as chaves,
   o catálogo inicial e funções de leitura/gravação usadas pelas duas.
   Script clássico: carregue-o ANTES do script de cada aplicação.
   ===================================================== */
(function () {
  const CHAVES = {
    produtos: "loja:v2:produtos", // catálogo (Dashboard cadastra, Loja exibe)
    clientes: "loja:v2:clientes", // clientes (cadastros da Loja + do Dashboard)
    pedidos: "loja:v2:pedidos"    // pedidos finalizados na Loja
  };

  const CATEGORIAS = ["Hardware", "Periféricos", "Monitores", "Acessórios"];

  // Meta de faturamento mensal usada no Dashboard (modo demonstração)
  const META_MENSAL = 20000;

  // Catálogo usado na primeira vez que alguma das aplicações é aberta
  const PRODUTOS_INICIAIS = [
    { id: "1", nome: "Placa de Vídeo RTX 4060", sku: "HW-RTX4060", categoria: "Hardware", preco: 2199.90, precoAntigo: 2599.90, estoque: 3, destaque: true, nota: 4.9, avaliacoes: 128, imagem: "https://images.unsplash.com/photo-1587202372775-e229f172b9d7?auto=format&fit=crop&w=600&q=80", descricao: "8 GB GDDR6, DLSS 3 e Ray Tracing para jogar em Full HD e QHD." },
    { id: "2", nome: "Processador Ryzen 7 5700X", sku: "HW-R75700X", categoria: "Hardware", preco: 1349.90, precoAntigo: 1599.90, estoque: 12, destaque: true, nota: 4.8, avaliacoes: 94, imagem: "https://images.unsplash.com/photo-1591799264318-7e6ef8ddb7ea?auto=format&fit=crop&w=600&q=80", descricao: "8 núcleos e 16 threads, soquete AM4." },
    { id: "3", nome: "Teclado Mecânico Gamer RGB", sku: "PER-TEC01", categoria: "Periféricos", preco: 349.90, precoAntigo: 429.90, estoque: 25, destaque: true, nota: 4.7, avaliacoes: 210, imagem: "https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=600&q=80", descricao: "Switches mecânicos, iluminação RGB e layout ABNT2." },
    { id: "4", nome: "Monitor Gamer 27' 165Hz QHD", sku: "MON-27QHD", categoria: "Monitores", preco: 1699.90, precoAntigo: 1999.90, estoque: 8, destaque: true, nota: 4.9, avaliacoes: 85, imagem: "https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&w=600&q=80", descricao: "Painel IPS 27 polegadas, 2560×1440, 165 Hz." },
    { id: "5", nome: "Mouse Gamer sem Fio 26K DPI", sku: "PER-MOU01", categoria: "Periféricos", preco: 399.90, precoAntigo: 499.90, estoque: 15, destaque: false, nota: 4.8, avaliacoes: 67, imagem: "https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?auto=format&fit=crop&w=600&q=80", descricao: "Sensor óptico de 26.000 DPI, 63 g e bateria para até 70 horas." },
    { id: "6", nome: "Headset Gamer com Microfone", sku: "ACE-HEAD01", categoria: "Acessórios", preco: 289.90, precoAntigo: 349.90, estoque: 20, destaque: false, nota: 4.6, avaliacoes: 142, imagem: "https://images.unsplash.com/photo-1599669454699-248893623440?auto=format&fit=crop&w=600&q=80", descricao: "Som surround 7.1, microfone removível e almofadas de espuma macia." }
  ];

  function ler(chave, padrao) {
    try {
      const bruto = localStorage.getItem(chave);
      return bruto ? JSON.parse(bruto) : padrao;
    } catch {
      return padrao;
    }
  }

  function gravar(chave, valor) {
    try {
      localStorage.setItem(chave, JSON.stringify(valor));
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  }

  // Lista de produtos; na primeira visita grava o catálogo inicial
  function produtos() {
    const lista = ler(CHAVES.produtos, null);
    if (Array.isArray(lista)) return lista;
    const inicial = PRODUTOS_INICIAIS.map(p => ({ ...p }));
    gravar(CHAVES.produtos, inicial);
    return inicial;
  }

  function lista(chave) {
    const l = ler(chave, []);
    return Array.isArray(l) ? l : [];
  }

  window.IWNZ_DADOS = {
    CHAVES,
    CATEGORIAS,
    META_MENSAL,
    ler,
    gravar,
    produtos,
    clientes: () => lista(CHAVES.clientes),
    pedidos: () => lista(CHAVES.pedidos)
  };
})();
