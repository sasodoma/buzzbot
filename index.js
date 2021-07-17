const Discord = require('discord.js');
const config = require('./config.json');

const handlers = require('./handlers');

const client = new Discord.Client();
const prefix = '/bzz ';

function login() {
    client.login(config.BOT_TOKEN).catch(reason => {
        console.error(reason);
        setTimeout(login, 10000);
    });
}

if (config.enabled) login();

client.on('ready', () => {
    handlers.count.setClientId(client.user.id);

    client.user.setActivity("/bzz help", { type: "LISTENING"}).catch(logErr);

    client.ws.on('INTERACTION_CREATE', async interaction => {
        if (interaction.data.name.toLowerCase() !== 'bzz') return;
        const command = interaction.data.options[0].name.toLowerCase();
        const args = interaction.data.options[0].options;
        const guild = client.guilds.resolve(interaction.guild_id);

        let data = {channels: []};
        if (command === 'help') {
            replyToCommand({embeds: [handlers.help()]}, interaction).catch(logErr);
            return;
        } else if (command === 'quote') {
            handlers.quote().then(quote => replyToCommand({embeds: [quote]}, interaction)).catch(logErr);
            return;
        } else if (command === 'total') {
            data = handlers.count.total(guild);
        } else if (command === 'channel') {
            let channel;
            if (args) {
                for (let option of args) {
                    if (option.name === 'channel') {
                        channel = guild.channels.resolve(option.value);
                    }
                }
            }
            if (!channel) {
                channel = guild.channels.resolve(interaction.channel_id);
            }
            data = handlers.count.channel(channel, []);
        }

        if (data.channels.length === 0) return;

        let sort = 0;
        let debug = false;
        if (args) {
            for (let arg of args) {
                if (arg.name === 'sort') {
                    sort = arg.value;
                } else if (arg.name === 'debug') {
                    debug = arg.value;
                }
            }
        }

        replyToCommand({embeds: [new Discord.MessageEmbed().setColor('#f1c40f').setTitle("Started indexing")]}, interaction).catch(logErr);
        client.api.webhooks('836630067588759572', interaction.token, 'messages', '@original').get()
            .then(res => guild.channels.resolve(res.channel_id).messages.fetch(res.id))
            .then(message => handlers.count.run(data, message, null, interaction.member.user, debug, sort));
    });
});

async function replyToCommand(data, interaction) {
    await client.api.interactions(interaction.id, interaction.token).callback.post({
        data: {
            type: 4,
            data: data
        }
    });
}

client.on('message', function(message) {
    if (!message.content.startsWith(prefix)) return;
    if (!message.guild) {
        message.channel.send("I don't work in the DMs. I wouldn't be useful anyway.").catch(logErr);
        return;
    }

    const commandBody = message.content.slice(prefix.length);
    const args = commandBody.split(' ');
    const command = args.shift().toLowerCase();
    const author = message.author;


    let data;
    if (command === 'help') {
        message.channel.send(handlers.help())
            .then(() => message.delete())
            .catch(logErr);
        return;
    } else if (command === 'quote') {
        handlers.quote()
            .then(quote => message.channel.send(quote))
            .then(() => message.delete())
            .catch(logErr);
        return;
    } else if (command === 'total') {
        data = handlers.count.total(message.guild);
    } else if (command === 'channel') {
        data = handlers.count.channel(message.channel, args);
    }
    if (data.channels.length === 0) return;

    let sort = 0;
    if (args.includes('ratio')) sort = 2;
    if (args.includes('words')) sort = 1;
    if (args.includes('messages')) sort = 0;

    message.channel.send(new Discord.MessageEmbed().setColor('#f1c40f').setTitle("Started indexing"))
        .then(indexingMessage => {
            handlers.count.run(data, indexingMessage, message, author, args.includes('debug'), sort);
        }).catch(logErr);
});

function logErr(error) {
    console.error(error);
}