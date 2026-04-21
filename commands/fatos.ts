import { 
    Message, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, ButtonInteraction, User, TextChannel, PermissionFlagsBits
} from 'discord.js';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));


const wikiData = [
    {
        "title": "Spam",
        "paragraphs": [
            "Spam é o termo usado para referir-se a mensagens eletrónicas não solicitadas, que são enviadas em massa.",
            "A distinção mais comum do spam é o seu caráter intrusivo e o facto de ser enviado para um grande número de destinatários que não autorizaram a receção.",
            "A forma mais reconhecida de spam é o e-mail.",
            "Mas o termo também se aplica a abusos noutros meios, como spam em redes sociais, mensagens instantâneas e fóruns de discussão.",
            "A origem da palavra 'spam' para descrever este fenómeno vem de um sketch do grupo de comédia britânico Monty Python, de 1970.",
            "Na cena, dois clientes tentam pedir o pequeno-almoço num café onde quase todos os pratos contêm a carne enlatada da marca SPAM.",
            "Enquanto a empregada recita o menu repetindo a palavra 'Spam' incessantemente, um grupo de Vikings na mesa ao lado começa a cantar.",
            "Eles gritam 'Spam, Spam, Spam, Spam... Adorável Spam!', abafando qualquer outra conversa no local.",
            "O primeiro caso registado de spam na história ocorreu em 3 de maio de 1978.",
            "Foi quando Gary Thuerk, da Digital Equipment Corporation (DEC), enviou uma mensagem a 393 destinatários na rede ARPANET.",
            "A reação da comunidade técnica foi imediata e hostil.",
            "Os administradores da ARPANET repreenderam a DEC, e a prática foi considerada uma violação flagrante da etiqueta da rede.",
            "Apesar disso, o marketing via spam tornou-se uma indústria global.",
            "Além do incómodo, o spam representa um risco de segurança.",
            "Muitos e-mails de spam contêm esquemas de phishing, malware ou fraudes financeiras.",
            "Atualmente, estima-se que a maioria do tráfego mundial de e-mails seja spam.",
            "Para combater isso, foram criadas leis em vários países e filtros de spam sofisticados que usam inteligência artificial."
        ]
    },
    {
        "title": "Discord",
        "paragraphs": [
            "O Discord é um aplicativo de voz sobre IP (VoIP) proprietário e gratuito, projetado inicialmente para comunidades de jogos.",
            "Disponível em diversos sistemas operacionais, ele permite comunicação por texto, voz e vídeo em canais de bate-papo.",
            "O conceito do Discord surgiu de Jason Citron, fundador da OpenFeint.",
            "Durante o desenvolvimento de um jogo, Citron notou a dificuldade para usar táticas em jogos como Final Fantasy XIV usando Skype ou TeamSpeak.",
            "Lançado publicamente em maio de 2015, o Discord cresceu rapidamente entre jogadores de e-sports e torneios de LAN.",
            "A empresa, ironicamente, não queria que o produto fosse nichado apenas para 'gamers', alterando seu slogan em 2020 para 'Seu lugar para conversar'.",
            "O Discord organiza-se em 'servidores', que são coleções de canais persistentes.",
            "Embora a maioria dos servidores seja gratuita, a empresa monetiza a plataforma através do 'Discord Nitro'.",
            "A plataforma já enfrentou diversas controvérsias relacionadas a abusos e segurança.",
            "Devido à sua natureza de semi-anonimato, o Discord tem sido criticado por hospedar comunidades que disseminam malware e spam.",
            "Isso forçou a empresa a criar uma equipe dedicada de 'Confiança e Segurança'.",
            "Em 2021, rumores indicaram que a Microsoft estava em negociações para comprar o Discord por mais de 10 bilhões de dólares.",
            "No entanto, as negociações foram encerradas e o Discord optou por permanecer independente."
        ]
    },
    {
        "title": "Bob Esponja Calça Quadrada",
        "paragraphs": [
            "Bob Esponja Calça Quadrada é o personagem-título e protagonista da série de animação americana de mesmo nome.",
            "Ele é uma esponja do mar amarela, enérgica e otimista que vive em um abacaxi no fundo do mar.",
            "O personagem foi criado e desenhado pelo biólogo marinho e animador Stephen Hillenburg.",
            "A ideia surgiu de um quadrinho educacional não publicado que Hillenburg criou em 1989 para ensinar alunos sobre a vida marinha.",
            "Bob Esponja trabalha como cozinheiro no Siri Cascudo, conhecido pelo seu hambúrguer exclusivo, o Hambúrguer de Siri.",
            "Ele é extremamente dedicado ao trabalho e frequentemente irrita seu vizinho e colega de trabalho, Lula Molusco.",
            "A risada característica do personagem foi criada pelo dublador original, Tom Kenny.",
            "Ele queria um som que lembrasse o barulho de um golfinho tentando falar.",
            "No Brasil, ele é dublado icônicamente por Wendel Bezerra.",
            "A série estreou em 1º de maio de 1999 e rapidamente se tornou um fenômeno global.",
            "A popularidade de Bob Esponja gerou uma franquia multibilionária, incluindo filmes, mercadorias e até um musical da Broadway.",
            "Apesar de sua aparência infantil, o personagem se tornou um ícone cultural inesperado.",
            "Ele é frequentemente alvo de memes na internet e análises acadêmicas sobre sua personalidade ingênua."
        ]
    },
    {
        "title": "Porto Alegre",
        "paragraphs": [
            "Porto Alegre é a capital e a cidade mais populosa do estado brasileiro do Rio Grande do Sul.",
            "Com uma área de quase 500 km², encontra-se sobre um terreno diversificado, com morros, baixadas e um grande lago: o Guaíba.",
            "A cidade foi constituída a partir da chegada de casais açorianos em meados do século XVIII.",
            "No século XIX contou com o influxo de muitos imigrantes alemães e italianos, recebendo também espanhóis e libaneses.",
            "Desenvolveu-se com rapidez e hoje abriga quase 1,4 milhão de habitantes dentro dos limites municipais.",
            "É a maior concentração urbana da Região Sul.",
            "A cidade recebeu numerosos prêmios assinalando-a como uma das melhores capitais brasileiras para morar e fazer negócios.",
            "Ganhou destaque internacional através da instituição do Orçamento Participativo e sediou as primeiras edições do Fórum Social Mundial.",
            "Além disso, foi uma das sedes da Copa do Mundo de 2014.",
            "Por outro lado, a cidade enfrenta desafios como sérios problemas ambientais e inundações históricas.",
            "Também apresenta zonas de grande desigualdade social."
        ]
    },
    {
        "title": "Jeffrey Epstein",
        "paragraphs": [
            "Jeffrey Edward Epstein (1953–2019) foi um financista norte-americano e criminoso sexual condenado.",
            "Ele iniciou sua vida profissional como professor de física e matemática na Dalton School em Manhattan, antes de ingressar no setor bancário.",
            "Epstein trabalhou no banco de investimentos Bear Stearns, onde subiu rapidamente de posição, chegando a sócio limitado.",
            "Em 1982, fundou sua própria empresa de gestão financeira, a J. Epstein & Co.",
            "Ele era conhecido por cultivar um círculo social de elite, que incluía celebridades, cientistas e políticos.",
            "Epstein possuía várias propriedades luxuosas, incluindo uma ilha privada nas Ilhas Virgens Americanas, apelidada de 'Little Saint James'.",
            "Em 2008, Epstein declarou-se culpado de acusações estaduais na Flórida por solicitar prostituição.",
            "Ele cumpriu 13 meses de prisão em regime semiaberto, um acordo judicial que mais tarde foi amplamente criticado.",
            "Em julho de 2019, foi preso novamente sob acusações federais de tráfico sexual de menores na Flórida e em Nova Iorque.",
            "Um mês depois, Epstein foi encontrado morto em sua cela no Centro Correcional Metropolitano de Nova Iorque.",
            "A morte foi oficialmente considerada suicídio por enforcamento, embora tenha gerado inúmeras teorias da conspiração."
        ]
    },
    {
        "title": "Xadrez",
        "paragraphs": [
            "O xadrez é um jogo de tabuleiro de natureza recreativa e competitiva para dois jogadores.",
            "É jogado num tabuleiro quadrado, dividido em 64 casas de cores alternadas, onde cada jogador controla 16 peças.",
            "O objetivo do jogo é dar xeque-mate ao rei adversário.",
            "Isso ocorre quando o rei está sob ataque imediato e não há nenhuma maneira legal de remover a ameaça.",
            "A forma atual do jogo surgiu no sudoeste da Europa na segunda metade do século XV.",
            "Ele evoluiu de suas antigas origens persas e indianas, conhecidas como Chaturanga.",
            "O xadrez é um dos jogos mais populares do mundo, sendo praticado por milhões de pessoas em torneios, clubes e escolas.",
            "A teoria do xadrez é vasta e divide-se em três fases: a abertura, o meio-jogo e o final.",
            "Em 1997, o xadrez ganhou as manchetes mundiais quando o supercomputador Deep Blue derrotou o campeão Garry Kasparov.",
            "Isso marcou um ponto de virada na relação entre inteligência artificial e humana."
        ]
    },
    {
        "title": "Linkin Park",
        "paragraphs": [
            "Linkin Park é uma banda de rock dos Estados Unidos formada em Agoura Hills, Califórnia.",
            "A formação atual inclui Mike Shinoda, Brad Delson, Dave Farrell, Joe Hahn, a vocalista Emily Armstrong e o baterista Colin Brittain.",
            "A banda alcançou fama internacional com o seu álbum de estreia, Hybrid Theory (2000).",
            "O disco foi certificado como diamante e se tornou um dos álbuns mais vendidos de todos os tempos.",
            "Seu segundo álbum, Meteora (2003), continuou o sucesso da banda, liderando a parada da Billboard 200.",
            "Tendo adaptado o nu metal e rap metal para um estilo de rádio, a banda explorou outros gêneros em Minutes to Midnight (2007).",
            "Em 2017, após a morte do vocalista Chester Bennington, o grupo passou por um hiato de sete anos.",
            "Em setembro de 2024, Linkin Park retornou às atividades com as adições de Armstrong e Brittain.",
            "O álbum de retorno, From Zero (2024), marcou uma volta às sonoridades originais do grupo.",
            "Linkin Park está entre as bandas mais bem-sucedidas do século XXI, tendo vendido mais de 100 milhões de álbuns em todo o mundo.",
            "A banda mistura estilos como rock alternativo, metal alternativo, rap rock e eletrônica.",
            "Eles ganharam dois Grammy Awards e foram declarados como 'a maior banda de rock do mundo' pela Kerrang! em 2014.",
            "A decisão da banda de adicionar Emily Armstrong gerou discussões devido às suas conexões passadas com a Cientologia, mas o retorno foi um sucesso comercial."
        ]
    },
    {
        "title": "Judaísmo",
        "paragraphs": [
            "O Judaísmo é uma religião étnica abraâmica e monoteísta que abrange as tradições espirituais e culturais do povo judeu.",
            "É considerada uma das primeiras religiões monoteístas da história, centrada na crença em um único Deus.",
            "Em 2025, a população judaica mundial foi estimada em cerca de 14,8 milhões de pessoas.",
            "Os textos centrais incluem a Torá, os Nevi'im e os Ketuvim, que juntos compõem a Bíblia Hebraica (Tanakh).",
            "Além da escrita, existe a Torá Oral, que inclui a Mishná e o Talmude, fundamentais para a lei judaica (Halacá).",
            "Os principais movimentos religiosos hoje são o judaísmo ortodoxo, o conservador e o reformista.",
            "A origem da fé remonta à aliança bíblica estabelecida entre Deus e o patriarca Abraão.",
            "A narrativa fundamental envolve o Êxodo: a libertação dos hebreus da escravidão no Egito, liderada por Moisés.",
            "No Monte Sinai, segundo a tradição, Deus revelou os Dez Mandamentos e as leis ao povo de Israel.",
            "Jerusalém é o centro espiritual, onde ficavam o Primeiro e o Segundo Templo, ambos destruídos na antiguidade.",
            "O Muro das Lamentações é o remanescente do muro que circundava o Segundo Templo e é um local sagrado.",
            "De acordo com a Halacá, é judeu quem nasce de mãe judia ou quem se converte formalmente à religião.",
            "O calendário judaico é lunissolar e conta os anos a partir da data tradicional da criação do mundo (3761 a.C.).",
            "Festas importantes incluem Rosh Hashaná (Ano Novo), Yom Kipur (Dia do Perdão) e Pessach (Páscoa).",
            "A culinária judaica segue as leis de cashrut, que proíbem carne de porco, mariscos e a mistura de carne com leite.",
            "Símbolos conhecidos incluem a Estrela de Davi, o candelabro (Menorá) e a Kipá (solidéu).",
            "O cristianismo surgiu originalmente como uma seita dentro do judaísmo do Segundo Templo antes de se separar.",
            "A história judaica foi marcada por períodos de diáspora, perseguição na Europa e o Holocausto no século XX.",
            "O hebraico é a língua litúrgica histórica e o idioma oficial do moderno Estado de Israel."
        ]
    },
    {
        "title": "Faint (Música)",
        "paragraphs": [
            "\"Faint\" é um single da banda de rock americana Linkin Park, do seu segundo álbum, Meteora.",
            "Lançada em junho de 2003, a música é considerada uma das mais icônicas do grupo.",
            "A faixa combina elementos de Nu metal e Rap metal, caracterizada pelo seu ritmo acelerado.",
            "Sua introdução e riff de guitarra primário são amplamente reconhecíveis pelos fãs.",
            "A música alcançou o primeiro lugar na parada US Modern Rock Tracks da Billboard.",
            "Mais tarde, foi misturada com músicas de Jay-Z no famoso EP mashup Collision Course.",
            "Curiosamente, a MTV produziu um mashup oficial de \"Faint\" com \"Toxic\" de Britney Spears.",
            "O single físico foi lançado em duas versões distintas: \"Faint 1\" (capa azul) e \"Faint 2\" (capa marrom-esverdeada).",
            "Uma demo da música, encontrada no LP Underground 9.0, apresenta Mike Shinoda cantando letras totalmente diferentes.",
            "A versão ao vivo da faixa foi frequentemente usada como Lado B de outros singles, como \"What I've Done\"."
        ]
    },
    {
        "title": "Psicólogo",
        "paragraphs": [
            "Psicólogo é o profissional que pratica a psicologia e estuda estados mentais, processos e comportamentos.",
            "Seu trabalho envolve a experimentação, a observação e a interpretação de como os indivíduos se relacionam uns com os outros.",
            "Geralmente, é necessário um bacharelado em psicologia para atuar na área.",
            "Diferentemente de psiquiatras, psicólogos geralmente não estão habilitados a prescrever medicação.",
            "Os psicólogos recebem treinamento extensivo em testes psicológicos e técnicas de comunicação.",
            "Eles se especializam em psicoterapias para tratar transtornos como ansiedade, depressão, esquizofrenia e transtorno bipolar.",
            "O tratamento psicológico pode ser realizado individualmente ou em grupos.",
            "A terapia cognitivo-comportamental (TCC) é uma das técnicas mais utilizadas e de alta eficácia praticada por esses profissionais.",
            "Psicólogos podem trabalhar em escolas, prisões, clínicas privadas, empresas ou com equipes esportivas.",
            "A psicologia aplicada usa a teoria para resolver problemas no comportamento humano e animal.",
            "Os campos de atuação incluem psicologia clínica, forense, organizacional, da saúde e escolar."
        ]
    },
    {
        "title": "CLT (Consolidação das Leis do Trabalho)",
        "paragraphs": [
            "A Consolidação das Leis do Trabalho (CLT) é a principal lei do Brasil referente ao direito do trabalho.",
            "Ela foi criada através do Decreto-Lei n.º 5.452, de 1 de maio de 1943, e sancionada pelo presidente Getúlio Vargas.",
            "A CLT surgiu durante o Estado Novo, unificando toda a legislação trabalhista existente no país até então.",
            "Há debates históricos sobre se a CLT foi inspirada na Carta del Lavoro do governo fascista de Benito Mussolini.",
            "Outra fonte de influência importante foi a doutrina social da Igreja Católica, especificamente a encíclica Rerum Novarum.",
            "A legislação foi baseada na ideia de 'colaboração de classes', unindo patrões e empregados pelo desenvolvimento nacional.",
            "A CLT possui 922 artigos que cobrem temas como jornada de trabalho, salário-mínimo, férias e segurança do trabalho.",
            "A assinatura da lei ocorreu em uma cerimônia multitudinária no Estádio de São Januário, no Rio de Janeiro.",
            "Críticos argumentam que o excesso de encargos trabalhistas gera o 'Custo Brasil' e estimula a informalidade.",
            "Em 2017, durante o governo Temer, a CLT sofreu alterações significativas com a reforma trabalhista.",
            "Entre as mudanças de 2017, destacam-se a prevalência do acordado sobre o legislado e o trabalho intermitente."
        ]
    },
    {
        "title": "Enchentes do RS (2024)",
        "paragraphs": [
            "As enchentes no Rio Grande do Sul em 2024 foram classificadas como a maior catástrofe climática da história do estado.",
            "Entre o final de abril e início de maio, choveu entre 500 a 700 mm em várias cidades, um terço da média de todo o ano.",
            "O lago Guaíba, em Porto Alegre, atingiu a marca histórica de 5,37 metros, superando a lendária enchente de 1941.",
            "Mais de 470 municípios foram atingidos, afetando diretamente cerca de 2,4 milhões de pessoas.",
            "O desastre resultou em mais de 180 mortes confirmadas e deixou milhares de desabrigados.",
            "Um bloqueio atmosférico e uma frente estacionária impediram o deslocamento das chuvas, agravando a situação.",
            "O Aeroporto Internacional Salgado Filho ficou fechado por meses, com a pista e o terminal de passageiros submersos.",
            "A tragédia gerou uma onda massiva de solidariedade, com civis usando barcos e jet-skis para resgatar ilhados.",
            "O cavalo 'Caramelo', que ficou dias ilhado em cima de um telhado em Canoas, tornou-se um símbolo de resistência.",
            "Cientistas ligaram a intensidade do evento às mudanças climáticas e ao fenômeno El Niño.",
            "O prejuízo econômico foi estimado em bilhões de reais, afetando habitação, agricultura e infraestrutura.",
            "Houve surtos de leptospirose após o contato da população com as águas contaminadas das enchentes."
        ]
    },
    {
        "title": "Trollface",
        "paragraphs": [
            "Trollface é um meme de rage comic de um personagem com um sorriso malicioso, usado para simbolizar trolls da Internet.",
            "Desenhado no Microsoft Paint em 19 de setembro de 2008, é uma das faces mais antigas e conhecidas da web.",
            "O criador foi Carlos Ramirez, um estudante de 18 anos que publicou a imagem original no DeviantArt.",
            "A tirinha original chamava-se 'Trolls' e criticava a natureza inútil de provocar pessoas na Internet.",
            "Rapidamente, a imagem migrou para o 4chan, Reddit e Urban Dictionary, tornando-se o emoticon universal da trolagem.",
            "O Trollface representa alguém que irrita os outros propositalmente para se divertir às custas alheias.",
            "A imagem costuma ser acompanhada por frases clássicas como 'Problem?' ou 'You mad, bro?'.",
            "Ramirez registrou os direitos autorais em 2010 e estima ter ganho mais de 100 mil dólares com licenciamento.",
            "No auge da popularidade, o criador chegava a ganhar 15 mil dólares mensais com o meme.",
            "O jogo 'Meme Run' do Wii U foi retirado das lojas por violação de direitos autorais ao usar o rosto sem permissão.",
            "O jornal La Tercera descreveu o Trollface como 'o pai dos memes'.",
            "Em 2012, torcedores de um time turco usaram um bandeirão gigante do Trollface para protestar contra regras do estádio."
        ]
    }
];

export default {
    name: 'fatos',
    description: 'Envia uma dose variada de conhecimento (sem repetir tópicos cedo demais).',
    aliases: ['curiosidades', 'cultura', 'aprender'],

    async execute(message: Message, args: string[]) {
        if (!message.member?.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply('Você não tem o PhD necessário para ministrar esta aula. 🎓');
        }

        const targetUser = message.mentions.users.first();
        const targetChannel = message.mentions.channels.first() as TextChannel;
        
        const numberArgs = args.filter(arg => !arg.startsWith('<') && !isNaN(parseInt(arg)));
        let count = numberArgs.length > 0 ? parseInt(numberArgs[0]) : 10; 

        if (count > 100) {
            count = 100;
            await message.reply('⚠️ Para evitar sobrecarga cognitiva, limitamos a aula a 100 fatos.');
        }

        if (!targetUser) return message.reply('Quem será o aluno? Ex: `rp!fatos @usuario 20`');

        const isChannelFlood = !!targetChannel;
        const destinationName = isChannelFlood ? `o canal ${targetChannel.toString()}` : 'o PV (DM)';

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId('confirm_facts').setLabel('🧠 Iniciar Maratona').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('cancel_facts').setLabel('Cancelar Aula').setStyle(ButtonStyle.Secondary)
        );

        const response = await message.reply({ 
            content: `📚 **MARATONA DE CULTURA** 📚\nVocê vai enviar **${count}** pílulas de conhecimento para **${targetUser.tag}** em **${destinationName}**.\nO aluno está pronto?`, 
            components: [row] 
        });

        const filter = (i: ButtonInteraction) => i.user.id === message.author.id;
        const collector = response.createMessageComponentCollector({ filter, componentType: ComponentType.Button, time: 60000 });

        collector.on('collect', async i => {
            if (i.customId === 'confirm_facts') {
                await i.update({ content: `✅ **Aula iniciada!** Ensinando ${count} fatos para ${targetUser.tag}...`, components: [] });
                startEducation(message, targetUser, targetChannel, count, wikiData);
                collector.stop();
            } else {
                await i.update({ content: '❌ Aula cancelada. O aluno foi poupado.', components: [] });
                collector.stop();
            }
        });
    }
};

async function startEducation(ctx: Message, target: User, channel: TextChannel | undefined, limit: number, wikiArticles: any[]) {
    const isChannel = !!channel;
    let usedTitles: string[] = [];

    const pickNextArticle = () => {
        let available = wikiArticles.filter(a => !usedTitles.includes(a.title));
        if (available.length === 0) {
            usedTitles = [];
            available = wikiArticles;
        }
        const choice = available[Math.floor(Math.random() * available.length)];
        usedTitles.push(choice.title);
        return choice;
    };

    let currentArticle = pickNextArticle();
    let paragraphIndex = 0;

    const introMessage = `🎓 **Você se inscreveu para Fatos Diários!**\n*Tópico inicial: ${currentArticle.title}*\n*Oferecimento: ${ctx.author.username}*`;
    
    try {
        if (isChannel && channel) await channel.send(introMessage);
        else await target.send(introMessage);
    } catch (e) {
        ctx.reply("❌ O aluno trancou a matrícula (DM fechada).");
        return;
    }

    await sleep(1000);

    for (let i = 0; i < limit; i++) {
        try {
            if (paragraphIndex >= currentArticle.paragraphs.length) {
                const oldTitle = currentArticle.title;
                currentArticle = pickNextArticle();
                paragraphIndex = 0; 
                const transitionMsg = `🔄 **Esgotamos o assunto "${oldTitle}".**\n👉 *Novo tópico: ${currentArticle.title}*`;
                if (isChannel && channel) await channel.send(transitionMsg);
                else await target.send(transitionMsg);
                await sleep(1500); 
            }

            const factContent = currentArticle.paragraphs[paragraphIndex];
            const messageContent = `**Fato #${i + 1} [${currentArticle.title}]:** ${factContent}`;

            if (isChannel && channel) await channel.send(`${target.toString()} ${messageContent}`);
            else await target.send(messageContent);

            paragraphIndex++; 
            await sleep(1500); 
        } catch (error) {
            await ctx.reply(`❌ A aula foi interrompida no fato #${i + 1}.`);
            return;
        }
    }
    await ctx.reply(`🏁 Certificado de conclusão emitido para **${target.tag}**! (Tópico final: ${currentArticle.title})`);
}