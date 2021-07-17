const Discord = require("discord.js");

let client_id = 0;

exports.count = {
    channel: channel,
    total: total,
    run: run,
    setClientId: setClientId
}

const fetchLimit = 100;

function setClientId(id) {
    client_id = id;
}

/**
 *
 * @param {TextChannel} channel
 * @param {[string]} args
 * @returns {{channels: *[], name: string}}
 */
function channel(channel, args) {
    let channels = [];

    let targetChannel;
    for (let arg of args) {
        if (arg.startsWith('<#') && arg.endsWith('>')) {
            let argChannel = arg;
            let channelId = argChannel.slice(2, argChannel.length - 1);
            targetChannel = channel.guild.channels.cache.get(channelId);
            break;
        }
    }
    if (!targetChannel) targetChannel = channel;
    if (targetChannel instanceof Discord.TextChannel && targetChannel.messages) {
        channels.push(targetChannel);
    }

    return {
        channels: channels,
        name: '#' + targetChannel.name
    };
}

/**
 *
 * @param {Guild} guild
 * @returns {{channels: *[], name}}
 */
function total(guild) {
    let channels = [];

    for (let channel of guild.channels.cache.values()) {
        const botPermissions = channel.permissionsFor(channel.guild.me);
        if (!botPermissions.has('VIEW_CHANNEL')) continue;
        if (!(channel instanceof Discord.TextChannel) || !channel.messages) continue;
        channels.push(channel);
    }

    return {
        channels: channels,
        name: guild.name
    };
}

/**
 *
 * @param {Object} data
 * @param {Message} indexingMessage
 * @param {Message} commandMessage
 * @param author
 * @param debug
 * @param sort
 */
function run(data, indexingMessage, commandMessage, author, debug, sort) {
    let userMessageCount = { map: new Map(), sort: sort};
    let channels = data.channels;
    let channelName = data.name;

    if (debug) {
        userMessageCount.debug = {
            requestCount: 0,
            beginTime: 0,
            endTime: 0,
            channelCount: channels.length
        };
    }

    if (userMessageCount.debug) userMessageCount.debug.beginTime = new Date().getTime();
    handleChannels(userMessageCount, channels).then(userMessageCount => {
        if (userMessageCount.debug) userMessageCount.debug.endTime = new Date().getTime();
        indexingMessage.delete().catch(logErr);
        indexingMessage.channel.send("<@" + author.id + ">").then(sent => {
            if (commandMessage) commandMessage.delete().catch(logErr);
            let embeds = constructEmbed(userMessageCount, channelName);
            displayResults(sent, embeds, true);
        }).catch(logErr);
    }).catch((error) => {
        indexingMessage.delete().catch(logErr);
        logErr(error);
    });
}

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
            if (!userMessageCount.map.has(message.author.id)) {
                userMessageCount.map.set(message.author.id, {words: 0, messages: 0, ratio: 0, tag: message.author.tag});
            }
            userMessageCount.map.get(message.author.id).words += countMessageWords(message);
            userMessageCount.map.get(message.author.id).messages++;
        }
        if(messages.size === fetchLimit) {
            return countChannelMessages(userMessageCount, channel, messages.lastKey());
        }
        return userMessageCount;
    });
}

function countMessageWords(message) {
    return message.content.split(/\s*[\s]\s*/).length;
}

/**
 *
 * @param {Object} userMessageCount
 * @param {string} channelName
 * @returns {[MessageEmbed]}
 */
function constructEmbed(userMessageCount, channelName){
    let countArray = Array.from(userMessageCount.map);
    countArray.sort((a, b) => {
        switch (userMessageCount.sort) {
            case 0: return b[1].messages - a[1].messages;
            case 1: return b[1].words - a[1].words;
            case 2: return b[1].words / b[1].messages - a[1].words / a[1].messages;
        }
    });
    let pages = [""];
    let page = 0;
    for (let element of countArray) {
        let words = element[1].words;
        let messages = element[1].messages;
        let ratio = (words / messages).toFixed(3);
        let newText = `**${element[1].tag}**: ${messages} msgs, ${words} words, ${ratio} wpm\n`;
        if (pages[page].length + newText.length > 512) pages[++page] = "";
        pages[page] += newText;
    }

    let title = 'Statistics for ';
    let embeds = [];
    for (let page of pages) {
        let embed = new Discord.MessageEmbed()
            .setColor('#f1c40f')
            .setTitle(title + channelName)
            .setDescription(page);

        if (userMessageCount.debug) {
            let seconds = (userMessageCount.debug.endTime - userMessageCount.debug.beginTime) / 1000;
            let minutes = Math.floor(seconds / 60);
            let hours = Math.floor(minutes / 60);
            let days = Math.floor(hours / 60);
            let timeString = '';
            if (days) timeString += days + 'd ';
            if (hours) timeString += hours % 24 + 'h ';
            if (minutes) timeString += minutes % 60 + 'm ';
            if (seconds) timeString += (seconds % 60).toFixed(3) + 's';
            let debugText = 'Total request count: ' + userMessageCount.debug.requestCount + '\n'
                + 'Total time: ' + timeString + '\n'
                + 'Average time per request: ' + (seconds / userMessageCount.debug.requestCount).toFixed(3)
                + 's';
            embed.addField('Debug info', debugText, false);
        }
        embeds.push(embed);
    }

    return embeds;
}

function filterReactions(react, user) {
    return react.emoji.name === '➡️' && user.id !== client_id;
}

/**
 * Send the embed and add a reaction, so
 * the user can request the next page
 * @param {Message} message
 * @param {[MessageEmbed]} embeds
 * @param {boolean} edit
 */
function displayResults(message, embeds, edit) {
    let sent;
    sent = edit ? message.edit(embeds.shift()) : message.channel.send(embeds.shift());
    if (embeds.length) sent.then(msg => msg.react('➡️'))
        .then(react => react.message.awaitReactions(filterReactions, {
            max: 1,
            time: (edit ? 8 * 60 : 5) * 60 * 1000,
            errors: ['time']
        }))
        .then(() => displayResults(message,embeds,false))
        .then(() => sent.then(msg => msg.reactions.removeAll()))
        .catch(logErr);
}

function logErr(error) {
    console.error(error);
}