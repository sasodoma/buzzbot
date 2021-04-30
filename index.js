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

client.on('ready', () => {
    client.user.setActivity("/bzz help", { type: "LISTENING"}).catch(logErr);
});

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

    let userMessageCount = { map: new Map() };
    let channels = [];
    let channelName;
    if (command === 'help') {
        message.channel.send(getHelpEmbed()).catch(logErr);
        return;
    } else if (command === 'total') {
        channelName = message.guild.name;
        for (let channel of message.guild.channels.cache.values()) {
            if (!(channel instanceof Discord.TextChannel) || !channel.messages) continue;
            channels.push(channel);
        }
    } else if (command === 'channel') {
        let argChannel = args[0];
        let targetChannel;
        if (argChannel && argChannel.startsWith('<#') && argChannel.endsWith('>')) {
            let channelId = argChannel.slice(2, argChannel.length - 1);
            targetChannel = message.guild.channels.cache.get(channelId);
            args.shift();
        }
        if (!targetChannel) targetChannel = message.channel;
        if (targetChannel instanceof Discord.TextChannel && targetChannel.messages) {
            channelName = '#' + targetChannel.name;
            channels.push(targetChannel);
        }
    }
    if (channels.length === 0) return;
    if (args.shift() === 'debug') {
        userMessageCount.debug = {
            requestCount: 0,
            beginTime: 0,
            endTime: 0,
            channelCount: channels.length
        };
    }
    message.channel.send(new Discord.MessageEmbed().setColor('#f1c40f').setTitle("Started indexing"))
        .then(indexingMessage => {
            if (userMessageCount.debug) userMessageCount.debug.beginTime = new Date().getTime();
            handleChannels(userMessageCount, channels).then(userMessageCount => {
                if (userMessageCount.debug) userMessageCount.debug.endTime = new Date().getTime();
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
        return new Promise(resolve => {resolve(userMessageCount)});
    }
    let channel = channels.pop();
    return countChannelMessages(userMessageCount, channel).then(userMessageCount => {
        return handleChannels(userMessageCount, channels);
    });
}

function countChannelMessages(userMessageCount, channel, lastMessage = null) {
    if (userMessageCount.debug) userMessageCount.debug.requestCount++;
    return channel.messages.fetch({limit: fetchLimit, before: lastMessage}).then(messages => {
        for (let message of messages.values()) {
            if (!message.author) continue;
            if (!userMessageCount.map.has(message.author.id)) userMessageCount.map.set(message.author.id, {count: 0});
            userMessageCount.map.get(message.author.id).count++;
        }
        if(messages.size === fetchLimit) {
            return countChannelMessages(userMessageCount, channel, messages.lastKey());
        }
        return userMessageCount;
    });
}

function constructEmbed(userMessageCount, channelName){
    let countArray = Array.from(userMessageCount.map);
    countArray.sort((a, b) => {
       return b[1].count - a[1].count;
    });
    let text = "";
    for (let element of countArray) {
        text += `*<@${element[0]}>*: ${element[1].count}\n`;
    }
    let embed = new Discord.MessageEmbed()
        .setColor('#f1c40f')
        .setTitle('Stats for ' + channelName)
        .setDescription(text);

    if (userMessageCount.debug) {
        let seconds = (userMessageCount.debug.endTime - userMessageCount.debug.beginTime) / 1000;
        let minutes = Math.floor(seconds / 60);
        let hours = Math.floor(minutes / 60);
        let days = Math.floor(hours / 60);
        let timeString = '';
        if (days) timeString += days + 'd ';
        if (hours) timeString += hours % 24 + 'h ';
        if (minutes) timeString += minutes % 60 + 'm ';
        if (seconds) timeString += seconds.toFixed(3) % 60 + 's';
        let debugText = 'Total request count: ' + userMessageCount.debug.requestCount + '\n'
            + 'Total time: ' + timeString + '\n'
            + 'Average time per request: ' + (seconds / userMessageCount.debug.requestCount).toFixed(3) + 's';
        embed.addField('Debug info', debugText, false);
    }

    return embed;
}

function getHelpEmbed() {
    return new Discord.MessageEmbed()
        .setColor('#f1c40f')
        .setTitle("Usage")
        .setDescription('type `/bzz <command>`')
        .addField('Available commands',
            '`total` - counts the messages in all channels\n' +
            '`channel [#channel-name]` - counts in the specified (or current) channel\n' +
            '`help` - displays this message');
}

function logErr(error) {
    console.error(error);
}