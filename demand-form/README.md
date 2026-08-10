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
   - `NOTIFY_TEAM_EMAILS`: e-mail(s) do time de design que devem ser avisados a cada nova demanda (opcional).
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

## Estrutura da planilha (aba "Demandas")

| Coluna | Descrição |
|---|---|
| Protocolo | Gerado automaticamente, ex: `SC-2026-0001` |
| Data/Hora | Timestamp do envio |
| Nome / Empresa / E-mail | Identificação do solicitante |
| Tipo de Demanda | Post redes sociais, Impresso, Site, Wallpaper, Campanha sazonal/vendas, Outro |
| Prioridade | Normal / Prioritário / Urgente |
| Prazo Desejado | Data escolhida pelo solicitante |
| Aprovador | Quem valida a peça final |
| **Status** | Coluna livre para o time atualizar manualmente: Recebido / Em produção / Em aprovação / Concluído — é aqui que a planilha vira o quadro de gestão |
| Campos Específicos (JSON) | Todos os campos do tipo de demanda escolhido, em JSON |
| Links de Referência | Links colados pelo solicitante |
| Arquivos (Drive) | URLs dos arquivos enviados, já salvos na pasta do protocolo |
| Observações | Texto livre |

## Extender para novos tipos de demanda

Os campos de cada tipo ficam centralizados em `SCHEMAS` no início de `app.js`.
Para adicionar ou ajustar campos de um tipo existente (ou criar um tipo novo),
edite esse objeto — o restante do formulário (navegação, validação, resumo,
envio) é genérico e não precisa mudar.

## Limitações conhecidas / próximos passos possíveis

- Upload de arquivo é convertido em base64 no navegador antes de enviar — ótimo até uns 8MB por arquivo (configurável em `config.js`), mas para vídeos grandes o formulário já orienta o uso de link em vez de upload.
- A coluna "Status" é atualizada manualmente pelo time na planilha. Se no futuro quiser um painel visual (Kanban) ligado a essa mesma planilha, dá para evoluir sem mexer no formulário.
- Não há autenticação no envio do formulário (assim como no Tally). Se for necessário restringir a solicitantes internos, dá para adicionar validação de domínio de e-mail no `Code.gs`.
