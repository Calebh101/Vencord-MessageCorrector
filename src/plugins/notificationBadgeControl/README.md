# About

What does this plugin do? It gives you control over the app's notification badge.

I've found it annoying how Discord displays a period when you have unread messages, so I was like "hmm, how do I control this?" So I made this. It lets you define when to show the placeholder (the period), when to show the unread notification count, and it even gives you the ability to use your own logic in JavaScript.

It works by patching the function that says what to render. Basically it's controlled by a number, with several different meanings:

- -1: Placeholder
- 0: No badge
- \>1: Unread count

And by patching said function which returns said number, we can manipulate what ends up showing. Hope it's useful!

# Info

## Custom logic

Custom logic instead of the default provided by this plugin. This function *must* be valid JavaScript, and *must* be of this type:

```ts
(mentions: number, other: number, hasUnread: boolean, disabled: boolean) => number
```

Don't do this unless you know what you're doing. This will override all other settings that use the default logic.

For reference, -1 means show the placeholder, 0 means don't show a badge, and above 0 means show a badge with the returned number.

Arguments:
- `mentions` and `other`: See notes in [What Are Notifs?](#what-are-notifs).
- `hasUnread`: If there are unread messages for the user. This includes literally any server or any DM having a message that's not marked as read.
- `disabled`: This seems to be a variable of Discord's. For this reason, this plugin does not use it by default.

Here's a template to get started:

```javascript
(mentions, other, hasUnread, disabled) => { /* ... */ }
```

## What Are Notifs?

Discord gives us 2 variables to work with.

- `mentions`: Probably all user mentions, role mentions, and ping-replies.
- `other`: I think this are the other things like friend requests. Not too sure about this one.

# Authors

- Calebh101
