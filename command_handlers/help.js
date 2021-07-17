const Discord = require("discord.js");

exports.help = help;

/**
 * Generates the help embed
 * @returns {module:"discord.js".MessageEmbed}
 */
function help() {
    return new Discord.MessageEmbed()
        .setColor('#f1c40f')
        .setTitle("Usage")
        .setDescription('type `/bzz <command>` or use slash commands')
        .addField('Available commands',
            '`total [messages/words/ratio]` - ' +
            'counts the messages in all channels and sorts by messages(words/ratio)\n' +
            '`channel [#channel-name]` - counts in the specified (or current) channel\n' +
            '`help` - displays this message');
}