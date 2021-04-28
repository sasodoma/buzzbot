# BuzzBot
A simple bot that counts the amount of messages each user has sent.

## Installation
Clone/download the repository and run `npm i` to install the required modules automatically.

Create a config.json file in the same directory with the following contents:
```
{
  "BOT_TOKEN": "your_token_here",
  "enabled": true
}
```

Run `node index.js`

## Usage
`/bzz channel #channel-name` - Counts the messages in the specified channel, or the current channel if you don't specify one.  
`/bzz total` - Counts all the messages in the server. Can take a very long time.
