# Plano: Show Time no Supabase

Hoje o app é um protótipo: tudo vem de `src/data.ts` e de timers simulados (`tick` em `src/pages/Live.tsx`). Este plano troca a simulação por Supabase mantendo a UI atual, no plano **Free**, sem servidor próprio.

## Decisões

| Tema | Decisão | Por quê |
|---|---|---|
| Backend | Supabase (Auth, Postgres, Storage, Realtime) | Firebase exigiria Blaze para Storage/Functions; Supabase Free cobre o app |
| Conversão de slides | No navegador do palestrante (ver "Conversão no cliente") | Edge Functions não rodam LibreOffice; o cliente já tem as fontes do palestrante |
| Estado efêmero (slide atual, reações, presença) | Realtime Broadcast + Presence | Não grava no banco, custo só em mensagens |
| Dado persistente (perguntas, votos, enquetes, notas) | Postgres + RLS, mudanças propagadas por *broadcast from database* | Atomicidade e unicidade garantidas pelo banco; escala melhor que Postgres Changes |
| Região | `sa-east-1` (São Paulo) | Público no Brasil |
| Hosting do front | Firebase Hosting (Spark, grátis) ou Vercel | Supabase não hospeda SPA |

## Limites do Free que moldam o design

- **200 conexões Realtime simultâneas**: plateia maior exige Pro (US$ 25/mês, 500 conexões).
- **2 milhões de mensagens Realtime/mês**: cada broadcast conta por destinatário. Por isso reações vão para um canal que só o telão escuta (1 destinatário), não para a plateia toda.
- **5 GB de egress + 5 GB de egress em cache/mês**: imagens de slide servidas por bucket público (cacheável). ~100 KB por slide mobile × 12 slides × 300 pessoas ≈ 360 MB por sessão.
- **1 GB de Storage, 50 MB por arquivo**: guardar só WebP, não o PDF/PPTX original.
- **Rate limit de login anônimo (padrão 30/h por IP)**: num evento todos saem pelo mesmo IP do Wi-Fi. **Aumentar em Auth > Rate Limits antes de qualquer evento**, senão a plateia não entra.
- Projeto pausa após 7 dias sem uso; máximo de 2 projetos ativos no Free.

## Fases

### F0. Setup (feito em 2026-11-24: projeto `oybebrgqstnnxaghyqwk`, anônimos + manual linking ativos, rate limit anônimo 1000/h, migration F1 aplicada; falta Google OAuth)
1. Criar projeto `show-time` em `sa-east-1`.
2. `npx supabase init` e `npx supabase link --project-ref <ref>`.
3. `bun add @supabase/supabase-js`; criar `src/supabase.ts` com `createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY)`.
4. `.env.local` (já ignorado por `*.local` no `.gitignore`):
   ```
   VITE_SUPABASE_URL=https://<ref>.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
   ```
5. Auth:
   - Ativar *Anonymous sign-ins* e *Manual linking* (para `linkIdentity`).
   - Provider Google: criar OAuth client no Google Cloud (pode ser no projeto `showtime-ae4b5`), redirect `https://<ref>.supabase.co/auth/v1/callback`.
   - Site URL e redirect URLs: `http://localhost:5867` e o domínio de produção.
   - Aumentar rate limit de anônimos; avaliar CAPTCHA (Turnstile) contra abuso.
6. Storage: bucket público `slides` (somente WebP, caminho `{deck_id}/{idx}_{stage|mob}.webp`). Escrita só pelo dono do deck.

### F1. Schema e RLS (migrations em `supabase/migrations`)

```
decks        id, owner_id → auth.users, title, status (processing|ready|error), slide_count, created_at
slides       deck_id, idx, title, text, stage_path, mobile_path                 PK(deck_id, idx)
speaker_notes deck_id, idx, body  (tabela à parte: a plateia lê slides, nunca as notas)
sessions     id, deck_id, owner_id, pin char(6), status (live|ended), current_slide,
             free_nav, moderation, started_at, ended_at, peak_online
             UNIQUE(pin) WHERE status = 'live'
participants session_id, user_id, nickname, joined_at                          PK(session_id, user_id)
questions    id, session_id, author_id, nickname, text (1..300), slide,
             status (pending|approved|hidden|merged), dup_of, answered, pinned,
             upvote_count, created_at
question_votes question_id, user_id                                           PK(question_id, user_id)
polls        id, session_id, question, options text[], counts int[], status (idle|open|closed), on_stage, slide
poll_votes   poll_id, user_id, option                                          PK(poll_id, user_id)
notes        session_id, user_id, slide, body, updated_at                      PK(session_id, user_id, slide)
reaction_counts session_id, slide, kind (fogo|palmas|uau), count               PK(session_id, slide, kind)
```

Funções (`security definer`, com validação):
- `create_session(deck_id, free_nav, moderation)`: gera PIN único de 6 dígitos, retorna sessão.
- `join_session(pin, nickname)`: valida PIN de sessão `live`, insere em `participants`.
- `add_reactions(session_id, slide, kind, n)`: soma em lote (cliente agrega a cada ~3 s).
- `session_report(session_id)`: KPIs, engajamento por slide, enquete, perguntas.

Triggers:
- `question_votes` insert/delete atualiza `questions.upvote_count` (atômico, voto único pela PK).
- `questions` insert força `status` = `pending` ou `approved` conforme `sessions.moderation` e aplica cooldown por autor (substitui o `cooldown` simulado).
- `poll_votes` insert incrementa `polls.counts`.
- `questions`, `polls`, `sessions` chamam `realtime.broadcast_changes`: `session:{id}` recebe sessões, enquetes e perguntas aprovadas; `session:{id}:host` (só o dono) recebe toda mudança de pergunta.

RLS, em resumo:
- `decks`/`slides`: dono faz tudo; participante de sessão `live` do deck lê `slides`.
- `sessions`: dono e participantes leem; só o dono altera.
- `questions`: participante insere com `author_id = auth.uid()`; lê `approved` + as próprias; só o dono da sessão altera status, `answered`, `pinned`, `dup_of`.
- `question_votes`/`poll_votes`: só o próprio voto, só participante, enquete só se `open`.
- `notes`: só o próprio usuário.
- `realtime.messages`: canais privados; só participante/dono entra em `session:{id}`, só o dono escuta `session:{id}:host` (participante só envia reações para ele); na `session:{id}` o participante só envia Presence.

Testes: `npx supabase test db` com pgTAP cobrindo as políticas críticas (votar por outro, ler pergunta pendente alheia, alterar sessão alheia).

### F2. Upload e biblioteca (`src/pages/Upload.tsx`)
- Trocar o progresso simulado pelo progresso real da conversão no cliente (ver seção abaixo), página a página.
- Insere `decks` (processing) → envia WebP ao Storage → insere `slides` → marca `ready`.
- Biblioteca lê `decks` do usuário. Login Google obrigatório nesta área (`SideNav` mostra o usuário real).

### F3. Sessão, PIN e entrada (`Upload.tsx` modal, `Join.tsx`, Homes)
- "Iniciar sessão ao vivo" chama `create_session`.
- `QR` em `src/Slide.tsx` é falso (padrão aleatório). Trocar por QR real (lib `qrcode`) apontando para `/join?pin=...`.
- `Join.tsx`: `signInAnonymously()` se não houver sessão, depois `join_session(pin, nickname)`. Remover a dica de PIN de teste.
- Escolher uma das Homes (V1/V2/V3) e remover as outras rotas.

### F4. Ao vivo: separar os papéis
O `Live.tsx` hoje mostra os 4 painéis numa tela. Viram rotas reais, reaproveitando os painéis:
- `/stage/:pin` telão: slide atual, QR/PIN, reações, pergunta fixada, enquete no palco.
- `/watch/:sessionId` público: slide atual (ou navegação livre), notas, perguntas, enquete, reações.
- `/presenter/:sessionId` palestrante: controle de slides (atalhos de teclado existentes), notas do orador, fila de perguntas, enquete, timer.
- `/moderate/:sessionId` moderação (opcional, mesmo dono).

Canal `session:{id}`:
- troca de slide: o palestrante grava `sessions.current_slide`; o trigger faz o broadcast (serve também para quem entra atrasado);
- Presence para o contador online (atualiza `peak_online` no fim);
- mudanças de perguntas/enquetes chegam via trigger.

Canal `session:{id}:host`: reações (só o telão recebe). O público envia, o cliente agrega e chama `add_reactions` a cada ~3 s para o relatório.

`Slide` (`src/Slide.tsx`) ganha modo imagem: `<img>` WebP mobile no público, stage no telão. Os tipos estruturados atuais continuam para a demo.

### F5. Notas pessoais
- Autosave com debounce em `notes` (`upsert`), substituindo o `saveT` atual.

### F6. Apostila (`src/pages/Apostila.tsx`)
- Dados reais: `notes` do usuário + `questions` próprias e top votadas + imagens dos slides.
- PDF: `window.print()` com CSS de impressão (zero dependência); Markdown: `Blob` + download.
- "Salvar na minha conta Google": `supabase.auth.linkIdentity({ provider: 'google' })`, preservando o mesmo `user_id` e as notas.

### F7. Relatório (`src/pages/Relatorio.tsx`)
- Trocar `DATA`, `QS`, `KPIS`, `PV` por `session_report(session_id)`.
- CSV gerado no navegador (`Blob`).

### F8. Deploy
- Build Vite no Hosting escolhido, com rewrite SPA para `index.html`.
- Adicionar o domínio em Auth redirect URLs e no OAuth client do Google.

## Conversão no cliente: as 3 recomendações

As três produzem a mesma saída por slide: `{ idx, stage: Blob (1920×1080), mobile: Blob (1280×720), text, notes }`. O resto do fluxo (Storage + tabela `slides`) não muda conforme a origem.

### 1. PDF com pdf.js (caminho principal)
- `pdfjs-dist`: para cada página, `page.render()` num canvas em escala para 1920 px de largura e outro para 1280 px; `canvas.toBlob(cb, 'image/webp', 0.85)`.
- Texto: `page.getTextContent()` → `slides.text` (busca e leitores de tela).
- Rodar num Web Worker com `OffscreenCanvas` para não travar a UI; progresso por página alimenta os passos que a tela já mostra.
- Safari pode não codificar WebP no canvas e devolver PNG: checar `blob.type` e cair para `image/jpeg`.
- Texto na tela de upload: "Para resultado perfeito, exporte como PDF no PowerPoint".

### 2. PPTX com renderizador JS + notas via zip
- Notas do orador: `jszip` lê `ppt/slides/_rels/slideN.xml.rels` → `ppt/notesSlides/notesSlideN.xml` e extrai o texto. Funciona sempre, independe da fidelidade visual.
- Slides: lib de render PPTX → HTML (ex.: `pptx-preview`), captura com `html-to-image` → WebP.
- Fidelidade média: SmartArt, gráficos e alguns gradientes/textos podem sair errados. Por isso há **prévia obrigatória** antes de publicar, com o botão "Ficou estranho? Envie o PDF".
- Atalho útil: o palestrante pode enviar o PDF **e** o PPTX: imagens do PDF + notas do PPTX.

### 3. LibreOffice em WebAssembly (alta fidelidade, opcional)
- ZetaOffice/LibreOffice WASM converte PPTX → PDF no navegador; depois segue o caminho 1.
- Download pesado (dezenas de MB) e experimental: carregar sob demanda (`import()` dinâmico) só quando o palestrante escolher "conversão de alta fidelidade", nunca no bundle inicial.
- Só implementar se a recomendação 2 não atender os decks reais. Não exige mudar nada do resto.

**Validar antes da F2:** rodar um deck real do palestrante nas recomendações 1 e 2 e comparar.

## Ordem sugerida
F0 → F1 → F3 (entrar numa sala) → F4 (slide sincronizado) → F2 (upload real) → F5 → perguntas/votos/enquete dentro da F4 → F6 → F7 → F8.
F3/F4 antes da F2 porque o deck de demo já existe em `src/data.ts` e prova o tempo real primeiro.
