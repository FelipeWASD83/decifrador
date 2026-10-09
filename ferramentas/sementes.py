"""Texto do dia a dia, em português e inglês, que entra no treino dos modelos
(ver gerar_modelos.py). O corpus técnico sozinho não conhece "ponte",
"meia-noite" nem "bridge": estas listas e frases cobrem a conversa comum,
as mensagens secretas de brincadeira e os exemplos de cifra.
"""

PT_PALAVRAS = """
ponte meia noite madrugada amanhecer anoitecer manhã tarde hoje ontem amanhã semana mês ano dia hora minuto
segunda terça quarta quinta sexta sábado domingo janeiro fevereiro março abril maio junho julho agosto setembro outubro novembro dezembro
encontro encontrar encontramos encontrei esperar espero esperamos chegar chego chegamos chegou sair saio saímos saiu voltar volto voltamos
levar levo leve traga trazer trago trouxe pegar pego peguei deixar deixo deixei guardar guardo guardei esconder escondo escondi escondido escondida
segredo segredos secreto secreta mensagem mensagens recado carta cartas bilhete código códigos cifra senha chave porta portão janela telhado
tesouro mapa caminho estrada trilha floresta mata bosque rio lago mar praia ilha montanha morro vale campo cidade vila aldeia castelo torre muro
casa casas quarto sala cozinha jardim quintal rua praça igreja escola mercado loja porto barco navio túnel caverna gruta
pedra pedras árvore árvores folha flor flores terra areia fogo água vento chuva sol lua estrela estrelas céu nuvem nuvens neve gelo frio calor
amigo amiga amigos inimigo irmão irmã pai mãe filho filha avô avó tio tia primo prima marido esposa namorado namorada pessoa pessoas gente
homem mulher menino menina criança crianças rei rainha príncipe princesa soldado soldados capitão guarda ladrão mestre professor aluno doutor
olho olhos mão mãos pé pés cabeça rosto cara boca nariz orelha coração corpo braço perna voz nome nomes
cachorro gato cavalo pássaro peixe lobo urso leão tigre cobra rato coelho vaca porco galinha
comer comida pão leite café chá vinho cerveja fome sede almoço jantar
fazer faço fazemos fez feito dizer digo disse dito falar falo falamos falou saber sei sabemos soube ver vejo vimos viu ouvir ouço ouvi
ir vou vamos foi fomos vir venho vem viemos veio ter tenho temos teve haver há havia ser sou somos era estar estou estamos esteve
poder posso podemos pode quero queremos querer precisar preciso precisamos dar dou damos deu ficar fico ficamos ficou
começar começo começamos terminar termino acabar acabou abrir abro abriu fechar fecho fechou entrar entro entrou
procurar procuro procuramos achar achei achamos descobrir descobri descobrimos decifrar decifrei decifrou cifrar
cuidado perigo medo coragem confiança verdade mentira sorte azar sonho vida morte amor ódio paz guerra ataque defesa luta
bom boa ótimo ruim mau grande pequeno novo velho antigo longo curto alto baixo forte fraco rápido lento escuro claro
vermelho azul verde amarelo preto branco cinza rosa laranja
um uma dois duas três quatro cinco seis sete oito nove dez onze doze vinte trinta cem mil primeiro segundo terceiro último
não sim talvez nunca sempre agora depois antes durante enquanto quando onde como porque porquê muito pouco mais menos tudo nada todos todas
eu você ele ela nós eles elas meu minha meus minhas seu sua seus suas nosso nossa este esta esse essa isto isso aquilo aqui ali lá
para por com sem sobre entre até desde contra após dentro fora perto longe junto
olá oi tchau obrigado obrigada parabéns desculpa desculpe favor bem vindo
faroleiro faroleiros falava ninguém havia muitos anos todas noites subia escada espiral acendia lanterna acreditava algum lugar escuro navio solitário
esperando sinal alguém ainda importava chegada porto viajar viagem próxima passagens passagem comprar arrumar malas sexta feira
""".split()

PT_FRASES = """
Encontro amanhã na praia ao meio dia, não conte a ninguém sobre o tesouro escondido.
Vamos nos encontrar na ponte velha à meia-noite, traga o mapa e a chave da porta.
O ataque começa ao amanhecer, avise todos os soldados do castelo.
Olá, meu nome é Felipe e eu moro em uma cidade grande, mas gosto de ir ao campo nos fins de semana.
A senha do cofre está escondida debaixo do tapete da sala, não esqueça de apagar esta mensagem.
Parabéns, você decifrou a mensagem secreta! O tesouro está enterrado perto da grande árvore.
Eu não sei o que fazer, mas amanhã cedo vou procurar você para conversar sobre tudo o que aconteceu.
Hoje o dia está lindo, o sol brilha no céu e as crianças brincam na praça enquanto os pais conversam.
Quando a noite chegar, acenda a luz da torre e espere o sinal do outro lado do rio.
Meu amigo, a vida é curta demais para guardar segredos, mas alguns segredos valem a pena ser guardados.
O velho faroleiro não falava com ninguém havia muitos anos, mas todas as noites subia a escada em espiral e acendia a grande lanterna, porque acreditava que em algum lugar no mar escuro havia um navio solitário esperando um sinal de que alguém ainda se importava com a sua chegada ao porto.
Nós vamos viajar na próxima semana, e eu preciso comprar as passagens e arrumar as malas antes de sexta-feira.
""".strip().split("\n")

EN_PALAVRAS = """
bridge midnight tomorrow today yesterday morning evening night dawn dusk week month year day hour minute second
monday tuesday wednesday thursday friday saturday sunday january february march april may june july august september october november december
meet meeting meets met wait waiting waits arrive arrives arrived leave leaves left return returns returned come comes came go goes went
bring brings brought take takes took carry carries carried keep keeps kept hide hides hidden hiding find finds found search searching
secret secrets message messages letter letters note notes code codes cipher ciphers password passwords key keys door doors gate window roof
treasure map maps path road trail forest wood woods river lake sea ocean beach island mountain hill valley field city town village castle tower wall
house houses room kitchen garden yard street square church school market shop harbor harbour boat ship tunnel cave
stone stones tree trees leaf leaves flower flowers earth sand fire water wind rain sun moon star stars sky cloud clouds snow ice cold hot warm
friend friends enemy brother sister father mother son daughter uncle aunt cousin husband wife person people man woman boy girl child children
king queen prince princess soldier soldiers captain guard thief master teacher student doctor
eye eyes hand hands foot feet head face mouth nose ear heart body arm leg voice name names
dog cat horse bird fish wolf bear lion tiger snake mouse rabbit cow pig chicken
eat food bread milk coffee tea wine beer hunger thirst lunch dinner breakfast
make makes made say says said speak speaks spoke know knows knew see sees saw hear hears heard
have has had be is are was were been being do does did done get gets got give gives gave let lets put puts
want wants wanted need needs needed can could will would shall should may might must
begin begins began start starts started finish finishes finished end ends open opens opened close closes closed enter enters entered
look looks looked think thinks thought believe believes believed remember remembers remembered forget forgets forgot
danger fear courage trust truth lie luck dream life death love hate peace war attack defense fight
good great bad small big little old new young long short high low strong weak fast slow dark light bright
red blue green yellow black white gray grey pink orange brown
one two three four five six seven eight nine ten eleven twelve twenty thirty hundred thousand first second third last
not yes no maybe never always now then before after during while when where how why because very much many more less all every some any none
you he she it we they me him her us them my your his its our their this that these those here there
for from with without about between into through over under above below behind inside outside near far together
hello hey goodbye thanks thank please sorry welcome congratulations
lighthouse keeper years evening stairs lamp ship water shore sign someone spoken anyone winding climbed believed somewhere lonely waiting still cared whether reached
""".split()

EN_FRASES = """
Meet me at the old bridge tomorrow at midnight and bring the map with you.
Attack at dawn, tell all the soldiers in the castle to be ready.
Hello, my name is Felipe and I live in a big city, but I like to go to the countryside on weekends.
The password to the safe is hidden under the rug in the living room, do not forget to delete this message.
Congratulations, you solved the secret message! The treasure is buried near the big tree by the river.
I do not know what to do, but tomorrow morning I will look for you so we can talk about everything that happened.
Today the weather is beautiful, the sun is shining in the sky and the children are playing in the square.
When the night comes, light the lamp in the tower and wait for the signal from the other side of the river.
My friend, life is too short to keep secrets, but some secrets are worth keeping.
The old lighthouse keeper had not spoken to anyone for many years, yet every evening he climbed the winding stairs and lit the great lamp, because he believed that somewhere out on the dark water a lonely ship was waiting for a sign that someone still cared whether it reached the shore.
We are going to travel next week, and I need to buy the tickets and pack the bags before Friday.
The quick brown fox jumps over the lazy dog.
""".strip().split("\n")
