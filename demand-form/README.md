# Formulário de Demanda Criativa

Formulário próprio (HTML/CSS/JS, sem dependências) para substituir o Tally,
com as mesmas etapas do original mais as melhorias combinadas: prazo,
prioridade, aprovador, upload de arquivo, multi-seleção de rede/formato,
protocolo automático e gravação direta numa planilha do Google Sheets via
Google Apps Script.

## Estrutura

```
demand-form/
  index.html            estrutura das 5 etapas do formulário
  style.css              visual (troque as variáveis de cor em :root para a marca)
  config.js               URL do backend e limite de tamanho de arquivo
  app.js                  lógica de etapas, campos dinâmicos por tipo de demanda e envio
  apps-script/Code.gs      backend: grava na planilha, sobe arquivos no Drive, envia e-mail
  elementor-widget.html    tudo acima combinado num único bloco, pronto para colar no widget "HTML" do Elementor Pro
```

`index.html` + `style.css` + `config.js` + `app.js` servem para hospedar o formulário como página própria (ou embutir via `<iframe>`). `elementor-widget.html` é a versão para colar direto no Elementor — veja a seção abaixo.

## Como publicar

### 1. Planilha + Apps Script
1. Crie uma planilha nova no Google Sheets.
2. Menu **Extensões > Apps Script**.
3. Apague o conteúdo padrão de `Code.gs` e cole o conteúdo de `apps-script/Code.gs` deste projeto.
4. No topo do arquivo, ajuste `CONFIG`:
   - `DRIVE_FOLDER_ID`: crie uma pasta no Google Drive para os anexos e cole o ID (está na URL da pasta).
   - `NOTIFY_TEAM_EMAILS`: já vem com `rafael@souzdesign.com.br` — troque ou adicione outros e-mails separados por vírgula se quiser que mais pessoas recebam cópia de toda demanda.
5. **Implantar > Nova implantação**:
   - Tipo: **App da Web**
   - Executar como: **Eu**
   - Quem pode acessar: **Qualquer pessoa**
6. Copie a URL gerada (termina em `/exec`).

### 2. Frontend
1. Abra `config.js` e cole a URL do passo anterior em `SCRIPT_URL`.
2. Suba a pasta `demand-form/` no seu site (ou embuta via `<iframe>` se preferir manter isolado).
3. Teste um envio: uma linha deve aparecer na aba **Demandas** da planilha e um e-mail de confirmação deve chegar ao solicitante.

Sem `SCRIPT_URL` configurada, o formulário funciona em modo de simulação: valida
e mostra a tela de sucesso, mas só loga o payload no console — útil para testar
localmente antes de publicar o Apps Script.

### 3. Publicar no widget HTML do Elementor Pro

O widget "HTML" do Elementor aceita só um bloco de código (não arquivos
separados), então use `elementor-widget.html` em vez dos arquivos soltos:

1. Complete o passo 1 (planilha + Apps Script) e copie a URL do Web App.
2. Abra `demand-form/elementor-widget.html`, ache a linha `SCRIPT_URL: ""`
   dentro do `<script>` (perto do topo) e cole a URL ali.
3. No Elementor, arraste o widget **HTML** para a página.
4. Copie **todo** o conteúdo do arquivo (o comentário, o `<div id="sd-demand-form">`,
   o `<style>` e o `<script>`) e cole no campo do widget.
5. Clique em **Atualizar/Publicar** e visite a página publicada (não só o preview
   do editor) para testar o envio de ponta a ponta.

Detalhes importantes dessa versão:
- O CSS é todo prefixado com `#sd-demand-form` para não vazar estilo para o
  resto do tema e não ser sobrescrito por ele — pode colar em qualquer página,
  mesmo com Elementor/WordPress carregando seus próprios estilos globais.
- Use o widget **uma única vez por página** — os IDs internos (`demand-form`,
  `btn-next` etc.) não foram feitos para duas instâncias na mesma página.
- Para trocar as cores da marca, edite as variáveis no topo do bloco `<style>`
  (`--sd-brand`, `--sd-brand-accent` etc.).

## Notificações por e-mail

Toda solicitação enviada dispara dois e-mails com o **resumo completo** (protocolo,
dados do solicitante, todos os campos preenchidos — inclusive cada criativo ou
cada peça de campanha —, links e arquivos anexados):

- **Para o solicitante**, no e-mail que ele informou no passo 1 (confirmação com protocolo).
- **Para o time de design**, em `CONFIG.NOTIFY_TEAM_EMAILS` no `Code.gs` (por padrão `rafael@souzdesign.com.br`).

## Estrutura da planilha (uma aba por mês)

Cada demanda cai numa aba nomeada pelo mês de envio, ex: **"Demandas 2026-08"** —
criada automaticamente na primeira solicitação daquele mês. Assim a planilha
fica organizada mês a mês e pode ser exportada como Excel (Arquivo > Fazer
download > Microsoft Excel) a qualquer momento, aba por aba.

| Coluna | Descrição |
|---|---|
| Protocolo | Gerado automaticamente, ex: `SC-2026-08-0001` (mesmo protocolo para todas as linhas de uma mesma solicitação) |
| Item | Qual item da solicitação essa linha representa — ver abaixo |
| Data/Hora | Timestamp do envio |
| Nome / Empresa / E-mail | Identificação do solicitante |
| Tipo de Demanda | Post redes sociais, Impresso, Site, Wallpaper, Campanha sazonal/vendas, Outro |
| Prioridade | Normal / Prioritário / Urgente |
| Prazo Desejado | Data escolhida pelo solicitante |
| Aprovador | Quem valida a peça final |
| **Status** | Coluna livre para o time atualizar manualmente: Recebido / Em produção / Em aprovação / Concluído — é aqui que a planilha vira o quadro de gestão |
| Detalhes do Item | Todos os campos preenchidos para aquele item, um por linha de texto |
| Links de Referência | Links colados pelo solicitante |
| Arquivos (Drive) | URLs dos arquivos enviados, já salvos na pasta do protocolo |
| Observações | Texto livre |

**Uma solicitação pode gerar mais de uma linha**, sempre com o mesmo Protocolo:
- Impresso, Site, Wallpaper, Outro → 1 linha ("Único item").
- Post para redes sociais → 1 linha por criativo adicionado ("Criativo 1 de 3", "Criativo 2 de 3"...).
- Campanha sazonal/de vendas → 1 linha com os dados gerais da campanha ("Campanha (dados gerais)") + 1 linha por peça envolvida marcada ("Peça — Impresso", "Peça — Post redes sociais"...).

## Redes sociais: múltiplos criativos numa única solicitação

No tipo "Post para redes sociais", o solicitante pode clicar em **"+ Adicionar
outro criativo/carrossel"** quantas vezes precisar (até 30) para pedir vários
criativos de uma vez, sem reabrir o formulário — cada um com sua própria rede
social, formato, objetivo, copy e cards de carrossel. Cada criativo é validado
e enviado como um item independente da mesma solicitação (mesmo protocolo).

## Campanhas: detalhamento automático por peça envolvida

Nos tipos "Campanha sazonal" e "Campanha de vendas", ao marcar uma ou mais
opções em "Peças envolvidas" (Post redes sociais, Impresso, Material para
site, Wallpaper, E-mail marketing, Outro), um bloco de detalhamento aparece
automaticamente logo abaixo para cada peça marcada — por exemplo, "Impresso"
pede a dimensão da peça, e "Post redes sociais" pede rede(s) social(is) e
formato(s), igual ao tipo de demanda dedicado. Desmarcar a peça esconde o
bloco e ele deixa de ser obrigatório.

## Extender para novos tipos de demanda

Os campos de cada tipo ficam centralizados em `SCHEMAS` no início de `app.js`
(replicado em `elementor-widget.html`, que empacota o mesmo código num único
bloco). Para adicionar ou ajustar campos de um tipo existente, edite esse
objeto — o restante do formulário (navegação, validação, resumo, envio) é
genérico e não precisa mudar. Redes sociais (múltiplos criativos) e campanhas
(detalhamento por peça) têm sua própria lógica dedicada, em `REDES_SOCIAIS_FIELDS`
e `PECA_DETAIL_FIELDS`/`PECAS_OPTIONS`, pelo mesmo motivo.

## Limitações conhecidas / próximos passos possíveis

- Upload de arquivo é convertido em base64 no navegador antes de enviar — ótimo até uns 8MB por arquivo (configurável em `config.js`), mas para vídeos grandes o formulário já orienta o uso de link em vez de upload.
- A coluna "Status" é atualizada manualmente pelo time na planilha. Se no futuro quiser um painel visual (Kanban) ligado a essa mesma planilha, dá para evoluir sem mexer no formulário.
- O número sequencial do protocolo é baseado na quantidade de linhas já gravadas no mês — como uma solicitação com vários criativos/peças gera várias linhas, os números podem "pular" (ex: `0001`, depois `0005` se a anterior tinha 3 itens). Continuam únicos e em ordem crescente, só não contam exatamente "1 por solicitação".
- Não há autenticação no envio do formulário (assim como no Tally). Se for necessário restringir a solicitantes internos, dá para adicionar validação de domínio de e-mail no `Code.gs`.
