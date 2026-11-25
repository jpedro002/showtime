export type SlideData =
  | { kind: 'cover'; kicker: string; title: string; sub: string; foot: string }
  | { kind: 'section'; num: string; title: string }
  | { kind: 'bullets'; title: string; bullets: string[] }
  | { kind: 'cap'; title: string; sub: string }
  | { kind: 'code'; title: string; code: string }
  | { kind: 'compare'; title: string; left: { h: string; items: string[] }; right: { h: string; items: string[] } }
  | { kind: 'end'; title: string; sub: string; pin: string }

export type DeckSlide = SlideData & { notes: string }

export const PIN = '849 201'
export const DECK_TITLE = 'Arquitetura de Sistemas Distribuídos'

export const DECK: DeckSlide[] = [
  { kind: 'cover', kicker: 'Semana de Arquitetura · Trilha Backend', title: DECK_TITLE, sub: 'Consistência, disponibilidade e o que fazer quando a rede falha', foot: '[SEU NOME] · [EVENTO]', notes: 'Abrir perguntando quem já teve um incidente por causa de rede. Pedir votos no app em vez de mãos levantadas.' },
  { kind: 'section', num: '01', title: 'Por que distribuir?', notes: 'Transição rápida — no máximo 20 segundos.' },
  { kind: 'bullets', title: 'Três motivos para sair de um servidor só', bullets: ['Escala horizontal: mais máquinas em vez de máquinas maiores', 'Tolerância a falhas: um nó cai, o serviço continua', 'Latência: dados perto de quem usa'], notes: 'Citar o caso do banco: migração do monólito para réplicas por região.' },
  { kind: 'cap', title: 'Teorema CAP', sub: 'Durante uma partição de rede, escolha entre consistência e disponibilidade.', notes: 'Desenhar a partição no ar. Reforçar: P não é opcional em rede real.' },
  { kind: 'bullets', title: 'Hotspots em contadores', bullets: ['Um documento recebendo centenas de escritas por segundo vira gargalo', 'Shards: N contadores somados na leitura', 'Incremento atômico no servidor, nunca ler-somar-gravar no cliente'], notes: 'Ponte para a demo: este app usa exatamente isso nos votos. Mostrar a fila de perguntas subindo.' },
  { kind: 'code', title: 'Voto único + incremento atômico', code: 'update(ref(db), {\n  [`sessionVotes/${sid}/${qid}/${uid}`]: true,\n  [`sessionQuestions/${sid}/${qid}/upvoteCount`]: increment(1)\n});', notes: 'As duas escritas são atômicas: ou ambas, ou nenhuma. A regra de segurança impede votar em nome de outro.' },
  { kind: 'compare', title: 'Estado efêmero × dado persistente', left: { h: 'Tempo real (WebSocket)', items: ['Slide atual', 'Fila de perguntas e votos', 'Presença online'] }, right: { h: 'Documento persistente', items: ['Decks e slides', 'Notas pessoais do público', 'Histórico pós-evento'] }, notes: 'Cobrança por banda versus por operação: aqui mora a decisão de arquitetura.' },
  { kind: 'bullets', title: 'Consistência eventual na prática', bullets: ['A leitura pode atrasar, mas converge', 'Projete a interface para tolerar o atraso', 'Ordene por versão ou horário do servidor'], notes: 'Exemplo: contador de votos que pisca 41 → 42 → 42.' },
  { kind: 'section', num: '02', title: 'Padrões na prática', notes: 'Checar o tempo: o ideal é estar perto de 25 minutos aqui.' },
  { kind: 'bullets', title: 'Idempotência e retries', bullets: ['Toda requisição pode chegar duas vezes', 'Chave de idempotência por operação', 'Backoff exponencial com jitter'], notes: 'Perguntar quem já viu uma cobrança duplicada.' },
  { kind: 'bullets', title: 'Observabilidade', bullets: ['Traces distribuídos ligam a jornada inteira', 'Métricas por região, não só globais', 'Alertas sobre sintomas, não sobre causas'], notes: 'Fechar o conteúdo e abrir o Q&A em seguida.' },
  { kind: 'end', title: 'Obrigado!', sub: 'Perguntas? Envie e vote pelo app', pin: PIN, notes: 'Abrir o Q&A pela fila ordenada por votos. Usar P no passador para destacar a próxima.' },
]

export const POLL = {
  q: 'Qual opção você usaria para o contador de votos desta sala?',
  options: ['Banco em tempo real + incremento atômico', 'Documento com contadores em shards', 'Postgres + Redis', 'Ainda não sei'],
}

export type QStatus = 'approved' | 'pending' | 'hidden' | 'merged'
export type Question = {
  id: string; text: string; author: string; slide: number; votes: number; voted: boolean
  status: QStatus; answered: boolean; dupOf?: string; mine?: boolean
}

export const SEED_Q: Question[] = [
  { id: 'q1', text: 'Como evitar hotspotting em contadores distribuídos?', author: 'Anônimo', slide: 4, votes: 42, voted: false, status: 'approved', answered: false },
  { id: 'q2', text: 'O teorema CAP ainda vale com redes modernas de baixa latência?', author: 'Anônimo', slide: 3, votes: 27, voted: true, status: 'approved', answered: false },
  { id: 'q3', text: 'Vale a pena usar CRDTs para notas colaborativas?', author: 'Anônimo', slide: 6, votes: 15, voted: false, status: 'approved', answered: false },
  { id: 'q4', text: 'Qual livro você recomenda para começar em sistemas distribuídos?', author: 'Anônimo', slide: 2, votes: 12, voted: false, status: 'approved', answered: true },
  { id: 'q5', text: 'Para o usuário final, qual a diferença real entre consistência eventual e forte?', author: 'Anônimo', slide: 3, votes: 9, voted: false, status: 'approved', answered: false },
  { id: 'q6', text: 'Teorema CAP ainda é relevante hoje em dia?', author: 'Anônimo', slide: 3, votes: 3, voted: false, status: 'pending', answered: false, dupOf: 'q2' },
  { id: 'q7', text: 'Os slides vão ficar disponíveis depois?', author: 'Anônimo', slide: 0, votes: 1, voted: false, status: 'pending', answered: false },
  { id: 'q8', text: 'Alguém sabe a senha do Wi-Fi?', author: 'Anônimo', slide: 2, votes: 0, voted: false, status: 'pending', answered: false },
]
