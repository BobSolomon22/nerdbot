const Discord = require('discord.js');
const { text } = require('express');
const { user } = require('pg/lib/defaults');
const auth = require('./auth.json');
const scheduler = require('node-schedule');
const { query } = require('express');
const PoolConfig = require('mysql/lib/PoolConfig');

const Pool = require('pg').Pool;
const pool = new Pool({
    user: auth.dbuser,
    host: auth.dbhost,
    database: auth.dbname,
    password: auth.dbpass,
    port: auth.dbport
});

const client = new Discord.Client({intents: ["GUILDS", "GUILD_MESSAGES","GUILD_MEMBERS"]});

let prefix = "&";

if(auth.debug == true) {
    prefix = '~';
}

let commandsActive = true;

const midnightJob = scheduler.scheduleJob('0 0 * * *', function() {
    update();
    console.log('Daily update complete.');
});

const commandJob = scheduler.scheduleJob('*/5 * * * * *', function() {
    commandsActive = true;
});

const startTime = Date.now();

client.login(auth.token);

client.on("ready", function() {
    update();
    console.log('Ready to go!');
});

client.on("guildCreate", guild => {
    const text = `INSERT INTO Guilds VALUES($1, $2, $3)`;
    const values = [guild.id, guild.name, true];

    pool.query(text, values, (err, res) => {
        if(err) {
            console.log(err.stack);
            return;
        }
        else {
            console.log(`Joined guild ${guild}`);
        }
    });
});

client.on("guildDelete", guild => {
    const text = `DELETE FROM Guilds WHERE guildid = $1`;
    const values = [guild.id];

    pool.query(text, values, (err, res) => {
        if(err) {
            console.log(err.stack);
            return;
        }
        else {
            console.log(`Left guild ${guild}`);
        }
    });
});

client.on("messageCreate", function(message) {
    if(message.author.bot) return;
    if(!message.content.startsWith(prefix)) return;
    if(!commandsActive) {
        message.reply('Commands on cooldown. Try again in a moment.');
        return;
    }

    const commandBody = message.content.slice(prefix.length);
    const args = commandBody.split(' ');
    const command = args.shift().toLowerCase();

    if(prefix === "~") {
        message.reply('Why hello there. You have stumbled upon my unstable development build. Please use "&" as a prefix unless you know what you are doing.');
    }

    switch(command) {
        case 'ping':
            ping(message);
            break;

        case 'register':
            register(message, args);
            break;

        case 'unregister':
            unregister(message);
            break;

        case 'addme':
            addme(message);
            break;

        case 'removeme':
            removeme(message);
            break;

        case 'togglemessage':
            togglemessage(message);
            break;

        case 'status':
            userStatus(message);
            break;

        // ------admin only commands------
        
        case 'update':
            updateAdminCheck(message);
            break;

        case 'editbday':
            editbdayAdminCheck(message, args);
            break;
        
        case 'setchannel':
            setChannelAdminCheck(message, args);
            break;

        case 'setrole':
            setRoleAdminCheck(message, args);
            break;

        case 'adminstatus':
            adminStatusAdminCheck(message);
            break;

        default:
            message.reply("Invalid command.");
    }
    commandsActive = false;
});

function ping(message) {
    const current = new Date();

    let uptime = current - startTime;

    let seconds = Math.floor(uptime / 1000);
    let minutes = Math.floor(seconds / 60);
    let hours = Math.floor(minutes / 60);
    let days = Math.floor(hours / 24);

    message.reply(`I'm alive! Uptime: ${days} days ${hours % 24} hours ${minutes % 60} minutes ${seconds % 60} seconds.`);
}

async function register(message, args) {
    const validate = await registerValidate(message, args);

    if(!validate) {
        return;
    }

    let author = message.author;

    const text = `INSERT INTO Users(userid, username, birthdate, birthmonth) VALUES($1, $2, $3, $4)`;
    const values = [author.id, author.username, args[1], args[0]];

    pool.query(text, values, (err, res) => {
        if(err) {
            console.log(err.stack);
            message.reply(`There was an error. Let BobSolomon know.`);
            return;
        }
        else {
            message.reply(`You have successfully been registered! This registration is good for all servers I'm in.`);
            addme(message);
        }
    });
}

async function registerValidate(message, args) {
    let author = message.author;
    let guild = message.guild;
    const isPresentUserValue = await isPresentUser(author.id);

    if(isPresentUserValue === true) {
        message.reply(`You are already registered with me. Remember that you only need to register with me once. Use &unregister to remove yourself from my records.`);
        return false;
    }
    
    return validateDateArguments(message, args);
}

function validateDateArguments(message, args) {
    if(args.length != 2) {
        message.reply(`usage: &register birthmonth birthdate`);
        return false;
    }

    if(!validateNumber(args[0]) || !validateNumber(args[1])) {
        message.reply(`${args[0]} and ${args[1]} must be positive integers`);
        return false;
    }

    if(!validateDate(args[0], args[1])) {
        message.reply(`${args[0]}/${args[1]} must be a valid month/day value`);
        return false;
    }

    return true;
}

async function unregister(message) {
    let author = message.author;
    const isPresentUserValue = await isPresentUser(author.id);

    if(!isPresentUserValue) {
        message.reply('You are not registered with me. Use &register month day to register with me.');
        return;
    }

    const text = `DELETE FROM Users WHERE userid = $1`;
    const values = [author.id];

    pool.query(text, values, (err, res) => {
        if(err) {
            console.log(err.stack);
            message.reply(`There was an error. Let BobSolomon know.`);
            return;
        }
        else {
            message.reply('You have been successfully unregistered, meaning your records have been removed from my general registry and all servers you were registered on. Run &register month day to register again.');
        }
    });
}

async function editbday(message, args) {
    let author = message.author;
    let validate = validateDateArguments(message, args);

    if(!validate) {
        return;
    }

    const text = 'UPDATE Users SET birthmonth = $1, birthdate = $2 WHERE userid = $3';
    const values = [args[0], args[1], author.id];

    pool.query(text, values, (err, res) => {
        if(err) {
            console.log(err.stack);
            message.reply(`There was an error. Let BobSolomon know.`);
            return;
        }
        else {
            message.reply('Your birthday has been successfully edited.');
        }
    });
}

async function addme(message) {
    let author = message.author;
    let guild = message.guild;
    const isPresentUserValue = await isPresentUser(author.id);
    const isPresentGuildUserValue = await isPresentGuildUser(author.id, guild.id);

    if(!isPresentUserValue) {
        message.reply('You are not registered with me, please use &register first.');
        return;
    }

    if(isPresentGuildUserValue) {
        message.reply('You are already registered in this server.');
        return;
    }

    const text = 'INSERT INTO GuildUsers VALUES ($1, $2, $3, $4, $5, $6, $7)';
    const values = [guild.id, guild.name, author.id, author.username, false, true, false];

    pool.query(text, values, (err, res) => {
        if(err) {
            console.log(err.stack);
            message.reply(`There was an error. Let BobSolomon know.`);
            return;
        }
        else {
            message.reply('You have been successfully added to this server. Use &removeme to undo this.');
        }
    });
}

async function removeme(message) {
    let author = message.author;
    let guild = message.guild;
    const isPresentUserValue = await isPresentUser(author.id);
    const isPresentGuildUserValue = await isPresentGuildUser(author.id, guild.id);

    if(!isPresentUserValue) {
        message.reply('You are not registered with me, and therefore not added to any servers. Use &register to register with me, then &addme to add yourself to a server.');
        return;
    }

    if (!isPresentGuildUserValue) {
        message.reply('You are not registered with this particular server. Use &addme to add yourself.');
        return;
    }

    let text = 'DELETE FROM GuildUsers WHERE userid = $1 AND guildid = $2';
    let values = [author.id, guild.id];

    pool.query(text, values, (err, res) => {
        if(err) {
            console.log(err.stack);
            message.reply(`There was an error. Let BobSolomon know.`);
            return;
        }
        else {
            message.reply('You have been successfully removed from my tracking on this server. Please note that this will not affect your status within my general registry, and your birthday is still saved. Use &unregister to be removed from my registry entirely.');
        }
    });
}

async function togglemessage(message) {
    let authorid = message.author.id;
    let guildid = message.guild.id;

    const text = 'SELECT * FROM GuildUsers WHERE userid = $1 AND guildid = $2';
    const values = [authorid, guildid];

    const result = await pool.query(text, values);

    if(result.rowCount <= 0) {
        message.reply('I couldn\'t find you. Are you sure you\'ve added yourself to this server with &addme?');
        return;
    }
    
    let querySelector = true;

    if(result.rows[0].wantsattention === true) {
        querySelector = false;
    }

    const text2 = 'UPDATE GuildUsers SET wantsattention = $1 WHERE userid = $2 AND guildid = $3';
    const values2 = [querySelector, authorid, guildid];

    pool.query(text2, values2, (err, res) => {
        if(err) {
            console.log(err.stack);
            message.reply(`There was an error. Let BobSolomon know.`);
            return;
        }
        else {
            message.reply(`Your birthday messages with this server set to ${querySelector}.`);
        }
    });
}

async function userStatus(message) {
    let author = message.author;
    let guild = message.guild;

    const text = "SELECT Users.username, guildname, birthmonth, birthdate, admin, wantsattention FROM GuildUsers INNER JOIN Users ON GuildUsers.userid = Users.userid WHERE Users.userid = $1 AND guildid = $2";
    const values = [author.id, guild.id];

    const result = await pool.query(text, values);

    if(result.rowCount <= 0) {
        message.reply('You are not added to this guild. Run &addme to add yourself.');
        return;
    }

    let entry = result.rows[0];

    let statusString = `Status for user ${entry.username} in server ${entry.guildname}:\nBirthday: ${entry.birthmonth}/${entry.birthdate}\nAdmin: ${entry.admin}\nServer Messages: ${entry.wantsattention}`;
    message.reply('Status message sent to your inbox.');
    author.send(statusString);
}

async function setChannel(message, args) {
    let guild = message.guild;
    let guildChannels = guild.channels;
    let validate = (args.length == 1 && validateChannelString(args[0]));

    if(!validate) {
        message.reply('Invalid arguments. Ensure that you type # and select the channel from that list.');
        return;
    }

    let channelid = args[0].match(/\d+/g);

    try {
        const channel = await guildChannels.fetch(channelid);  
    }
    catch (error) {
        message.reply('There was an error. Make sure you are giving me a valid channel.');
        return;
    }

    const text = 'UPDATE Guilds SET announcementchannelid = $1 WHERE guildid = $2';
    const values = [channelid[0], guild.id];

    pool.query(text, values, (err, res) => {
        if(err) {
            console.log(err.stack);
            message.reply(`There was an error. Let BobSolomon know.`);
            return;
        }
        else {
            message.reply(`Your announcement channel with this server changed!`);
        }
    });
}

async function setRole(message, args) {
    let guild = message.guild;
    let guildRoles = guild.roles;
    let validate = (args.length == 1 && validateRoleString(args[0]));

    if(!validate) {
        message.reply('Invalid arguments. Ensure you type @ and select the role from that list.');
        return;
    }

    let roleid = args[0].match(/\d+/g);

    try {
        const role = await guildRoles.fetch(roleid);  
    }
    catch (error) {
        message.reply('There was an error. Make sure you are giving me a valid role.');
        return;
    }

    const text = 'UPDATE Guilds SET birthdayroleid = $1 WHERE guildid = $2';
    const values = [roleid[0], guild.id];

    pool.query(text, values, (err, res) => {
        if(err) {
            console.log(err.stack);
            message.reply(`There was an error. Let BobSolomon know.`);
            return;
        }
        else {
            message.reply(`Your birthday role with this server changed!`);
        }
    });
}

async function adminStatus(message) {
    let guild = message.guild;
    
    const text = 'SELECT * FROM Guilds WHERE guildid = $1';
    const values = [guild.id];

    const result = await pool.query(text, values);

    if(result.rowCount <= 0) {
        message.reply('An unexpected error occured. Please let BobSolomon know.');
        return;
    }

    let currentGuild = result.rows[0]

    let statusString = `NerdBot Status for server ${currentGuild.guildname}:\nAnnouncement Channel: <#${currentGuild.announcementchannelid}>\nBirthday Role:<@&${currentGuild.birthdayroleid}>`;
    message.reply(statusString);
}

// ------ OTHER FUNCTIONS ------

async function addRole(message, userId) {
    let guildMember = await message.guild.members.fetch(userId);
    let role = await message.guild.roles.fetch(auth.roleid);
    guildMember.roles.add(role);
}

async function removeRole(message, userId) {
    let guildMember = await message.guild.members.fetch(userId);
    let role = await message.guild.roles.fetch(auth.roleid);
    guildMember.roles.remove(role);
}

async function getCurrentGuild(guildid) {
    let currentGuild =  await client.guilds.fetch(guildid);
    return currentGuild;
}

async function getCurrentGuildUser(currentGuild, userid) {
    let currentGuildUser = await currentGuild.members.fetch(userid);
    return currentGuildUser;
}

async function getCurrentChannel(currentGuild, channelid) {
    let currentChannel = await currentGuild.channels.fetch(channelid);
    return currentChannel;
}

async function getCurrentRole(currentGuild, roleid) {
    let currentRole = await currentGuild.roles.fetch(roleid);
    return currentRole;
}

async function handleBirthday(guildid, userid, channelid, roleid, wantsattention) {
    let currentGuild = await getCurrentGuild(guildid);
    let currentGuildUser = await getCurrentGuildUser(currentGuild, userid);
    let currentUsername = currentGuildUser.user.username;
    let currentNickname = currentGuildUser.nickname;

    try {
        let currentChannel = await getCurrentChannel(currentGuild, channelid);
        let currentRole = await getCurrentRole(currentGuild, roleid);

        if(wantsattention === true) {
            let displayName = currentUsername;
            if(currentNickname != null) {
                displayName = currentNickname;
            }
            currentChannel.send(`Today is ${displayName}'s birthday!!!`);
        }
    
        currentGuildUser.roles.add(currentRole);
        const text3 = 'UPDATE GuildUsers SET hasrole = true WHERE userid = $1 AND guildid = $2';
        const values3 = [userid, guildid];
    
        pool.query(text3, values3, (err, res) => {
            if(err) {
                console.log(err.stack);
                return;
            }
        });
    }
    catch(err) {
        console.log(`Invalid entries in guild ${currentGuild.name}`);
        return;
    }
}

async function handleUnbirthday(guildid, userid, roleid) {
    let currentGuild = await getCurrentGuild(guildid);
    let currentGuildUser = await getCurrentGuildUser(currentGuild, userid);

    try {
        let currentRole = await getCurrentRole(currentGuild, roleid);

        currentGuildUser.roles.remove(currentRole);

        const text = 'UPDATE GuildUsers SET hasrole = false WHERE userid = $1 AND guildid = $2';
        const values = [userid, guildid];

        pool.query(text, values, (err, res) => {
            if(err) {
                console.log(err.stack);
                return;
            }
        });
    }
    catch(err) {
        console.log(`Invalid entries in guild ${currentGuild.name}`);
        return;
    }
    
}

async function updateAdminCheck(message) {
    const isAdmin = await checkAdminAuthor(message.author, message.guild);
    if(isAdmin) {
        update();
        message.reply('Update complete.');
    }
    else {
        message.reply('Insufficient permissions.');
    }
}

async function editbdayAdminCheck(message, args) {
    const isAdmin = await checkAdminAuthor(message.author, message.guild);
    if(isAdmin) {
        editbday(message, args);
    }
    else {
        message.reply('Insufficient permissions.');
    }
}

async function setChannelAdminCheck(message, args) {
    const isAdmin = await checkAdminAuthor(message.author, message.guild);
    if(isAdmin) {
        setChannel(message, args);
    }
    else {
        message.reply('Insufficient permissions.');
    }
}

async function setRoleAdminCheck(message, args) {
    const isAdmin = await checkAdminAuthor(message.author, message.guild);
    if(isAdmin) {
        setRole(message, args);
    }
    else {
        message.reply('Insufficient permissions.');
    }
}

async function adminStatusAdminCheck(message) {
    const isAdmin = await checkAdminAuthor(message.author, message.guild);
    if(isAdmin) {
        adminStatus(message);
    }
    else {
        message.reply('Insufficient permissions.');
    }
}

async function update() {
    const today = new Date();
    const currentMonth = today.getMonth() + 1;
    const currentDay = today.getDate();

    const text2 = 'SELECT GuildUsers.userid, GuildUsers.username, wantsattention, GuildUsers.guildid, GuildUsers.guildname, birthdayroleid, announcementchannelid FROM GuildUsers INNER JOIN Users ON GuildUsers.userid = Users.userid INNER JOIN Guilds ON GuildUsers.guildid = Guilds.guildid WHERE hasrole = false AND birthmonth = $1 AND birthdate = $2 AND active = true';
    const values2 = [currentMonth, currentDay];

    const birthdaypeople = await pool.query(text2, values2);

    if(birthdaypeople.rowCount > 0) {
        birthdaypeople.rows.forEach(person => {
            let guildid = person.guildid;
            let userid = person.userid;
            let channelid = person.announcementchannelid;
            let roleid = person.birthdayroleid;

            if(!channelid || !roleid) {
                console.log(`channelid or roleid are blank for guild ${person.guildname}`);
            }
            else {
                handleBirthday(guildid, userid, channelid, roleid, person.wantsattention);
            }
        });
    }

    const text4 = 'SELECT GuildUsers.userid, wantsattention, GuildUsers.guildid, birthdayroleid, announcementchannelid FROM GuildUsers INNER JOIN Users ON GuildUsers.userid = Users.userid INNER JOIN Guilds ON GuildUsers.guildid = Guilds.guildid WHERE hasrole = true AND NOT (birthmonth = $1 AND birthdate = $2) AND active = true';
    const values4 = [currentMonth, currentDay];

    const unbirthdaypeople = await pool.query(text4, values4);

    if(unbirthdaypeople.rowCount > 0) {
        unbirthdaypeople.rows.forEach(person => {
            let guildid = person.guildid;
            let userid = person.userid;
            let roleid = person.birthdayroleid;

            handleUnbirthday(guildid, userid, roleid);
        });
    }

    console.log('Update finished');
}

/*
async function update(message) {
    const userText = 'SELECT * FROM Users';

    const userRegistry = await pool.query(userText);

    const channel = await message.guild.channels.fetch(auth.channelid);
    const today = new Date();
    const currentMonth = today.getMonth() + 1;
    const currentDay = today.getDate();
    
    userRegistry.rows.forEach(member => {
        let month = member.birthmonth;
        let day = member.birthdate;

        if(month === currentMonth && day === currentDay) {
            addRole(message, member.userid);
            if(member.wantsattention === true) {
                channel.send(`@everyone Today is ${member.username}'s birthday!!!`);
            }
        }
        else {
            removeRole(message, member.userid);
        }
    });
}
*/

async function isPresentUser(userId) {
    const text = 'SELECT * FROM Users WHERE userid = $1';
    const values = [userId];
    const result = await pool.query(text, values);

    if(result.rowCount > 0) {
        return true;
    }

    return false;
}

async function isPresentGuildUser(userId, guildId) {
    const text = 'SELECT * FROM GuildUsers WHERE userid = $1 AND guildid = $2';
    const values = [userId, guildId];
    const result = await pool.query(text, values);

    if (result.rowCount > 0) {
        return true;
    }

    return false;
}

async function checkAdminAuthor(author, guild) {
    const text = 'SELECT * FROM GuildUsers WHERE userid = $1 AND guildid = $2 AND admin = true';
    const values = [author.id, guild.id];

    const result = await pool.query(text, values);
    
    if(result.rowCount > 0) {
        return true;
    }
    return false;
}

function validateNumber(num) {
    const pattern = /^[0-9]*$/;

    return pattern.test(num);
}

function validateChannelString(string) {
    const pattern = /^<#[0-9]*>$/;

    return pattern.test(string);
}

function validateRoleString(string) {
    const pattern = /^<@&[0-9]*>$/;

    return pattern.test(string);
}

function validateDate(month, day) {
    let numDays = -1;
    month = parseInt(month);
    switch(month) {
        case 1:
            numDays = 31;
            break;
        case 2:
            numDays = 29;
            break;
        case 3:
            numDays = 31;
            break;
        case 4:
            numDays = 30;
            break;
        case 5:
            numDays = 31;
            break;
        case 6:
            numDays = 30;
            break;
        case 7:
            numDays = 31;
            break;
        case 8:
            numDays = 31;
            break;
        case 9:
            numDays = 30;
            break;
        case 10:
            numDays = 31;
            break;
        case 11:
            numDays = 30;
            break;
        case 12:
            numDays = 31;
            break;
        default:
            return false;
    }
    if(day < 1 || day > numDays) {
        return false;
    }
    return true;
}