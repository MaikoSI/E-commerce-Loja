# E-commerce-Loja

Trabalho do Marcelo Boer

**IWNZ Tech** é uma loja virtual de demonstração feita como **trabalho da faculdade**, na disciplina de Design de Interface. É um projeto acadêmico: nenhuma compra, cobrança ou entrega é real, e os produtos, preços e avaliações são ilustrativos.

## O que tem no projeto

- **Loja (`Loja/`)**: vitrine de produtos de tecnologia (hardware, periféricos, monitores e acessórios) com busca, filtros por categoria, ordenação, carrinho, cadastro e login de clientes, checkout simulado e página de pedido confirmado.
- **Painel da loja (`Dashboard/`)**: área do administrador ("Minha Loja") para cadastrar e listar produtos e clientes, ver os pedidos feitos na loja e acompanhar vendas da semana, meta do mês e ticket médio.
- **Dados compartilhados (`Compartilhado/dados.js`)**: catálogo inicial e funções usadas pelas duas partes. O que é cadastrado no painel aparece na loja, e as contas e pedidos feitos na loja aparecem no painel.

Também foram trabalhados pontos de experiência e acessibilidade: alto contraste, texto maior, redução de animações, navegação por teclado, e textos de privacidade com as opções de baixar e excluir os próprios dados (LGPD).

## Tecnologias

HTML, CSS e JavaScript puros, sem frameworks e sem servidor. Todos os dados ficam guardados no próprio navegador (`localStorage` e `sessionStorage`).

## Como rodar

O site precisa ser aberto por um servidor local (abrir o arquivo direto no navegador não funciona):

```bash
python3 -m http.server 8000
```

Depois acesse:

- Loja: http://localhost:8000/Loja/
- Painel: http://localhost:8000/Dashboard/

O login de demonstração do painel é fictício e está em `Dashboard/script.js` (objeto `Auth.DEMO`). Como a loja e o painel usam o mesmo armazenamento do navegador, os dois precisam ser abertos pelo mesmo endereço.
