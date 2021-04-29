const Discord = require('discord.js');
const config = require('./config.json');

const client = new Discord.Client();
const prefix = '/bzz ';
const fetchLimit = 100;

function login() {
    client.login(config.BOT_TOKEN).catch(reason => {
        console.error(reason);
        setTimeout(login, 10000);
    });
}

if (config.enabled) login();

client.on('message', function(message) {
    if (message.author.bot) return;
    if (!message.content.startsWith(prefix)) return;
    if (!message.guild) {
        message.channel.send("I don't work in the DMs. I wouldn't be useful anyway.").catch(logErr);
        return;
    }

    const commandBody = message.content.slice(prefix.length);
    const args = commandBody.split(' ');
    const command = args.shift().toLowerCase();
    const author = message.author;

    let userMessageCount = new Map();
    let channels = [];
    let channelName;
    if (command === 'total') {
        channelName = message.guild.name;
        for (let channel of message.guild.channels.cache.values()) {
            if (!(channel instanceof Discord.TextChannel) || !channel.messages) continue;
            channels.push(channel);
        }
    } else if (command === 'channel') {
        let argChannel = args.shift();
        let targetChannel;
        if (argChannel && argChannel.startsWith('<#') && argChannel.endsWith('>')) {
            let channelId = argChannel.slice(2, argChannel.length - 1);
            targetChannel = message.guild.channels.cache.get(channelId);
        }
        if (!targetChannel) targetChannel = message.channel;
        if (targetChannel instanceof Discord.TextChannel && targetChannel.messages) {
            channelName = '#' + targetChannel.name;
            channels.push(targetChannel);
        }
    }
    if (channels.length === 0) return;
    message.channel.send(new Discord.MessageEmbed().setColor('#f1c40f').setTitle("Started indexing")).then(indexingMessage => {
        handleChannels(userMessageCount, channels).then(userMessageCount => {
            indexingMessage.delete().catch(logErr);
            message.channel.send("<@" + author.id + ">").then(sent => {
                sent.edit(constructEmbed(userMessageCount, channelName)).catch(logErr);
                message.delete().catch(logErr);
            }).catch(logErr);
        }).catch(logErr);
    }).catch(logErr);
});

function handleChannels(userMessageCount, channels) {
    if (channels.length === 0) {
        return new Promise((resolve) => {resolve(userMessageCount)});
    }
    let channel = channels.pop();
    return countChannelMessages(userMessageCount, channel).then(userMessageCount => {
        return handleChannels(userMessageCount, channels);
    });
}

function countChannelMessages(userMessageCount, channel, lastMessage = null) {
    return channel.messages.fetch({limit: fetchLimit, before: lastMessage}).then(messages => {
        for (let message of messages.values()) {
            if (!message.author) continue;
            if (!userMessageCount.has(message.author.id)) userMessageCount.set(message.author.id, {count: 0});
            userMessageCount.get(message.author.id).count++;
        }
        if(messages.size === fetchLimit) {
            return countChannelMessages(userMessageCount, channel, messages.lastKey());
        }
        return userMessageCount;
    });
}

function constructEmbed(userMessageCount, channelName){
    let countArray = Array.from(userMessageCount);
    countArray.sort((a, b) => {
       return b[1].count - a[1].count;
    });
    let text = "";
    for (let element of countArray) {
        text += `*<@${element[0]}>*: ${element[1].count}\n`;
    }
    return new Discord.MessageEmbed()
        .setColor('#f1c40f')
        .setTitle('Stats for ' + channelName)
        .setDescription(text);
}

function logErr(error) {
    console.error(error);
}