# nerdbot
A Discord bot I made for some friends.

Welcome to NerdBot! NerdBot is a service with an ever-growing list of features which are geared toward a more automated form of server management. Current features include remembering birthdays, posting announcements about them and providing the birthday person with a special role on their special day!

Some features I intend to implement down the line:
-Text channel message cleanup
-Event planning
-Role selection

How can one use NerdBot?

Excellent question. There are several commands which can be used to interact with NerdBot, including:
&register birth_month birth_date: Once a server has NerdBot, a user can run this command to be added to its global registry and the current server they are in. This command only needs to be run once per user.

&addme: Once a user is registered with NerdBot, they can add to the per-server registry and adjust their personalized settings for each server they are in. This command needs to be run once per server shared with NerdBot and is automatically run when registering.

&unregister: The complement to &register. Running this will irreversibly remove you from the global registry and, consequently, all server registries. If a user runs this command they will need to register again and add to all of their added servers again.

&removeme: The complement to &addme. Running this will irreversibly remove you from the server registry of the server it is run in. The user can add again with &addme, but their settings will be restored to defaults and may need to be changed.

&togglemessage: This toggles whether announcements pertaining to the user running the command will be sent or not. Messages are activated by default.

&status: Sends the running user a private message containing information about their provided birthday, their admin status within a server, and whether their messages are activated or not.

&ping: Checks NerdBot's availability and uptime statistics.

&roll or &r: Roll some dice! The current syntax for rolling dice is as follows: &roll [number of dice]d[number of sides][+|-][modifier]. Number of dice and modifier are optional, they will default to 1 and +0 respectively if not specified. The result will be given as the total, a parenthetical breakdown of the individual die rolls, and the added (or subtracted) modifier at the end.
